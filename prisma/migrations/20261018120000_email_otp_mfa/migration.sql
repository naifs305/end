-- التحقق الثنائي عبر البريد (OTP): رمز لمرة واحدة يُخزَّن مُجزّأً (HMAC) لا نصاً صريحاً،
-- مع وقت انتهاء وعدّاد محاولات خاطئة.
ALTER TABLE "User" ADD COLUMN "otpHash" TEXT;
ALTER TABLE "User" ADD COLUMN "otpExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0;
