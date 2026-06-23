-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "displayName" TEXT,
    "feishuWebhook" TEXT,
    "emailAddress" TEXT,
    "emailNotify" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "applyReason" TEXT NOT NULL,
    "customPrompt" TEXT,
    "promptStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "adminNote" TEXT,
    "activatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT,
    "reportDate" DATETIME NOT NULL,
    "rawItems" TEXT NOT NULL DEFAULT '[]',
    "processedContent" TEXT,
    "promptUsed" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "aiModel" TEXT,
    "contentHash" TEXT,
    "processingMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_reports_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "daily_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_daily_reports" ("aiModel", "channelId", "contentHash", "createdAt", "id", "itemCount", "processedContent", "processingMs", "promptUsed", "rawItems", "reportDate") SELECT "aiModel", "channelId", "contentHash", "createdAt", "id", "itemCount", "processedContent", "processingMs", "promptUsed", "rawItems", "reportDate" FROM "daily_reports";
DROP TABLE "daily_reports";
ALTER TABLE "new_daily_reports" RENAME TO "daily_reports";
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");
CREATE INDEX "daily_reports_contentHash_idx" ON "daily_reports"("contentHash");
CREATE INDEX "daily_reports_userId_idx" ON "daily_reports"("userId");
CREATE TABLE "new_push_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "reportDate" DATETIME NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'FEISHU',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_push_logs" ("channel", "createdAt", "errorMsg", "id", "reportDate", "sentAt", "status") SELECT "channel", "createdAt", "errorMsg", "id", "reportDate", "sentAt", "status" FROM "push_logs";
DROP TABLE "push_logs";
ALTER TABLE "new_push_logs" RENAME TO "push_logs";
CREATE INDEX "push_logs_reportDate_idx" ON "push_logs"("reportDate");
CREATE INDEX "push_logs_status_idx" ON "push_logs"("status");
CREATE INDEX "push_logs_userId_idx" ON "push_logs"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_channelId_idx" ON "subscriptions"("channelId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_channelId_key" ON "subscriptions"("userId", "channelId");
