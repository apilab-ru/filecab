-- Adds a shared request log for provider rate limits (25 November 2026).
-- CreateTable
CREATE TABLE "ProviderRequestSlot" (
    "id" BIGSERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "takenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderRequestSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderRequestSlot_provider_takenAt_idx" ON "ProviderRequestSlot"("provider", "takenAt");
