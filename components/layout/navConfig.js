import {
  Home,
  BookOpen,
  ClipboardCheck,
  Archive,
  BarChart3,
  Gauge,
  FileText,
  FileSearch,
  Award,
  MessageSquare,
  Bell,
  User,
  Users,
  FolderKanban,
  ListChecks,
  Settings,
} from 'lucide-react';
import { isAdminRole, canAccessKpis, canViewReportsOnly } from '../../lib/roles';

/**
 * يبني أقسام التنقّل وفق صلاحيات الدور (RBAC).
 * كل عنصر مرتبط بقاعدة وصول صريحة، والأقسام مرتّبة حسب الغرض.
 * @returns {Array<{key,title,items:Array<{href,icon,label}>}>}
 */
export function buildNavSections(activeRole, t) {
  const isManager = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const isAdmin = isAdminRole(activeRole); // مدير
  const isOversight = isManager || isSupervisor; // مدير أو مشرف
  const canViewKpis = canAccessKpis(activeRole);
  const isQuality = canViewReportsOnly(activeRole);

  const item = (href, icon, label) => ({ href, icon, label });
  const sections = [];
  const push = (key, title, items) => {
    if (items.length) sections.push({ key, title, items });
  };

  // ── دور الجودة: عرض للقراءة فقط (الجودة + التقارير + الحساب) ──
  if (isQuality) {
    push('reportsFollowup', t('navSections.reportsFollowup'), [
      item('/quality', Gauge, t('nav.quality')),
      item('/reports', BarChart3, t('nav.reports')),
    ]);
    push('account', t('navSections.account'), [item('/profile', User, t('nav.profile'))]);
    return sections;
  }

  // ── 1. نظرة عامة ──
  push('main', t('navSections.main'), [item('/', Home, t('nav.dashboard'))]);

  // ── 2. العمليات ──
  const operations = [item('/courses', BookOpen, t('nav.courses'))];
  if (isOversight) operations.push(item('/approvals', ClipboardCheck, t('nav.approvals')));
  operations.push(item('/archive', Archive, t('nav.archive')));
  push('operations', t('navSections.operations'), operations);

  // ── 3. الأداء والتقارير ──
  const reports = [];
  if (canViewKpis) reports.push(item('/kpis', Gauge, t('nav.kpis')));
  reports.push(item('/reports', BarChart3, t('nav.reports')));
  if (isOversight) reports.push(item('/executive-report', FileText, t('nav.executiveReport')));
  if (isOversight) reports.push(item('/audit', FileSearch, t('nav.audit')));
  push('reportsFollowup', t('navSections.reportsFollowup'), reports);

  // ── 4. التحفيز ──
  push('engagement', t('navSections.engagement'), [item('/motivation', Award, t('nav.motivation'))]);

  // ── 5. الاتصال ──
  push('communication', t('navSections.communication'), [
    item('/messages', MessageSquare, t('nav.messages')),
    item('/notifications', Bell, t('nav.notifications')),
  ]);

  // ── 6. الإدارة (المدير فقط) ──
  if (isAdmin) {
    push('administration', t('navSections.administration'), [
      item('/users', Users, t('nav.users')),
      item('/projects', FolderKanban, t('nav.projects')),
      item('/closure-elements', ListChecks, t('nav.closureElements')),
      item('/jobs', Settings, t('nav.jobs')),
    ]);
  }

  // ── 7. الحساب ──
  push('account', t('navSections.account'), [item('/profile', User, t('nav.profile'))]);

  return sections;
}
