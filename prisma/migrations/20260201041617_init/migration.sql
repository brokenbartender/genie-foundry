-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problem" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "stack" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "deliverables" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
