import { Inter } from 'next/font/google';
import { DisplayBoardNavProvider } from '../contexts/DisplayBoardNavContext';
import '../styles/globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default function App({ Component, pageProps }) {
  return (
    <div className={`${sans.variable} font-sans`}>
      <DisplayBoardNavProvider>
        <Component {...pageProps} />
      </DisplayBoardNavProvider>
    </div>
  );
}
