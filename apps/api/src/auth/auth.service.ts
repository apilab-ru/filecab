import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { ExtensionSession } from '@filecab/contracts';
import { randomUUID } from 'node:crypto';
import type { Prisma, Session } from '../generated/prisma/client';
import { createDatabaseClient } from '../database/client';
import type { ApiEnvironment } from '../config/environment';
import { ApiException } from '../http/api-error';
import {
  AUTH_ENVIRONMENT,
  GOOGLE_IDENTITY,
  AuthClient,
  randomCredential,
  credentialHash,
  verifierChallenge,
} from './credentials';
import type { GoogleIdentityProvider } from './google';

/** Carries the authenticated account and session, never a submitted owner field. */
export interface AuthIdentity {
  ownerId: string;
  sessionId: string;
  client: string;
}

/** Carries new opaque tokens only to the cookie writer or privileged extension. */
export interface SessionTokens extends ExtensionSession {}

/** Rejects authentication failures without revealing account or credential existence. */
function unauthorized(): ApiException {
  return new ApiException(401, 'UNAUTHORIZED', 'Authentication required');
}

/** Persists browser-bound login, owner identity and transactional session rotation. */
@Injectable()
export class AuthService implements OnModuleDestroy {
  readonly database;

  constructor(
    @Inject(AUTH_ENVIRONMENT) readonly environment: ApiEnvironment,
    @Inject(GOOGLE_IDENTITY) private readonly google: GoogleIdentityProvider,
  ) {
    this.database = createDatabaseClient(environment.databaseUrl);
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }

  private hash(value: string): string {
    return credentialHash(value, this.environment.sessionSecret);
  }

  private assertEnabled(): void {
    if (!this.environment.google.enabled)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Google login is disabled');
  }

  async start(client: AuthClient, returnTo: string, challenge?: string, attempt?: string) {
    this.assertEnabled();
    const allowed =
      client === AuthClient.Website
        ? this.environment.websiteOrigins.map((origin) => `${origin}/`)
        : this.environment.extensionOrigins.map(
            (origin) =>
              `https://${origin.slice('chrome-extension://'.length)}.chromiumapp.org/filecab`,
          );

    if (
      !allowed.includes(returnTo) ||
      (client === AuthClient.Extension && (!challenge || !attempt)) ||
      (client === AuthClient.Website && (challenge || attempt))
    )
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'Invalid login destination or attempt binding',
      );

    const state = randomCredential();
    const binding = randomCredential();
    const nonce = randomCredential();
    const googleVerifier = randomCredential();
    await this.database.loginAttempt.create({
      data: {
        stateHash: this.hash(state),
        bindingHash: this.hash(binding),
        nonce,
        googleVerifier,
        client,
        returnTo,
        challenge,
        attempt,
        expiresAt: new Date(Date.now() + this.environment.auth.loginSeconds * 1000),
      },
    });

