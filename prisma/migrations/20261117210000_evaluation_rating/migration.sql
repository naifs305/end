-- تقدير المدير في التقييم السنوي (جدول مستقل بلا روابط خارجية)
CREATE TABLE IF NOT EXISTS "EvaluationRating" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" DOUBLE PRECISION NOT NULL,
  "ratedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationRating_year_userId_key" ON "EvaluationRating"("year", "userId");
CREATE INDEX IF NOT EXISTS "EvaluationRating_year_idx" ON "EvaluationRating"("year");
