-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "accessExpiresAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "accessHash" TEXT,
ADD COLUMN     "client" TEXT NOT NULL DEFAULT 'website',
ADD COLUMN     "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "stateHash" TEXT NOT NULL,
    "bindingHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "googleVerifier" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "attempt" TEXT,
    "challenge" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("stateHash")
);

-- CreateTable
CREATE TABLE "LoginExchange" (
    "codeHash" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "challenge" TEXT NOT NULL,
    "attempt" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "LoginExchange_pkey" PRIMARY KEY ("codeHash")
);

-- CreateTable
CREATE TABLE "RefreshCredential" (
    "tokenHash" TEXT NOT NULL,
    "sessionId" UUID NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RefreshCredential_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE INDEX "RefreshCredential_sessionId_idx" ON "RefreshCredential"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_accessHash_key" ON "Session"("accessHash");

-- AddForeignKey
ALTER TABLE "LoginExchange" ADD CONSTRAINT "LoginExchange_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Infrastructure-era sessions have no access credential or refresh history; require a new login.
UPDATE "Session" SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP);
