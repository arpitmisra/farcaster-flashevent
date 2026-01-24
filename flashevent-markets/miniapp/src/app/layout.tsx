import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/shared/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#030712',
};

export const metadata: Metadata = {
  title: 'FlashEvent Markets - Predict & Win',
  description: 'Decentralized prediction markets on Farcaster. Create markets, place bets, and win rewards.',
  applicationName: 'FlashEvent Markets',
  keywords: ['prediction market', 'farcaster', 'crypto', 'betting', 'blockchain'],
  authors: [{ name: 'FlashEvent Team' }],
  creator: 'FlashEvent',
  publisher: 'FlashEvent',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'FlashEvent Markets',
    title: 'FlashEvent Markets - Predict & Win',
    description: 'Decentralized prediction markets on Farcaster',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'FlashEvent Markets',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlashEvent Markets - Predict & Win',
    description: 'Decentralized prediction markets on Farcaster',
    images: [`${process.env.NEXT_PUBLIC_APP_URL}/og-image.png`],
  },
  other: {
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/og-image.png`,
      button: {
        title: '⚡ Open App',
        action: {
          type: 'launch_miniapp',
          url: process.env.NEXT_PUBLIC_APP_URL,
          name: 'FlashEvent Markets',
          splashImageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
          splashBackgroundColor: '#030712',
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1 pb-20">
              {children}
            </main>
            <Navbar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
