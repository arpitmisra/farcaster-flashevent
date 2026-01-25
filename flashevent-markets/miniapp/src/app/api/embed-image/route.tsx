import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Farcaster Mini App Embed image must be 3:2 aspect ratio.
// This produces a 1200x800 image suitable for in-feed embeds.
export async function GET(request: NextRequest) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#030712',
          backgroundImage: 'linear-gradient(135deg, #1e1b4b 0%, #030712 55%, #4c1d95 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 64 }}>⚡</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'white', fontSize: 54, fontWeight: 800, lineHeight: 1 }}>FlashEvent</div>
            <div style={{ color: '#cbd5e1', fontSize: 26, marginTop: 6 }}>Markets • Predict & Win</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 18,
            marginTop: 8,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              color: '#dcfce7',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            YES
          </div>
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fee2e2',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            NO
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 34, color: '#94a3b8', fontSize: 22 }}>
          Open in Farcaster • Powered by Monad
        </div>
      </div>
    ),
    { width: 1200, height: 800 }
  );
}

