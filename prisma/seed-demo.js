// =============================================================
// seed-demo.js — DEMO data seed (re-runnable / idempotent)
// -------------------------------------------------------------
// Purpose: populate EVERY page of the platform with realistic
// sample records so the whole UI can be tested.
//
// ASSUMES the BASE seed (prisma/seed.js) has ALREADY run, i.e.:
//   - 3 OperationalProjects exist (proj_1, proj_2, proj_3)
//   - 15 ClosureElements exist (looked up by their unique `key`)
//   - the real admin user Nalshahrani@nauss.edu.sa exists
//   - the 3 default ScheduledJobs exist
//   - (optionally) an EmployeeKpiSetting exists
//
// This script NEVER touches the real admin or base
// projects/elements/settings. All demo data is scoped by markers:
//   - demo users have emails ending in  @demo.nauss.local
//   - demo courses have a `code` starting with  DEMO-
// On every run it first deletes prior demo data (respecting FK
// order) and then recreates everything fresh.
//
// Run:  node prisma/seed-demo.js     (or  npm run seed:demo)
// =============================================================

// --- lightweight .env loader (the project does NOT depend on dotenv) ---
// Prisma CLI normally injects .env, but we run via plain `node`, so we
// parse .env ourselves into process.env if the vars are not already set.
const fs = require('fs');
const path = require('path');
(function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
})();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// =============================================================
// Demo markers — everything created here is identifiable & purgeable
// =============================================================
const DEMO_EMAIL_DOMAIN = '@demo.nauss.local';
const DEMO_COURSE_PREFIX = 'DEMO-';
const DEMO_PASSWORD = 'Demo@1234';

// Base projects created by the base seed (looked up, never created here)
const PROJECT_IDS = ['proj_1', 'proj_2', 'proj_3'];

// Helpers ----------------------------------------------------------------
const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;
const NOW = new Date('2026-06-17T10:00:00.000Z'); // "today" per the demo timeline

function daysFromNow(n) {
  return new Date(NOW.getTime() + n * DAY);
}
function hoursFromNow(n) {
  return new Date(NOW.getTime() + n * HOUR);
}
function performanceLevelFor(score) {
  if (score >= 90) return 'OUTSTANDING';
  if (score >= 80) return 'VERY_GOOD';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'NEEDS_IMPROVEMENT';
  return 'WEAK';
}
function pick(arr, i) {
  return arr[i % arr.length];
}

// =============================================================
// STEP 0 — purge prior demo data (FK-safe order)
// =============================================================
async function purgeDemoData() {
  console.log('Purging any prior demo data...');

  // Find existing demo users & demo courses (by markers)
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoCourses = await prisma.course.findMany({
    where: { code: { startsWith: DEMO_COURSE_PREFIX } },
    select: { id: true },
  });
  const demoCourseIds = demoCourses.map((c) => c.id);

  // Delete in dependency order. Many relations cascade on user/course
  // delete, but we delete explicitly to be safe and deterministic.

  // 1) Things tied to demo courses (children first)
  if (demoCourseIds.length) {
    await prisma.courseClosureTracking.deleteMany({ where: { courseId: { in: demoCourseIds } } });
    await prisma.courseOptionalReport.deleteMany({ where: { courseId: { in: demoCourseIds } } });
    await prisma.fieldReport.deleteMany({ where: { courseId: { in: demoCourseIds } } });
    await prisma.courseSupport.deleteMany({ where: { courseId: { in: demoCourseIds } } });
    await prisma.messageRecipient.deleteMany({ where: { message: { courseId: { in: demoCourseIds } } } });
    await prisma.message.deleteMany({ where: { courseId: { in: demoCourseIds } } });
    await prisma.auditLog.deleteMany({ where: { courseId: { in: demoCourseIds } } });
  }

  // 2) Things tied to demo users (independent of demo courses)
  if (demoUserIds.length) {
    // KPI children first
    await prisma.employeeKpiNote.deleteMany({
      where: { OR: [{ userId: { in: demoUserIds } }, { managerId: { in: demoUserIds } }] },
    });
    await prisma.employeeKpiSnapshot.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.courseAssignmentRegister.deleteMany({ where: { userId: { in: demoUserIds } } });

    // Motivation
    await prisma.ideaSupport.deleteMany({
      where: { OR: [{ userId: { in: demoUserIds } }, { idea: { userId: { in: demoUserIds } } }] },
    });
    await prisma.improvementIdea.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.monthlyPledge.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.employeeBadge.deleteMany({
      where: { OR: [{ userId: { in: demoUserIds } }, { awardedById: { in: demoUserIds } }] },
    });

    // Messaging
    await prisma.messageRecipient.deleteMany({
      where: { OR: [{ recipientId: { in: demoUserIds } }, { message: { senderId: { in: demoUserIds } } }] },
    });
    await prisma.message.deleteMany({ where: { senderId: { in: demoUserIds } } });

    // Notifications & audit
    await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } });

    // Supervisor links
    await prisma.projectSupervisor.deleteMany({ where: { userId: { in: demoUserIds } } });

    // Any courses where a demo user is the primary employee (defensive —
    // demo courses are also matched by code above, but a course could in
    // theory reference a demo user without the DEMO- code).
    const orphanCourses = await prisma.course.findMany({
      where: { primaryEmployeeId: { in: demoUserIds } },
      select: { id: true },
    });
    const orphanIds = orphanCourses.map((c) => c.id);
    if (orphanIds.length) {
      await prisma.courseClosureTracking.deleteMany({ where: { courseId: { in: orphanIds } } });
      await prisma.courseOptionalReport.deleteMany({ where: { courseId: { in: orphanIds } } });
      await prisma.fieldReport.deleteMany({ where: { courseId: { in: orphanIds } } });
      await prisma.courseSupport.deleteMany({ where: { courseId: { in: orphanIds } } });
      await prisma.messageRecipient.deleteMany({ where: { message: { courseId: { in: orphanIds } } } });
      await prisma.message.deleteMany({ where: { courseId: { in: orphanIds } } });
      await prisma.auditLog.deleteMany({ where: { courseId: { in: orphanIds } } });
      demoCourseIds.push(...orphanIds);
    }
  }

  // 3) Delete demo courses
  if (demoCourseIds.length) {
    await prisma.course.deleteMany({ where: { id: { in: demoCourseIds } } });
  }

  // 4) Demo TeamChallenge rows (scoped by createdById = demo user)
  if (demoUserIds.length) {
    await prisma.teamChallenge.deleteMany({ where: { createdById: { in: demoUserIds } } });
  }

  // 5) Finally, delete demo users
  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });

  console.log(`  Purged ${demoUserIds.length} demo user(s) and ${demoCourseIds.length} demo course(s).`);
}

