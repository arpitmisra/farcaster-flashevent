const { ethers } = require('ethers');
const { MARKET_ABI, MARKET_FACTORY_ABI, MARKET_RESULT } = require('../config/abis');

// Network config
const NETWORKS = {
  monadTestnet: {
    chainId: 10143,
    rpcUrl: process.env.RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
    contracts: {
      MarketFactory: process.env.MARKET_FACTORY_ADDRESS,
    },
  },
};

// Get network
const NETWORK = process.env.NETWORK || 'monadTestnet';
const networkConfig = NETWORKS[NETWORK];

// Provider singleton
let provider = null;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  }
  return provider;
}

// Wallet for signing transactions (resolver)
let wallet = null;

function getWallet() {
  if (!wallet) {
    const privateKey = process.env.RESOLVER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('RESOLVER_PRIVATE_KEY not set');
    }
    wallet = new ethers.Wallet(privateKey, getProvider());
  }
  return wallet;
}

// Contract instances cache
const contracts = {};

function getContract(name, address = null) {
  const contractAddress = address || networkConfig.contracts[name];

  if (!contractAddress) {
    throw new Error(`Contract address not configured: ${name}`);
  }

  const key = `${name}_${contractAddress}`;
  if (!contracts[key]) {
    const abi = getABI(name);
    contracts[key] = new ethers.Contract(contractAddress, abi, getProvider());
  }

  return contracts[key];
}

function getABI(name) {
  switch (name) {
    case 'MarketFactory':
      return MARKET_FACTORY_ABI;
    case 'Market':
      return MARKET_ABI;
    default:
      throw new Error(`Unknown contract: ${name}`);
  }
}

// Get market contract instance
function getMarketContract(marketAddress) {
  return new ethers.Contract(marketAddress, MARKET_ABI, getProvider());
}

// Get market contract with signer
function getMarketContractWithSigner(marketAddress) {
  return new ethers.Contract(marketAddress, MARKET_ABI, getWallet());
}

// Get factory contract with signer (for admin operations)
function getFactoryWithSigner() {
  const factory = getContract('MarketFactory');
  return factory.connect(getWallet());
}

// ============ Market Factory Functions ============

async function getAllMarkets() {
  const factory = getContract('MarketFactory');
  return factory.getAllMarkets();
}

async function getMarketsCount() {
  const factory = getContract('MarketFactory');
  const count = await factory.marketsCount();
  return Number(count);
}

// Get markets with pagination
async function getMarkets(offset, limit) {
  const factory = getContract('MarketFactory');
  return factory.getMarkets(offset, limit);
}

// Get market index by address
async function getMarketIndex(marketAddress) {
  const factory = getContract('MarketFactory');
  return Number(await factory.getMarketIndex(marketAddress));
}

async function getMarketByIndex(index) {
  const factory = getContract('MarketFactory');
  return factory.getMarket(index);
}

async function isValidMarket(marketAddress) {
  const factory = getContract('MarketFactory');
  return factory.isValidMarket(marketAddress);
}

// Default lock duration: 15 minutes before expiry for betting deadline
const DEFAULT_LOCK_DURATION = 15 * 60; // 15 minutes in seconds

async function createMarket(question, expiryTimestamp, bettingDeadline = null) {
  const factory = getFactoryWithSigner();
  
  // If no bettingDeadline provided, default to 15 minutes before expiry
  const actualBettingDeadline = bettingDeadline || (expiryTimestamp - DEFAULT_LOCK_DURATION);
  
  // Check wallet balance before attempting transaction
  const wallet = getWallet();
  const balance = await getProvider().getBalance(wallet.address);
  const minBalance = ethers.parseEther('0.001'); // Minimum balance needed for gas
  
  if (balance < minBalance) {
    const balanceFormatted = ethers.formatEther(balance);
    const error = new Error(
      `Server wallet has insufficient balance (${balanceFormatted} MON). ` +
      `Please fund the wallet at ${wallet.address} with at least 0.01 MON.`
    );
    error.code = 'INSUFFICIENT_SERVER_FUNDS';
    error.walletAddress = wallet.address;
    error.currentBalance = balanceFormatted;
    throw error;
  }
  
  let tx;
  try {
    tx = await factory.createMarket(question, expiryTimestamp, actualBettingDeadline);
  } catch (txError) {
    // Handle specific transaction errors
    const msg = txError.message || '';
    if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
      const error = new Error(
        `Server wallet has insufficient balance to pay for gas. ` +
        `Please fund the wallet at ${wallet.address}.`
      );
      error.code = 'INSUFFICIENT_SERVER_FUNDS';
      error.walletAddress = wallet.address;
      throw error;
    }
    throw txError;
  }
  
  const receipt = await tx.wait();

  // Extract market address from event
  const event = receipt.logs.find((log) => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === 'MarketCreated';
    } catch {
      return false;
    }
  });

  if (!event) {
    throw new Error('MarketCreated event not found');
  }

  const parsed = factory.interface.parseLog(event);
  return {
    txHash: receipt.hash,
    marketAddress: parsed.args.market,
    question: parsed.args.question,
    expiry: Number(parsed.args.expiry),
    bettingDeadline: Number(parsed.args.bettingDeadline),
  };
}

