import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  
  const id = searchParams.get('id') || '0';
  const yes = searchParams.get('yes') || '50';
  const no = searchParams.get('no') || '50';
  const volume = searchParams.get('volume') || '0';
  const time = searchParams.get('time') || '24h';
  const question = searchParams.get('q') || 'Will this happen?';

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
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#fff',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            ⚡ FlashEvent
          </div>
          <div
            style={{
              display: 'flex',
              gap: '20px',
              fontSize: '18px',
              color: '#888',
            }}
          >
            <span>📊 {volume} ETH</span>
            <span>⏰ {time}</span>
          </div>
        </div>

        {/* Question */}
        <div
          style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '40px',
            lineHeight: 1.3,
          }}
        >
          {question}
        </div>

        {/* Odds Bar */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '80px',
            borderRadius: '16px',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: `${yes}%`,
              backgroundColor: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            YES {yes}%
          </div>
          <div
            style={{
              width: `${no}%`,
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            NO {no}%
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            color: '#666',
            fontSize: '16px',
            marginTop: 'auto',
          }}
        >
          Tap to bet • Powered by Monad
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 628,
    }
  );
}
