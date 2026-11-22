// «مؤشرات الأداء» صارت «رصيد الإنجاز» — درجات بدل النسب
export async function getServerSideProps() {
  return { redirect: { destination: '/points', permanent: false } };
}

export default function KpisRedirect() {
  return null;
}
