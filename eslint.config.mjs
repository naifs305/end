import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextVitals,
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'الملفات المساعدة/**'] },
];

export default eslintConfig;
