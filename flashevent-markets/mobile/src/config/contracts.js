// Contract addresses - Monad Testnet
export const CONTRACT_ADDRESSES = {
  MARKET_FACTORY: process.env.EXPO_PUBLIC_MARKET_FACTORY_ADDRESS || '0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007',
};

// Monad Testnet Configuration
export const NETWORK_CONFIG = {
  chainId: 10143,
  chainName: 'Monad Testnet',
  rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
  blockExplorer: 'https://testnet.monadexplorer.com',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
};

// Market types - matches contract enum
export const MARKET_TYPES = {
  PRICE_TOUCH: 0,
  ONCHAIN_EVENT: 1,
  API_COUNT: 2,
  SPORTS: 3,
};

// Market type icons for UI
export const MARKET_TYPE_ICONS = {
  [MARKET_TYPES.PRICE_TOUCH]: '📈',
  [MARKET_TYPES.ONCHAIN_EVENT]: '⛓️',
  [MARKET_TYPES.API_COUNT]: '🔢',
  [MARKET_TYPES.SPORTS]: '⚽',
};

// Market type labels for UI
export const MARKET_TYPE_LABELS = {
  [MARKET_TYPES.PRICE_TOUCH]: 'Price Touch',
  [MARKET_TYPES.ONCHAIN_EVENT]: 'On-Chain Event',
  [MARKET_TYPES.API_COUNT]: 'API Count',
  [MARKET_TYPES.SPORTS]: 'Sports',
};

