import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Garante que todas as tabelas do SQLite existam no dev.db sem depender de comandos manuais no terminal.
 */
export async function ensureDatabaseTables(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "JobOpportunity" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "messageId" TEXT NOT NULL,
          "groupName" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "company" TEXT,
          "location" TEXT,
          "modality" TEXT NOT NULL DEFAULT 'PRESENCIAL',
          "salary" REAL,
          "salaryText" TEXT,
          "description" TEXT NOT NULL,
          "requirements" TEXT,
          "contactInfo" TEXT,
          "applicationUrl" TEXT,
          "originalMessage" TEXT NOT NULL,
          "publishedAt" DATETIME NOT NULL,
          "expiresAt" DATETIME,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "JobOpportunity_messageId_key" ON "JobOpportunity"("messageId");
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CandidateProfile" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "messageId" TEXT NOT NULL,
          "groupName" TEXT NOT NULL,
          "fullName" TEXT NOT NULL,
          "targetRole" TEXT NOT NULL,
          "experienceSummary" TEXT NOT NULL,
          "skills" TEXT,
          "location" TEXT,
          "contactPhone" TEXT NOT NULL,
          "contactEmail" TEXT,
          "attachmentUrl" TEXT,
          "originalMessage" TEXT NOT NULL,
          "publishedAt" DATETIME NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "CandidateProfile_messageId_key" ON "CandidateProfile"("messageId");
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GroupMember" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "phone" TEXT NOT NULL,
          "name" TEXT,
          "groupName" TEXT NOT NULL,
          "isAuthorized" BOOLEAN NOT NULL DEFAULT 1,
          "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_phone_key" ON "GroupMember"("phone");
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuthOtp" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "phone" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "used" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsAppSession" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
          "qrCodeData" TEXT,
          "phoneConnected" TEXT,
          "lastActiveAt" DATETIME,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SyncLog" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "groupName" TEXT NOT NULL,
          "messageType" TEXT NOT NULL,
          "summary" TEXT NOT NULL,
          "success" BOOLEAN NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      isInitialized = true;
    } catch (err) {
      console.error("[prisma] Erro ao auto-inicializar tabelas no banco de dados SQLite:", err);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}
