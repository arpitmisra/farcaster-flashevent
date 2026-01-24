'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OddsBar } from '@/components/market/OddsBar';
import { BettingInterface } from '@/components/market/BettingInterface';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useMarketData, useUserPosition, useClaimWinnings, useClaimableAmount } from '@/lib/contracts/hooks';
import { useFarcaster } from '@/app/providers';
import { formatEth, formatTimeRemaining, formatAddress, formatRelativeTime, cn } from '@/lib/utils';
import { MarketResult } from '@/types';
import { ArrowLeft, Share2, ExternalLink, Clock, Users, Coins, Trophy } from 'lucide-react';

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketAddress = params.id as `0x${string}`;
  const { address } = useAccount();
  const { shareToFarcaster, openUrl } = useFarcaster();

  const { data: market, isLoading, refetch } = useMarketData(marketAddress);
  const { data: userPosition } = useUserPosition(marketAddress, address);
  const { data: claimable } = useClaimableAmount(marketAddress, address);
  const { claim, isPending: isClaiming, isSuccess: claimSuccess } = useClaimWinnings(marketAddress);

  if (isLoading) {
    return <PageLoader text="Loading market..." />;
  }

  if (!market || !market.question) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-lg font-medium text-white mb-2">Market Not Found</h3>
            <p className="text-gray-400 mb-4">This market doesn't exist or has been removed.</p>
            <Button onClick={() => router.push('/')}>Back to Markets</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPool = (market.yesPool || BigInt(0)) + (market.noPool || BigInt(0));
  const totalBets = Number(market.yesBets || 0) + Number(market.noBets || 0);
  const yesPercentage = totalPool > BigInt(0) 
    ? (Number(market.yesPool) / Number(totalPool)) * 100 
    : 50;
  const noPercentage = 100 - yesPercentage;
  const isResolved = market.result !== undefined && market.result !== MarketResult.PENDING;
  const userWon = userPosition?.hasVoted && isResolved && (
    (market.result === MarketResult.YES && (userPosition.yesBetAmount || BigInt(0)) > BigInt(0)) ||
    (market.result === MarketResult.NO && (userPosition.noBetAmount || BigInt(0)) > BigInt(0))
  );
  const canClaim = userWon && !userPosition?.hasClaimed && claimable && claimable[0] > BigInt(0);

  const handleShare = () => {
    const text = `⚡ Check out this prediction market on FlashEvent!\n\n"${market.question}"\n\n💰 Pool: ${formatEth(totalPool)} ETH\n📊 Odds: ${yesPercentage.toFixed(0)}% YES / ${noPercentage.toFixed(0)}% NO`;
    shareToFarcaster(text, `${process.env.NEXT_PUBLIC_APP_URL}/market/${marketAddress}`);
  };

  const handleClaim = async () => {
    try {
      await claim();
      refetch();
    } catch (err) {
      console.error('Failed to claim:', err);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openUrl(`https://testnet.monadexplorer.com/address/${marketAddress}`)}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Market Question */}
        <div>
          <h1 className="text-xl font-bold text-white leading-tight mb-3">
            {market.question}
          </h1>
          
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            {isResolved ? (
              <span className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                market.result === MarketResult.YES 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              )}>
                {market.result === MarketResult.YES ? '✅ YES Won' : '❌ NO Won'}
              </span>
            ) : market.isBettingOpen ? (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Betting Open
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400">
                ⏰ Betting Closed
              </span>
            )}
          </div>
        </div>

        {/* Odds Visualization */}
        <Card>
          <CardContent className="p-4">
            <OddsBar 
              yesPercentage={yesPercentage}
              noPercentage={noPercentage}
              yesPool={formatEth(market.yesPool || BigInt(0))}
              noPool={formatEth(market.noPool || BigInt(0))}
              size="lg"
            />
          </CardContent>
        </Card>

        {/* Market Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-lg font-bold text-white">{formatEth(totalPool)} ETH</div>
              <div className="text-xs text-gray-400">Total Pool</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">👥</div>
              <div className="text-lg font-bold text-white">{totalBets}</div>
              <div className="text-xs text-gray-400">Total Bets</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">⏰</div>
              <div className="text-lg font-bold text-white">
                {market.isBettingOpen 
                  ? formatTimeRemaining(Number(market.bettingDeadline))
                  : 'Closed'
                }
              </div>
              <div className="text-xs text-gray-400">Betting Ends</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">{market.isCreatorEligible ? '✅' : '⏳'}</div>
              <div className="text-lg font-bold text-white">
                {market.isCreatorEligible ? 'Eligible' : `${10 - totalBets} more`}
              </div>
              <div className="text-xs text-gray-400">Creator Reward</div>
            </CardContent>
          </Card>
        </div>

        {/* Winner Claim Section */}
        {canClaim && (
          <Card className="border-green-500/50 bg-green-500/5 animate-pulse-glow">
            <CardContent className="p-6 text-center space-y-4">
              <div className="text-5xl">🎉</div>
              <div>
                <h3 className="text-xl font-bold text-white">You Won!</h3>
                <p className="text-gray-400">Claim your winnings now</p>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {formatEth(claimable[0])} ETH
              </div>
              <Button 
                variant="success" 
                size="lg" 
                fullWidth
                onClick={handleClaim}
                isLoading={isClaiming}
              >
                {isClaiming ? 'Claiming...' : 'Claim Winnings 💰'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Already Claimed */}
        {userPosition?.hasClaimed && (
          <Card className="border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-gray-400">You've already claimed your winnings</p>
            </CardContent>
          </Card>
        )}

        {/* Betting Interface (only if market is open) */}
        {!isResolved && (
          <BettingInterface
            marketAddress={marketAddress}
            question={market.question}
            yesPool={market.yesPool || BigInt(0)}
            noPool={market.noPool || BigInt(0)}
            totalBets={totalBets}
            isBettingOpen={market.isBettingOpen || false}
            onSuccess={refetch}
          />
        )}

        {/* Creator Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Creator</span>
              <span className="text-white font-mono">
                {formatAddress(market.creator || '')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Betting Deadline</span>
              <span className="text-white">
                {new Date(Number(market.bettingDeadline) * 1000).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Resolution Time</span>
              <span className="text-white">
                {new Date(Number(market.expiry) * 1000).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-white">2.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Creator Fee</span>
              <span className="text-white">
                {market.isCreatorEligible ? '5%' : '0% (needs 10+ bets)'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
