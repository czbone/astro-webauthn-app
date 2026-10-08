CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password TEXT,
  role TEXT
);

CREATE TABLE IF NOT EXISTS "App" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  "redirectUris" TEXT[] NOT NULL
);

CREATE TABLE IF NOT EXISTS "AppGrant" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User" (id) ON DELETE CASCADE,
  "appId" TEXT NOT NULL REFERENCES "App" (id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  UNIQUE ("userId", "appId")
);

CREATE INDEX IF NOT EXISTS "AppGrant_appId_idx" ON "AppGrant" ("appId");

CREATE TABLE IF NOT EXISTS "WebAuthnCredential" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "WebAuthnCredential_userId_idx" ON "WebAuthnCredential" ("userId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role TEXT;
