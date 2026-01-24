'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LevelProgress } from '@/components/gamification/LevelProgress';
import { AchievementsGrid } from '@/components/gamification/AchievementBadge';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';
import { MarketCard } from '@/components/market/MarketCard';
import { MarketCardSkeleton, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useMarketsByCreator, useMarketData, useUserPosition } from '@/lib/contracts/hooks';
import { useFarcaster } from '@/app/providers';
import { formatEth, formatAddress, cn } from '@/lib/utils';
import { getLevelFromXP } from '@/types/index';
import { MarketStatus, MarketResult, ACHIEVEMENTS } from '@/types';
import { fetchUserStats } from '@/lib/api/client';
import { Share2, ExternalLink, Settings, Trophy, Target, Coins, TrendingUp } from 'lucide-react';

type Tab = 'positions' | 'created' | 'achievements';

interface UserStatsResponse {
  address: string;
  fid?: number;
  totalBets: number;
  totalVolume: number;
  marketsCreated: number;
  resolvedBets?: number;
  wins?: number;
  winRate?: number;
  totalPnL?: number;
  joinedAt?: string;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { user: farcasterUser, shareToFarcaster, openUrl } = useFarcaster();
  const [activeTab, setActiveTab] = useState<Tab>('positions');
  
  const { data: createdMarkets, isLoading: isLoadingCreated } = useMarketsByCreator(address);

  // Fetch real user stats from backend
  const { data: apiStats, isLoading: isLoadingStats } = useQuery<UserStatsResponse>({
    queryKey: ['userStats', address],
    queryFn: () => address ? fetchUserStats(address) as Promise<UserStatsResponse> : Promise.resolve({} as UserStatsResponse),
    enabled: !!address,
    staleTime: 30000,
  });

  // Combine API stats with on-chain data
  const userStats = {
    xp: ((apiStats?.totalBets || 0) * 25) + ((apiStats?.wins || 0) * 50), // Calculate XP from activity
    totalBets: apiStats?.totalBets || 0,
    totalWins: apiStats?.wins || 0,
    winRate: apiStats?.winRate || 0,
    totalProfit: BigInt(Math.floor((apiStats?.totalPnL || 0) * 1e18)), // Convert to wei
    currentStreak: 0, // Would need to track separately
    bestStreak: 0,
    marketsCreated: apiStats?.marketsCreated || createdMarkets?.length || 0,
    creatorEarnings: BigInt(0), // Would need to calculate from market data
    totalVolume: apiStats?.totalVolume || 0,
    // Calculate achievements based on stats
    achievements: [
      ...(apiStats?.totalBets ? ['first_steps', 'first_bet'] : []),
      ...(apiStats?.wins ? ['winner'] : []),
      ...((apiStats?.wins || 0) >= 3 ? ['hot_streak'] : []),
      ...(apiStats?.marketsCreated ? ['market_creator'] : []),
    ],
  };

