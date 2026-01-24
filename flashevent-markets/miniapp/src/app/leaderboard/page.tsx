'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LevelBadge } from '@/components/gamification/LevelProgress';
import { useFarcaster } from '@/app/providers';
import { formatEth, cn } from '@/lib/utils';
import { getLevelFromXP } from '@/types/index';
import { Trophy, TrendingUp, Flame, Users, ArrowUp, ArrowDown, Minus } from 'lucide-react';

type LeaderboardType = 'profit' | 'winRate' | 'streak' | 'creator';
type TimePeriod = 'all' | 'month' | 'week' | 'today';

// Mock leaderboard data
const MOCK_LEADERBOARD = [
  { rank: 1, address: '0x1234...5678', username: 'whale', pfpUrl: null, profit: BigInt('125800000000000000000'), winRate: 78, wins: 234, bets: 300, streak: 15, level: 5, change: 'up' },
  { rank: 2, address: '0x2345...6789', username: 'king', pfpUrl: null, profit: BigInt('98200000000000000000'), winRate: 74, wins: 185, bets: 250, streak: 12, level: 5, change: 'up' },
  { rank: 3, address: '0x3456...7890', username: 'shark', pfpUrl: null, profit: BigInt('76500000000000000000'), winRate: 71, wins: 142, bets: 200, streak: 10, level: 4, change: 'down' },
  { rank: 4, address: '0x4567...8901', username: 'alice', pfpUrl: null, profit: BigInt('65300000000000000000'), winRate: 68, wins: 136, bets: 200, streak: 9, level: 4, change: 'same' },
  { rank: 5, address: '0x5678...9012', username: 'crypto_king', pfpUrl: null, profit: BigInt('58700000000000000000'), winRate: 72, wins: 144, bets: 200, streak: 11, level: 4, change: 'up' },
];

const MOCK_CREATOR_LEADERBOARD = [
  { rank: 1, address: '0x1234...5678', username: 'whale', earnings: BigInt('45800000000000000000'), markets: 32, qualified: 31, avgPool: BigInt('15200000000000000000') },
  { rank: 2, address: '0x2345...6789', username: 'market_master', earnings: BigInt('38300000000000000000'), markets: 28, qualified: 27, avgPool: BigInt('14800000000000000000') },
  { rank: 3, address: '0x3456...7890', username: 'alice', earnings: BigInt('32100000000000000000'), markets: 25, qualified: 23, avgPool: BigInt('13900000000000000000') },
];

export default function LeaderboardPage() {
  const { shareToFarcaster } = useFarcaster();
  const [type, setType] = useState<LeaderboardType>('profit');
  const [period, setPeriod] = useState<TimePeriod>('all');

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
        {type !== 'creator' ? (
          <div className="space-y-3">
            {MOCK_LEADERBOARD.map((entry, index) => {
              const levelInfo = getLevelInfo(entry.level);
              
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
                        {getChangeIcon(entry.change)}
                      </div>
                      
                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{levelInfo.icon}</span>
                          <span className="font-medium text-white">@{entry.username}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {entry.winRate}% win rate • {entry.wins}/{entry.bets} bets
                        </div>
                      </div>
                      
                      {/* Main stat */}
                      <div className="text-right">
                        {type === 'profit' && (
                          <div className="text-green-400 font-bold">
                            +{formatEth(entry.profit)} ETH
                          </div>
                        )}
                        {type === 'winRate' && (
                          <div className="text-blue-400 font-bold">
                            {entry.winRate}%
                          </div>
                        )}
                        {type === 'streak' && (
                          <div className="text-orange-400 font-bold flex items-center gap-1">
                            <Flame className="w-4 h-4" />
                            {entry.streak}
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
            {MOCK_CREATOR_LEADERBOARD.map((entry) => (
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
                        <span className="font-medium text-white">@{entry.username}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {entry.qualified}/{entry.markets} qualified • Avg {formatEth(entry.avgPool)} ETH
                      </div>
                    </div>
                    
                    {/* Earnings */}
                    <div className="text-right">
                      <div className="text-purple-400 font-bold">
                        +{formatEth(entry.earnings)} ETH
                      </div>
                      <div className="text-xs text-gray-500">
                        earned
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Ranking */}
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 text-center">
                <span className="text-lg font-bold text-gray-400">127</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🥚</span>
                  <span className="font-medium text-white">You</span>
                  <span className="text-xs text-purple-400 px-2 py-0.5 rounded-full bg-purple-500/20">
                    New
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Keep playing to climb the ranks!
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 font-bold">0 ETH</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share */}
        <Button 
          variant="outline" 
          fullWidth
          onClick={() => shareToFarcaster(
            `⚡ Check out the FlashEvent leaderboard!\n\n🥇 @whale leads with +125.8 ETH profit\n\nCan you make it to the top? 🏆`,
            `${process.env.NEXT_PUBLIC_APP_URL}/leaderboard`
          )}
        >
          Share Leaderboard
        </Button>
      </div>
    </div>
  );
}
