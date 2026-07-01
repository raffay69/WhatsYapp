-- CreateTable
CREATE TABLE "Failed" (
    "id" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "originalError" TEXT NOT NULL,
    "latestError" TEXT NOT NULL,
    "originalTopic" TEXT NOT NULL,
    "originalPartition" TEXT NOT NULL,
    "failedAt" TEXT NOT NULL,

    CONSTRAINT "Failed_pkey" PRIMARY KEY ("id")
);
