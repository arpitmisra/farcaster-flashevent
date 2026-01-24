'use client';

import { ReactNode, useEffect, useState, createContext, useContext, useCallback, useMemo } from 'react';
import sdk, { type Context } from '@farcaster/frame-sdk';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';
import { type Chain } from 'viem';

// Monad Testnet Configuration
export const monadTestnet: Chain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { 
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/demo'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Monad Explorer', 
      url: 'https://testnet.monadexplorer.com' 
    },
  },
  testnet: true,
};

// Check if we're in a Farcaster Mini App environment (client-side only)
const getIsMiniAppEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.search.includes('miniApp=true') || 
         window.parent !== window ||
         window.location.href.includes('warpcast');
};

// Create wagmi config based on environment
// The Farcaster connector will be first in miniapp, injected first otherwise
function createWagmiConfig(isMiniApp: boolean) {
  const connectors = isMiniApp
    ? [
        // In Mini App: Farcaster connector first (primary)
        miniAppConnector(),
        // Fallback to injected
        injected({ shimDisconnect: true }),
      ]
    : [
        // In browser: Injected (MetaMask) first
        injected({ shimDisconnect: true }),
        // Farcaster as fallback
        miniAppConnector(),
      ];

  return createConfig({
    chains: [monadTestnet],
    transports: {
      [monadTestnet.id]: http(),
    },
    connectors,
    ssr: true,
  });
}

// Initial config - will be replaced with proper one once we know the environment
let wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
  connectors: [
    miniAppConnector(),
    injected({ shimDisconnect: true }),
  ],
  ssr: true,
});

// React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Farcaster Context Types
interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  custody?: string;
}

interface FarcasterContextType {
  context: Context | null;
  user: FarcasterUser | null;
  isSDKLoaded: boolean;
  isInMiniApp: boolean;
  isWalletReady: boolean;
  connectedAddress: string | null;
  openUrl: (url: string) => Promise<void>;
  shareToFarcaster: (text: string, embedUrl?: string) => Promise<void>;
  addMiniApp: () => Promise<void>;
}

const FarcasterContext = createContext<FarcasterContextType>({
  context: null,
  user: null,
  isSDKLoaded: false,
  isInMiniApp: false,
  isWalletReady: false,
  connectedAddress: null,
  openUrl: async () => {},
  shareToFarcaster: async () => {},
  addMiniApp: async () => {},
});

export const useFarcaster = () => {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error('useFarcaster must be used within FarcasterProvider');
  }
  return context;
};

function FarcasterProvider({ children }: { children: ReactNode }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Check if we're in a Farcaster Mini App environment
        const isMiniAppEnv = getIsMiniAppEnvironment();

        if (isMiniAppEnv) {
          console.log('Detected Farcaster Mini App environment');
          
          // Load Farcaster context (auto-authentication)
          const ctx = await sdk.context;
          setContext(ctx);
          setIsInMiniApp(true);

          // Extract user info from context
          if (ctx?.user) {
            setUser({
              fid: ctx.user.fid,
              username: ctx.user.username,
              displayName: ctx.user.displayName,
              pfpUrl: ctx.user.pfpUrl,
            });
            console.log('Farcaster user loaded:', ctx.user.username);
          }

          // Try to get the ethereum provider and connected accounts
          try {
            const provider = await sdk.wallet.getEthereumProvider();
            if (provider) {
              console.log('Farcaster Ethereum provider obtained');
              setIsWalletReady(true);
              
              // Try to get the connected account
              try {
                const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
                if (accounts && accounts.length > 0) {
                  setConnectedAddress(accounts[0]);
                  console.log('Farcaster wallet already connected:', accounts[0]);
                }
              } catch (accountErr) {
                console.log('No accounts connected yet, will connect on demand');
              }
            }
          } catch (providerErr) {
            console.error('Failed to get Farcaster wallet provider:', providerErr);
            // Still proceed - user may need to connect
          }

          // Signal ready to Farcaster client (hides splash screen)
          sdk.actions.ready();
          console.log('Farcaster SDK ready, context:', ctx);
        } else {
          console.log('Not in Farcaster Mini App environment, using browser wallet');
          setIsWalletReady(true); // Browser wallets are always "ready"
        }
        
        setIsSDKLoaded(true);
      } catch (error) {
        console.error('Failed to load Farcaster SDK:', error);
        setIsSDKLoaded(true); // Still proceed for development
        setIsWalletReady(true);
      }
    };

    load();
  }, []);

  // Open URL using Farcaster SDK or fallback to window.open
  const openUrl = useCallback(async (url: string) => {
    if (isInMiniApp) {
      await sdk.actions.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  }, [isInMiniApp]);

  // Share to Farcaster (compose cast)
  const shareToFarcaster = useCallback(async (text: string, embedUrl?: string) => {
    // Only include embed URL if it's a valid https URL (not localhost)
    const validEmbedUrl = embedUrl && embedUrl.startsWith('https://') ? embedUrl : undefined;
    
    if (isInMiniApp) {
      try {
        await sdk.actions.composeCast({
          text,
          embeds: validEmbedUrl ? [validEmbedUrl as `https://${string}`] : undefined,
        });
      } catch (err) {
        console.error('Failed to compose cast:', err);
        // Fallback to web if SDK fails
        openWarpcastCompose(text, validEmbedUrl);
      }
    } else {
      openWarpcastCompose(text, validEmbedUrl);
    }
  }, [isInMiniApp]);

  // Helper to open Warpcast compose in browser
  const openWarpcastCompose = (text: string, embedUrl?: string) => {
    const encodedText = encodeURIComponent(text);
    // Warpcast compose URL format
    let url = `https://warpcast.com/~/compose?text=${encodedText}`;
    if (embedUrl) {
      url += `&embeds[]=${encodeURIComponent(embedUrl)}`;
    }
    window.open(url, '_blank');
  };

  // Add Mini App to user's list
  const addMiniApp = useCallback(async () => {
    if (isInMiniApp) {
      await sdk.actions.addMiniApp();
    }
  }, [isInMiniApp]);

  // Loading state
  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-pulse">⚡</div>
          <p className="text-white text-lg font-medium">Loading FlashEvent...</p>
          <div className="w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <FarcasterContext.Provider value={{ 
      context, 
      user, 
      isSDKLoaded, 
      isInMiniApp,
      isWalletReady,
      connectedAddress,
      openUrl,
      shareToFarcaster,
      addMiniApp,
    }}>
      {children}
    </FarcasterContext.Provider>
  );
}

// Main Providers Component
export function Providers({ children }: { children: ReactNode }) {
  return (
    <FarcasterProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
            config={{
              loginMethods: ['wallet', 'email', 'google', 'twitter', 'farcaster'],
              appearance: {
                theme: 'dark',
                accentColor: '#8B5CF6',
                logo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/logo.png`,
                landingHeader: '⚡ FlashEvent Markets',
                showWalletLoginFirst: true,
              },
              embeddedWallets: {
                createOnLogin: 'all-users',
                requireUserPasswordOnCreate: false,
                noPromptOnSignature: true,
              },
              externalWallets: {
                coinbaseWallet: {
                  connectionOptions: 'smartWalletOnly',
                },
              },
              supportedChains: [monadTestnet],
              defaultChain: monadTestnet,
            }}
          >
            {children}
          </PrivyProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </FarcasterProvider>
  );
}

export { wagmiConfig, queryClient };
