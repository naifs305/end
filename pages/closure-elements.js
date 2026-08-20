import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { Plus } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import ConfirmModal from '../components/operational/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { useTranslation } from '../lib/i18n';

const TYPE_META = {
  MANDATORY:   { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  CONDITIONAL: { bg: 'bg-sand/20',    text: 'text-warning', border: 'border-sand/40' },
  OPTIONAL:    { bg: 'bg-background', text: 'text-text-soft', border: 'border-border' },
};

const CONDITION_FIELDS = [
  'requiresAdvance',
  'requiresRevenue',
  'materialsIssued',
  'requiresAdvanceSettlement',
  'requiresSupervisorCompensation',
  'requiresTrainerCompensation',
  'requiresPreTest',
  'requiresPostTest',
  'requiresOpeningReport',
  'requiresClosingReport',
];

export default function ClosureElementsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [elementType, setElementType] = useState('MANDATORY');
  const [conditionField, setConditionField] = useState(CONDITION_FIELDS[0]);
  const [isFormBased, setIsFormBased] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || activeRole !== 'MANAGER')) router.replace('/');
  }, [authLoading, user, activeRole, router]);

  useEffect(() => {
    if (user && activeRole === 'MANAGER') load();
  }, [user, activeRole]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/closure-elements');
      setElements(res.data || []);
    } catch {
      toast.error(t('admin.closureElements.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const createElement = async () => {
    if (!name.trim()) return toast.error(t('admin.closureElements.nameRequired'));
    setSaving(true);
    try {
      await api.post('/closure-elements', {
        name: name.trim(),
        elementType,
        conditionField: elementType === 'CONDITIONAL' ? conditionField : undefined,
        isFormBased,
      });
      toast.success(t('admin.closureElements.created'));
      setName('');
      setElementType('MANDATORY');
      setIsFormBased(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || t('admin.closureElements.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const requestToggle = (el) => {
    const willEnable = !el.isActive;
    setConfirmState({ id: el.id, name: el.name, willEnable });
  };

  const confirmToggle = async () => {
    if (!confirmState) return;
    const { id, willEnable } = confirmState;
    setBusy(true);
    try {
      await api.patch(`/closure-elements/${id}`, { isActive: willEnable });
      toast.success(willEnable ? t('admin.closureElements.enabledToast') : t('admin.closureElements.disabledToast'));
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || t('admin.closureElements.toggleFailed'));
    } finally {
      setBusy(false);
      setConfirmState(null);
    }
  };

  if (authLoading || !user) return null;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <h1 className="text-xl font-extrabold text-primary">{t('admin.closureElements.title')}</h1>
          <p className="mt-0.5 text-xs text-text-soft">
            {t('admin.closureElements.subtitle')}
          </p>
        </div>

        {/* إنشاء عنصر جديد */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
          <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-text-main">
            <Plus size={15} aria-hidden="true" /> {t('admin.closureElements.addTitle')}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.closureElements.namePlaceholder')}
              className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary lg:col-span-2" />

            <select value={elementType} onChange={(e) => setElementType(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="MANDATORY">{t('admin.closureElements.typeMandatoryFull')}</option>
              <option value="CONDITIONAL">{t('admin.closureElements.typeConditionalFull')}</option>
              <option value="OPTIONAL">{t('admin.closureElements.typeOptionalFull')}</option>
            </select>

            {elementType === 'CONDITIONAL' ? (
              <select value={conditionField} onChange={(e) => setConditionField(e.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                {CONDITION_FIELDS.map((f) => (
                  <option key={f} value={f}>{t(`admin.closureElements.conditions.${f}`)}</option>
                ))}
              </select>
            ) : (
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-soft">
                <input type="checkbox" checked={isFormBased} onChange={(e) => setIsFormBased(e.target.checked)} />
                {t('admin.closureElements.requiresForm')}
              </label>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={createElement} disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50">
              {saving ? t('admin.closureElements.creating') : t('admin.closureElements.createButton')}
            </button>
          </div>
        </div>

        {/* قائمة العناصر */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-10 text-text-soft shadow-card">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-start text-xs font-extrabold text-text-soft">
                  <th className="px-4 py-3 text-start">{t('admin.closureElements.colElement')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.closureElements.colType')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.closureElements.colCondition')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.closureElements.colStatus')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el) => {
                  const meta = TYPE_META[el.elementType] || TYPE_META.MANDATORY;
                  return (
                    <tr key={el.id} className={`border-b border-border last:border-0 ${!el.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-bold text-text-main">
                        {el.name}
                        {el.isCustom && (
                          <span className="ms-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{t('admin.closureElements.customBadge')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text} ${meta.border}`}>
                          {t(`admin.closureElements.types.${el.elementType}`) || el.elementType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-soft">
                        {el.conditionField ? t(`admin.closureElements.conditions.${el.conditionField}`) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${el.isActive ? 'bg-success/10 text-success' : 'bg-burgundy/10 text-danger'}`}>
                          {el.isActive ? t('admin.common.enabled') : t('admin.common.disabled')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button onClick={() => requestToggle(el)}
                          className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-text-soft hover:bg-background">
                          {el.isActive ? t('admin.common.disable') : t('admin.common.enable')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmState}
        title={confirmState ? (confirmState.willEnable ? t('admin.common.enable') : t('admin.common.disable')) : ''}
        message={
          confirmState
            ? (confirmState.willEnable
                ? t('admin.closureElements.enableConfirm', { name: confirmState.name })
                : t('admin.closureElements.disableConfirm', { name: confirmState.name }))
            : ''
        }
        confirmLabel={confirmState ? (confirmState.willEnable ? t('admin.common.enable') : t('admin.common.disable')) : ''}
        tone={confirmState && confirmState.willEnable ? 'primary' : 'warning'}
        loading={busy}
        onConfirm={confirmToggle}
        onCancel={() => setConfirmState(null)}
      />
    </MainLayout>
  );
}
