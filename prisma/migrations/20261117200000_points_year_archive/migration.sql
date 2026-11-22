-- رصيد الإنجاز: أرشيف السنوات المنقضية (جدول مستقل بلا روابط خارجية)
CREATE TABLE IF NOT EXISTS "PointsYearArchive" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "rank" INTEGER NOT NULL,
  "summary" JSONB NOT NULL,
  "entries" JSONB NOT NULL,
  "rulesVersion" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedById" TEXT,
  CONSTRAINT "PointsYearArchive_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointsYearArchive_year_userId_key" ON "PointsYearArchive"("year", "userId");
CREATE INDEX IF NOT EXISTS "PointsYearArchive_year_idx" ON "PointsYearArchive"("year");
