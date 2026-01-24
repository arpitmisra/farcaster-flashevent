// Contract Addresses for Monad Testnet
export const CONTRACTS = {
  MARKET_FACTORY: (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS || '0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007') as `0x${string}`,
  PLATFORM_TREASURY: (process.env.NEXT_PUBLIC_PLATFORM_TREASURY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
};

// Fee Configuration (matches smart contract)
export const FEES = {
  PLATFORM_FEE_BPS: 250, // 2.5%
  CREATOR_FEE_BPS: 500, // 5%
  MIN_BETS_FOR_CREATOR: 10, // Minimum bets for creator to earn fees
  ONE_SIDED_FEE_BPS: 500, // 5% fee for one-sided markets
};

// Network Configuration
export const NETWORK = {
  CHAIN_ID: 10143,
  CHAIN_NAME: 'Monad Testnet',
  RPC_URL: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/demo',
  EXPLORER_URL: 'https://testnet.monadexplorer.com',
  NATIVE_CURRENCY: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
};

// Market Result Enum (matches Solidity)
export enum MarketResult {
  Pending = 0,
  Yes = 1,
  No = 2,
}

// Helper to get result label
export function getResultLabel(result: MarketResult): string {
  switch (result) {
    case MarketResult.Pending:
      return 'Pending';
    case MarketResult.Yes:
      return 'Yes';
    case MarketResult.No:
      return 'No';
    default:
      return 'Unknown';
  }
}
