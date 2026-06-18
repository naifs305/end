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

async function create({ name }, actor) {
  policy.assertCanManage(actor.activeRole);
  const project = await repo.create(name);
  await logAudit(actor.userId, 'MANAGER', 'PROJECT_CREATED', { projectId: project.id, projectName: project.name });
  return project;
}

async function update(id, { name }, actor) {
  policy.assertCanManage(actor.activeRole);
  await getById(id); // 404 إن لم يوجد
  const project = await repo.update(id, name);
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

module.exports = { list, publicList, getById, create, update, remove };