    return { binding, url: this.google.authorizationUrl(state, nonce, googleVerifier) };
  }

  async callback(state: string, binding: string, code?: string, denied = false) {
    this.assertEnabled();
    const now = new Date();
    const stateHash = this.hash(state);
    const consumed = await this.database.loginAttempt.updateMany({
      where: {
        stateHash,
        bindingHash: this.hash(binding),
        expiresAt: { gt: now },
        consumedAt: null,
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) throw unauthorized();

    const login = await this.database.loginAttempt.findUniqueOrThrow({ where: { stateHash } });

    if (denied || !code) throw unauthorized();

    const subject = await this.google.exchange(code, login.nonce, login.googleVerifier);
    // Nested account/library upserts can race on a new Google subject: re-read the winner.
    const owner = await this.database.user
      .upsert({
        where: { googleSubject: subject },
        create: { id: randomUUID(), googleSubject: subject, library: { create: {} } },
        update: {},
      })
      .catch(async (error: unknown) => {
        if (
          typeof error !== 'object' ||
          error === null ||
          !('code' in error) ||
          error.code !== 'P2002'
        )
          throw error;

        return this.database.user.findUniqueOrThrow({ where: { googleSubject: subject } });
      });

    if (login.client === AuthClient.Website) {
      const tokens = await this.database.$transaction(async (tx) => {
        await this.lockOwner(tx, owner.id);

        return this.issue(tx, owner.id, AuthClient.Website);
      });

      return { client: AuthClient.Website, returnTo: login.returnTo, tokens };
    }

    const exchangeCode = randomCredential();
    await this.database.loginExchange.create({
      data: {
        codeHash: this.hash(exchangeCode),
        ownerId: owner.id,
        challenge: login.challenge!,
        attempt: login.attempt!,
        expiresAt: new Date(Date.now() + this.environment.auth.exchangeSeconds * 1000),
      },
    });
    const destination = new URL(login.returnTo);
    destination.searchParams.set('code', exchangeCode);
    destination.searchParams.set('attempt', login.attempt!);

    return { client: AuthClient.Extension, returnTo: destination.href, tokens: null };
  }

  private async lockOwner(tx: Prisma.TransactionClient, ownerId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId}::uuid FOR UPDATE`;
  }

  private async issue(
    tx: Prisma.TransactionClient,
    ownerId: string,
    client: AuthClient,
    previous?: Session,
  ): Promise<SessionTokens> {
    const now = Date.now();
    const accessToken = randomCredential();
    const refreshToken = randomCredential();
    const expiresAt =
      previous?.expiresAt ?? new Date(now + this.environment.auth.sessionSeconds * 1000);
    const idleExpiresAt = new Date(
      Math.min(expiresAt.getTime(), now + this.environment.auth.idleSeconds * 1000),
    );
    const accessExpiresAt = new Date(
      Math.min(idleExpiresAt.getTime(), now + this.environment.auth.accessSeconds * 1000),
    );
    const data = {
      accessHash: this.hash(accessToken),
      refreshHash: this.hash(refreshToken),
      accessExpiresAt,
      idleExpiresAt,
    };
    const session = previous
      ? await tx.session.update({ where: { id: previous.id }, data })
      : await tx.session.create({
          data: { id: randomUUID(), ownerId, client, expiresAt, ...data },
        });
    await tx.refreshCredential.create({
      data: { tokenHash: data.refreshHash, sessionId: session.id },
    });

    return {
      schemaVersion: 1,
      ownerId,
      accessToken,
      refreshToken,
      accessExpiresAt: accessExpiresAt.toISOString(),
      sessionExpiresAt: expiresAt.toISOString(),
    };
  }

  async exchange(code: string, attempt: string, verifier: string): Promise<SessionTokens> {
    this.assertEnabled();
    const tokens = await this.database.$transaction(async (tx) => {
      const codeHash = this.hash(code);
      const exchange = await tx.loginExchange.findUnique({ where: { codeHash } });

      if (
        !exchange ||
        exchange.attempt !== attempt ||
        exchange.challenge !== verifierChallenge(verifier)
      )
        return null;

      await this.lockOwner(tx, exchange.ownerId);
      const consumed = await tx.loginExchange.updateMany({
        where: { codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });

      if (consumed.count !== 1) return null;

      return this.issue(tx, exchange.ownerId, AuthClient.Extension);
    });

    if (!tokens) throw unauthorized();

    return tokens;
  }

  async authenticate(token: string, client: AuthClient): Promise<AuthIdentity> {
    const session = await this.database.session.findUnique({
      where: { accessHash: this.hash(token) },
    });
    const now = new Date();

    if (
      !session ||
      session.client !== client ||
      session.revokedAt ||
      session.accessExpiresAt <= now ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now
    )
      throw unauthorized();

    return { ownerId: session.ownerId, sessionId: session.id, client: session.client };
  }

  async refresh(token: string, client: AuthClient): Promise<SessionTokens> {
    const result = await this.database.$transaction(async (tx) => {
      const credential = await tx.refreshCredential.findUnique({
        where: { tokenHash: this.hash(token) },
        include: { session: true },
      });

      if (!credential || credential.session.client !== client) return null;

      await this.lockOwner(tx, credential.session.ownerId);
      const session = await tx.session.findUniqueOrThrow({ where: { id: credential.sessionId } });
      const current = await tx.refreshCredential.findUniqueOrThrow({
        where: { tokenHash: credential.tokenHash },
      });
      const now = new Date();

      if (current.consumedAt || session.refreshHash !== credential.tokenHash) {
        await tx.session.update({ where: { id: session.id }, data: { revokedAt: now } });

        return null;
      }

      if (session.revokedAt || session.expiresAt <= now || session.idleExpiresAt <= now)
        return null;

      await tx.refreshCredential.update({
        where: { tokenHash: credential.tokenHash },
        data: { consumedAt: now },
      });

      return this.issue(tx, session.ownerId, client, session);
    });

    // Throw outside the transaction so replay revocation is committed.
    if (!result) throw unauthorized();

    return result;
  }

  async logout(identity: AuthIdentity, all: boolean): Promise<void> {
    await this.database.$transaction(async (tx) => {
      await this.lockOwner(tx, identity.ownerId);
      await tx.session.updateMany({
        where: { ownerId: identity.ownerId, ...(all ? {} : { id: identity.sessionId }) },
        data: { revokedAt: new Date() },
      });
    });
  }
}
