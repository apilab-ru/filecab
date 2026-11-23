-- Adds external list connections, mappings and durable export and import jobs (24 November 2026).
-- CreateTable
CREATE TABLE "ListSyncConnection" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "credentials" TEXT,
    "scopes" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "lastExportAt" TIMESTAMPTZ(3),
    "lastImportAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListSyncConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListSyncAuthorization" (
    "stateHash" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ListSyncAuthorization_pkey" PRIMARY KEY ("stateHash")
);

-- CreateTable
CREATE TABLE "ListSyncItem" (
    "connectionId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "remoteRecordId" TEXT NOT NULL,
    "acknowledged" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ListSyncItem_pkey" PRIMARY KEY ("connectionId","entryId")
);

-- CreateTable
CREATE TABLE "ListSyncJob" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "previewOpen" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ListSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListSyncConnection_ownerId_provider_key" ON "ListSyncConnection"("ownerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ListSyncConnection_provider_accountId_key" ON "ListSyncConnection"("provider", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ListSyncItem_connectionId_remoteRecordId_key" ON "ListSyncItem"("connectionId", "remoteRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ListSyncItem_connectionId_namespace_entity_externalId_key" ON "ListSyncItem"("connectionId", "namespace", "entity", "externalId");

-- CreateIndex
CREATE INDEX "ListSyncJob_state_runAfter_idx" ON "ListSyncJob"("state", "runAfter");

-- CreateIndex
CREATE INDEX "ListSyncJob_connectionId_createdAt_idx" ON "ListSyncJob"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListSyncConnection" ADD CONSTRAINT "ListSyncConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListSyncAuthorization" ADD CONSTRAINT "ListSyncAuthorization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListSyncItem" ADD CONSTRAINT "ListSyncItem_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ListSyncConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListSyncJob" ADD CONSTRAINT "ListSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ListSyncConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One queued or running job for each connection.
CREATE UNIQUE INDEX "ListSyncJob_active_connection_key" ON "ListSyncJob"("connectionId")
  WHERE "state" IN ('queued', 'running');

ALTER TABLE "ListSyncConnection" ADD CONSTRAINT "ListSyncConnection_state_value"
  CHECK ("state" IN ('active', 'paused', 'authorization-required'));

ALTER TABLE "ListSyncJob" ADD CONSTRAINT "ListSyncJob_kind_value"
  CHECK ("kind" IN ('export', 'import-preview', 'import-apply'));

ALTER TABLE "ListSyncJob" ADD CONSTRAINT "ListSyncJob_state_value"
  CHECK ("state" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'));
