// صورة توثيق تملأ إطارها بقصّها وفلترها المحفوظين — دون مساس بالأصل.
// الإطار المحيط يحدد الشكل (عريض، طولي، مربع…)، وهذا المكوّن يملؤه.
import { photoStyles } from '../../lib/documentation/photoLook';

export default function PhotoImg({ m, src, alt = '', loading }) {
  if (!m) return null;
  const st = photoStyles(m);
  const url = src || m.fullUrl;
  return (
    <span style={st.frame} className="nphoto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {st.backdrop && <img src={url} alt="" aria-hidden="true" style={st.backdrop} loading={loading} />}
      <span style={st.box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} style={st.img} loading={loading} draggable={false} />
      </span>
    </span>
  );
}