  const levelInfo = getLevelFromXP(userStats.xp);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">👤</div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Your Profile</h2>
              <p className="text-gray-400">Connect your wallet to view your stats and positions</p>
            </div>
            <ConnectWallet />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg text-white">Profile</span>
          <Button size="sm" variant="ghost">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile Header */}
        <Card className="overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-purple-600 to-pink-600" />
          <CardContent className="p-4 -mt-10">
            <div className="flex items-end gap-4">
              {farcasterUser?.pfpUrl ? (
                <img 
                  src={farcasterUser.pfpUrl} 
                  alt="Profile" 
                  className="w-20 h-20 rounded-full border-4 border-gray-900"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-gray-900 bg-gray-800 flex items-center justify-center text-3xl">
                  👤
                </div>
              )}
              <div className="flex-1 pb-2">
                <h2 className="text-xl font-bold text-white">
                  {farcasterUser?.displayName || farcasterUser?.username || 'Predictor'}
                </h2>
                {farcasterUser?.username && (
                  <p className="text-gray-400">@{farcasterUser.username}</p>
                )}
                <p className="text-gray-500 text-sm font-mono">
                  {formatAddress(address!, 6)}
                </p>
              </div>
            </div>
            
            {/* Level Progress */}
            <div className="mt-4">
              <LevelProgress xp={userStats.xp} showDetails size="md" />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-lg font-bold text-white">{userStats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Win Rate</div>
              <div className="text-xs text-gray-500 mt-1">{userStats.totalWins}/{userStats.totalBets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-lg font-bold text-green-400">+{formatEth(userStats.totalProfit)} ETH</div>
              <div className="text-xs text-gray-400">Total Profit</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-lg font-bold text-white">{userStats.totalVolume.toFixed(4)}</div>
              <div className="text-xs text-gray-400">Volume (ETH)</div>
              <div className="text-xs text-gray-500 mt-1">{userStats.totalBets} bets</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">🏆</div>
              <div className="text-lg font-bold text-white">{userStats.achievements.length}</div>
              <div className="text-xs text-gray-400">Achievements</div>
            </CardContent>
          </Card>
        </div>

        {/* Creator Stats */}
        {userStats.marketsCreated > 0 && (
          <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/30">
            <CardContent className="p-4">
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <span>🎨</span> Creator Stats
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Markets Created:</span>
                  <span className="ml-2 text-white font-medium">{userStats.marketsCreated}</span>
                </div>
                <div>
                  <span className="text-gray-400">Total Volume:</span>
                  <span className="ml-2 text-green-400 font-medium">{userStats.totalVolume.toFixed(4)} ETH</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'positions' as Tab, label: 'My Bets', icon: '📊' },
            { id: 'created' as Tab, label: 'Created', icon: '🎨' },
            { id: 'achievements' as Tab, label: 'Badges', icon: '🏆' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-white'
              )}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'positions' && (
          <div className="space-y-4">
            <p className="text-center text-gray-500 py-8">
              Your active positions will appear here
            </p>
          </div>
        )}

        {activeTab === 'created' && (
          <div className="space-y-4">
            {isLoadingCreated ? (
              <>
                <MarketCardSkeleton />
                <MarketCardSkeleton />
              </>
            ) : createdMarkets && createdMarkets.length > 0 ? (
              createdMarkets.map((marketAddress) => (
                <CreatedMarketCard key={marketAddress} address={marketAddress} />
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-4xl mb-4">🎨</div>
                  <h3 className="font-medium text-white mb-2">No markets created yet</h3>
                  <p className="text-gray-400 text-sm mb-4">Create your first market and earn 5% of the pool!</p>
                  <Button onClick={() => window.location.href = '/create'}>
                    Create Market
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <AchievementsGrid 
              unlockedIds={userStats.achievements} 
              category="betting"
            />
            
            <div className="pt-4 border-t border-gray-800">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Creator Achievements</h4>
              <AchievementsGrid 
                unlockedIds={userStats.achievements} 
                category="creator"
              />
            </div>
          </div>
        )}

        {/* Share Profile Button */}
        <Button 
          variant="outline" 
          fullWidth
          onClick={() => shareToFarcaster(
            `⚡ Check out my FlashEvent stats!\n\n🎯 Win Rate: ${userStats.winRate.toFixed(1)}%\n💰 Volume: ${userStats.totalVolume.toFixed(4)} ETH\n📊 Bets: ${userStats.totalBets}\n🏆 Level: ${levelInfo.level} ${levelInfo.name}\n\nCan you beat me?`,
            process.env.NEXT_PUBLIC_APP_URL
          )}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Profile
        </Button>
      </div>
    </div>
  );
}

// Helper component for created markets
function CreatedMarketCard({ address }: { address: string }) {
  const { data: market, isLoading } = useMarketData(address as `0x${string}`);
  
  if (isLoading || !market) {
    return <MarketCardSkeleton />;
  }

  const now = Date.now() / 1000;
  const status = market.isResolved 
    ? MarketStatus.RESOLVED 
    : (market.isBettingOpen ? MarketStatus.ACTIVE : MarketStatus.BETTING_CLOSED);

  return (
    <MarketCard
      address={address}
      question={market.question || 'Loading...'}
      yesPool={market.yesPool || BigInt(0)}
      noPool={market.noPool || BigInt(0)}
      totalBets={Number(market.yesBets || 0) + Number(market.noBets || 0)}
      bettingDeadline={Number(market.bettingDeadline || 0)}
      expiry={Number(market.expiry || 0)}
      status={status}
      result={(market.result as MarketResult) || MarketResult.PENDING}
      isCreatorEligible={market.isCreatorEligible}
    />
  );
}
