-- CreateTable
CREATE TABLE "IdeaBookAttachment" (
    "id" TEXT NOT NULL,
    "ideaBookId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaBookAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaBookAttachment_ideaBookId_idx" ON "IdeaBookAttachment"("ideaBookId");

-- CreateIndex
CREATE INDEX "IdeaBookAttachment_createdAt_idx" ON "IdeaBookAttachment"("createdAt");

-- CreateIndex
CREATE INDEX "IdeaBook_clientId_idx" ON "IdeaBook"("clientId");

-- CreateIndex
CREATE INDEX "IdeaBook_createdAt_idx" ON "IdeaBook"("createdAt");

-- AddForeignKey
ALTER TABLE "IdeaBookAttachment" ADD CONSTRAINT "IdeaBookAttachment_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