// MarketFactory ABI - matches deployed Foundry contract
// Using JSON format for proper encoding
export const MARKET_FACTORY_ABI = [
  // State variables
  'function treasury() view returns (address)',
  'function owner() view returns (address)',
  'function creationPaused() view returns (bool)',
  'function defaultProtocolFeeBps() view returns (uint256)',
  'function minLockDuration() view returns (uint256)',
  
  // Core function - JSON format for proper encoding (now with bettingDeadline)
  {
    "type": "function",
    "name": "createMarket",
    "inputs": [
      { "name": "question", "type": "string" },
      { "name": "expiry", "type": "uint256" },
      { "name": "bettingDeadline", "type": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  
  // Getter functions
  'function marketsCount() view returns (uint256)',
  'function getMarket(uint256 index) view returns (address)',
  'function getMarkets(uint256 offset, uint256 limit) view returns (address[])',
  'function getAllMarkets() view returns (address[])',
  'function isValidMarket(address market) view returns (bool)',
  'function getMarketIndex(address market) view returns (uint256)',
  
  // Admin functions
  'function setTreasury(address newTreasury)',
  'function pauseCreation()',
  'function resumeCreation()',
  'function transferOwnership(address newOwner)',
  'function setDefaultProtocolFee(uint256 feeBps)',
  'function setMinLockDuration(uint256 newMinLockDuration)',
  
  // Market admin passthrough
  'function resolveMarket(address marketAddr, uint8 outcome)',
  'function cancelMarket(address marketAddr)',
  'function setMarketProtocolFee(address marketAddr, uint256 feeBps)',
  'function setMarketTreasury(address marketAddr, address newTreasury)',
  'function withdrawMarketFees(address marketAddr)',
  
  // Events
  {
    "type": "event",
    "name": "MarketCreated",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true },
      { "name": "question", "type": "string", "indexed": false },
      { "name": "expiry", "type": "uint256", "indexed": false },
      { "name": "bettingDeadline", "type": "uint256", "indexed": false },
      { "name": "creator", "type": "address", "indexed": true }
    ]
  },
  {
    "type": "event",
    "name": "MinLockDurationChanged",
    "inputs": [
      { "name": "oldDuration", "type": "uint256", "indexed": false },
      { "name": "newDuration", "type": "uint256", "indexed": false }
    ]
  },
];

// Market ABI - matches deployed Foundry contract
// Using JSON format for functions that need encoding
export const MARKET_ABI = [
  // State variables
  'function question() view returns (string)',
  'function expiry() view returns (uint256)',
  'function bettingDeadline() view returns (uint256)',
  'function factory() view returns (address)',
  'function creator() view returns (address)',
  'function result() view returns (uint8)',
  'function totalYesBetsAmount() view returns (uint256)',
  'function totalNoBetsAmount() view returns (uint256)',
  'function totalYesBets() view returns (uint256)',
  'function totalNoBets() view returns (uint256)',
  'function protocolFeeBps() view returns (uint256)',
  'function treasury() view returns (address)',
  'function accruedFees() view returns (uint256)',
  'function accruedCreatorFees() view returns (uint256)',
  
  // Mappings
  'function yesBets(address) view returns (uint256)',
  'function noBets(address) view returns (uint256)',
  'function hasVoted(address) view returns (bool)',
  'function hasClaimed(address) view returns (bool)',
  
  // Betting functions - JSON format for proper encoding
  {
    "type": "function",
    "name": "placeYes",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "placeNo",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  
  // Resolution & claims
  'function resolve(uint8 _result)',
  {
    "type": "function",
    "name": "claim",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable"
  },
  'function getClaimableAmount(address user) view returns (uint256 claimableAmount, uint256 feeDeducted)',
  
  // Creator fee withdrawal
  'function withdrawCreatorFees()',
  
  // Getter functions
  'function getTotalYesBetsAmount() view returns (uint256)',
  'function getTotalNoBetsAmount() view returns (uint256)',
  'function getTotalPoolAmount() view returns (uint256)',
  'function getTotalBets() view returns (uint256)',
  'function getUserBet(address user) view returns (uint256)',
  'function getProbablityYes() view returns (uint256)',
  'function getProbablityNo() view returns (uint256)',
  'function getIsExpired() view returns (bool)',
  'function getIsresolved() view returns (bool)',
  'function getFactoryAddress() view returns (address)',
  'function getMarketQuestion() view returns (string)',
  'function getMarketExpiry() view returns (uint256)',
  'function getTotalAmountToBeClaimedByTheWinningSide() view returns (uint256)',
  'function isCreatorEligibleForFees() view returns (bool)',
  'function isOneSided() view returns (bool)',
  'function isBettingOpen() view returns (bool)',
  'function isLocked() view returns (bool)',
  'function getTimeUntilBettingEnds() view returns (uint256)',
  'function getTimeUntilExpiry() view returns (uint256)',
  'function getBettingDeadline() view returns (uint256)',
  'function getLockDuration() view returns (uint256)',
  'function getFeeInfo() view returns (uint256 platformFeeBps, uint256 creatorFeeBps, bool creatorEligible, bool oneSided)',
  
  // Events
  {
    "type": "event",
    "name": "BetPlaced",
    "inputs": [
      { "name": "bettor", "type": "address", "indexed": true },
      { "name": "yesSide", "type": "bool", "indexed": false },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "winnings", "type": "uint256", "indexed": false },
      { "name": "platformFee", "type": "uint256", "indexed": false },
      { "name": "creatorFee", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "CreatorFeesWithdrawn",
    "inputs": [
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  },
  'event Resolved(uint8 outcome)',
  'event MarketCancelled()',
  'event FeesWithdrawn(address treasury, uint256 amount)',
];

// Market Result enum - matches Solidity enum
export const MARKET_RESULT = {
  Pending: 0,
  Yes: 1,
  No: 2,
};

// Helper to check if market is resolved
export const isMarketResolved = (result) => result !== MARKET_RESULT.Pending;

// Market status for UI
export const MARKET_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
};

// Helper to get result label
export const getResultLabel = (result) => {
  switch (result) {
    case MARKET_RESULT.Pending:
      return 'Pending';
    case MARKET_RESULT.Yes:
      return 'Yes';
    case MARKET_RESULT.No:
      return 'No';
    default:
      return 'Unknown';
  }
};

export default {
  CONTRACT_ADDRESSES,
  MARKET_FACTORY_ABI,
  MARKET_ABI,
  MARKET_RESULT,
  MARKET_TYPES,
  MARKET_TYPE_ICONS,
  MARKET_TYPE_LABELS,
  MARKET_STATUS,
  isMarketResolved,
  getResultLabel,
};
