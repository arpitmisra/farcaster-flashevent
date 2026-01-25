'use client';

import { ReactNode, useEffect, useState, createContext, useContext, useCallback } from 'react';
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

// Initial config
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
      staleTime: 60 * 1000,
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
        console.log('🔍 Environment check - isMiniApp:', isMiniAppEnv);

        if (isMiniAppEnv) {
          console.log('⚡ Initializing Farcaster Mini App SDK...');
          
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
            console.log('👤 Farcaster user loaded:', ctx.user.username, 'FID:', ctx.user.fid);
          }

          // Try to get the ethereum provider and connected accounts
          try {
            const provider = await sdk.wallet.getEthereumProvider();
            if (provider) {
              console.log('💼 Farcaster Ethereum provider obtained');
              setIsWalletReady(true);
              
              // Try to get the connected account
              try {
                const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
                if (accounts && accounts.length > 0) {
                  setConnectedAddress(accounts[0]);
                  console.log('✅ Farcaster wallet connected:', accounts[0]);
                }
              } catch (accountErr) {
                console.log('ℹ️ No accounts connected yet, will connect on demand');
              }
            }
          } catch (providerErr) {
            console.error('⚠️ Failed to get Farcaster wallet provider:', providerErr);
            // Still proceed - user may need to connect manually
          }

          // ⚡ CRITICAL: Signal ready to Farcaster client (hides splash screen)
          console.log('🚀 Calling sdk.actions.ready()...');
          sdk.actions.ready();
          console.log('✅ SDK ready called - splash screen should hide now');
          
        } else {
          console.log('🌐 Not in Farcaster Mini App - using browser mode');
          setIsWalletReady(true); // Browser wallets are always "ready"
        }
        
        setIsSDKLoaded(true);
        console.log('✅ SDK loading complete');
        
      } catch (error) {
        console.error('❌ Failed to load Farcaster SDK:', error);
        
        // IMPORTANT: Still call ready even on error to prevent infinite loading
        try {
          sdk.actions.ready();
          console.log('⚠️ Called ready() despite error to prevent stuck splash screen');
        } catch (readyErr) {
          console.error('❌ Even ready() failed:', readyErr);
        }
        
        setIsSDKLoaded(true);
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
    const validEmbedUrl = embedUrl && embedUrl.startsWith('https://') ? embedUrl : undefined;
    
    if (isInMiniApp) {
      try {
        await sdk.actions.composeCast({
          text,
          embeds: validEmbedUrl ? [validEmbedUrl as `https://${string}`] : undefined,
        });
      } catch (err) {
        console.error('Failed to compose cast:', err);
        openWarpcastCompose(text, validEmbedUrl);
      }
    } else {
      openWarpcastCompose(text, validEmbedUrl);
    }
  }, [isInMiniApp]);

  // Helper to open Warpcast compose in browser
  const openWarpcastCompose = (text: string, embedUrl?: string) => {
    const encodedText = encodeURIComponent(text);
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

  // 🔥 CRITICAL FIX: Return null instead of custom loading screen
  // This lets Farcaster's splash screen work properly
  if (!isSDKLoaded) {
    return null;
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