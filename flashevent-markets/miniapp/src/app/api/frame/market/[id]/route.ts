import { NextRequest, NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://flashevent.vercel.app';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const marketId = params.id;
  
  // In a real implementation, you'd fetch market data here
  // For now, return a generic frame response
  
  const frameData = {
    version: '1',
    imageUrl: `${APP_URL}/api/og?title=Prediction+Market&subtitle=Make+your+prediction&pool=0`,
    button: {
      title: '⚡ Open Market',
      action: {
        type: 'launch_miniapp',
        url: `${APP_URL}/market/${marketId}`,
        name: 'FlashEvent Markets',
        splashImageUrl: `${APP_URL}/splash.png`,
        splashBackgroundColor: '#030712',
      },
    },
  };

  // Return HTML with frame meta tags for scraping
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="FlashEvent Market" />
  <meta property="og:description" content="Make your prediction on FlashEvent" />
  <meta property="og:image" content="${APP_URL}/api/og?title=Prediction+Market" />
  <meta name="fc:miniapp" content='${JSON.stringify(frameData)}' />
  <meta name="fc:frame" content='${JSON.stringify(frameData)}' />
</head>
<body>
  <h1>FlashEvent Market</h1>
  <p>View this market in a Farcaster client to participate.</p>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