// =============================================================
// MAIN
// =============================================================
async function main() {
  // --- Sanity: confirm the base seed has been run ---
  const projects = await prisma.operationalProject.findMany({
    where: { id: { in: PROJECT_IDS } },
  });
  if (projects.length < 3) {
    throw new Error(
      `Base data missing: expected 3 base projects (${PROJECT_IDS.join(', ')}) but found ${projects.length}. ` +
        'Run the base seed first:  node prisma/seed.js'
    );
  }

  const elements = await prisma.closureElement.findMany();
  if (!elements.length) {
    throw new Error('Base data missing: no ClosureElements found. Run the base seed first: node prisma/seed.js');
  }
  // Lookup map by key
  const elByKey = new Map(elements.map((e) => [e.key, e]));

  const activeSetting = await prisma.employeeKpiSetting.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  const settingsId = activeSetting?.id || null;

  // --- purge prior demo data ---
  await purgeDemoData();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // =============================================================
  // STEP 1 — USERS  (~10 across all role combinations)
  // =============================================================
  console.log('Creating demo users...');

  // Definitions: each gets a real Arabic name + a demo email + a project.
  const userDefs = [
    // --- Manager ---
    { key: 'mgr',    first: 'سلطان',  last: 'القحطاني', mobile: '0551000001', roles: ['MANAGER', 'EMPLOYEE'], project: 'proj_1' },
    // --- Quality viewer ---
    { key: 'qa',     first: 'هند',    last: 'العتيبي',  mobile: '0551000002', roles: ['QUALITY_VIEWER'],       project: 'proj_1' },
    // --- Supervisors (one per project) ---
    { key: 'sup1',   first: 'فهد',    last: 'الدوسري',  mobile: '0551000003', roles: ['PROJECT_SUPERVISOR', 'EMPLOYEE'], project: 'proj_1' },
    { key: 'sup2',   first: 'ريم',    last: 'الحربي',   mobile: '0551000004', roles: ['PROJECT_SUPERVISOR', 'EMPLOYEE'], project: 'proj_2' },
    { key: 'sup3',   first: 'ماجد',   last: 'الزهراني', mobile: '0551000005', roles: ['PROJECT_SUPERVISOR'],            project: 'proj_3' },
    // --- Employees ---
    { key: 'emp1',   first: 'عبدالله', last: 'الشمري',   mobile: '0551000006', roles: ['EMPLOYEE'], project: 'proj_1' },
    { key: 'emp2',   first: 'نورة',   last: 'المطيري',  mobile: '0551000007', roles: ['EMPLOYEE'], project: 'proj_1' },
    { key: 'emp3',   first: 'خالد',   last: 'العنزي',   mobile: '0551000008', roles: ['EMPLOYEE'], project: 'proj_2' },
    { key: 'emp4',   first: 'لطيفة',  last: 'الغامدي',  mobile: '0551000009', roles: ['EMPLOYEE'], project: 'proj_2' },
    { key: 'emp5',   first: 'تركي',   last: 'البقمي',   mobile: '0551000010', roles: ['EMPLOYEE'], project: 'proj_3' },
  ];

  const users = {}; // key -> created user record
  for (let i = 0; i < userDefs.length; i++) {
    const d = userDefs[i];
    const email = `${d.key}${DEMO_EMAIL_DOMAIN}`;
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: d.first,
        lastName: d.last,
        mobileNumber: d.mobile,
        extensionNumber: `10${String(i + 10)}`,
        roles: d.roles,
        isActive: true,
        termsAccepted: true,
        termsAcceptedAt: daysFromNow(-120),
        operationalProjectId: d.project,
      },
    });
    users[d.key] = u;
  }

  const manager = users.mgr;
  const employeeKeys = ['emp1', 'emp2', 'emp3', 'emp4', 'emp5'];
  const employees = employeeKeys.map((k) => users[k]);
  // sup1 & sup2 also hold EMPLOYEE role → they can own courses too
  const courseOwners = [...employees, users.sup1, users.sup2];

  // =============================================================
  // STEP 2 — PROJECT SUPERVISOR assignments (one project per supervisor)
  // respect @@unique([userId])
  // =============================================================
  console.log('Creating supervisor assignments...');
  const supervisorAssignments = [
    { user: users.sup1, project: 'proj_1' },
    { user: users.sup2, project: 'proj_2' },
    { user: users.sup3, project: 'proj_3' },
  ];
  for (const s of supervisorAssignments) {
    await prisma.projectSupervisor.create({
      data: {
        userId: s.user.id,
        operationalProjectId: s.project,
        createdById: manager.id,
      },
    });
  }

  // =============================================================
  // STEP 3 — COURSES  (12-15, covering every CourseStatus & flag mix)
  // =============================================================
  console.log('Creating demo courses...');

  // Course definitions. courseType 'external' implies opening/closing reports
  // are mandatory (mirrors createCourse logic), so we set those flags true.
  const courseDefs = [
    // PREPARATION — future courses
    { name: 'القيادة الأمنية المتقدمة', city: 'الرياض', courseType: 'internal', locationType: 'internal',
      start: daysFromNow(20), end: daysFromNow(25), trainees: 25, status: 'PREPARATION', project: 'proj_1', owner: 'emp1',
      flags: { requiresPreTest: true, requiresPostTest: true } },
    { name: 'إدارة الأزمات الأمنية', city: 'جدة', courseType: 'external', locationType: 'external',
      start: daysFromNow(15), end: daysFromNow(19), trainees: 30, status: 'PREPARATION', project: 'proj_1', owner: 'emp2',
      flags: { requiresAdvance: true, requiresRevenue: true, requiresOpeningReport: true, requiresClosingReport: true } },

    // EXECUTION — currently running
    { name: 'مكافحة التهديدات السيبرانية', city: 'الدمام', courseType: 'internal', locationType: 'internal',
      start: daysFromNow(-2), end: daysFromNow(3), trainees: 18, status: 'EXECUTION', project: 'proj_2', owner: 'emp3',
      flags: { requiresPreTest: true, requiresPostTest: true, requiresOpeningReport: true } },
    { name: 'الأمن الوقائي الميداني', city: 'مكة المكرمة', courseType: 'external', locationType: 'external',
      start: daysFromNow(-1), end: daysFromNow(4), trainees: 40, status: 'EXECUTION', project: 'proj_3', owner: 'emp5',
      flags: { requiresAdvance: true, requiresRevenue: true, materialsIssued: true, requiresOpeningReport: true, requiresClosingReport: true } },

    // AWAITING_CLOSURE — finished, closure in progress
    { name: 'تحليل المخاطر الأمنية', city: 'المدينة المنورة', courseType: 'internal', locationType: 'internal',
      start: daysFromNow(-12), end: daysFromNow(-6), trainees: 22, status: 'AWAITING_CLOSURE', project: 'proj_1', owner: 'emp1',
      flags: { requiresPostTest: true, requiresOpeningReport: true, requiresClosingReport: true } },
    { name: 'حماية المنشآت الحيوية', city: 'أبها', courseType: 'external', locationType: 'external',
      start: daysFromNow(-15), end: daysFromNow(-9), trainees: 35, status: 'AWAITING_CLOSURE', project: 'proj_2', owner: 'emp4',
      flags: { requiresAdvance: true, requiresAdvanceSettlement: true, requiresRevenue: true,
               requiresSupervisorCompensation: true, requiresTrainerCompensation: true,
               requiresOpeningReport: true, requiresClosingReport: true, isCrossProject: true } },
    { name: 'الاستجابة للطوارئ', city: 'تبوك', courseType: 'internal', locationType: 'external',
      start: daysFromNow(-18), end: daysFromNow(-11), trainees: 28, status: 'AWAITING_CLOSURE', project: 'proj_3', owner: 'emp5',
      flags: { materialsIssued: true, requiresPreTest: true, requiresPostTest: true } },

    // CLOSED — fully completed (all tracking APPROVED/NOT_APPLICABLE)
    { name: 'أساسيات الأمن السيبراني', city: 'الرياض', courseType: 'internal', locationType: 'internal',
      start: daysFromNow(-45), end: daysFromNow(-40), trainees: 20, status: 'CLOSED', project: 'proj_1', owner: 'emp2',
      flags: { requiresPreTest: true, requiresPostTest: true } },
    { name: 'القيادة والتخطيط الاستراتيجي', city: 'جدة', courseType: 'external', locationType: 'external',
      start: daysFromNow(-60), end: daysFromNow(-54), trainees: 32, status: 'CLOSED', project: 'proj_2', owner: 'emp3',
      flags: { requiresAdvance: true, requiresAdvanceSettlement: true, requiresRevenue: true,
               requiresOpeningReport: true, requiresClosingReport: true } },
    { name: 'الإسعافات الأولية المتقدمة', city: 'الدمام', courseType: 'internal', locationType: 'internal',
      start: daysFromNow(-50), end: daysFromNow(-46), trainees: 16, status: 'CLOSED', project: 'proj_3', owner: 'emp5',
      flags: { materialsIssued: true, requiresPostTest: true } },

    // ARCHIVED — closed & archived
    { name: 'مكافحة الإرهاب الفكري', city: 'مكة المكرمة', courseType: 'external', locationType: 'external',
      start: daysFromNow(-120), end: daysFromNow(-114), trainees: 45, status: 'ARCHIVED', project: 'proj_1', owner: 'emp1',
      flags: { requiresAdvance: true, requiresRevenue: true, requiresOpeningReport: true, requiresClosingReport: true } },
    { name: 'إدارة الحشود والفعاليات', city: 'المدينة المنورة', courseType: 'internal', locationType: 'external',
      start: daysFromNow(-150), end: daysFromNow(-145), trainees: 38, status: 'ARCHIVED', project: 'proj_2', owner: 'sup2',
      flags: { materialsIssued: true } },

    // A couple more recent ones owned by supervisors-as-employees to enrich KPI
    { name: 'التحقيق الجنائي الرقمي', city: 'أبها', courseType: 'internal', locationType: 'internal',
      start: daysFromNow(-8), end: daysFromNow(-3), trainees: 19, status: 'AWAITING_CLOSURE', project: 'proj_1', owner: 'sup1',
      flags: { requiresPreTest: true, requiresPostTest: true, requiresOpeningReport: true, requiresClosingReport: true, isCrossProject: true } },
    { name: 'أمن المعلومات للقادة', city: 'الرياض', courseType: 'external', locationType: 'external',
      start: daysFromNow(-30), end: daysFromNow(-24), trainees: 27, status: 'CLOSED', project: 'proj_2', owner: 'emp4',
      flags: { requiresAdvance: true, requiresAdvanceSettlement: true, requiresRevenue: true,
               requiresSupervisorCompensation: true, requiresTrainerCompensation: true,
               requiresOpeningReport: true, requiresClosingReport: true } },
  ];

  // Form data templates for form-based elements ---------------------------
  const goodReportFormData = {
    training_environment: { rating: 'excellent', comment: 'بيئة تدريبية ممتازة ومجهزة بالكامل.' },
    trainer_evaluation: { rating: 'very_good', comment: 'أداء المدرب احترافي وملتزم بالخطة.' },
    trainee_evaluation: { rating: 'good', comment: 'تفاعل جيد من المتدربين.' },
    content_evaluation: { rating: 'very_good', comment: 'محتوى محدث وملائم.' },
    lms_evaluation: { rating: 'good', comment: 'منصة LMS تعمل بسلاسة.' },
    support_services_evaluation: { rating: 'excellent', comment: 'خدمات مساندة متميزة.' },
    declarationConfirmed: true,
  };
  const advanceFormData = {
    totalAmount: 25000,
    requestDate: daysFromNow(-20).toISOString(),
    receiptDate: daysFromNow(-18).toISOString(),
    note: 'سلفة لتغطية مصاريف الدورة الخارجية.',
  };
  const settlementFormData = {
    advanceAmount: 25000,
    spentAmount: 23150,
    deliveredToAuditorDate: daysFromNow(-5).toISOString(),
    invoicesUploadedDate: daysFromNow(-6).toISOString(),
    note: 'تمت التسوية وإرجاع المتبقي.',
  };
  const medicalInsuranceFormData = {
    provider: 'بوبا العربية',
    policyNumber: 'POL-2026-7781',
    issuedDate: daysFromNow(-22).toISOString(),
    coveredTrainees: 40,
  };

  // Evaluate a CONDITIONAL element's condition against a course (mirrors
  // lib/services/courses.js evaluateCondition).
  function conditionMet(course, conditionField) {
    if (!conditionField) return true;
    if (conditionField.includes('=')) {
      const [field, value] = conditionField.split('=');
      return course[field] === value;
    }
    return !!course[conditionField];
  }

  // Build the full Course `data` object from a def (applies defaults).
  function buildCourseData(def, index) {
    const isExternal = def.courseType === 'external';
    const f = def.flags || {};
    return {
      name: def.name,
      code: `${DEMO_COURSE_PREFIX}${String(index + 1).padStart(3, '0')}`,
      beneficiaryEntity: isExternal ? `جهة مستفيدة ${index + 1}` : 'داخلي - جامعة نايف',
      city: def.city,
      locationType: def.locationType,
      startDate: def.start,
      endDate: def.end,
      numTrainees: def.trainees,
      courseType: def.courseType,
      requiresAdvance: !!f.requiresAdvance,
      requiresRevenue: !!f.requiresRevenue,
      materialsIssued: !!f.materialsIssued,
      requiresAdvanceSettlement: !!f.requiresAdvanceSettlement,
      requiresSupervisorCompensation: !!f.requiresSupervisorCompensation,
      requiresTrainerCompensation: !!f.requiresTrainerCompensation,
      requiresPreTest: !!f.requiresPreTest,
      requiresPostTest: !!f.requiresPostTest,
      isCrossProject: !!f.isCrossProject,
      // external ⇒ reports mandatory (mirrors createCourse)
      requiresOpeningReport: isExternal ? true : !!f.requiresOpeningReport,
      requiresClosingReport: isExternal ? true : !!f.requiresClosingReport,
      status: def.status,
      operationalProjectId: def.project,
      primaryEmployeeId: users[def.owner].id,
    };
  }

  const createdCourses = [];
  for (let i = 0; i < courseDefs.length; i++) {
    const def = courseDefs[i];
    const data = buildCourseData(def, i);

    // Supporting team: pick 1-2 other course owners (not the primary)
    const supporters = courseOwners
      .filter((u) => u.id !== data.primaryEmployeeId)
      .slice(i % 3, (i % 3) + 2)
      .map((u) => ({ userId: u.id }));

    const course = await prisma.course.create({
      data: {
        ...data,
        supportingTeam: { create: supporters },
      },
    });
    createdCourses.push(course);
  }
  console.log(`  Created ${createdCourses.length} courses.`);

  // =============================================================
  // STEP 4 — CLOSURE TRACKING (one row per applicable element, varied states)
  // =============================================================
  console.log('Creating closure tracking rows...');

  let trackingCount = 0;

  // Returns a tracking-row `data` object for one (course, element).
  // The chosen state depends on course status + element index for variety.
  function buildTrackingData(course, el, idx) {
    const base = { courseId: course.id, elementId: el.id };

    // CONDITIONAL elements that don't apply → NOT_APPLICABLE
    if (el.elementType === 'CONDITIONAL' && el.conditionField && !conditionMet(course, el.conditionField)) {
      return { ...base, status: 'NOT_APPLICABLE' };
    }
    // OPTIONAL elements default to NOT_APPLICABLE (not activated)
    if (el.elementType === 'OPTIONAL') {
      return { ...base, status: 'NOT_APPLICABLE' };
    }

    const ownerId = course.primaryEmployeeId;

    // Form data for form-based elements
    let formData = null;
    if (el.isFormBased) {
      if (el.key === 'opening_report' || el.key === 'closing_report') formData = goodReportFormData;
      else if (el.key === 'advance_req') formData = advanceFormData;
      else if (el.key === 'settlement') formData = settlementFormData;
      else if (el.key === 'medical_insurance') formData = medicalInsuranceFormData;
      else formData = { note: 'بيانات نموذجية تجريبية' };
    }

    // --- CLOSED / ARCHIVED courses: everything APPROVED (or NOT_APPLICABLE) ---
    if (course.status === 'CLOSED' || course.status === 'ARCHIVED') {
      return {
        ...base,
        status: 'APPROVED',
        executionAt: new Date(course.endDate.getTime() + 12 * HOUR),
        executedById: ownerId,
        decisionAt: new Date(course.endDate.getTime() + 24 * HOUR),
        decidedById: manager.id,
        notes: 'تم الاعتماد ضمن إقفال الدورة.',
        formData,
      };
    }

    // --- PREPARATION courses: most NOT_STARTED, a couple PENDING ---
    if (course.status === 'PREPARATION') {
      if (idx % 4 === 0) {
        return {
          ...base,
          status: 'PENDING_APPROVAL',
          executionAt: hoursFromNow(-6),
          executedById: ownerId,
          notes: 'تم التقديم بانتظار الاعتماد.',
          formData,
        };
      }
      return { ...base, status: 'NOT_STARTED', formData: el.isFormBased ? null : null };
    }

    // --- EXECUTION / AWAITING_CLOSURE: a rich variety of states ---
    const variant = idx % 6;
    switch (variant) {
      case 0: // APPROVED
        return {
          ...base,
          status: 'APPROVED',
          executionAt: hoursFromNow(-72),
          executedById: ownerId,
          decisionAt: hoursFromNow(-60),
          decidedById: manager.id,
          notes: 'معتمد.',
          formData,
        };
      case 1: // PENDING_APPROVAL
        return {
          ...base,
          status: 'PENDING_APPROVAL',
          executionAt: hoursFromNow(-10),
          executedById: ownerId,
          notes: 'بانتظار قرار المشرف.',
          delayReason: 'تأخر بسيط بسبب ضغط العمل.',
          formData,
        };
      case 2: // RETURNED (needs correction)
        return {
          ...base,
          status: 'RETURNED',
          executionAt: hoursFromNow(-48),
          executedById: ownerId,
          decisionAt: hoursFromNow(-30),
          decidedById: manager.id,
          rejectionReason: 'يرجى استكمال البيانات الناقصة وإعادة التقديم.',
          notes: 'يرجى استكمال البيانات الناقصة وإعادة التقديم.',
          formData,
        };
      case 3: // REJECTED
        return {
          ...base,
          status: 'REJECTED',
          executionAt: hoursFromNow(-50),
          executedById: ownerId,
          decisionAt: hoursFromNow(-40),
          decidedById: manager.id,
          rejectionReason: 'البيانات المقدمة غير صحيحة.',
          notes: 'البيانات المقدمة غير صحيحة.',
          formData,
        };
      case 4: // PENDING with manager extension granted
        return {
          ...base,
          status: 'PENDING_APPROVAL',
          executionAt: hoursFromNow(-4),
          executedById: ownerId,
          notes: 'مُقدّم بعد منح تمديد.',
          extensionHours: 48,
          extensionReason: 'ظروف تشغيلية استثنائية تستدعي تمديد المهلة.',
          extensionGrantedById: manager.id,
          extensionGrantedAt: hoursFromNow(-26),
          formData,
        };
      default: // NOT_STARTED
        return { ...base, status: 'NOT_STARTED', formData: null };
    }
  }

  for (const course of createdCourses) {
    // build the per-course list of applicable elements (active ones)
    const rows = [];
    let i = 0;
    for (const el of elements) {
      if (el.isActive === false) continue;
      rows.push(buildTrackingData(course, el, i));
      i++;
    }
    // create them
    for (const row of rows) {
      await prisma.courseClosureTracking.create({ data: row });
      trackingCount++;
    }
  }

  // Add a couple of explicit MANAGER OVERRIDE rows on an AWAITING_CLOSURE course
  // (find the first tracking row of a non-closed course and add override fields).
  const awaitingCourse = createdCourses.find((c) => c.status === 'AWAITING_CLOSURE');
  if (awaitingCourse) {
    const reactionEl = elByKey.get('reaction_evaluation');
    if (reactionEl) {
      const tr = await prisma.courseClosureTracking.findUnique({
        where: { courseId_elementId: { courseId: awaitingCourse.id, elementId: reactionEl.id } },
      });
      if (tr) {
        await prisma.courseClosureTracking.update({
          where: { id: tr.id },
          data: {
            status: 'APPROVED',
            executionAt: hoursFromNow(-20),
            executedById: awaitingCourse.primaryEmployeeId,
            decisionAt: hoursFromNow(-10),
            decidedById: manager.id,
            overrideReason: 'استرجاع المدير لاستثناء حالة خاصة وإقفال العنصر يدوياً.',
            overriddenAt: hoursFromNow(-9),
            overriddenById: manager.id,
            notes: 'تم الإقفال عبر صلاحية المدير الاستثنائية.',
          },
        });
      }
    }
  }
  console.log(`  Created ${trackingCount} closure tracking rows (+ overrides).`);

  // =============================================================
  // STEP 5 — CourseOptionalReport + FieldReport
  // =============================================================
  console.log('Creating optional & field reports...');
  let optionalReportCount = 0;
  let fieldReportCount = 0;

  const optionalReportTargets = createdCourses.slice(0, 5);
  for (let i = 0; i < optionalReportTargets.length; i++) {
    const c = optionalReportTargets[i];
    await prisma.courseOptionalReport.create({
      data: {
        courseId: c.id,
        authorId: c.primaryEmployeeId,
        title: `ملاحظات تشغيلية - ${c.name}`,
        content:
          'تقرير اختياري يوثّق ملاحظات عامة حول سير الدورة، أبرز التحديات، والمقترحات للتحسين في الدورات القادمة.',
      },
    });
    optionalReportCount++;
  }

  const fieldReportTargets = createdCourses.slice(2, 6);
  for (let i = 0; i < fieldReportTargets.length; i++) {
    const c = fieldReportTargets[i];
    await prisma.fieldReport.create({
      data: {
        courseId: c.id,
        authorId: c.primaryEmployeeId,
        formData: {
          observationDate: daysFromNow(-(i + 1)).toISOString(),
          location: c.city,
          summary: 'زيارة ميدانية لمتابعة سير الدورة وجاهزية القاعات.',
          findings: [
            { area: 'القاعة', status: 'جيد', note: 'تجهيزات كاملة.' },
            { area: 'الحضور', status: 'ممتاز', note: 'نسبة حضور 100%.' },
          ],
          recommendation: 'الاستمرار على نفس مستوى التنظيم.',
        },
      },
    });
    fieldReportCount++;
  }

  // =============================================================
  // STEP 6 — MESSAGES + MessageRecipient (inbox / sent / threads)
  // =============================================================
  console.log('Creating messages...');
  let messageCount = 0;
  let recipientCount = 0;

  const messageDefs = [
    {
      sender: 'mgr', subject: 'تعميم: مواعيد إقفال الدورات',
      body: 'يرجى الالتزام بمواعيد إقفال عناصر الدورات قبل الموعد المثالي قدر الإمكان.',
      recipients: ['emp1', 'emp2', 'emp3', 'emp4', 'emp5'], course: null, readMap: { emp1: true, emp2: false },
    },
    {
      sender: 'sup1', subject: 'استفسار حول تقرير الافتتاح',
      body: 'هل تم رفع تقرير الافتتاح للدورة المسندة إليك؟',
      recipients: ['emp1'], course: 4, readMap: { emp1: false },
    },
    {
      sender: 'emp1', subject: 'رد: استفسار حول تقرير الافتتاح',
      body: 'نعم تم الرفع وبانتظار الاعتماد.',
      recipients: ['sup1'], course: 4, readMap: { sup1: true },
    },
    {
      sender: 'mgr', subject: 'تنبيه أداء فردي',
      body: 'لاحظنا تأخراً في بعض العناصر، يرجى المتابعة.',
      recipients: ['emp3'], course: null, readMap: { emp3: false },
    },
    {
      sender: 'emp2', subject: 'طلب دعم لوجستي',
      body: 'نحتاج تجهيز قاعة إضافية للدورة القادمة.',
      recipients: ['sup1', 'mgr'], course: 1, readMap: { sup1: true, mgr: false },
    },
    {
      sender: 'qa', subject: 'مراجعة جودة عناصر الإقفال',
      body: 'سيتم إجراء مراجعة جودة على عينة من الدورات المقفلة هذا الشهر.',
      recipients: ['mgr', 'sup1', 'sup2'], course: null, readMap: { mgr: true, sup1: false, sup2: false },
    },
  ];

  for (const m of messageDefs) {
    const courseId = m.course != null ? createdCourses[m.course]?.id || null : null;
    const msg = await prisma.message.create({
      data: {
        senderId: users[m.sender].id,
        subject: m.subject,
        body: m.body,
        courseId,
        recipients: {
          create: m.recipients.map((rk) => {
            const isRead = !!m.readMap?.[rk];
            return {
              recipientId: users[rk].id,
              isRead,
              readAt: isRead ? hoursFromNow(-2) : null,
              readById: isRead ? users[rk].id : null,
            };
          }),
        },
      },
    });
    messageCount++;
    recipientCount += m.recipients.length;
  }

  // =============================================================
  // STEP 7 — NOTIFICATIONS (several per user, mixed read state)
  // =============================================================
  console.log('Creating notifications...');
  let notificationCount = 0;

  const notifTemplates = [
    { type: 'ELEMENT_RETURNED', title: 'طلب مراجعة عنصر', message: 'أُعيد أحد عناصر الإقفال للتصحيح، يرجى المتابعة خلال 48 ساعة.' },
    { type: 'ELEMENT_APPROVED', title: 'اعتماد عنصر', message: 'تم اعتماد أحد عناصر الإقفال الخاصة بك.' },
    { type: 'COURSE_ASSIGNED', title: 'إسناد دورة جديدة', message: 'تم إسناد دورة جديدة إليك، يرجى مراجعة التفاصيل.' },
    { type: 'DEADLINE_APPROACHING', title: 'اقتراب موعد', message: 'يقترب الموعد المثالي لأحد عناصر الإقفال.' },
    { type: 'EMPLOYEE_LOW_SCORE', title: 'تنبيه أداء', message: 'انخفضت درجة أداء أحد الموظفين عن الحد المقبول.' },
    { type: 'BADGE_AWARDED', title: 'شارة جديدة', message: 'حصلت على شارة تقديرية جديدة، مبارك!' },
  ];

  const allUsersForNotif = Object.values(users);
  for (let u = 0; u < allUsersForNotif.length; u++) {
    const user = allUsersForNotif[u];
    // 3 notifications each, varied type & read state
    for (let n = 0; n < 3; n++) {
      const t = pick(notifTemplates, u + n);
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: t.type,
          title: t.title,
          message: t.message,
          isRead: (u + n) % 2 === 0,
          metadata: { periodLabel: '2026-06', source: 'demo-seed', index: n },
          createdAt: hoursFromNow(-(n * 5 + 1)),
        },
      });
      notificationCount++;
    }
  }

  // =============================================================
  // STEP 8 — AUDIT LOGS (10-15, varied action / roleContext)
  // =============================================================
  console.log('Creating audit logs...');
  let auditCount = 0;

  const auditDefs = [
    { user: 'mgr',  role: 'MANAGER',            action: 'COURSE_CREATED',                 courseIdx: 0,  details: { courseName: createdCourses[0].name } },
    { user: 'emp1', role: 'EMPLOYEE',           action: 'ELEMENT_SUBMITTED',              courseIdx: 4,  details: { elementKey: 'opening_report', elementName: 'تقرير افتتاح الدورة' } },
    { user: 'sup1', role: 'PROJECT_SUPERVISOR', action: 'ELEMENT_APPROVED',               courseIdx: 4,  details: { elementKey: 'opening_report' } },
    { user: 'mgr',  role: 'MANAGER',            action: 'ELEMENT_RETURNED',               courseIdx: 2,  details: { elementKey: 'pre_test', notes: 'بيانات ناقصة' } },
    { user: 'emp3', role: 'EMPLOYEE',           action: 'ELEMENT_SUBMITTED',              courseIdx: 2,  details: { elementKey: 'reaction_evaluation' } },
    { user: 'mgr',  role: 'MANAGER',            action: 'COURSE_REASSIGNED',              courseIdx: 6,  details: { fromEmployeeId: employees[0].id, toEmployeeId: employees[4].id } },
    { user: 'mgr',  role: 'MANAGER',            action: 'KPI_SNAPSHOTS_CALCULATED',       courseIdx: null, details: { periodType: 'MONTHLY', periodLabel: '2026-06', employeesCount: 5 } },
    { user: 'qa',   role: 'QUALITY_VIEWER',     action: 'QUALITY_REVIEW_OPENED',          courseIdx: 7,  details: { note: 'مراجعة عينة جودة' } },
    { user: 'mgr',  role: 'MANAGER',            action: 'FINANCIAL_ELEMENT_MANUALLY_APPROVED', courseIdx: 8, details: { elementKey: 'advance_req' } },
    { user: 'sup2', role: 'PROJECT_SUPERVISOR', action: 'COURSE_UPDATED',                 courseIdx: 5,  details: { field: 'city' } },
    { user: 'emp2', role: 'EMPLOYEE',           action: 'OPTIONAL_REPORT_SUBMITTED',      courseIdx: 1,  details: { title: 'ملاحظات تشغيلية' } },
    { user: 'mgr',  role: 'MANAGER',            action: 'COURSE_ARCHIVED',                courseIdx: 10, details: { courseId: createdCourses[10].id } },
    { user: 'mgr',  role: 'MANAGER',            action: 'EXTENSION_GRANTED',              courseIdx: 3,  details: { elementKey: 'closing_report', hours: 48 } },
    { user: 'emp5', role: 'EMPLOYEE',           action: 'ELEMENT_SUBMITTED',              courseIdx: 3,  details: { elementKey: 'opening_report' } },
    { user: 'mgr',  role: 'MANAGER',            action: 'USER_ROLE_UPDATED',              courseIdx: null, details: { targetEmail: employees[0].email, roles: ['EMPLOYEE'] } },
  ];

  for (const a of auditDefs) {
    await prisma.auditLog.create({
      data: {
        userId: users[a.user].id,
        roleContext: a.role,
        action: a.action,
        details: a.details,
        courseId: a.courseIdx != null ? createdCourses[a.courseIdx].id : null,
        createdAt: hoursFromNow(-(auditCount * 3 + 1)),
      },
    });
    auditCount++;
  }

  // =============================================================
  // STEP 9 — KPI: snapshots, notes, assignment register
  // =============================================================
  console.log('Creating KPI snapshots, notes & assignment registers...');
  let snapshotCount = 0;
  let kpiNoteCount = 0;
  let assignmentCount = 0;

  // Period helpers (mirror lib/services/kpis.js getPeriodRange) ----------
  function monthlyRange(year, month) {
    // month is 1-12
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { label: `${year}-${String(month).padStart(2, '0')}`, start, end, periodType: 'MONTHLY' };
  }
  function quarterlyRange(year, q) {
    const startMonth = (q - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
    return { label: `${year}-Q${q}`, start, end, periodType: 'QUARTERLY' };
  }
  function yearlyRange(year) {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { label: `${year}`, start, end, periodType: 'YEARLY' };
  }

  // Build a realistic, internally-consistent snapshot payload from a
  // target finalScore + per-employee variation.
  function buildSnapshotData(range, baseScore, variation) {
    const finalScore = Math.max(40, Math.min(100, baseScore + variation));
    // derive component scores that hover around finalScore
    const productivityScore = Math.min(100, Math.max(0, finalScore + 4));
    const timelinessScore = Math.min(100, Math.max(0, finalScore - 3));
    const qualityScore = Math.min(100, Math.max(0, finalScore + 2));
    const criticalScore = Math.min(100, Math.max(0, finalScore - 1));
    const speedScore = Math.min(100, Math.max(0, finalScore - 5));
    const disciplineScore = Math.min(100, Math.max(0, finalScore + 1));
    const reportBonusScore = 2.5;

    const requiredElementsCount = 10;
    const completedElementsCount = Math.round((finalScore / 100) * requiredElementsCount);
    const submittedElementsCount = Math.min(requiredElementsCount, completedElementsCount + 1);
    const approvedElementsCount = completedElementsCount;
    const returnedElementsCount = finalScore < 75 ? 2 : 1;
    const rejectedElementsCount = finalScore < 65 ? 1 : 0;

    const closureCompletionRate = Number(((completedElementsCount / requiredElementsCount) * 100).toFixed(2));
    const firstPassApprovalRate = Number(Math.max(0, qualityScore).toFixed(2));
    const returnRate = Number(((returnedElementsCount / Math.max(1, submittedElementsCount)) * 100).toFixed(2));
    const rejectRate = Number(((rejectedElementsCount / Math.max(1, submittedElementsCount)) * 100).toFixed(2));
    const operationalErrorRate = Number(
      (((returnedElementsCount + rejectedElementsCount) / Math.max(1, submittedElementsCount)) * 100).toFixed(2)
    );

    return {
      periodStart: range.start,
      periodEnd: range.end,

      requiredElementsCount,
      completedElementsCount,
      closureCompletionRate,

      dueCoursesCount: 2,
      closedCoursesCount: 2,
      dueCourseClosureRate: 100,

      submittedElementsCount,
      approvedElementsCount,
      returnedElementsCount,
      rejectedElementsCount,

      firstPassApprovalRate,
      returnRate,
      rejectRate,
      operationalErrorRate,

      avgElementSubmissionHours: Number((48 + variation).toFixed(2)),
      avgResubmissionHours: Number((12 + Math.abs(variation)).toFixed(2)),
      avgCourseClosureDelayDays: Number((finalScore >= 80 ? 0.5 : 2.5).toFixed(2)),

      overdueCoursesCount: finalScore < 70 ? 1 : 0,
      overdueCoursesRate: finalScore < 70 ? 25 : 0,

      overdueElementsCount: finalScore < 70 ? 2 : 0,
      overdueElementsRate: finalScore < 70 ? 20 : 0,

      stalePendingElementsCount: finalScore < 75 ? 1 : 0,
      stalePendingElementsRate: finalScore < 75 ? 10 : 0,

      productivityScore: Number(productivityScore.toFixed(2)),
      timelinessScore: Number(timelinessScore.toFixed(2)),
      qualityScore: Number(qualityScore.toFixed(2)),
      criticalScore: Number(criticalScore.toFixed(2)),
      speedScore: Number(speedScore.toFixed(2)),
      disciplineScore: Number(disciplineScore.toFixed(2)),
      reportBonusScore,
      finalScore: Number(finalScore.toFixed(2)),
      performanceLevel: performanceLevelFor(finalScore),
      settingsId,
    };
  }

  // Per-employee base scores (a spread across performance levels)
  const employeeBaseScores = {
    emp1: 92, // OUTSTANDING
    emp2: 84, // VERY_GOOD
    emp3: 73, // GOOD
    emp4: 63, // NEEDS_IMPROVEMENT
    emp5: 55, // WEAK
  };

  // Monthly periods: 2026-03 .. 2026-06
  const monthlyPeriods = [
    monthlyRange(2026, 3),
    monthlyRange(2026, 4),
    monthlyRange(2026, 5),
    monthlyRange(2026, 6),
  ];
  // Quarterly: 2026-Q1, 2026-Q2 ; Yearly: 2026
  const quarterlyPeriods = [quarterlyRange(2026, 1), quarterlyRange(2026, 2)];
  const yearlyPeriods = [yearlyRange(2026)];

  // keep a reference to each employee's latest monthly snapshot for notes
  const latestMonthlySnapshotByEmp = {};

  for (const empKey of employeeKeys) {
    const emp = users[empKey];
    const base = employeeBaseScores[empKey];

    // Monthly — trend upward slightly each month
    for (let m = 0; m < monthlyPeriods.length; m++) {
      const range = monthlyPeriods[m];
      const variation = (m - monthlyPeriods.length + 1) * 2; // earlier months slightly lower
      const data = buildSnapshotData(range, base, variation);
      const snap = await prisma.employeeKpiSnapshot.create({
        data: { userId: emp.id, periodType: range.periodType, periodLabel: range.label, ...data },
      });
      snapshotCount++;
      if (range.label === '2026-06') latestMonthlySnapshotByEmp[empKey] = snap;

      // Assignment register per employee per month
      await prisma.courseAssignmentRegister.create({
        data: {
          userId: emp.id,
          periodType: 'MONTHLY',
          periodLabel: range.label,
          periodStart: range.start,
          periodEnd: range.end,
          assignedCoursesCount: 2,
          notes: 'إسناد شهري نموذجي.',
        },
      });
      assignmentCount++;
    }

    // Quarterly
    for (const range of quarterlyPeriods) {
      const data = buildSnapshotData(range, base, 1);
      await prisma.employeeKpiSnapshot.create({
        data: { userId: emp.id, periodType: range.periodType, periodLabel: range.label, ...data },
      });
      snapshotCount++;
    }

    // Yearly
    for (const range of yearlyPeriods) {
      const data = buildSnapshotData(range, base, 0);
      await prisma.employeeKpiSnapshot.create({
        data: { userId: emp.id, periodType: range.periodType, periodLabel: range.label, ...data },
      });
      snapshotCount++;
    }
  }

  // KPI notes from the manager on a few latest monthly snapshots
  const noteTexts = {
    emp1: 'أداء متميز ومستمر، يُنصح بالترشيح للتقدير.',
    emp3: 'هناك تحسن لكن يلزم تقليل نسبة الإرجاعات.',
    emp5: 'الأداء دون المقبول، نطلب جلسة متابعة عاجلة.',
  };
  for (const empKey of Object.keys(noteTexts)) {
    const snap = latestMonthlySnapshotByEmp[empKey];
    if (snap) {
      await prisma.employeeKpiNote.create({
        data: {
          snapshotId: snap.id,
          userId: users[empKey].id,
          managerId: manager.id,
          note: noteTexts[empKey],
        },
      });
      kpiNoteCount++;
    }
  }

  // =============================================================
  // STEP 10 — MOTIVATION: badges, ideas, supports, challenge, pledges
  // =============================================================
  console.log('Creating motivation data (badges, ideas, challenge, pledges)...');
  let badgeCount = 0;
  let ideaCount = 0;
  let ideaSupportCount = 0;
  let pledgeCount = 0;

  // --- Badges (several types; mix of auto [awardedById null] and manager-awarded) ---
  // explicit list using real BadgeType enum values
  const badgeRows = [
    { user: 'emp1', badgeType: 'COMMITTED',     awarded: false, note: 'كل العناصر قبل الموعد المثالي.' },
    { user: 'emp1', badgeType: 'STAR',          awarded: true,  note: 'أداء متميز مرتين متتاليتين.' },
    { user: 'emp2', badgeType: 'PRECISE',       awarded: false, note: 'صفر إعادات خلال الفترة.' },
    { user: 'emp2', badgeType: 'CONSISTENT',    awarded: false, note: '3 أشهر فوق 80%.' },
    { user: 'emp3', badgeType: 'IMPROVER',      awarded: true,  note: 'أفضل تحسن في الاتجاه.' },
    { user: 'emp4', badgeType: 'TEAM_PLAYER',   awarded: true,  note: 'ساهم في تحقيق تحدي الفريق.' },
    { user: 'emp5', badgeType: 'PLEDGE_KEEPER', awarded: false, note: 'حقق تعهده الشخصي.' },
    { user: 'sup1', badgeType: 'PIONEER',       awarded: false, note: 'أول من أكمل كل العناصر لدورة.' },
    { user: 'emp1', badgeType: 'IDEA_CHAMPION', awarded: true,  note: 'مبادرة معتمدة ومنفّذة.' },
    { user: 'emp3', badgeType: 'FAST',          awarded: false, note: 'أسرع متوسط تقديم في الفريق.' },
  ];
  for (const b of badgeRows) {
    await prisma.employeeBadge.create({
      data: {
        userId: users[b.user].id,
        badgeType: b.badgeType,
        periodLabel: '2026-06',
        note: b.note,
        awardedById: b.awarded ? manager.id : null,
        awardedAt: hoursFromNow(-(badgeCount * 6 + 1)),
      },
    });
    badgeCount++;
  }

  // --- Improvement ideas across ALL IdeaStatus values ---
  const ideaRows = [
    { user: 'emp1', title: 'أتمتة تذكيرات العناصر',          status: 'PENDING',      category: 'technical', desc: 'إرسال تذكيرات تلقائية قبل المواعيد المثالية بيوم.' },
    { user: 'emp2', title: 'قالب موحد لتقارير الافتتاح',     status: 'UNDER_REVIEW', category: 'process',   desc: 'توحيد حقول تقرير الافتتاح لتسريع التعبئة.' },
    { user: 'emp3', title: 'لوحة متابعة الدورات المتأخرة',   status: 'APPROVED',     category: 'technical', desc: 'لوحة تعرض الدورات المتأخرة في الإقفال بشكل لحظي.' },
    { user: 'emp4', title: 'دورة تعريفية للموظفين الجدد',    status: 'IMPLEMENTED',  category: 'training',  desc: 'برنامج تأهيل قصير لشرح منصة الإقفال.' },
    { user: 'emp5', title: 'تخفيض عدد العناصر الإجبارية',    status: 'REJECTED',     category: 'general',   desc: 'مقترح غير قابل للتطبيق لأسباب تنظيمية.' },
  ];
  const createdIdeas = [];
  for (let i = 0; i < ideaRows.length; i++) {
    const r = ideaRows[i];
    const isReviewed = ['APPROVED', 'IMPLEMENTED', 'REJECTED', 'UNDER_REVIEW'].includes(r.status);
    const idea = await prisma.improvementIdea.create({
      data: {
        userId: users[r.user].id,
        title: r.title,
        description: r.desc,
        category: r.category,
        status: r.status,
        supportCount: 0, // updated below after supports
        reviewedAt: isReviewed ? hoursFromNow(-(i * 24 + 12)) : null,
        reviewedById: isReviewed ? manager.id : null,
        reviewNotes: isReviewed
          ? (r.status === 'REJECTED' ? 'تم الرفض لأسباب تنظيمية.' : 'مبادرة جيدة، تمت الموافقة.')
          : null,
        implementedAt: r.status === 'IMPLEMENTED' ? hoursFromNow(-(i * 24)) : null,
      },
    });
    createdIdeas.push(idea);
    ideaCount++;
  }

  // --- Idea supports (respect @@unique([ideaId, userId])) ---
  const supporterKeys = ['emp1', 'emp2', 'emp3', 'emp4', 'emp5', 'sup1', 'sup2'];
  for (let i = 0; i < createdIdeas.length; i++) {
    const idea = createdIdeas[i];
    // each idea supported by a distinct subset of users (not the author)
    const supporters = supporterKeys
      .filter((k) => users[k].id !== idea.userId)
      .slice(0, 2 + (i % 3)); // 2-4 supporters
    for (const k of supporters) {
      await prisma.ideaSupport.create({
        data: { ideaId: idea.id, userId: users[k].id, createdAt: hoursFromNow(-(i * 4 + 1)) },
      });
      ideaSupportCount++;
    }
    // keep denormalized supportCount accurate
    await prisma.improvementIdea.update({
      where: { id: idea.id },
      data: { supportCount: supporters.length },
    });
  }

  // --- One ACTIVE TeamChallenge for 2026-06 (periodLabel is @unique) ---
  // The base seed does NOT create challenges. But another run of THIS script
  // may have left one for 2026-06; purge handles demo-created ones (scoped by
  // createdById). Guard with a find to avoid the unique-constraint crash if a
  // non-demo challenge already owns 2026-06.
  let teamChallengeCreated = 0;
  const existingChallenge = await prisma.teamChallenge.findUnique({ where: { periodLabel: '2026-06' } });
  if (!existingChallenge) {
    await prisma.teamChallenge.create({
      data: {
        periodLabel: '2026-06',
        title: 'تحدي الالتزام بالمواعيد المثالية',
        description: 'تقديم 90% من عناصر الإقفال قبل الموعد المثالي خلال الشهر.',
        targetMetric: 'all_before_ideal',
        targetValue: 90,
        status: 'ACTIVE',
        achieved: false,
        createdById: manager.id,
      },
    });
    teamChallengeCreated = 1;
  } else {
    console.log('  TeamChallenge for 2026-06 already exists (non-demo) — skipped.');
  }

  // --- Monthly pledges for 2026-06 (@@unique([userId, periodLabel])) ---
  // Some evaluated (fulfillRate set), some not (null).
  const pledgeRows = [
    { user: 'emp1', p1: 'تقديم كل العناصر قبل الموعد المثالي.', p2: 'صفر إعادات.', p3: 'مساعدة زميل واحد.', evaluated: true,  f: [true, true, true] },
    { user: 'emp2', p1: 'إغلاق دورتين خلال الشهر.',           p2: 'رفع تقرير اختياري واحد.', p3: null, evaluated: true,  f: [true, false, null] },
    { user: 'emp3', p1: 'تقليل نسبة الإرجاع إلى أقل من 10%.',  p2: null, p3: null, evaluated: false, f: [null, null, null] },
    { user: 'emp4', p1: 'حضور ورشة تطوير مهني.',              p2: 'تقديم مبادرة تحسين.', p3: null, evaluated: true,  f: [false, true, null] },
    { user: 'emp5', p1: 'الالتزام بمواعيد التقديم.',          p2: null, p3: null, evaluated: false, f: [null, null, null] },
  ];
  for (const pr of pledgeRows) {
    let fulfillRate = null;
    if (pr.evaluated) {
      const considered = pr.f.filter((x) => x !== null);
      const done = considered.filter((x) => x === true).length;
      fulfillRate = considered.length ? Number(((done / considered.length) * 100).toFixed(2)) : 0;
    }
    await prisma.monthlyPledge.create({
      data: {
        userId: users[pr.user].id,
        periodLabel: '2026-06',
        pledge1: pr.p1,
        pledge2: pr.p2,
        pledge3: pr.p3,
        fulfilled1: pr.f[0],
        fulfilled2: pr.f[1],
        fulfilled3: pr.f[2],
        fulfillRate,
        evaluatedAt: pr.evaluated ? hoursFromNow(-12) : null,
      },
    });
    pledgeCount++;
  }

  // =============================================================
  // STEP 11 — ScheduledJobs: update base jobs with run history (no dupes)
  // =============================================================
  console.log('Updating scheduled jobs with run history...');
  const jobs = await prisma.scheduledJob.findMany();
  let jobsUpdated = 0;
  for (const job of jobs) {
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: hoursFromNow(-(job.intervalHours || 24)),
        nextRunAt: hoursFromNow(job.intervalHours || 24),
        runCount: (job.runCount || 0) + 12,
        lastResult: { ok: true, processed: 7, updated: 3, ranAt: hoursFromNow(-(job.intervalHours || 24)).toISOString() },
        lastError: null,
      },
    });
    jobsUpdated++;
  }

  // =============================================================
  // SUMMARY
  // =============================================================
  console.log('\n==================== DEMO SEED COMPLETE ====================');
  console.log('Models populated (counts):');
  console.log(`  User ................................ ${userDefs.length}`);
  console.log(`  ProjectSupervisor ................... ${supervisorAssignments.length}`);
  console.log(`  Course .............................. ${createdCourses.length}`);
  console.log(`  CourseSupport ....................... (1-2 per course)`);
  console.log(`  CourseClosureTracking ............... ${trackingCount} (+ overrides)`);
  console.log(`  CourseOptionalReport ................ ${optionalReportCount}`);
  console.log(`  FieldReport ......................... ${fieldReportCount}`);
  console.log(`  Message ............................. ${messageCount}`);
  console.log(`  MessageRecipient .................... ${recipientCount}`);
  console.log(`  Notification ........................ ${notificationCount}`);
  console.log(`  AuditLog ............................ ${auditCount}`);
  console.log(`  EmployeeKpiSnapshot ................. ${snapshotCount}`);
  console.log(`  EmployeeKpiNote ..................... ${kpiNoteCount}`);
  console.log(`  CourseAssignmentRegister ............ ${assignmentCount}`);
  console.log(`  EmployeeBadge ....................... ${badgeCount}`);
  console.log(`  ImprovementIdea ..................... ${ideaCount}`);
  console.log(`  IdeaSupport ......................... ${ideaSupportCount}`);
  console.log(`  TeamChallenge ....................... ${teamChallengeCreated}`);
  console.log(`  MonthlyPledge ....................... ${pledgeCount}`);
  console.log(`  ScheduledJob (updated, not created) . ${jobsUpdated}`);

  console.log('\n==================== LOGIN CREDENTIALS ====================');
  console.log(`Shared demo password for ALL demo users: ${DEMO_PASSWORD}\n`);
  console.log('  ROLE(S)                    | EMAIL                          | NAME');
  console.log('  ---------------------------|--------------------------------|------------------');
  for (const d of userDefs) {
    const email = `${d.key}${DEMO_EMAIL_DOMAIN}`;
    const roles = d.roles.join('+').padEnd(26);
    console.log(`  ${roles} | ${email.padEnd(30)} | ${d.first} ${d.last}`);
  }
  console.log('\n  Existing real admin (created by base seed, NOT touched here):');
  console.log('    Email: Nalshahrani@nauss.edu.sa   Password: Zx.321321   Roles: MANAGER+EMPLOYEE');
  console.log('============================================================\n');
}

// =============================================================
// Entry point — wrap in try/catch, disconnect in finally,
// exit non-zero on error.
// =============================================================
main()
  .then(() => {
    console.log('Demo seed finished successfully.');
  })
  .catch((e) => {
    console.error('Demo seed FAILED:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
