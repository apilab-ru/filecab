import type { OnModuleDestroy } from '@nestjs/common';
import { createDatabaseClient } from '../database/client';

export const DATABASE_READINESS = Symbol('DATABASE_READINESS');

/** Supplies a bounded database-only readiness probe and an optional lifecycle cleanup. */
export interface DatabaseReadiness {
  check(): Promise<void>;
}

/** Opens PostgreSQL lazily so provider/database outages cannot affect liveness. */
export class PostgresReadiness implements DatabaseReadiness, OnModuleDestroy {
  private readonly database;

  constructor(connectionString: string) {
    this.database = createDatabaseClient(connectionString);
  }

  async check(): Promise<void> {
    await this.database.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
        await tx.$queryRaw`SELECT 1`;
      },
      { maxWait: 2000, timeout: 3000 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}
