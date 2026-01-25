import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/shared/Navbar';

const inter = Inter({ subsets: ['latin'] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://farcaster-flashevent-xwwd.vercel.app';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#030712',
};

const miniAppEmbed = {
  version: '1',
  // Mini App embeds require a 3:2 image
  imageUrl: `${APP_URL}/api/embed-image`,
  button: {
    title: 'Open App',
    action: {
      // Per Farcaster spec, use launch_frame for Mini App embed actions
      type: 'launch_frame',
      name: 'FlashEvent Markets',
      url: APP_URL,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: '#000000',
    },
  },
} as const;

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
    url: APP_URL,
    siteName: 'FlashEvent Markets',
    title: 'FlashEvent Markets - Predict & Win',
    description: 'Decentralized prediction markets on Farcaster',
    images: [
      {
        url: `${APP_URL}/ogImage.png`,
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
    images: [`${APP_URL}/ogImage.png`],
  },
  other: {
    // Mini App embed meta tags (required for Warpcast to render "Open App" card in-feed)
    'fc:miniapp': JSON.stringify(miniAppEmbed),
    // Backward compatibility
    'fc:frame': JSON.stringify(miniAppEmbed),
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
