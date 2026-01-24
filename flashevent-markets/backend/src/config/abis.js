// Market ABI - matches deployed Foundry contract
const MARKET_ABI = [
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
  
  // Betting functions
  'function placeYes() payable',
  'function placeNo() payable',
  
  // Resolution & claims
  'function resolve(uint8 _result)',
  'function claim() returns (uint256)',
  'function getClaimableAmount(address user) view returns (uint256 claimableAmount, uint256 feeDeducted)',
  
  // Creator fee withdrawal
  'function withdrawCreatorFees()',
  
  // Admin functions
  'function setProtocolFee(uint256 newFeeBps)',
  'function setTreasury(address _treasury)',
  'function withdrawFees()',
  'function cancelMarket()',
  
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
  'event BetPlaced(address indexed bettor, bool yesSide, uint256 amount)',
  'event Resolved(uint8 outcome)',
  'event Claimed(address indexed user, uint256 winnings, uint256 platformFee, uint256 creatorFee)',
  'event FeesWithdrawn(address treasury, uint256 amount)',
  'event CreatorFeesWithdrawn(address indexed creator, uint256 amount)',
  'event MarketCancelled()',
];

// MarketFactory ABI - matches deployed Foundry contract
const MARKET_FACTORY_ABI = [
  // State variables
  'function treasury() view returns (address)',
  'function owner() view returns (address)',
  'function creationPaused() view returns (bool)',
  'function defaultProtocolFeeBps() view returns (uint256)',
  'function minLockDuration() view returns (uint256)',
  
  // Core functions (now with bettingDeadline)
  'function createMarket(string memory question, uint256 expiry, uint256 bettingDeadline) returns (address)',
  
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
  'event MarketCreated(address indexed market, string question, uint256 expiry, uint256 bettingDeadline, address indexed creator)',
  'event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury)',
  'event CreationPaused()',
  'event CreationResumed()',
  'event OwnershipTransferred(address indexed oldOwner, address indexed newOwner)',
  'event ProtocolFeeChanged(uint256 newFeeBps)',
  'event MinLockDurationChanged(uint256 oldDuration, uint256 newDuration)',
];

// Market Result enum values
const MARKET_RESULT = {
  Pending: 0,
  Yes: 1,
  No: 2,
};

// Deployed Contract Addresses - Monad Testnet (Chain ID: 10143)
const CONTRACT_ADDRESSES = {
  MARKET_FACTORY: process.env.MARKET_FACTORY_ADDRESS || '0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007',
};

// Network Configuration
const NETWORK_CONFIG = {
  chainId: 10143,
  chainName: 'Monad Testnet',
  rpcUrl: process.env.MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
};

module.exports = {
  MARKET_ABI,
  MARKET_FACTORY_ABI,
  MARKET_RESULT,
  CONTRACT_ADDRESSES,
  NETWORK_CONFIG,
};
