/*
  Warnings:

  - The `Members` column on the `Conversations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Conversations" DROP COLUMN "Members",
ADD COLUMN     "Members" JSONB[];
