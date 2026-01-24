'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LevelBadge } from '@/components/gamification/LevelProgress';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useFarcaster } from '@/app/providers';
import { formatEth, formatAddress, cn } from '@/lib/utils';
import { getLevelFromXP } from '@/types/index';
import { fetchLeaderboard, fetchUserStats } from '@/lib/api/client';
import { Trophy, TrendingUp, Flame, Users, ArrowUp, ArrowDown, Minus } from 'lucide-react';

type LeaderboardType = 'profit' | 'winRate' | 'streak' | 'creator';
type TimePeriod = 'all' | 'month' | 'week' | 'today';

interface LeaderboardEntry {
  rank: number;
  address: string;
  user?: {
    username?: string;
    displayName?: string;
    avatar?: string;
    fid?: number;
  };
  totalVolume: number;
  totalBets: number;
  winRate?: number;
  wins?: number;
  profit?: bigint;
  streak?: number;
  level?: number;
  change?: 'up' | 'down' | 'same';
}

interface CreatorLeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  earnings: bigint;
  markets: number;
  qualified: number;
  avgPool: bigint;
}

export default function LeaderboardPage() {
  const { shareToFarcaster } = useFarcaster();
  const { address, isConnected } = useAccount();
  const [type, setType] = useState<LeaderboardType>('profit');
  const [period, setPeriod] = useState<TimePeriod>('all');

  // Fetch leaderboard data from API
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ['leaderboard', type, period],
    queryFn: () => fetchLeaderboard({ type, period, limit: 50 }),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch user's own stats for ranking
  const { data: userStats, isLoading: isLoadingUserStats } = useQuery({
    queryKey: ['userStats', address],
    queryFn: () => address ? fetchUserStats(address) : null,
    enabled: !!address,
    staleTime: 30000,
  });

  // Transform API data to display format
  const leaderboard: LeaderboardEntry[] = (leaderboardData as LeaderboardEntry[] || []).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    level: Math.min(5, Math.floor((entry.totalBets || 0) / 10) + 1),
    change: 'same' as const,
  }));

  // Find user's rank in the leaderboard
  const userRank = address ? leaderboard.findIndex(e => e.address?.toLowerCase() === address.toLowerCase()) + 1 : 0;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank.toString();
  };

  const getChangeIcon = (change: string) => {
    if (change === 'up') return <ArrowUp className="w-3 h-3 text-green-400" />;
    if (change === 'down') return <ArrowDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const getLevelInfo = (xp: number) => {
    const levels = [
      { level: 1, name: 'Rookie', icon: '🥚' },
      { level: 2, name: 'Apprentice', icon: '🌱' },
      { level: 3, name: 'Expert', icon: '🏅' },
      { level: 4, name: 'Master', icon: '💎' },
      { level: 5, name: 'Legend', icon: '⚡' },
    ];
    const levelNum = Math.min(5, Math.max(1, xp));
    return levels[levelNum - 1];
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="font-bold text-lg text-white text-center">🏆 Leaderboard</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Type Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'profit' as LeaderboardType, label: 'Top Profit', icon: '💰' },
            { id: 'winRate' as LeaderboardType, label: 'Win Rate', icon: '🎯' },
            { id: 'streak' as LeaderboardType, label: 'Streaks', icon: '🔥' },
            { id: 'creator' as LeaderboardType, label: 'Creators', icon: '🎨' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setType(option.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                type === option.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              )}
            >
              <span>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {[
            { id: 'all' as TimePeriod, label: 'All Time' },
            { id: 'month' as TimePeriod, label: 'Month' },
            { id: 'week' as TimePeriod, label: 'Week' },
            { id: 'today' as TimePeriod, label: 'Today' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setPeriod(option.id)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                period === option.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {isLoadingLeaderboard ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="font-medium text-white mb-2">No rankings yet</h3>
              <p className="text-gray-400 text-sm">Be the first to place a bet and climb the leaderboard!</p>
            </CardContent>
          </Card>
        ) : type !== 'creator' ? (
          <div className="space-y-3">
            {leaderboard.map((entry) => {
              const levelInfo = getLevelInfo(entry.level || 1);
              const displayName = entry.user?.username || entry.user?.displayName || formatAddress(entry.address, 4);
              
              return (
                <Card key={entry.rank} className={cn(
                  entry.rank <= 3 && 'border-yellow-500/30'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {entry.rank <= 3 ? (
                          <span className="text-2xl">{getRankBadge(entry.rank)}</span>
                        ) : (
                          <span className="text-lg font-bold text-gray-400">{entry.rank}</span>
                        )}
                      </div>
                      
                      {/* Change indicator */}
                      <div className="w-4">
                        {getChangeIcon(entry.change || 'same')}
                      </div>
                      
                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {entry.user?.avatar ? (
                            <img src={entry.user.avatar} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <span className="text-lg">{levelInfo.icon}</span>
                          )}
                          <span className="font-medium text-white truncate">
                            {entry.user?.username ? `@${entry.user.username}` : displayName}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {entry.winRate ? `${entry.winRate}% win rate • ` : ''}{entry.totalBets} bets
                        </div>
                      </div>
                      
                      {/* Main stat */}
                      <div className="text-right">
                        {type === 'profit' && (
                          <div className="text-green-400 font-bold">
                            {entry.totalVolume.toFixed(4)} ETH
                          </div>
                        )}
                        {type === 'winRate' && (
                          <div className="text-blue-400 font-bold">
                            {entry.winRate || 0}%
                          </div>
                        )}
                        {type === 'streak' && (
                          <div className="text-orange-400 font-bold flex items-center gap-1">
                            <Flame className="w-4 h-4" />
                            {entry.streak || 0}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => {
              const displayName = entry.user?.username || formatAddress(entry.address, 4);
              
              return (
                <Card key={entry.rank} className={cn(
                  entry.rank <= 3 && 'border-purple-500/30'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {entry.rank <= 3 ? (
                          <span className="text-2xl">{getRankBadge(entry.rank)}</span>
                        ) : (
                          <span className="text-lg font-bold text-gray-400">{entry.rank}</span>
                        )}
                      </div>
                      
                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎨</span>
                          <span className="font-medium text-white truncate">
                            {entry.user?.username ? `@${entry.user.username}` : displayName}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {entry.totalBets} markets created
                        </div>
                      </div>
                      
                      {/* Volume */}
                      <div className="text-right">
                        <div className="text-purple-400 font-bold">
                          {entry.totalVolume.toFixed(4)} ETH
                        </div>
                        <div className="text-xs text-gray-500">
                          volume
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Your Ranking */}
        {isConnected && (
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 text-center">
                  <span className="text-lg font-bold text-gray-400">
                    {userRank > 0 ? userRank : '-'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {(userStats as { totalBets?: number })?.totalBets ? '🏅' : '🥚'}
                    </span>
                    <span className="font-medium text-white">You</span>
                    {!(userStats as { totalBets?: number })?.totalBets && (
                      <span className="text-xs text-purple-400 px-2 py-0.5 rounded-full bg-purple-500/20">
                        New
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {(userStats as { totalBets?: number })?.totalBets 
                      ? `${(userStats as { totalBets?: number }).totalBets} bets placed`
                      : 'Place your first bet to join the ranks!'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 font-bold">
                    {((userStats as { totalVolume?: number })?.totalVolume || 0).toFixed(4)} ETH
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Share */}
        <Button 
          variant="outline" 
          fullWidth
          onClick={() => {
            const topPlayer = leaderboard[0];
            const topName = topPlayer?.user?.username ? `@${topPlayer.user.username}` : formatAddress(topPlayer?.address || '', 4);
            const topVolume = topPlayer?.totalVolume?.toFixed(2) || '0';
            shareToFarcaster(
              `⚡ Check out the FlashEvent leaderboard!\n\n🥇 ${topName} leads with ${topVolume} ETH volume\n\nCan you make it to the top? 🏆`,
              `${process.env.NEXT_PUBLIC_APP_URL}/leaderboard`
            );
          }}
        >
          Share Leaderboard
        </Button>
      </div>
    </div>
  );
}
