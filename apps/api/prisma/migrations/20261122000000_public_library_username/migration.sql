-- Adds the optional public library username (22 November 2026).
ALTER TABLE "User" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User" ADD CONSTRAINT "User_username_format"
  CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9][a-z0-9_-]{2,31}$');
