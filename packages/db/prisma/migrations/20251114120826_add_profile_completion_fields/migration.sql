-- AlterTable
ALTER TABLE "_MessageThreadUsers" ADD CONSTRAINT "_MessageThreadUsers_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_MessageThreadUsers_AB_unique";
