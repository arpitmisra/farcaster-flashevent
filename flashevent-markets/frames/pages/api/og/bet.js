import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  
  const position = searchParams.get('position') || 'YES';
  const price = searchParams.get('price') || '50';
  const question = searchParams.get('q') || 'Will this happen?';

  const isYes = position === 'YES';
  const bgColor = isYes ? '#22c55e' : '#ef4444';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0a0a0a',
          padding: '40px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#fff',
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          ⚡ FlashEvent - Place Bet
        </div>

        {/* Question */}
        <div
          style={{
            fontSize: '28px',
            color: '#888',
            marginBottom: '40px',
            lineHeight: 1.3,
          }}
        >
          {question}
        </div>

        {/* Bet Details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: bgColor,
              padding: '40px 80px',
              borderRadius: '24px',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#fff',
                marginBottom: '10px',
              }}
            >
              {position}
            </div>
            <div
              style={{
                fontSize: '32px',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              @ {price}%
            </div>
          </div>

          <div
            style={{
              marginTop: '30px',
              fontSize: '20px',
              color: '#666',
            }}
          >
            Enter amount in ETH below
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            color: '#666',
            fontSize: '16px',
          }}
        >
          Powered by Monad • x402 Payments
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 628,
    }
  );
}
