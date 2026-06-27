-- تقارير الافتتاح/الاختتام الاختيارية (الدورات الداخلية): تمييز التفعيل التطوّعي من الموظف
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "openingReportVoluntary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "closingReportVoluntary" BOOLEAN NOT NULL DEFAULT false;
