/**
 * WalletConnect Component - MetaMask Connection UI
 */

import React, { useEffect, useState } from 'react';
import { useMetaMask } from '../hooks/useMetaMask';

const WalletConnect = () => {
  const {
    address,
    chainId,
    isConnected,
    isConnecting,
    error,
    isMetaMaskInstalled,
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    getBalance,
  } = useMetaMask();

  const [balance, setBalance] = useState(null);

  // Monad Testnet Configuration
  const MONAD_TESTNET = {
    chainId: 10143,
    chainName: 'Monad Testnet',
    nativeCurrency: {
      name: 'Monad',
      symbol: 'MON',
      decimals: 18,
    },
    rpcUrls: ['https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5'],
    blockExplorerUrls: ['https://explorer.testnet.monad.xyz'],
  };

  // Fetch balance when connected
  useEffect(() => {
    if (isConnected) {
      getBalance().then(setBalance).catch(console.error);
    }
  }, [isConnected, getBalance]);

  // Handle connect button click
  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  // Handle network switch
  const handleSwitchToMonad = async () => {
    try {
      await switchNetwork(MONAD_TESTNET.chainId);
    } catch (err) {
      if (err.message.includes('not added')) {
        // Try adding the network
        try {
          await addNetwork(MONAD_TESTNET);
        } catch (addErr) {
          console.error('Failed to add network:', addErr);
        }
      }
    }
  };

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // If MetaMask is not installed
  if (!isMetaMaskInstalled) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h3 style={styles.title}>MetaMask Not Found</h3>
          <p style={styles.text}>
            Please install MetaMask extension to connect your wallet.
          </p>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.button}
          >
            Install MetaMask
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Wallet Connection</h2>

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            style={{
              ...styles.button,
              ...(isConnecting ? styles.buttonDisabled : {}),
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        ) : (
          <div style={styles.connectedContainer}>
            <div style={styles.infoRow}>
              <span style={styles.label}>Address:</span>
              <span style={styles.value}>{formatAddress(address)}</span>
            </div>

            <div style={styles.infoRow}>
              <span style={styles.label}>Chain ID:</span>
              <span style={styles.value}>{chainId}</span>
            </div>

            {balance !== null && (
              <div style={styles.infoRow}>
                <span style={styles.label}>Balance:</span>
                <span style={styles.value}>
                  {parseFloat(balance).toFixed(4)} {chainId === 10143 ? 'MON' : 'ETH'}
                </span>
              </div>
            )}

            {chainId !== MONAD_TESTNET.chainId && (
              <button onClick={handleSwitchToMonad} style={styles.switchButton}>
                Switch to Monad Testnet
              </button>
            )}

            <button onClick={disconnect} style={styles.disconnectButton}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '400px',
    width: '100%',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  text: {
    color: '#666',
    marginBottom: '20px',
    lineHeight: '1.5',
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#f6851b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  switchButton: {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#0066ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
  },
  disconnectButton: {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#ff4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
  },
  connectedContainer: {
    marginTop: '16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    marginBottom: '8px',
  },
  label: {
    fontWeight: '600',
    color: '#666',
  },
  value: {
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c00',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
};

export default WalletConnect;
