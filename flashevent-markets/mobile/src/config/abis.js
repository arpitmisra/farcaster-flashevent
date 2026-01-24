/**
 * Complete ABIs for FlashEvent Markets Contracts
 * Using Monad Testnet (Chain ID: 10143)
 * Deployed addresses should point to Monad testnet contracts
 */

// MarketFactory Full ABI
export const MARKET_FACTORY_FULL_ABI = [
  // Constructor
  {
    "type": "constructor",
    "inputs": [
      { "name": "_treasury", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  
  // Functions
  {
    "type": "function",
    "name": "createMarket",
    "inputs": [
      { "name": "_question", "type": "string", "internalType": "string" },
      { "name": "_expiry", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "creationPaused",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "defaultProtocolFeeBps",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllMarkets",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address[]", "internalType": "address[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarket",
    "inputs": [
      { "name": "index", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketsCount",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pauseCreation",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveMarket",
    "inputs": [
      { "name": "marketAddr", "type": "address", "internalType": "address" },
      { "name": "outcome", "type": "uint8", "internalType": "enum Market.Result" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resumeCreation",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTreasury",
    "inputs": [
      { "name": "newTreasury", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      { "name": "newOwner", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdrawMarketFees",
    "inputs": [
      { "name": "marketAddr", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // Events
  {
    "type": "event",
    "name": "MarketCreated",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "question", "type": "string", "indexed": false, "internalType": "string" },
      { "name": "expiry", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      { "name": "previousOwner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "newOwner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TreasuryChanged",
    "inputs": [
      { "name": "newTreasury", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  
  // Errors
  {
    "type": "error",
    "name": "CreationPaused",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidExpiry",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTreasury",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  }
];

// Market Full ABI
export const MARKET_FULL_ABI = [
  // Constructor
  {
    "type": "constructor",
    "inputs": [
      { "name": "_question", "type": "string", "internalType": "string" },
      { "name": "_expiry", "type": "uint256", "internalType": "uint256" },
      { "name": "_treasury", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  
  // Betting Functions
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
  {
    "type": "function",
    "name": "claim",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "nonpayable"
  },
  
  // Resolution
  {
    "type": "function",
    "name": "resolve",
    "inputs": [
      { "name": "_result", "type": "uint8", "internalType": "enum Market.Result" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelMarket",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // State Variables
  {
    "type": "function",
    "name": "question",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "string", "internalType": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "expiry",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "result",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint8", "internalType": "enum Market.Result" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "protocolFeeBps",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "accruedFees",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalYesBetsAmount",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalNoBetsAmount",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalYesBets",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalNoBets",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  
  // Mappings
  {
    "type": "function",
    "name": "yesBets",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "noBets",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasVoted",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasClaimed",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  
  // Getter Functions
  {
    "type": "function",
    "name": "getTotalYesBetsAmount",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalNoBetsAmount",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalPoolAmount",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserBet",
    "inputs": [
      { "name": "user", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "totalAmountUserBet", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getClaimableAmount",
    "inputs": [
      { "name": "user", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "claimableAmount", "type": "uint256", "internalType": "uint256" },
      { "name": "feeDeducted", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getProbablityYes",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getProbablityNo",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getIsExpired",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getIsresolved",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getFactoryAddress",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketQuestion",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "string", "internalType": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketExpiry",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalAmountToBeClaimedByTheWinningSide",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  
  // Admin Functions
  {
    "type": "function",
    "name": "setProtocolFee",
    "inputs": [
      { "name": "newFeeBps", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTreasury",
    "inputs": [
      { "name": "_treasury", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawFees",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // Events
  {
    "type": "event",
    "name": "BetPlaced",
    "inputs": [
      { "name": "bettor", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "yesSide", "type": "bool", "indexed": false, "internalType": "bool" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Resolved",
    "inputs": [
      { "name": "outcome", "type": "uint8", "indexed": false, "internalType": "enum Market.Result" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "winnings", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "fee", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketCancelled",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeesWithdrawn",
    "inputs": [
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  
  // Errors
  {
    "type": "error",
    "name": "AlreadyClaimed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyVoted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CannotCancelResolvedMarket",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ClaimTransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DidNotBetOnWinningSide",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeWithdrawalFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTreasury",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketAlreadyResolved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketNotResolved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoFeesToWithdraw",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoWinningsToClaim",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotFactoryAddress",
    "inputs": [
      { "name": "sender", "type": "address", "internalType": "address" }
    ]
  },
  {
    "type": "error",
    "name": "RefundFailed",
    "inputs": []
  }
];

// Market Result Enum
export const MarketResult = {
  Pending: 0,
  Yes: 1,
  No: 2
};

export default {
  MARKET_FACTORY_FULL_ABI,
  MARKET_FULL_ABI,
  MarketResult
};
