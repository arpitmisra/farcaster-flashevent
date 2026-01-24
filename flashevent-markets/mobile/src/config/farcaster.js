// Farcaster / Neynar Configuration
export const FARCASTER_CONFIG = {
  // Neynar API
  NEYNAR_API_URL: 'https://api.neynar.com/v2',
  NEYNAR_API_KEY: process.env.EXPO_PUBLIC_NEYNAR_API_KEY || '',
  NEYNAR_CLIENT_ID: process.env.EXPO_PUBLIC_NEYNAR_CLIENT_ID || '',
  
  // Farcaster Hub
  HUB_URL: process.env.EXPO_PUBLIC_FARCASTER_HUB_URL || 'https://hub.farcaster.xyz',
  
  // Auth callback URL (for deep linking)
  AUTH_CALLBACK_URL: 'flashevent://auth/farcaster',
  
  // App FID (your app's Farcaster ID after registration)
  APP_FID: process.env.EXPO_PUBLIC_FARCASTER_APP_FID || '',
  
  // Channel for prediction markets
  PREDICTIONS_CHANNEL: 'predictions',
  
  // Cast templates
  CAST_TEMPLATES: {
    MARKET_CREATED: (question, frameUrl) => 
      `🔮 New prediction market!\n\n${question}\n\nBet now: ${frameUrl}`,
    
    BET_PLACED: (side, question, odds) =>
      `🎯 Just bet ${side} on "${question}"\n\nCurrent odds: ${odds}% | Potential payout: ${(100 / odds).toFixed(2)}x`,
    
    MARKET_RESOLVED: (question, outcome, winners, payout) =>
      `🎉 Market Resolved!\n\n"${question}" → ${outcome} ✅\n\nWinners: ${winners} | Total Payout: ${payout} ETH`,
    
    WINNINGS_CLAIMED: (amount, question) =>
      `💰 Just won ${amount} ETH on FlashEvent!\n\nPredicted correctly: "${question}" ✅`,
  },
};

// Neynar API endpoints
export const NEYNAR_ENDPOINTS = {
  // User endpoints
  USER_BY_FID: (fid) => `/farcaster/user?fid=${fid}`,
  USER_BY_USERNAME: (username) => `/farcaster/user/by_username?username=${username}`,
  USER_SEARCH: (query) => `/farcaster/user/search?q=${query}`,
  USER_FOLLOWERS: (fid) => `/farcaster/followers?fid=${fid}`,
  USER_FOLLOWING: (fid) => `/farcaster/following?fid=${fid}`,
  
  // Cast endpoints
  CAST: '/farcaster/cast',
  CAST_BY_HASH: (hash) => `/farcaster/cast?hash=${hash}`,
  USER_CASTS: (fid) => `/farcaster/feed/user/${fid}`,
  CHANNEL_CASTS: (channel) => `/farcaster/feed/channel/${channel}`,
  
  // Auth endpoints
  SIGNER: '/farcaster/signer',
  SIGNER_STATUS: (signerUuid) => `/farcaster/signer?signer_uuid=${signerUuid}`,
};

export default FARCASTER_CONFIG;
