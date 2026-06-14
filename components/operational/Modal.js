export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2F3437]/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <h3 className="text-lg font-extrabold text-text-main">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-soft transition hover:bg-white hover:text-primary"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}