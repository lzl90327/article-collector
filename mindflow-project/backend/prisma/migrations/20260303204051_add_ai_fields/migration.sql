-- AlterTable
ALTER TABLE "sources" ADD COLUMN "aiStatus" TEXT DEFAULT 'pending';
ALTER TABLE "sources" ADD COLUMN "viewpoints" TEXT;

-- CreateIndex
CREATE INDEX "sources_aiStatus_idx" ON "sources"("aiStatus");
