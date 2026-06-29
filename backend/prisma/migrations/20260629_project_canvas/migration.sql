-- Project Overview Canvas: switchable projects with business-model-canvas blocks and features

CREATE TABLE "CanvasProject" (
  "id" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanvasProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanvasBlock" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanvasBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanvasFeature" (
  "id" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanvasFeature_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CanvasProject" ADD CONSTRAINT "CanvasProject_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasBlock" ADD CONSTRAINT "CanvasBlock_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "CanvasProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasFeature" ADD CONSTRAINT "CanvasFeature_blockId_fkey"
  FOREIGN KEY ("blockId") REFERENCES "CanvasBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CanvasProject_boardId_idx" ON "CanvasProject"("boardId");
CREATE INDEX "CanvasBlock_projectId_idx" ON "CanvasBlock"("projectId");
CREATE INDEX "CanvasFeature_blockId_idx" ON "CanvasFeature"("blockId");
