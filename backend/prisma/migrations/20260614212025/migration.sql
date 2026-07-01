/*
  Warnings:

  - Added the required column `type` to the `Conversations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConvoType" AS ENUM ('Group', 'Single');

-- AlterTable
ALTER TABLE "Conversations" ADD COLUMN     "GroupName" TEXT,
ADD COLUMN     "type" "ConvoType" NOT NULL;