// ============ Market Functions ============

async function getMarketDetails(marketAddress) {
  const market = getMarketContract(marketAddress);

  const [
    question,
    expiry,
    factory,
    result,
    totalYesBetsAmount,
    totalNoBetsAmount,
    totalYesBets,
    totalNoBets,
    protocolFeeBps,
    treasury,
    yesProbability,
    noProbability,
    isExpired,
    isResolved,
  ] = await Promise.all([
    market.question(),
    market.expiry(),
    market.factory(),
    market.result(),
    market.totalYesBetsAmount(),
    market.totalNoBetsAmount(),
    market.totalYesBets(),
    market.totalNoBets(),
    market.protocolFeeBps(),
    market.treasury(),
    market.getProbablityYes(),
    market.getProbablityNo(),
    market.getIsExpired(),
    market.getIsresolved(),
  ]);

  return {
    address: marketAddress,
    question,
    expiry: Number(expiry),
    expiryMs: Number(expiry) * 1000,
    factory,
    result: Number(result),
    resultLabel: getResultLabel(Number(result)),
    totalYesBetsAmount: ethers.formatEther(totalYesBetsAmount),
    totalNoBetsAmount: ethers.formatEther(totalNoBetsAmount),
    totalYesBets: Number(totalYesBets),
    totalNoBets: Number(totalNoBets),
    totalPool: ethers.formatEther(totalYesBetsAmount + totalNoBetsAmount),
    protocolFeeBps: Number(protocolFeeBps),
    treasury,
    yesProbability: Number(yesProbability),
    noProbability: Number(noProbability),
    isExpired,
    isResolved,
  };
}

async function getUserPosition(marketAddress, userAddress) {
  const market = getMarketContract(marketAddress);

  const [yesBets, noBets, hasVoted, hasClaimed] = await Promise.all([
    market.yesBets(userAddress),
    market.noBets(userAddress),
    market.hasVoted(userAddress),
    market.hasClaimed(userAddress),
  ]);

  return {
    yesBets: ethers.formatEther(yesBets),
    noBets: ethers.formatEther(noBets),
    totalBet: ethers.formatEther(yesBets + noBets),
    hasVoted,
    hasClaimed,
    side: yesBets > 0n ? 'YES' : noBets > 0n ? 'NO' : null,
  };
}

// ============ CRITICAL: Bet Placement Functions ============

// Place a YES bet on a market
async function placeYesBet(marketAddress, amount) {
  try {
    const market = getMarketContractWithSigner(marketAddress);
    
    // amount should be in ETH, convert to Wei
    const amountWei = ethers.parseEther(amount.toString());
    
    const tx = await market.placeYes({ value: amountWei });
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      amount: amount,
      side: 'YES',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      side: 'YES',
    };
  }
}

// Place a NO bet on a market
async function placeNoBet(marketAddress, amount) {
  try {
    const market = getMarketContractWithSigner(marketAddress);
    
    // amount should be in ETH, convert to Wei
    const amountWei = ethers.parseEther(amount.toString());
    
    const tx = await market.placeNo({ value: amountWei });
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      amount: amount,
      side: 'NO',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      side: 'NO',
    };
  }
}

