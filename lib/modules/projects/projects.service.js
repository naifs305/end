// =============================================================
// وحدة المشاريع — حالات الاستخدام (Service)
// تنسّق بين المستودع (repo) والصلاحيات (policy) وسجل التدقيق.
// تتلقّى DTO مُتحقَّقاً منه + actor = { userId, activeRole }.
// =============================================================
const repo = require('./projects.repo');
const policy = require('./projects.policy');
const { AppError } = require('../../shared/AppError');
// نمرّر عبر كائن الوحدة الحيّ (لا نفكّك) حتى تبقى مناداة logAudit قابلة للمراقبة في الاختبارات.
const audit = require('../../services/audit');
const logAudit = (...args) => audit.logAudit(...args);

async function list() {
  return repo.findAll();
}

async function publicList() {
  return repo.findAllMinimal();
}

async function getById(id) {
  const project = await repo.findById(id);
  if (!project) throw AppError.notFound('المشروع غير موجود');
  return project;
}

// اسم المشروع فريد: رسالة واضحة بدل «تعارض في البيانات»
const DUPLICATE = (e) => {
  if (e?.code === 'P2002') return AppError.badRequest('يوجد مشروع بهذا الاسم — اختر اسماً آخر', 'serverErrors.projects.duplicateName');
  return e;
};

async function create({ name }, actor) {
  policy.assertCanManage(actor.activeRole);
  const project = await repo.create(name).catch((e) => { throw DUPLICATE(e); });
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_CREATED', { projectId: project.id, projectName: project.name });
  return project;
}

async function update(id, { name }, actor) {
  policy.assertCanManage(actor.activeRole);
  await getById(id); // 404 إن لم يوجد
  const project = await repo.update(id, name).catch((e) => { throw DUPLICATE(e); });
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_UPDATED', { projectId: project.id, projectName: project.name });
  return project;
}

async function remove(id, actor) {
  policy.assertCanManage(actor.activeRole);
  const project = await repo.findWithRelationCounts(id);
  if (!project) throw AppError.notFound('المشروع غير موجود');

  const { users, courses, supervisors } = project._count;
  if (users > 0 || courses > 0 || supervisors > 0) {
    throw AppError.badRequest('لا يمكن حذف مشروع مرتبط بمستخدمين أو دورات أو إشراف', 'serverErrors.common.conflict');
  }

  await repo.remove(id);
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_DELETED', { projectId: project.id, projectName: project.name });
  return { success: true };
}

// ── المجالات التدريبية: كل مجال يتبع مشروعاً واحداً ───────────
const DUPLICATE_DOMAIN = (e) => {
  if (e?.code === 'P2002') return AppError.badRequest('يوجد مجال بهذا الاسم — كل مجال يتبع مشروعاً واحداً', 'serverErrors.projects.duplicateDomain');
  return e;
};

async function createDomain({ name, operationalProjectId }, actor) {
  policy.assertCanManage(actor.activeRole);
  await getById(operationalProjectId);
  const domain = await repo.createDomain(name, operationalProjectId).catch((e) => { throw DUPLICATE_DOMAIN(e); });
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_DOMAIN_CREATED', { domainId: domain.id, domainName: domain.name, projectId: operationalProjectId });
  return domain;
}

async function updateDomain(id, { name, operationalProjectId }, actor) {
  policy.assertCanManage(actor.activeRole);
  const before = await repo.findDomain(id);
  if (!before) throw AppError.notFound('المجال غير موجود');
  if (operationalProjectId) await getById(operationalProjectId);
  const data = {};
  if (name !== undefined) data.name = name;
  if (operationalProjectId !== undefined) data.operationalProjectId = operationalProjectId;
  const domain = await repo.updateDomain(id, data).catch((e) => { throw DUPLICATE_DOMAIN(e); });
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_DOMAIN_UPDATED', {
    domainId: id, domainName: domain.name, previousName: before.name,
    projectId: domain.operationalProjectId, previousProjectId: before.operationalProjectId,
  });
  return domain;
}

async function removeDomain(id, actor) {
  policy.assertCanManage(actor.activeRole);
  const domain = await repo.findDomain(id);
  if (!domain) throw AppError.notFound('المجال غير موجود');
  await repo.removeDomain(id);
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_DOMAIN_DELETED', { domainId: id, domainName: domain.name, projectId: domain.operationalProjectId });
  return { success: true };
}

module.exports = { list, publicList, getById, create, update, remove, createDomain, updateDomain, removeDomain };
