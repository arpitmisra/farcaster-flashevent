import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const FRAMES_BASE_URL = process.env.FRAMES_BASE_URL || 'http://localhost:3002';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    // Return initial frame
    return renderFrame(res, id);
  }

  if (req.method === 'POST') {
    // Handle frame action
    return handleAction(req, res, id);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function renderFrame(res, marketId, state = {}) {
  try {
    // Fetch market data
    const { data: market } = await axios.get(`${API_BASE_URL}/markets/${marketId}`);

    const yesPercent = Math.round(parseFloat(market.yesPrice) * 100);
    const noPercent = 100 - yesPercent;
    const volume = formatVolume(market.totalVolume);
    const timeLeft = formatTimeLeft(market.endTime);

    const imageUrl = `${FRAMES_BASE_URL}/api/og/market?id=${marketId}&yes=${yesPercent}&no=${noPercent}&volume=${volume}&time=${timeLeft}&q=${encodeURIComponent(market.question.slice(0, 100))}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="🟢 YES ${yesPercent}%" />
  <meta property="fc:frame:button:1:action" content="post" />
  <meta property="fc:frame:button:2" content="🔴 NO ${noPercent}%" />
  <meta property="fc:frame:button:2:action" content="post" />
  <meta property="fc:frame:button:3" content="📊 Details" />
  <meta property="fc:frame:button:3:action" content="link" />
  <meta property="fc:frame:button:3:target" content="https://flashevent.xyz/market/${marketId}" />
  <meta property="fc:frame:button:4" content="🔄 Refresh" />
  <meta property="fc:frame:button:4:action" content="post" />
  <meta property="fc:frame:post_url" content="${FRAMES_BASE_URL}/api/frame/${marketId}" />
  <meta property="og:title" content="FlashEvent: ${market.question}" />
  <meta property="og:image" content="${imageUrl}" />
</head>
<body></body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Frame render error:', error);
    return renderErrorFrame(res, 'Market not found');
  }
}

async function handleAction(req, res, marketId) {
  try {
    const { untrustedData, trustedData } = req.body;
    const buttonIndex = untrustedData?.buttonIndex;
    const fid = untrustedData?.fid;

    // Button 4 = Refresh
    if (buttonIndex === 4) {
      return renderFrame(res, marketId);
    }

    // Button 1 = YES, Button 2 = NO
    if (buttonIndex === 1 || buttonIndex === 2) {
      const position = buttonIndex === 1 ? 'YES' : 'NO';
      return renderBetFrame(res, marketId, position, fid);
    }

    // Default: refresh
    return renderFrame(res, marketId);
  } catch (error) {
    console.error('Frame action error:', error);
    return renderErrorFrame(res, 'Action failed');
  }
}

async function renderBetFrame(res, marketId, position, fid) {
  try {
    const { data: market } = await axios.get(`${API_BASE_URL}/markets/${marketId}`);
    
    const price = position === 'YES' ? market.yesPrice : market.noPrice;
    const percent = Math.round(parseFloat(price) * 100);

    const imageUrl = `${FRAMES_BASE_URL}/api/og/bet?id=${marketId}&position=${position}&price=${percent}&q=${encodeURIComponent(market.question.slice(0, 80))}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:input:text" content="Amount in ETH (e.g., 0.01)" />
  <meta property="fc:frame:button:1" content="💰 Place Bet" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="${FRAMES_BASE_URL}/api/tx/bet?market=${marketId}&position=${position}" />
  <meta property="fc:frame:button:2" content="⬅️ Back" />
  <meta property="fc:frame:button:2:action" content="post" />
  <meta property="fc:frame:button:2:target" content="${FRAMES_BASE_URL}/api/frame/${marketId}" />
  <meta property="fc:frame:post_url" content="${FRAMES_BASE_URL}/api/frame/${marketId}/bet" />
</head>
<body></body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Bet frame error:', error);
    return renderErrorFrame(res, 'Failed to load bet options');
  }
}

function renderErrorFrame(res, message) {
  const imageUrl = `${FRAMES_BASE_URL}/api/og/error?msg=${encodeURIComponent(message)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:button:1" content="🔄 Try Again" />
  <meta property="fc:frame:button:1:action" content="post" />
</head>
<body></body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}

function formatVolume(volume) {
  const val = parseFloat(volume) / 1e18;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(2);
}

function formatTimeLeft(endTime) {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  
  if (diff <= 0) return 'Ended';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
