BEGIN;
CREATE TABLE "RequestLimit" (
  "keyHash" CHAR(64) PRIMARY KEY,
  "hits" INTEGER NOT NULL CHECK ("hits" > 0),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RequestLimit_hash_check" CHECK ("keyHash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "RequestLimit_expiresAt_idx" ON "RequestLimit"("expiresAt");
COMMIT;
