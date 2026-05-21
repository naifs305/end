export default function InputField({ label, name, type = 'text', value, onChange, required = false, placeholder }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-xs font-bold text-text-main">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
    </div>
  );
}
