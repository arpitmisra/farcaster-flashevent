'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { OddsDisplay } from './OddsBar';
import { formatEth, formatTimeRemaining, formatAddress, calculateOdds } from '@/lib/utils';
import { MarketResult, MarketStatus } from '@/types';
import { cn } from '@/lib/utils';

interface MarketCardProps {
  address: string;
  question: string;
  yesPool: bigint;
  noPool: bigint;
  totalBets: number;
  bettingDeadline: number;
  expiry: number;
  status: MarketStatus;
  result: MarketResult;
  creator?: string;
  creatorUsername?: string;
  isCreatorEligible?: boolean;
  isFeatured?: boolean;
}

export function MarketCard({
  address,
  question,
  yesPool,
  noPool,
  totalBets,
  bettingDeadline,
  expiry,
  status,
  result,
  creator,
  creatorUsername,
  isCreatorEligible,
  isFeatured,
}: MarketCardProps) {
  const odds = calculateOdds(yesPool, noPool);
  const totalPool = yesPool + noPool;
  const now = Date.now() / 1000;
  const isBettingOpen = now < bettingDeadline && result === MarketResult.PENDING;
  const isExpired = now > expiry;
  const isResolved = result !== MarketResult.PENDING;

  // Status badge
  const getStatusBadge = () => {
    if (isResolved) {
      return (
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          result === MarketResult.YES 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        )}>
          {result === MarketResult.YES ? 'YES Won' : 'NO Won'}
        </span>
      );
    }
    if (!isBettingOpen && !isExpired) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          Betting Closed
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Live
      </span>
    );
  };

  return (
    <Link href={`/market/${address}`}>
      <Card className={cn(
        'hover:border-purple-500/50 transition-all duration-200 cursor-pointer',
        isFeatured && 'border-purple-500/30 bg-purple-900/10'
      )}>
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {isFeatured && (
                <span className="text-xs text-purple-400 font-medium flex items-center gap-1 mb-1">
                  <span>💎</span> Featured
                </span>
              )}
              <h3 className="font-medium text-white line-clamp-2 text-base leading-tight">
                {question}
              </h3>
            </div>
            {getStatusBadge()}
          </div>

          {/* Odds Bar */}
          <OddsDisplay yesPercentage={odds.yes} noPercentage={odds.no} />

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-gray-400">
                <span>💰</span>
                <span>{formatEth(totalPool)} ETH</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <span>👥</span>
                <span>{totalBets}</span>
              </div>
            </div>
            
            {isBettingOpen && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <span>⏰</span>
                <span>{formatTimeRemaining(bettingDeadline)}</span>
              </div>
            )}
          </div>

          {/* Creator info */}
          {creator && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>By</span>
                <span className="text-gray-400">
                  {creatorUsername ? `@${creatorUsername}` : formatAddress(creator)}
                </span>
              </div>
              {isCreatorEligible !== undefined && (
                <span className={cn(
                  'text-xs',
                  isCreatorEligible ? 'text-green-400' : 'text-gray-500'
                )}>
                  {isCreatorEligible ? '✓ Creator eligible' : `${10 - totalBets} bets to qualify`}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Featured market card with more details
export function FeaturedMarketCard(props: MarketCardProps & { recentActivity?: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur-xl" />
      <MarketCard {...props} isFeatured />
      {props.recentActivity && (
        <div className="absolute -bottom-2 left-4 right-4 px-3 py-1 bg-gray-800 rounded-full text-xs text-center text-gray-300 border border-gray-700">
          🔥 {props.recentActivity}
        </div>
      )}
    </div>
  );
}
