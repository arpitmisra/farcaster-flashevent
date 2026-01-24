// Monad Testnet Configuration (chainId 10143)
export const MONAD_TESTNET = {
  chainId: 10143,
  chainIdHex: '0x279f',
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5'],
    },
    public: {
      http: ['https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
};

// Chain configurations map
export const CHAINS = {
  [MONAD_TESTNET.chainId]: MONAD_TESTNET,
};

// Get chain by ID
export function getChainById(chainId) {
  return CHAINS[chainId] || null;
}

// Get RPC URL for a chain
export function getRpcUrl(chainId) {
  const chain = getChainById(chainId);
  if (!chain) return null;
  return chain.rpcUrls.default.http[0];
}

// Get block explorer URL
export function getExplorerUrl(chainId) {
  const chain = getChainById(chainId);
  if (!chain) return null;
  return chain.blockExplorers.default.url;
}

// Get transaction URL
export function getTxUrl(chainId, txHash) {
  const explorerUrl = getExplorerUrl(chainId);
  if (!explorerUrl) return null;
  return `${explorerUrl}/tx/${txHash}`;
}

// Get address URL
export function getAddressUrl(chainId, address) {
  const explorerUrl = getExplorerUrl(chainId);
  if (!explorerUrl) return null;
  return `${explorerUrl}/address/${address}`;
}

export default CHAINS;
