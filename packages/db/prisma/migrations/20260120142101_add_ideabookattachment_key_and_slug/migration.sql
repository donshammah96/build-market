/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `IdeaBook` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key]` on the table `IdeaBookAttachment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `IdeaBook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `IdeaBookAttachment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "IdeaBook" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "IdeaBookAttachment" ADD COLUMN     "key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBook_slug_key" ON "IdeaBook"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBookAttachment_key_key" ON "IdeaBookAttachment"("key");
