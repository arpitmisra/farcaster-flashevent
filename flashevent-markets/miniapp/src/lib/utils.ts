import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatEther, parseEther } from 'viem';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format ETH value for display
export function formatEth(value: bigint | string | number, decimals = 4): string {
  if (typeof value === 'string' || typeof value === 'number') {
    value = BigInt(value);
  }
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

// Parse ETH string to bigint
export function parseEthInput(value: string): bigint {
  try {
    return parseEther(value);
  } catch {
    return BigInt(0);
  }
}

// Format percentage
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Format large numbers with abbreviations
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// Format address for display
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format time remaining
export function formatTimeRemaining(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp * 1000 - now;
  
  if (diff <= 0) return 'Expired';
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Calculate odds percentage from pools
export function calculateOdds(yesPool: bigint, noPool: bigint): { yes: number; no: number } {
  const total = yesPool + noPool;
  if (total === BigInt(0)) {
    return { yes: 50, no: 50 };
  }
  
  const yes = (Number(yesPool) / Number(total)) * 100;
  const no = (Number(noPool) / Number(total)) * 100;
  
  return { yes, no };
}

// Calculate potential winnings
export function calculatePotentialWinnings(
  betAmount: bigint,
  side: 'YES' | 'NO',
  yesPool: bigint,
  noPool: bigint,
  platformFeeBps: number = 250,
  creatorFeeBps: number = 500,
  totalBets: number = 0,
  minBetsForCreator: number = 10
): { winnings: bigint; profit: bigint; roi: number } {
  const newYesPool = side === 'YES' ? yesPool + betAmount : yesPool;
  const newNoPool = side === 'NO' ? noPool + betAmount : noPool;
  const totalPool = newYesPool + newNoPool;
  
  // Calculate fees
  const platformFee = (totalPool * BigInt(platformFeeBps)) / BigInt(10000);
  const creatorFee = totalBets >= minBetsForCreator 
    ? (totalPool * BigInt(creatorFeeBps)) / BigInt(10000)
    : BigInt(0);
  
  const winnerPool = totalPool - platformFee - creatorFee;
  
  // Calculate user's share
  const userPool = side === 'YES' ? newYesPool : newNoPool;
  const winnings = (betAmount * winnerPool) / userPool;
  const profit = winnings - betAmount;
  const roi = Number(profit) / Number(betAmount) * 100;
  
  return { winnings, profit, roi };
}

// Re-export getLevelFromXP from types for convenience
export { getLevelFromXP } from '@/types/index';

// Generate share text for Farcaster
export function generateShareText(
  type: 'bet' | 'win' | 'market_created',
  data: {
    question?: string;
    amount?: string;
    side?: 'YES' | 'NO';
    profit?: string;
    roi?: number;
  }
): string {
  switch (type) {
    case 'bet':
      return `⚡ I just predicted ${data.side} on "${data.question}" with ${data.amount} ETH!\n\nThink I'm right? 🤔`;
    case 'win':
      return `🏆 I WON! Earned +${data.profit} ETH (${data.roi?.toFixed(1)}% ROI) predicting "${data.question}"!\n\n🔥 Think you can beat me?`;
    case 'market_created':
      return `🚀 I just created a prediction market: "${data.question}"\n\n🎯 Be among the first to predict!`;
    default:
      return '';
  }
}

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
