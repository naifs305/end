import Head from 'next/head';
import { AuthProvider } from '../context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { I18nProvider, useTranslation } from '../lib/i18n';
import '../styles/globals.css';
import 'react-datepicker/dist/react-datepicker.css';

// العنوان الافتراضي + شريط التنبيهات يتبعان لغة الواجهة (داخل مزوّد i18n)
function AppChrome() {
  const { t, isRTL } = useTranslation();
  return (
    <>
      <Head>
        <title>{t('common.appNameShort')}</title>
      </Head>
      <Toaster
      position={isRTL ? 'top-right' : 'top-left'}
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'Cairo, sans-serif',
          background: '#FFFFFF',
          color: '#14221D',
          border: '1px solid #D7DBDA',
          borderRadius: '14px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: '0 4px 20px rgba(20,34,29,0.10)',
          direction: isRTL ? 'rtl' : 'ltr',
        },
        success: { iconTheme: { primary: '#5D8A70', secondary: '#FFFFFF' } },
        error: { iconTheme: { primary: '#633646', secondary: '#FFFFFF' } },
      }}
      />
    </>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      </Head>

      <I18nProvider>
        <AuthProvider>
          <AppChrome />
          <Component {...pageProps} />
        </AuthProvider>
      </I18nProvider>
    </>
  );
}
