'use client';

import { useState, useEffect } from 'react';
import { useWalletDetails, useCopyAddress, formatBalance } from '@/lib/hooks/useWalletDetails';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';
import { useFarcaster } from '@/app/providers';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Wallet,
  ArrowUpRight,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletDetailsProps {
  className?: string;
  compact?: boolean;
  showTokens?: boolean;
  showActions?: boolean;
}

export function WalletDetails({ 
  className, 
  compact = false, 
  showTokens = true,
  showActions = true 
}: WalletDetailsProps) {
  const {
    address,
    shortAddress,
    isConnected,
    isLoading,
    balance,
    transactionCount,
    chainName,
    isCorrectChain,
    explorerUrl,
    lastUpdated,
    error,
    refetch,
  } = useWalletDetails();

  const { switchToMonad, isSwitching } = useChainSwitch();
  const { user: farcasterUser, isInMiniApp } = useFarcaster();
  const { copied, copy } = useCopyAddress();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopy = () => {
    if (address) {
      copy(address);
    }
  };

  const handleOpenExplorer = () => {
    if (explorerUrl) {
      window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isConnected) {
    return null;
  }

  // Compact view for headers/navbar
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700">
          {farcasterUser?.pfpUrl ? (
            <img 
              src={farcasterUser.pfpUrl} 
              alt="Profile" 
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <Wallet className="w-4 h-4 text-purple-400" />
          )}
          <span className="text-xs font-medium text-white">{shortAddress}</span>
          <span className="text-xs font-bold text-purple-400">
            {balance?.native.formatted || '0'} {balance?.native.symbol || 'MON'}
          </span>
          {!isCorrectChain && (
            <span className="text-xs text-red-400">!</span>
          )}
        </div>
      </div>
    );
  }

  // Full details view
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {farcasterUser?.pfpUrl ? (
                <img 
                  src={farcasterUser.pfpUrl} 
                  alt="Profile" 
                  className="w-12 h-12 rounded-full border-2 border-purple-500/50"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                {farcasterUser?.username && (
                  <p className="text-sm font-medium text-purple-400">@{farcasterUser.username}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">{shortAddress}</span>
                  <button
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleOpenExplorer}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={cn(
                'p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors',
                isRefreshing && 'animate-spin'
              )}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Balance Section */}
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-400 uppercase font-medium mb-2">Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                balance?.native.formatted || '0'
              )}
            </span>
            <span className="text-lg text-gray-400">{balance?.native.symbol || 'MON'}</span>
          </div>
          {balance?.native.usdValue !== undefined && balance.native.usdValue > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              ≈ ${balance.native.usdValue.toFixed(2)} USD
            </p>
          )}
        </div>

        {/* Network Status */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium">Network</p>
              <p className={cn(
                'text-sm font-medium',
                isCorrectChain ? 'text-green-400' : 'text-red-400'
              )}>
                {isCorrectChain ? '✓ ' : '✗ '}{chainName}
              </p>
            </div>
            {!isCorrectChain && (
              <Button
                size="sm"
                variant="outline"
                onClick={switchToMonad}
                isLoading={isSwitching}
                className="text-xs"
              >
                Switch to Monad
              </Button>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-800">
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Transactions</p>
            <p className="text-lg font-bold text-white">
              {transactionCount !== null ? transactionCount : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Last Updated</p>
            <p className="text-sm text-gray-300">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}
            </p>
          </div>
        </div>

        {/* Token Balances (expandable) */}
        {showTokens && balance && balance.tokens.length > 0 && (
          <div className="border-b border-gray-800">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">
                Token Balances ({balance.tokens.length})
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {balance.tokens.map((token) => (
                  <div 
                    key={token.address}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                        {token.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{token.symbol}</p>
                        <p className="text-xs text-gray-400">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{token.formatted}</p>
                      {token.usdValue !== undefined && token.usdValue > 0 && (
                        <p className="text-xs text-gray-400">${token.usdValue.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="p-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Address
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenExplorer}
              className="text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Explorer
            </Button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border-t border-red-500/20">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Inline balance display for headers
export function WalletBalanceInline({ className }: { className?: string }) {
  const { balance, isLoading, isConnected } = useWalletDetails();

  if (!isConnected) return null;

  return (
    <span className={cn('text-sm font-medium', className)}>
      {isLoading ? (
        <span className="animate-pulse text-gray-400">...</span>
      ) : (
        <span className="text-purple-400">
          {balance?.native.formatted || '0'} {balance?.native.symbol || 'MON'}
        </span>
      )}
    </span>
  );
}

// Mini wallet card for dashboard
export function WalletMiniCard({ className }: { className?: string }) {
  const {
    shortAddress,
    isConnected,
    balance,
    isLoading,
    isCorrectChain,
    explorerUrl,
  } = useWalletDetails();
  const { user: farcasterUser } = useFarcaster();
  const { copied, copy } = useCopyAddress();

  if (!isConnected) return null;

  return (
    <div className={cn(
      'p-4 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {farcasterUser?.pfpUrl ? (
            <img 
              src={farcasterUser.pfpUrl} 
              alt="Profile" 
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">
              {farcasterUser?.username ? `@${farcasterUser.username}` : 'Wallet'}
            </p>
            <p className="text-sm font-mono text-white">{shortAddress}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shortAddress && copy(shortAddress.includes('...') ? '' : shortAddress)}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Balance</p>
          <p className="text-xl font-bold text-white">
            {isLoading ? (
              <span className="animate-pulse">...</span>
            ) : (
              `${balance?.native.formatted || '0'} ${balance?.native.symbol || 'MON'}`
            )}
          </p>
        </div>
        <div className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          isCorrectChain ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        )}>
          {isCorrectChain ? 'Monad' : 'Wrong Chain'}
        </div>
      </div>
    </div>
  );
}
