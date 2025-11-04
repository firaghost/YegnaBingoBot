import '../styles/globals.css';
import { useEffect } from 'react';
import Script from 'next/script';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Disable pull-to-refresh
    document.body.style.overscrollBehavior = 'none';
  }, []);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <Component {...pageProps} />
    </>
  );
}
