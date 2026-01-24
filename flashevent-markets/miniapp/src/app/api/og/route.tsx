import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get('title') || 'FlashEvent Markets';
  const subtitle = searchParams.get('subtitle') || 'Predict & Win on Farcaster';
  const yesPercent = searchParams.get('yes') || '50';
  const noPercent = searchParams.get('no') || '50';
  const pool = searchParams.get('pool') || '0';

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
          backgroundImage: 'linear-gradient(135deg, #1e1b4b 0%, #030712 50%, #4c1d95 100%)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 60, marginRight: 16 }}>⚡</span>
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: 'white',
            }}
          >
            FlashEvent
          </span>
        </div>

        {/* Question */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 900,
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.2,
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 28,
              color: '#9ca3af',
              marginTop: 16,
            }}
          >
            {subtitle}
          </span>
        </div>

        {/* Odds Bar */}
        {pool !== '0' && (
          <div
            style={{
              display: 'flex',
              width: 700,
              height: 60,
              borderRadius: 30,
              overflow: 'hidden',
              marginBottom: 30,
            }}
          >
            <div
              style={{
                width: `${yesPercent}%`,
                height: '100%',
                backgroundColor: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>
                YES {yesPercent}%
              </span>
            </div>
            <div
              style={{
                width: `${noPercent}%`,
                height: '100%',
                backgroundColor: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>
                NO {noPercent}%
              </span>
            </div>
          </div>
        )}

        {/* Pool Info */}
        {pool !== '0' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 32,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#9ca3af',
                fontSize: 28,
              }}
            >
              💰 Pool: {pool} ETH
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            color: '#6b7280',
            fontSize: 24,
          }}
        >
          Powered by Monad • Built on Farcaster
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
