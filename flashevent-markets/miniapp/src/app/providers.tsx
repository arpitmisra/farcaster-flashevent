'use client';

import { ReactNode, useEffect, useState, createContext, useContext, useCallback } from 'react';
import sdk from '@farcaster/frame-sdk';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, useSetActiveWallet } from '@privy-io/wagmi';
import { http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type Chain } from 'viem';
import { usePrivy, useWallets } from '@privy-io/react-auth';

type FrameSDKContext = Awaited<typeof sdk.context>;

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
  const qs = window.location.search.toLowerCase();
  const href = window.location.href.toLowerCase();
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();

  // Explicit opt-in
  if (qs.includes('miniapp=true')) return true;

  // Heuristic: Warpcast/Farcaster user agent + running in an iframe
  const looksLikeWarpcast = href.includes('warpcast') || ua.includes('warpcast') || ua.includes('farcaster');
  let isIframed = false;
  try {
    isIframed = window.self !== window.top;
  } catch {
    // Cross-origin iframe can throw; treat as iframed.
    isIframed = true;
  }

  return looksLikeWarpcast && isIframed;
};

// Wagmi config (Privy drives connector state)
const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
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
  context: FrameSDKContext | null;
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
  const [context, setContext] = useState<FrameSDKContext | null>(null);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const safeReady = (reason: string) => {
        try {
          console.log(`🚀 Calling sdk.actions.ready() (${reason})...`);
          sdk.actions.ready();
          console.log('✅ sdk.actions.ready() called');
        } catch (err) {
          console.warn('⚠️ sdk.actions.ready() failed:', err);
        }
      };

      const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        try {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
              timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      };

      try {
        // Always attempt to dismiss the Farcaster splash screen.
        // If we mis-detect the environment, the splash can get stuck forever.
        safeReady('mount');
        setTimeout(() => safeReady('mount+750ms'), 750);

        // Check if we're in a Farcaster Mini App environment
        const isMiniAppEnv = getIsMiniAppEnvironment();
        console.log('🔍 Environment check - isMiniApp:', isMiniAppEnv);

        if (isMiniAppEnv) {
          console.log('⚡ Initializing Farcaster Mini App SDK...');
          setIsInMiniApp(true);
          
          // Load Farcaster context (auto-authentication)
          const ctx = await withTimeout(sdk.context, 3500, 'sdk.context');
          setContext(ctx);

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
            const provider = await withTimeout(sdk.wallet.getEthereumProvider(), 3500, 'sdk.wallet.getEthereumProvider()');
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

          // Signal ready again after initialization completes
          safeReady('after-init');
          
        } else {
          console.log('🌐 Not in Farcaster Mini App - using browser mode');
          setIsInMiniApp(false);
          setIsWalletReady(true); // Browser wallets are always "ready"
        }
        
        setIsSDKLoaded(true);
        console.log('✅ SDK loading complete');
        
      } catch (error) {
        console.error('❌ Failed to load Farcaster SDK:', error);
        
        // IMPORTANT: still call ready even on error to prevent infinite loading
        safeReady('error-fallback');
        
        setIsSDKLoaded(true);
        setIsWalletReady(true);
        setIsInMiniApp(false);
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
      {!isSDKLoaded ? (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-3xl">⚡</div>
            <div className="text-sm text-gray-300">Loading FlashEvents…</div>
            <div className="text-xs text-gray-500">If this gets stuck, open DevTools and check console logs.</div>
          </div>
        </div>
      ) : (
        children
      )}
    </FarcasterContext.Provider>
  );
}

function PrivyWagmiSync({ children }: { children: ReactNode }) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  useEffect(() => {
    if (!authenticated) return;
    if (!wallets || wallets.length === 0) return;

    // Prefer Privy embedded wallet when available; otherwise just pick first.
    const preferred =
      wallets.find((w: any) => w.walletClientType === 'privy' || w.connectorType === 'embedded' || w.type === 'embedded') ??
      wallets[0];

    setActiveWallet(preferred).catch((e: any) => console.warn('Failed to set active Privy wallet:', e));
  }, [authenticated, wallets, setActiveWallet]);

  return <>{children}</>;
}

// Main Providers Component
export function Providers({ children }: { children: ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!privyAppId) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-3">
          <div className="text-xl font-semibold">Missing env: `NEXT_PUBLIC_PRIVY_APP_ID`</div>
          <div className="text-sm text-gray-300">
            Add it in `miniapp/.env.local` (for local) and Vercel Environment Variables (for prod),
            then redeploy/restart.
          </div>
        </div>
      </div>
    );
  }

  return (
    <FarcasterProvider>
      <PrivyProvider
        appId={privyAppId}
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
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <PrivyWagmiSync>{children}</PrivyWagmiSync>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </FarcasterProvider>
  );
}

export { wagmiConfig, queryClient };