import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/** The caller owns connection lifecycle; no database connection is made on import. */
export function createDatabaseClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5_000 });
  return new PrismaClient({ adapter });
}
