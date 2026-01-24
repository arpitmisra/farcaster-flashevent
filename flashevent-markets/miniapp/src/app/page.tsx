'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MarketCard, FeaturedMarketCard } from '@/components/market/MarketCard';
import { MarketCardSkeleton, PageLoader } from '@/components/ui/LoadingSpinner';
import { LevelProgress } from '@/components/gamification/LevelProgress';
import { WalletButton } from '@/components/wallet/ConnectWallet';
import { useWalletDetails, useCopyAddress } from '@/lib/hooks/useWalletDetails';
import { useAllMarkets, useMarketData } from '@/lib/contracts/hooks';
import { useFarcaster } from './providers';
import { formatEth, formatTimeRemaining, formatAddress } from '@/lib/utils';
import { fetchLeaderboard } from '@/lib/api/client';
import { MarketStatus, MarketResult } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, ExternalLink, Wallet } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { authenticated, user: privyUser } = usePrivy();
  const { user: farcasterUser, isInMiniApp, addMiniApp } = useFarcaster();
  const { data: marketAddresses, isLoading: isLoadingMarkets } = useAllMarkets();
  const [showAddPrompt, setShowAddPrompt] = useState(false);

  // Check if user is connected via either wagmi or Privy
  const isUserConnected = isConnected || authenticated;
  
  // Get wallet details
  const { balance, isLoading: isBalanceLoading, explorerUrl, shortAddress } = useWalletDetails();
  const { copied, copy } = useCopyAddress();

  const handleCopyAddress = () => {
    const addr = address || privyUser?.wallet?.address || '';
    if (addr) {
      copy(addr);
    }
  };

  // Fetch top predictors from leaderboard
  const { data: leaderboardData } = useQuery({
    queryKey: ['leaderboard', 'profit', 'all'],
    queryFn: () => fetchLeaderboard({ type: 'profit', period: 'all', limit: 3 }),
    staleTime: 60000,
  });

  const topPredictors = (leaderboardData as Array<{
    rank: number;
    address: string;
    user?: { username?: string };
    totalVolume: number;
  }> || []).slice(0, 3);

  // Show add to favorites prompt after first interaction
  useEffect(() => {
    if (isInMiniApp && isUserConnected) {
      const hasSeenPrompt = localStorage.getItem('flashevent-add-prompt-seen');
      if (!hasSeenPrompt) {
        setShowAddPrompt(true);
      }
    }
  }, [isInMiniApp, isUserConnected]);

  const handleAddToFavorites = async () => {
    await addMiniApp();
    localStorage.setItem('flashevent-add-prompt-seen', 'true');
    setShowAddPrompt(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="font-bold text-lg text-white">FlashEvent</span>
          </div>
          <WalletButton />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card for connected users */}
        {isUserConnected && (
          <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {(farcasterUser?.pfpUrl || privyUser?.farcaster?.pfp) ? (
                  <img 
                    src={farcasterUser?.pfpUrl || privyUser?.farcaster?.pfp} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full border-2 border-purple-500"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-xl">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-white">
                      {farcasterUser?.displayName || 
                       privyUser?.farcaster?.displayName || 
                       farcasterUser?.username || 
                       privyUser?.farcaster?.username || 
                       'Predictor'}
                    </h2>
                    {/* Balance Badge */}
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">
                      {isBalanceLoading ? '...' : `${balance?.native.formatted || '0'} ${balance?.native.symbol || 'MON'}`}
                    </span>
                  </div>
                  {(address || privyUser?.wallet?.address) && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {shortAddress || formatAddress(address || privyUser?.wallet?.address || '')}
                      </span>
                      <button
                        onClick={handleCopyAddress}
                        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Copy address"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => window.open(explorerUrl, '_blank')}
                        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="mt-2">
                    <LevelProgress xp={150} size="sm" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add to Favorites Prompt */}
        {showAddPrompt && (
          <Card className="border-purple-500/50 animate-slide-up">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">⭐</span>
                <div className="flex-1">
                  <h3 className="font-medium text-white mb-1">Add to your apps</h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Quick access to FlashEvent from your Farcaster client
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddToFavorites}>
                      Add Now
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        localStorage.setItem('flashevent-add-prompt-seen', 'true');
                        setShowAddPrompt(false);
                      }}
                    >
                      Maybe Later
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Challenge */}
        <Card className="border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎁</span>
                <span className="font-medium text-white">Daily Challenge</span>
              </div>
              <span className="text-xs text-gray-400">Expires in 18h 32m</span>
            </div>
            <p className="text-sm text-gray-300 mb-3">Place your first bet today!</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full w-0 bg-green-500" />
              </div>
              <span className="text-xs text-gray-400">0/1</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-green-400">
              <span>Reward: 50 XP + 0.001 ETH</span>
            </div>
          </CardContent>
        </Card>

        {/* Markets Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🔥 Trending Markets
            </h2>
            <Link href="/markets" className="text-sm text-purple-400 hover:text-purple-300">
              View All →
            </Link>
          </div>

          {isLoadingMarkets ? (
            <div className="space-y-4">
              <MarketCardSkeleton />
              <MarketCardSkeleton />
              <MarketCardSkeleton />
            </div>
          ) : marketAddresses && marketAddresses.length > 0 ? (
            <div className="space-y-4">
              {marketAddresses.slice(0, 5).map((address, i) => (
                <MarketCardWrapper key={address} address={address} isFeatured={i === 0} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-white mb-2">No markets yet</h3>
                <p className="text-gray-400 mb-4">Be the first to create a prediction market!</p>
                <Link href="/create">
                  <Button>Create Market</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create Market CTA */}
        <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/30">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="text-lg font-bold text-white mb-2">Create Your Own Market</h3>
            <p className="text-sm text-gray-400 mb-4">
              Earn 5% of the pool when your market gets 10+ bets!
            </p>
            <Link href="/create">
              <Button size="lg" className="w-full">
                Start Creating →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Top Predictors Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                🏆 Top Predictors
              </span>
              <Link href="/leaderboard" className="text-sm text-purple-400 font-normal hover:text-purple-300">
                View All →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPredictors.length > 0 ? (
              topPredictors.map((entry, index) => (
                <div key={entry.address} className="flex items-center gap-3 py-2">
                  <span className="text-lg w-6 text-center">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                  <span className="text-lg">
                    {index === 0 ? '🐋' : index === 1 ? '🌟' : '👑'}
                  </span>
                  <span className="flex-1 font-medium text-white truncate">
                    {entry.user?.username ? `@${entry.user.username}` : formatAddress(entry.address, 4)}
                  </span>
                  <span className="text-green-400 font-medium">
                    {entry.totalVolume.toFixed(4)} ETH
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">No predictors yet</p>
                <p className="text-xs text-gray-500 mt-1">Be the first to place a bet!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Market card wrapper that fetches data for each market
function MarketCardWrapper({ address, isFeatured }: { address: string; isFeatured?: boolean }) {
  const { data, isLoading } = useMarketData(address as `0x${string}`);
  
  if (isLoading || !data) {
    return <MarketCardSkeleton />;
  }

  const now = Date.now() / 1000;
  const status = data.isResolved 
    ? MarketStatus.RESOLVED 
    : (data.isBettingOpen ? MarketStatus.ACTIVE : MarketStatus.BETTING_CLOSED);

  return (
    <MarketCard
      address={address}
      question={data.question || 'Loading...'}
      yesPool={data.yesPool || BigInt(0)}
      noPool={data.noPool || BigInt(0)}
      totalBets={Number(data.yesBets || 0) + Number(data.noBets || 0)}
      bettingDeadline={Number(data.bettingDeadline || 0)}
      expiry={Number(data.expiry || 0)}
      status={status}
      result={(data.result as MarketResult) || MarketResult.PENDING}
      creator={data.creator}
      isCreatorEligible={data.isCreatorEligible}
      isFeatured={isFeatured}
    />
  );
}
