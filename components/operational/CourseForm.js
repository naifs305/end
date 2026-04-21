import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

export default function CourseForm({ initialData, onSubmit, isEditMode = false }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialData || {
    name: '', code: '', beneficiaryEntity: '', city: '', locationType: '',
    startDate: '', endDate: '', numTrainees: 0,
    operationalProjectId: '', primaryEmployeeId: '', 
    courseType: 'internal', requiresAdvance: false, requiresRevenue: false, materialsIssued: false
  });

  useEffect(() => {
    api.get('/projects').then(res => setProjects(res.data)).catch(() => toast.error('Could not load projects'));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // If creating, assign current user as primary
      if (!isEditMode) {
         const me = await api.get('/users/me');
         form.primaryEmployeeId = me.data.id;
      }
      await onSubmit(form);
      toast.success(isEditMode ? 'تم تحديث الدورة' : 'تم إنشاء الدورة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">اسم الدورة</label>
          <input type="text" name="name" required value={form.name} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">كود الدورة (اختياري)</label>
          <input type="text" name="code" value={form.code} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">الجهة المستفيدة</label>
          <input type="text" name="beneficiaryEntity" required value={form.beneficiaryEntity} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">المدينة</label>
          <input type="text" name="city" required value={form.city} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">نوع الموقع</label>
          <input type="text" name="locationType" required value={form.locationType} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">تاريخ البداية</label>
          <input type="date" name="startDate" required value={form.startDate} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">تاريخ النهاية</label>
          <input type="date" name="endDate" required value={form.endDate} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">عدد المتدربين</label>
          <input type="number" name="numTrainees" required value={form.numTrainees} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">المشروع التشغيلي</label>
          <select name="operationalProjectId" required value={form.operationalProjectId} onChange={handleChange} className="w-full border rounded p-2">
            <option value="">اختر المشروع</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">نوع الدورة</label>
          <select name="courseType" value={form.courseType} onChange={handleChange} className="w-full border rounded p-2">
            <option value="internal">داخلية</option>
            <option value="external">خارجية</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="font-bold mb-4 text-gray-700">الإعدادات التشغيلية</h3>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" name="requiresAdvance" checked={form.requiresAdvance} onChange={handleChange} className="ml-2 w-4 h-4 text-primary rounded" />
            يتطلب سلفة مالية
          </label>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" name="requiresRevenue" checked={form.requiresRevenue} onChange={handleChange} className="ml-2 w-4 h-4 text-primary rounded" />
            يتطلب إيرادات
          </label>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" name="materialsIssued" checked={form.materialsIssued} onChange={handleChange} className="ml-2 w-4 h-4 text-primary rounded" />
            تم إصدار مواد تدريبية
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" disabled={loading} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-green-800 transition disabled:opacity-50">
          {loading ? 'جاري الحفظ...' : (isEditMode ? 'حفظ التعديلات' : 'إنشاء الدورة')}
        </button>
      </div>
    </form>
  );
}