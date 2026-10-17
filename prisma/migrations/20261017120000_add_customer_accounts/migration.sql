-- Add persistent credentials to web customers while keeping Telegram users
-- and legacy browser-scoped users compatible.
ALTER TABLE "User"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "CustomerActivity" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerActivity_userId_createdAt_idx"
  ON "CustomerActivity"("userId", "createdAt");

ALTER TABLE "CustomerActivity"
  ADD CONSTRAINT "CustomerActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