// Claim winnings from a resolved market
async function claimWinnings(marketAddress) {
  try {
    const market = getMarketContractWithSigner(marketAddress);
    
    const tx = await market.claim();
    const receipt = await tx.wait();
    
    // Get claimed amount from events
    const events = receipt.logs.map(log => {
      try {
        return market.interface.parseLog(log);
      } catch {
        return null;
      }
    }).filter(e => e && e.name === 'Claimed');
    
    const claimEvent = events[0];
    
    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      winnings: claimEvent ? ethers.formatEther(claimEvent.args.winnings) : '0',
      fee: claimEvent ? ethers.formatEther(claimEvent.args.fee) : '0',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get all YES bettors for a market
async function getBettorsYes(marketAddress) {
  const market = getMarketContract(marketAddress);
  try {
    const bettors = await market.getBettorsYes();
    return bettors;
  } catch (error) {
    console.error('Error getting YES bettors:', error);
    return [];
  }
}

// Get all NO bettors for a market
async function getBettorsNo(marketAddress) {
  const market = getMarketContract(marketAddress);
  try {
    const bettors = await market.getBettorsNo();
    return bettors;
  } catch (error) {
    console.error('Error getting NO bettors:', error);
    return [];
  }
}

async function getClaimableAmount(marketAddress, userAddress) {
  const market = getMarketContract(marketAddress);

  try {
    const [claimableAmount, feeDeducted] = await market.getClaimableAmount(userAddress);
    return {
      claimable: ethers.formatEther(claimableAmount),
      fee: ethers.formatEther(feeDeducted),
      canClaim: claimableAmount > 0n,
    };
  } catch (error) {
    return {
      claimable: '0',
      fee: '0',
      canClaim: false,
      error: error.message,
    };
  }
}

// Set protocol fee for a specific market
async function setMarketProtocolFee(marketAddress, feeBps) {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.setMarketProtocolFee(marketAddress, feeBps);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      marketAddress,
      feeBps,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Set treasury for a specific market
async function setMarketTreasury(marketAddress, newTreasury) {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.setMarketTreasury(marketAddress, newTreasury);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      marketAddress,
      newTreasury,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============ Admin/Resolver Functions ============

// Set treasury address (ADMIN)
async function setTreasury(newTreasury) {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.setTreasury(newTreasury);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      newTreasury,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Pause market creation (ADMIN)
async function pauseCreation() {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.pauseCreation();
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      action: 'pauseCreation',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Resume market creation (ADMIN)
async function resumeCreation() {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.resumeCreation();
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      action: 'resumeCreation',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Transfer ownership (ADMIN)
async function transferOwnership(newOwner) {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.transferOwnership(newOwner);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      newOwner,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Set default protocol fee (ADMIN)
async function setDefaultProtocolFee(feeBps) {
  try {
    const factory = getFactoryWithSigner();
    const tx = await factory.setDefaultProtocolFee(feeBps);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      feeBps,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function resolveMarket(marketAddress, outcome) {
  const factory = getFactoryWithSigner();
  
  // outcome: 1 = Yes, 2 = No
  const resultValue = outcome === 'YES' || outcome === true ? MARKET_RESULT.Yes : MARKET_RESULT.No;
  
  const tx = await factory.resolveMarket(marketAddress, resultValue);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    marketAddress,
    outcome: resultValue,
  };
}

async function cancelMarket(marketAddress) {
  const factory = getFactoryWithSigner();
  const tx = await factory.cancelMarket(marketAddress);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    marketAddress,
  };
}

async function withdrawMarketFees(marketAddress) {
  const factory = getFactoryWithSigner();
  const tx = await factory.withdrawMarketFees(marketAddress);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    marketAddress,
  };
}

// ============ Event Listeners ============

function onMarketCreated(callback) {
  const factory = getContract('MarketFactory');
  factory.on('MarketCreated', (market, question, expiry) => {
    callback({
      marketAddress: market,
      question,
      expiry: Number(expiry),
    });
  });

  return () => factory.removeAllListeners('MarketCreated');
}

function onBetPlaced(marketAddress, callback) {
  const market = getMarketContract(marketAddress);
  market.on('BetPlaced', (bettor, yesSide, amount) => {
    callback({
      bettor,
      side: yesSide ? 'YES' : 'NO',
      amount: ethers.formatEther(amount),
    });
  });

  return () => market.removeAllListeners('BetPlaced');
}

function onMarketResolved(marketAddress, callback) {
  const market = getMarketContract(marketAddress);
  market.on('Resolved', (outcome) => {
    callback({
      outcome: Number(outcome),
      outcomeLabel: getResultLabel(Number(outcome)),
    });
  });

  return () => market.removeAllListeners('Resolved');
}

// ============ Helpers ============

function getResultLabel(result) {
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
}

async function getBalance(address) {
  const balance = await getProvider().getBalance(address);
  return ethers.formatEther(balance);
}

async function getBlockNumber() {
  return getProvider().getBlockNumber();
}

async function getBlock(blockNumber) {
  return getProvider().getBlock(blockNumber);
}

module.exports = {
  // Core
  getProvider,
  getWallet,
  getContract,
  getMarketContract,
  getMarketContractWithSigner,
  getFactoryWithSigner,
  
  // Factory functions - Getters
  getAllMarkets,
  getMarketsCount,
  getMarketByIndex,
  getMarkets, // Paginated
  getMarketIndex,
  isValidMarket,
  createMarket,
  
  // Market functions - Getters
  getMarketDetails,
  getUserPosition,
  getClaimableAmount,
  getBettorsYes,
  getBettorsNo,
  
  // BET PLACEMENT FUNCTIONS (CRITICAL)
  placeYesBet,
  placeNoBet,
  claimWinnings,
  
  // Market admin functions
  setMarketProtocolFee,
  setMarketTreasury,
  
  // Factory admin functions
  setTreasury,
  pauseCreation,
  resumeCreation,
  transferOwnership,
  setDefaultProtocolFee,
  
  // Market resolution functions
  resolveMarket,
  cancelMarket,
  withdrawMarketFees,
  
  // Event listeners
  onMarketCreated,
  onBetPlaced,
  onMarketResolved,
  
  // Helpers
  getResultLabel,
  getBalance,
  getBlockNumber,
  getBlock,
  
  // Constants
  MARKET_RESULT,
  networkConfig,
};
