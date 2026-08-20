import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * useFocusTrap — يحبس تركيز لوحة المفاتيح داخل نافذة منبثقة (a11y).
 * عند التفعيل: يحفظ العنصر المركّز سابقاً، يركّز أول عنصر قابل للتركيز داخل
 * الحاوية، يجعل Tab/Shift+Tab يدوران داخلها فقط، ثم يعيد التركيز عند الإغلاق.
 *
 * @param {boolean} active هل النافذة مفتوحة
 * @returns {React.RefObject} ref يُمرَّر لحاوية النافذة
 */
export function useFocusTrap(active) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;

    // ركّز أول عنصر قابل للتركيز (أو الحاوية نفسها) — ما لم يكن هناك autoFocus فعّال
    const focusables = () => Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    const alreadyInside = container.contains(document.activeElement);
    if (!alreadyInside) {
      const first = focusables()[0];
      (first || container).focus?.();
    }

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // أعد التركيز للعنصر الذي فتح النافذة
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [active]);

  return containerRef;
}
