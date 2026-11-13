import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// قاعدتا البيانات تختلفان في نوع المعرّفات: UUID في نسخة فيرسل، ونصّي
// في خادم الجامعة. فالترحيل الذي يكتب UUID صريحاً لعمود يشير إلى جدول
// أساسي يفشل على خادم الجامعة ويوقف النشر — ويبقى مسجّلاً «فاشلاً»
// فيمنع كل نشر بعده حتى يتدخّل فنّي يدوياً.

const DIR = path.join(process.cwd(), 'prisma', 'migrations');
// ما قبل هذه القاعدة كُتب قبل اكتشاف الفرق وطُبّق على القاعدتين
const FROM = '20261112';

const newMigrations = fs
  .readdirSync(DIR)
  .filter((d) => d >= FROM && fs.existsSync(path.join(DIR, d, 'migration.sql')))
  .map((d) => ({
    name: d,
    // التعليقات لا تُنفَّذ، فلا تُحتسب
    sql: fs.readFileSync(path.join(DIR, d, 'migration.sql'), 'utf8').replace(/--.*$/gm, ''),
  }));

describe('ترحيلات قاعدة البيانات — تصحّ على القاعدتين', () => {
  it('توجد ترحيلات جديدة تخضع للفحص', () => {
    expect(newMigrations.length).toBeGreaterThan(0);
  });

  it.each(newMigrations.map((m) => [m.name, m.sql]))(
    '%s: لا يكتب نوع UUID صريحاً لعمود، بل يأخذ النوع من الجدول المشار إليه',
    (_name, sql) => {
      // "عمود" UUID  أو  ADD COLUMN ... UUID  أو  ::UUID
      expect(sql).not.toMatch(/"\w+"\s+UUID\b/i);
      expect(sql).not.toMatch(/ADD COLUMN[^;]*\bUUID\b/i);
      expect(sql).not.toMatch(/::\s*UUID\b/i);
    },
  );
});
