import { createRemoteJWKSet, customFetch, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { ApiEnvironment } from '../config/environment';
import { ApiException } from '../http/api-error';
import { verifierChallenge } from './credentials';

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GOOGLE_KEYS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Isolates Google communication from persisted Filecab authentication rules. */
export interface GoogleIdentityProvider {
  authorizationUrl(state: string, nonce: string, verifier: string): string;
  exchange(code: string, nonce: string, verifier: string): Promise<string>;
}

/** Bounds Google token and signing-key downloads without logging their private contents. */
async function boundedGoogleFetch(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  try {
    const response = await fetch(args[0], {
      ...args[1],
      redirect: 'error',
      signal: args[1]?.signal ?? AbortSignal.timeout(5000),
    });

    if (response.status >= 500 || response.status === 429) throw new Error('Upstream unavailable');

    const reader = response.body?.getReader();

    if (!reader) throw new Error('Missing body');

    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        size += value.byteLength;

        if (size > 65536) throw new Error('Oversized response');

        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }

    return new Response(Buffer.concat(chunks), {
      status: response.status,
      headers: response.headers,
    });
  } catch {
    throw new ApiException(
      503,
      'SERVICE_UNAVAILABLE',
      'Google login is temporarily unavailable',
      true,
    );
  }
}

/** Verifies signed identity claims, including the login-specific nonce and authorized party. */
export async function verifyGoogleIdentity(
  token: string,
  audience: string,
  nonce: string,
  keys: JWTVerifyGetKey,
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer: GOOGLE_ISSUERS,
      audience,
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
      maxTokenAge: '10m',
    });

    if (
      payload.nonce !== nonce ||
      (payload.azp !== undefined && payload.azp !== audience) ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== audience) ||
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      payload.sub.length > 255
    )
      throw new Error('Invalid claims');

    return payload.sub;
  } catch (error) {
    if (error instanceof ApiException) throw error;

    throw new ApiException(401, 'UNAUTHORIZED', 'Google identity could not be verified');
  }
}

/** Implements the Google code flow without exposing or retaining upstream credentials. */
export class GoogleOAuthProvider implements GoogleIdentityProvider {
  private readonly keys = createRemoteJWKSet(GOOGLE_KEYS_URL, {
    timeoutDuration: 5000,
    cooldownDuration: 30000,
    [customFetch]: boundedGoogleFetch,
  });

  constructor(private readonly environment: ApiEnvironment) {}

  authorizationUrl(state: string, nonce: string, verifier: string): string {
    const url = new URL(GOOGLE_AUTHORIZATION_URL);
    url.search = new URLSearchParams({
      client_id: this.environment.google.clientId!,
      redirect_uri: this.environment.google.callbackUrl!,
      response_type: 'code',
      scope: 'openid',
      state,
      nonce,
      code_challenge: verifierChallenge(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();

    return url.href;
  }

  async exchange(code: string, nonce: string, verifier: string): Promise<string> {
    let token: unknown;
    try {
      const response = await boundedGoogleFetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.environment.google.clientId!,
          client_secret: this.environment.google.clientSecret!,
          redirect_uri: this.environment.google.callbackUrl!,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      });

      if (!response.ok)
        throw new ApiException(401, 'UNAUTHORIZED', 'Google authorization was rejected');

      const body: unknown = await response.json();

      if (typeof body !== 'object' || body === null || !('id_token' in body))
        throw new Error('Missing identity token');

      token = body.id_token;
    } catch (error) {
      if (error instanceof ApiException) throw error;

      throw new ApiException(
        503,
        'SERVICE_UNAVAILABLE',
        'Google login is temporarily unavailable',
        true,
      );
    }

    if (typeof token !== 'string' || token.length > 32768)
      throw new ApiException(401, 'UNAUTHORIZED', 'Google identity could not be verified');

    return verifyGoogleIdentity(token, this.environment.google.clientId!, nonce, this.keys);
  }
}
