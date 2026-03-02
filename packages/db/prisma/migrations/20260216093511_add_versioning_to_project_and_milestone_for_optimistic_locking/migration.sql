-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProjectMilestone" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
