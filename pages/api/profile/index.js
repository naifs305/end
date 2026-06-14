// =============================================================
// GET/PATCH /api/profile
// -------------------------------------------------------------
// الملف الشخصي للمستخدم الحالي: عرض/تعديل الاسم، الهاتف،
// التحويلة، الصورة الشخصية، والتوقيع الإلكتروني.
// لا يسمح بتعديل الدور (roles) — هذا حصري للمدير عبر /api/users/[id]
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const { isNonEmptyString, isValidMobile } = require('../../../lib/middleware/validate');

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  mobileNumber: true,
  extensionNumber: true,
  profileImage: true,
  signatureImage: true,
  roles: true,
  isActive: true,
  operationalProject: true,
  createdAt: true,
  updatedAt: true,
};

// أنواع الصور المسموحة وحد الحجم التقريبي (base64)
const ALLOWED_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/;
const MAX_IMAGE_LENGTH = 6 * 1024 * 1024; // ~6 ميجابايت من نص base64

function validateImageField(value, label) {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value !== 'string' || !ALLOWED_IMAGE_RE.test(value)) {
    return { valid: false, message: `صيغة ${label} غير صحيحة (يجب أن تكون صورة PNG/JPG/WEBP/GIF)` };
  }
  if (value.length > MAX_IMAGE_LENGTH) {
    return { valid: false, message: `حجم ${label} كبير جداً` };
  }
  return { valid: true };
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: profileSelect,
    });
    return res.status(200).json(me);
  }

  // PATCH — تعديل الملف الشخصي
  const body = req.body || {};
  const data = {};

  if (body.firstName !== undefined) {
    if (!isNonEmptyString(body.firstName, 100)) {
      return res.status(400).json({ message: 'الاسم الأول مطلوب (100 حرف كحد أقصى)' });
    }
    data.firstName = body.firstName.trim();
  }

  if (body.lastName !== undefined) {
    if (!isNonEmptyString(body.lastName, 100)) {
      return res.status(400).json({ message: 'الاسم الأخير مطلوب (100 حرف كحد أقصى)' });
    }
    data.lastName = body.lastName.trim();
  }

  if (body.mobileNumber !== undefined) {
    if (!isValidMobile(body.mobileNumber)) {
      return res.status(400).json({ message: 'رقم الجوال غير صحيح' });
    }
    data.mobileNumber = body.mobileNumber.trim();
  }

  if (body.extensionNumber !== undefined) {
    const ext = body.extensionNumber;
    if (ext !== null && (typeof ext !== 'string' || ext.length > 20)) {
      return res.status(400).json({ message: 'التحويلة غير صحيحة' });
    }
    data.extensionNumber = ext === null ? null : ext.trim();
  }

  if (body.profileImage !== undefined) {
    const v = validateImageField(body.profileImage, 'الصورة الشخصية');
    if (!v.valid) return res.status(400).json({ message: v.message });
    data.profileImage = body.profileImage;
  }

  if (body.signatureImage !== undefined) {
    const v = validateImageField(body.signatureImage, 'التوقيع الإلكتروني');
    if (!v.valid) return res.status(400).json({ message: v.message });
    data.signatureImage = body.signatureImage;
  }

  // منع تمرير role/roles أو أي حقول حساسة أخرى بشكل صريح
  delete data.role;
  delete data.roles;
  delete data.passwordHash;
  delete data.email;
  delete data.isActive;
  delete data.operationalProjectId;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'لا توجد بيانات لتحديثها' });
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: profileSelect,
  });

  return res.status(200).json(updated);
}

module.exports = withMethods(['GET', 'PATCH'], withAuth(handler));
module.exports.default = module.exports;

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
    responseLimit: '12mb',
  },
};
