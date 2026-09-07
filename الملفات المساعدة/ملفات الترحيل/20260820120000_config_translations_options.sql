-- طبقة الإعدادات والمحتوى المُدار من قاعدة البيانات
-- (الترجمات + قوائم الخيارات + إعدادات النظام)

CREATE TABLE IF NOT EXISTS "Translation" (
  "id"        TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "ar"        TEXT NOT NULL,
  "en"        TEXT NOT NULL,
  "category"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Translation_key_key" ON "Translation"("key");
CREATE INDEX IF NOT EXISTS "Translation_category_idx" ON "Translation"("category");

CREATE TABLE IF NOT EXISTS "OptionItem" (
  "id"        TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "labelAr"   TEXT NOT NULL,
  "labelEn"   TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OptionItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OptionItem_category_value_key" ON "OptionItem"("category", "value");
CREATE INDEX IF NOT EXISTS "OptionItem_category_isActive_sortOrder_idx" ON "OptionItem"("category", "isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "category"  TEXT,
  "label"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "AppSetting_category_idx" ON "AppSetting"("category");
