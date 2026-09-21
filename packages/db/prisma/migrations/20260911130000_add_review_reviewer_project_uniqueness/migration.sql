-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewerId_projectId_key" ON "Review"("reviewerId", "projectId");
