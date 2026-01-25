import { NextRequest, NextResponse } from 'next/server';

// Farcaster requires castShareUrl to be on the same domain as homeUrl.
// This endpoint redirects to Warpcast compose with prefilled text + embed.
export async function GET(request: NextRequest) {
  const appUrl = 'https://farcaster-flashevent-xwwd.vercel.app';
  const text = 'Check out FlashEvents Market - predict and win on Farcaster!';

  const destination =
    `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}` +
    `&embeds[]=${encodeURIComponent(appUrl)}`;

  return NextResponse.redirect(destination, { status: 302 });
}

