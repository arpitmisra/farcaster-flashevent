// MarketFactory ABI
export const MARKET_FACTORY_ABI = [
  // Constructor
  {
    type: 'constructor',
    inputs: [{ name: '_treasury', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  
  // Core Functions
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      { name: 'question', type: 'string', internalType: 'string' },
      { name: 'expiry', type: 'uint256', internalType: 'uint256' },
      { name: 'bettingDeadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  
  // Getters
  {
    type: 'function',
    name: 'marketsCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarket',
    inputs: [{ name: 'index', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllMarkets',
    inputs: [],
    outputs: [{ name: '', type: 'address[]', internalType: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketsByCreator',
    inputs: [{ name: 'creator', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address[]', internalType: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isValidMarket',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creationPaused',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'defaultProtocolFeeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minLockDuration',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },

  // Events
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { name: 'market', type: 'address', indexed: true, internalType: 'address' },
      { name: 'question', type: 'string', indexed: false, internalType: 'string' },
      { name: 'expiry', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'bettingDeadline', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'creator', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
] as const;

// Market ABI
export const MARKET_ABI = [
  // Betting Functions
  {
    type: 'function',
    name: 'placeYes',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'placeNo',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  
  // State Variables
  {
    type: 'function',
    name: 'question',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'expiry',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bettingDeadline',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creator',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'result',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum Market.Result' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalYesBetsAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalNoBetsAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalYesBets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalNoBets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  
  // User Mappings
  {
    type: 'function',
    name: 'yesBets',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'noBets',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  
  // Getters
  {
    type: 'function',
    name: 'getTotalPoolAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalBets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserBet',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'totalAmountUserBet', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getClaimableAmount',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'claimableAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'feeDeducted', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProbablityYes',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProbablityNo',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getIsExpired',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getIsresolved',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isBettingOpen',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isLocked',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isOneSided',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isCreatorEligibleForFees',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTimeUntilBettingEnds',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTimeUntilExpiry',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeInfo',
    inputs: [],
    outputs: [
      { name: 'platformFeeBps', type: 'uint256', internalType: 'uint256' },
      { name: 'creatorFeeBps', type: 'uint256', internalType: 'uint256' },
      { name: 'platformFeesAccrued', type: 'uint256', internalType: 'uint256' },
      { name: 'creatorFeesAccrued', type: 'uint256', internalType: 'uint256' },
      { name: 'treasuryAddress', type: 'address', internalType: 'address' },
      { name: 'creatorAddress', type: 'address', internalType: 'address' },
      { name: 'minBetsRequired', type: 'uint256', internalType: 'uint256' },
      { name: 'creatorEligibleForFees', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBetsUntilCreatorEligible',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  
  // Events
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'bettor', type: 'address', indexed: true, internalType: 'address' },
      { name: 'yesSide', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Resolved',
    inputs: [{ name: 'outcome', type: 'uint8', indexed: false, internalType: 'enum Market.Result' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'winnings', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'platformFee', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'creatorFee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketCancelled',
    inputs: [],
    anonymous: false,
  },
] as const;
