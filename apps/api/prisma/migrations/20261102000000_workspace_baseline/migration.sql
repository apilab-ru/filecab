CREATE TABLE "workspace_state" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_state_pkey" PRIMARY KEY ("id")
);

INSERT INTO "workspace_state" ("id") VALUES ('baseline');
