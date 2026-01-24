'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/Button';
import { formatAddress } from '@/lib/utils';
import { useFarcaster } from '@/app/providers';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';

export function ConnectWallet() {
  const [showOptions, setShowOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { login, logout, authenticated, ready, user: privyUser } = usePrivy();
  const { wallets } = useWallets();
  const { user: farcasterUser, isInMiniApp } = useFarcaster();
  const { isCorrectChain, isSwitching, switchToMonad, targetChainName, isFarcasterConnector } = useChainSwitch();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Note: Auto-switch is now handled in the useChainSwitch hook

  // Get the first available wallet address from Privy
  const privyWalletAddress = wallets?.[0]?.address || privyUser?.wallet?.address;
  const displayAddress = address || privyWalletAddress;

  // Handle MetaMask connection
  const handleMetaMaskConnect = async () => {
    const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
    setShowOptions(false);
  };

  // Handle Privy login (Farcaster, email, etc.)
  const handlePrivyLogin = () => {
    login();
    setShowOptions(false);
  };

  // If in Farcaster Mini App, use the built-in connector
  if (isInMiniApp) {
    if (isConnected && address) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
            {farcasterUser?.pfpUrl && (
              <img 
                src={farcasterUser.pfpUrl} 
                alt="Profile" 
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="text-sm font-medium text-white">
              {farcasterUser?.username ? `@${farcasterUser.username}` : formatAddress(address)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect()}
          >
            Disconnect
          </Button>
        </div>
      );
    }

    return (
      <Button
        onClick={() => {
          const connector = connectors[0];
          if (connector) {
            connect({ connector });
          }
        }}
        isLoading={isConnecting}
      >
        Connect Wallet
      </Button>
    );
  }

  // For web (non-Mini App) - show connected state
  if (isConnected && address) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">
              🦊
            </div>
            <span className="text-sm font-medium text-white">
              {formatAddress(address)}
            </span>
            {/* Chain indicator */}
            {isCorrectChain ? (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                Monad
              </span>
            ) : (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                Wrong Chain
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect()}
          >
            Disconnect
          </Button>
        </div>
        {/* Show switch chain button if on wrong chain */}
        {!isCorrectChain && (
          <Button
            size="sm"
            variant="outline"
            onClick={switchToMonad}
            isLoading={isSwitching}
            className="text-xs"
          >
            🔄 Switch to {targetChainName}
          </Button>
        )}
      </div>
    );
  }

  // Show Privy authenticated state (but wagmi not connected - can't transact)
  if (authenticated && !isConnected) {
    const farcasterUsername = privyUser?.farcaster?.username;
    const farcasterPfp = privyUser?.farcaster?.pfp;
    
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
            {farcasterPfp && (
              <img 
                src={farcasterPfp} 
                alt="Profile" 
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="text-sm font-medium text-white">
              {farcasterUsername 
                ? `@${farcasterUsername}` 
                : displayAddress 
                  ? formatAddress(displayAddress)
                  : 'Logged in'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              disconnect();
            }}
          >
            Logout
          </Button>
        </div>
        {/* Show connect MetaMask button for transactions */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleMetaMaskConnect}
          className="text-xs"
        >
          🦊 Connect MetaMask for Transactions
        </Button>
      </div>
    );
  }

  // Not connected - show Connect button with dropdown options
  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setShowOptions(!showOptions)}
        isLoading={isConnecting}
      >
        Connect Wallet
      </Button>
      
      {/* Dropdown Options */}
      {showOptions && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-gray-900 border border-gray-700 shadow-xl z-50 overflow-hidden">
          <div className="p-2">
            <p className="text-xs text-gray-500 uppercase px-3 py-2 font-medium">
              Choose Connection Method
            </p>
            
            {/* MetaMask Option */}
            <button
              onClick={handleMetaMaskConnect}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-xl">🦊</span>
              </div>
              <div>
                <p className="text-white font-medium">MetaMask</p>
                <p className="text-xs text-gray-400">Connect & transact directly</p>
              </div>
              <span className="ml-auto text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
                Recommended
              </span>
            </button>

            {/* Divider */}
            <div className="h-px bg-gray-700 my-2" />

            {/* Farcaster Option */}
            {ready && (
              <button
                onClick={handlePrivyLogin}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xl">🟣</span>
                </div>
                <div>
                  <p className="text-white font-medium">Farcaster</p>
                  <p className="text-xs text-gray-400">Login with Farcaster account</p>
                </div>
              </button>
            )}

            {/* Email Option */}
            {ready && (
              <button
                onClick={handlePrivyLogin}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xl">📧</span>
                </div>
                <div>
                  <p className="text-white font-medium">Email / Social</p>
                  <p className="text-xs text-gray-400">Google, Twitter, Email</p>
                </div>
              </button>
            )}

            {/* Warning Note */}
            <div className="px-3 py-2 mt-2 bg-yellow-500/10 rounded-lg">
              <p className="text-xs text-yellow-500">
                💡 For transactions, MetaMask is recommended. Other options are for login only.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact wallet button for mobile header
export function WalletButton() {
  const [showOptions, setShowOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { login, logout, authenticated, ready, user: privyUser } = usePrivy();
  const { disconnect } = useDisconnect();
  const { wallets } = useWallets();
  const { user: farcasterUser, isInMiniApp } = useFarcaster();
  const { isCorrectChain, isSwitching, switchToMonad, isFarcasterConnector } = useChainSwitch();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Note: Auto-switch is now handled in the useChainSwitch hook

  // Get the display address from wagmi or Privy
  const privyWalletAddress = wallets?.[0]?.address || privyUser?.wallet?.address;
  const displayAddress = address || privyWalletAddress;

  // Handle MetaMask connection
  const handleMetaMaskConnect = async () => {
    const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
    setShowOptions(false);
  };

  // Handle Privy login
  const handlePrivyLogin = () => {
    login();
    setShowOptions(false);
  };

  // Prioritize wagmi connection (needed for transactions)
  if (isConnected && address) {
    // Show switching indicator
    if (isSwitching) {
      return (
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-xs">
          <span className="animate-spin">🔄</span>
          <span>Switching...</span>
        </button>
      );
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
            isCorrectChain 
              ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' 
              : 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30'
          }`}
        >
          <span className="text-sm">🦊</span>
          <span className="text-xs font-medium text-white">
            {formatAddress(address, 3)}
          </span>
          {!isCorrectChain && (
            <span className="text-xs text-red-400">⚠️</span>
          )}
        </button>
        
        {showOptions && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl bg-gray-900 border border-gray-700 shadow-xl z-50 overflow-hidden">
            <div className="p-2">
              {/* Chain Status */}
              <div className="px-3 py-2 mb-2 rounded-lg bg-gray-800">
                <p className="text-xs text-gray-400">Network</p>
                <p className={`text-sm font-medium ${isCorrectChain ? 'text-green-400' : 'text-red-400'}`}>
                  {isCorrectChain ? '✓ Monad Testnet' : '✗ Wrong Network'}
                </p>
              </div>
              
              {/* Switch Chain Button */}
              {!isCorrectChain && (
                <button
                  onClick={() => {
                    switchToMonad();
                    setShowOptions(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm text-yellow-400 mb-1"
                >
                  <span>🔄</span>
                  <span>Switch to Monad</span>
                </button>
              )}
              
              <div className="h-px bg-gray-700 my-1" />
              
              <button
                onClick={() => {
                  disconnect();
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 rounded-lg"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show Privy auth state (but note: can't transact without wagmi)
  if (authenticated) {
    const farcasterPfp = farcasterUser?.pfpUrl || privyUser?.farcaster?.pfp;
    const farcasterUsername = farcasterUser?.username || privyUser?.farcaster?.username;

    return (
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors"
        >
          {farcasterPfp ? (
            <img 
              src={farcasterPfp} 
              alt="Profile" 
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-xs">
              {displayAddress ? displayAddress.slice(2, 4).toUpperCase() : '??'}
            </div>
          )}
          <span className="text-xs font-medium text-white">
            {farcasterUsername 
              ? `@${farcasterUsername}` 
              : displayAddress 
                ? formatAddress(displayAddress, 3)
                : 'Logged in'}
          </span>
        </button>
        
        {showOptions && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl bg-gray-900 border border-gray-700 shadow-xl z-50 overflow-hidden">
            <div className="p-2">
              <button
                onClick={() => {
                  handleMetaMaskConnect();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm"
              >
                <span>🦊</span>
                <span className="text-white">Connect MetaMask</span>
              </button>
              <div className="h-px bg-gray-700 my-1" />
              <button
                onClick={() => {
                  logout();
                  disconnect();
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected - show connect button with options
  const handleConnect = () => {
    if (isInMiniApp) {
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      }
    } else {
      setShowOptions(!showOptions);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button size="sm" onClick={handleConnect} isLoading={isConnecting}>
        Connect
      </Button>
      
      {showOptions && !isInMiniApp && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-gray-900 border border-gray-700 shadow-xl z-50 overflow-hidden">
          <div className="p-2">
            <p className="text-xs text-gray-500 uppercase px-2 py-1 font-medium">
              Connect
            </p>
            
            <button
              onClick={handleMetaMaskConnect}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left"
            >
              <span className="text-lg">🦊</span>
              <div>
                <p className="text-sm text-white font-medium">MetaMask</p>
                <p className="text-xs text-green-500">For transactions</p>
              </div>
            </button>
            
            <button
              onClick={handlePrivyLogin}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left"
            >
              <span className="text-lg">🟣</span>
              <div>
                <p className="text-sm text-white font-medium">Farcaster</p>
                <p className="text-xs text-gray-400">Login only</p>
              </div>
            </button>
            
            <button
              onClick={handlePrivyLogin}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left"
            >
              <span className="text-lg">📧</span>
              <div>
                <p className="text-sm text-white font-medium">Email / Social</p>
                <p className="text-xs text-gray-400">Login only</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
