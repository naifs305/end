import Head from 'next/head';
import { AuthProvider } from '../context/AuthContext';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';
import 'react-datepicker/dist/react-datepicker.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      </Head>

      <AuthProvider>
        <Toaster
          position="top-left"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Cairo, sans-serif',
              background: '#FFFFFF',
              color: '#2F3437',
              border: '1px solid #D8DDDA',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(0, 108, 109, 0.08)',
            },
            success: {
              iconTheme: {
                primary: '#2E7D5A',
                secondary: '#FFFFFF',
              },
            },
            error: {
              iconTheme: {
                primary: '#A63D4A',
                secondary: '#FFFFFF',
              },
            },
          }}
        />
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}