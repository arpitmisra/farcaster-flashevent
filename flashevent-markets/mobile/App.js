import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear corrupted WalletConnect session data on startup
async function clearWalletConnectStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const wcKeys = keys.filter(key => 
      key.startsWith('wc@') || 
      key.startsWith('walletconnect') ||
      key.includes('wc:') ||
      key.includes('session')
    );
    if (wcKeys.length > 0) {
      console.log('🧹 Clearing WalletConnect storage keys:', wcKeys.length);
      await AsyncStorage.multiRemove(wcKeys);
    }
  } catch (error) {
    console.warn('Failed to clear WalletConnect storage:', error);
  }
}

// Clear on startup to prevent "Provider not found" error from stale sessions
clearWalletConnectStorage();

// Import WalletConnect with error handling
let WalletConnectModal = null;
try {
  WalletConnectModal = require('@walletconnect/modal-react-native').WalletConnectModal;
  console.log('✅ WalletConnectModal loaded successfully');
} catch (error) {
  console.warn('⚠️ WalletConnect module not available:', error.message);
}

import Navigation from './src/navigation';
import { useAuthStore } from './src/store/authStore';
import { useWalletStore } from './src/store/walletStore';
import { WalletProvider } from './src/context/WalletContext';

// WalletConnect Project ID - get from https://cloud.walletconnect.com
const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || '89728b16e55dfa011ab338b3c8752e44';

console.log('🔑 WalletConnect Project ID:', projectId ? 'Set' : 'Missing');

// WalletConnect Modal metadata
const providerMetadata = {
  name: 'FlashEvent',
  description: 'FlashEvent - Prediction Markets on Monad',
  url: 'https://flashevent.app',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
  redirect: {
    native: 'flashevent://',
    universal: 'https://flashevent.app',
  },
};

// Session parameters - request Monad Testnet as primary chain
// Using the correct structure for @walletconnect/modal-react-native@1.1.0
const sessionParams = {
  namespaces: {
    eip155: {
      methods: [
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData_v4',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
      ],
      chains: ['eip155:1'], // Start with mainnet for compatibility
      events: ['chainChanged', 'accountsChanged'],
      rpcMap: {
        1: 'https://eth.llamarpc.com',
        10143: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
      },
    },
  },
};

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if splash screen is already hidden
});

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const checkWalletConnection = useWalletStore((state) => state.checkConnection);

  useEffect(() => {
    async function prepare() {
      try {
        // Check if user is already authenticated with timeout
        const authPromise = checkAuth();
        const walletPromise = checkWalletConnection();
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
        
        await Promise.race([Promise.all([authPromise, walletPromise]), timeoutPromise]);
      } catch (e) {
        console.warn('Error during app preparation:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Handle deep links (like WalletConnect URIs from QR codes)
  useEffect(() => {
    // Handle initial URL if app was opened from a link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for URL changes while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url) => {
    if (!url) return;
    
    console.log('Deep link received:', url);
    
    // Handle WalletConnect URIs
    if (url.startsWith('wc:') || url.includes('wc?uri=')) {
      console.log('WalletConnect URI detected - navigate to wallet connection');
      // The URI will be handled by the WalletConnect client in metamaskService
      // User just needs to be on the right screen
    }
  };

  useEffect(() => {
    if (appIsReady) {
      // Hide splash screen after app is ready
      SplashScreen.hideAsync().catch(() => {
        // Ignore errors
      });
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <WalletConnectModalWrapper>
            <WalletProvider>
              <Navigation />
              <StatusBar style="light" />
            </WalletProvider>
          </WalletConnectModalWrapper>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrapper component that renders WalletConnectModal and its children
function WalletConnectModalWrapper({ children }) {
  if (!WalletConnectModal) {
    console.warn('⚠️ WalletConnectModal not available, rendering children without wallet support');
    return <>{children}</>;
  }
  
  return (
    <>
      <WalletConnectModal
        projectId={projectId}
        providerMetadata={providerMetadata}
        sessionParams={sessionParams}
      />
      {children}
    </>
  );
}
