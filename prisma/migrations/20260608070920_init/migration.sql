-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'PUBLIC',
    "collectRule" TEXT NOT NULL DEFAULT '{}',
    "collectFrequency" TEXT NOT NULL DEFAULT '0 2 * * *',
    "defaultPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "rawItems" TEXT NOT NULL DEFAULT '[]',
    "processedContent" TEXT,
    "promptUsed" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "aiModel" TEXT,
    "contentHash" TEXT,
    "processingMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_reports_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "push_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportDate" DATETIME NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'FEISHU',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");

-- CreateIndex
CREATE INDEX "daily_reports_contentHash_idx" ON "daily_reports"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_channelId_reportDate_key" ON "daily_reports"("channelId", "reportDate");

-- CreateIndex
CREATE INDEX "push_logs_reportDate_idx" ON "push_logs"("reportDate");

-- CreateIndex
CREATE INDEX "push_logs_status_idx" ON "push_logs"("status");
