'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OddsBar } from './OddsBar';
import { usePlaceBet, useUserPosition } from '@/lib/contracts/hooks';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';
import { useFarcaster } from '@/app/providers';
import { formatEth, calculatePotentialWinnings, cn } from '@/lib/utils';
import { FEES } from '@/lib/contracts/addresses';
import { AlertCircle, Wallet } from 'lucide-react';

interface BettingInterfaceProps {
  marketAddress: `0x${string}`;
  question: string;
  yesPool: bigint;
  noPool: bigint;
  totalBets: number;
  isBettingOpen: boolean;
  onSuccess?: () => void;
}

export function BettingInterface({
  marketAddress,
  question,
  yesPool,
  noPool,
  totalBets,
  isBettingOpen,
  onSuccess,
}: BettingInterfaceProps) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO' | null>(null);
  const [betAmount, setBetAmount] = useState('0.1');
  const [showConfirm, setShowConfirm] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  
  const { placeBet, isPending, isConfirming, isSuccess, error, reset } = usePlaceBet(marketAddress);
  const { data: userPosition } = useUserPosition(marketAddress, address);
  const { isCorrectChain, switchToMonad, isSwitching } = useChainSwitch();
  const { isInMiniApp, isWalletReady } = useFarcaster();

  // Handle wallet connection for Farcaster
  const handleConnect = async () => {
    if (isInMiniApp) {
      // In Farcaster, use the first connector (miniAppConnector)
      const farcasterConnector = connectors.find(c => c.id === 'farcaster' || c.name?.toLowerCase().includes('farcaster')) || connectors[0];
      if (farcasterConnector) {
        try {
          await connect({ connector: farcasterConnector });
        } catch (err) {
          console.error('Failed to connect Farcaster wallet:', err);
          setTransactionError('Failed to connect wallet. Please try again.');
        }
      }
    } else {
      // In browser, use injected connector
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        try {
          await connect({ connector: injectedConnector });
        } catch (err) {
          console.error('Failed to connect wallet:', err);
          setTransactionError('Failed to connect wallet. Please try again.');
        }
      }
    }
  };

  // Calculate odds
  const totalPool = yesPool + noPool;
  const yesPercentage = totalPool > BigInt(0) ? (Number(yesPool) / Number(totalPool)) * 100 : 50;
  const noPercentage = 100 - yesPercentage;

  // Calculate potential winnings
  const betAmountBigInt = parseEther(betAmount || '0');
  const potentialWinnings = selectedSide 
    ? calculatePotentialWinnings(
        betAmountBigInt,
        selectedSide,
        yesPool,
        noPool,
        FEES.PLATFORM_FEE_BPS,
        FEES.CREATOR_FEE_BPS,
        totalBets,
        FEES.MIN_BETS_FOR_CREATOR
      )
    : null;

  // Handle successful bet
  useEffect(() => {
    if (isSuccess) {
      setShowConfirm(false);
      setSelectedSide(null);
      setBetAmount('0.1');
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  // Quick bet amounts
  const quickAmounts = ['0.05', '0.1', '0.5', '1.0', '5.0'];

  const handlePlaceBet = async () => {
    if (!selectedSide || !betAmount) return;
    setTransactionError(null);
    
    // Check if connected
    if (!isConnected) {
      setTransactionError('Please connect your wallet first');
      return;
    }

    // Check if on correct chain
    if (!isCorrectChain) {
      try {
        await switchToMonad();
        // Wait a bit for chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        setTransactionError('Please switch to Monad Testnet to place bets');
        return;
      }
    }
    
    try {
      await placeBet(selectedSide, parseEther(betAmount));
    } catch (err: any) {
      console.error('Failed to place bet:', err);
      
      // Parse common error messages
      const errorMessage = err?.message || err?.toString() || 'Transaction failed';
      
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        setTransactionError('Transaction was cancelled');
      } else if (errorMessage.includes('insufficient funds')) {
        setTransactionError('Insufficient balance for this bet');
      } else if (errorMessage.includes('chain') || errorMessage.includes('network')) {
        setTransactionError('Please switch to Monad Testnet');
      } else {
        setTransactionError(errorMessage.slice(0, 100));
      }
    }
  };

  // User has already voted
  if (userPosition?.hasVoted) {
    const side = (userPosition.yesBetAmount || BigInt(0)) > BigInt(0) ? 'YES' : 'NO';
    const amount = side === 'YES' ? userPosition.yesBetAmount : userPosition.noBetAmount;
    
    return (
      <Card className="border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🎯</span> Your Position
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn(
            'p-4 rounded-lg text-center',
            side === 'YES' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
          )}>
            <div className="text-sm text-gray-400 mb-1">You bet on</div>
            <div className={cn(
              'text-2xl font-bold',
              side === 'YES' ? 'text-green-400' : 'text-red-400'
            )}>
              {side}
            </div>
            <div className="text-lg text-white mt-2">
              {formatEth(amount || BigInt(0))} ETH
            </div>
          </div>
          
          <OddsBar 
            yesPercentage={yesPercentage}
            noPercentage={noPercentage}
            yesPool={formatEth(yesPool)}
            noPool={formatEth(noPool)}
          />
        </CardContent>
      </Card>
    );
  }

  // Betting closed
  if (!isBettingOpen) {
    return (
      <Card className="border-yellow-500/30">
        <CardContent className="p-6 text-center">
          <div className="text-4xl mb-4">⏰</div>
          <h3 className="text-lg font-medium text-white mb-2">Betting Closed</h3>
          <p className="text-gray-400">
            This market is no longer accepting bets.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🎯</span> Place Your Bet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Odds */}
        <OddsBar 
          yesPercentage={yesPercentage}
          noPercentage={noPercentage}
          yesPool={formatEth(yesPool)}
          noPool={formatEth(noPool)}
        />

        {/* Side Selection */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={selectedSide === 'YES' ? 'yes' : 'outline'}
            size="lg"
            fullWidth
            onClick={() => setSelectedSide('YES')}
            className={cn(
              selectedSide === 'YES' && 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900'
            )}
          >
            <span className="text-xl mr-2">✅</span>
            YES
          </Button>
          <Button
            variant={selectedSide === 'NO' ? 'no' : 'outline'}
            size="lg"
            fullWidth
            onClick={() => setSelectedSide('NO')}
            className={cn(
              selectedSide === 'NO' && 'ring-2 ring-red-400 ring-offset-2 ring-offset-gray-900'
            )}
          >
            <span className="text-xl mr-2">❌</span>
            NO
          </Button>
        </div>

        {/* Bet Amount */}
        {selectedSide && (
          <div className="space-y-3 animate-fade-in">
            <Input
              label="Bet Amount (ETH)"
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="0.001"
              step="0.01"
              placeholder="0.1"
            />
            
            {/* Quick Amount Buttons */}
            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                    betAmount === amount
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  )}
                >
                  {amount}
                </button>
              ))}
            </div>

            {/* Potential Winnings */}
            {potentialWinnings && (
              <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">If {selectedSide} wins:</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Potential Return:</span>
                  <span className="text-white font-medium">
                    {formatEth(potentialWinnings.winnings)} ETH
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit:</span>
                  <span className={cn(
                    'font-medium',
                    potentialWinnings.profit > BigInt(0) ? 'text-green-400' : 'text-red-400'
                  )}>
                    +{formatEth(potentialWinnings.profit)} ETH ({potentialWinnings.roi.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {(error || transactionError) && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{transactionError || error?.message || 'Transaction failed'}</span>
              </div>
            )}

            {/* Chain Warning */}
            {isConnected && !isCorrectChain && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                <div className="flex items-center justify-between">
                  <span>Switch to Monad Testnet to place bets</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={switchToMonad}
                    isLoading={isSwitching}
                    className="text-xs ml-2"
                  >
                    Switch
                  </Button>
                </div>
              </div>
            )}

            {/* Place Bet Button */}
            {isConnected ? (
              <Button
                variant={selectedSide === 'YES' ? 'yes' : 'no'}
                size="lg"
                fullWidth
                onClick={handlePlaceBet}
                isLoading={isPending || isConfirming || isSwitching}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
              >
                {isSwitching
                  ? 'Switching Network...'
                  : isPending 
                    ? 'Confirm in Wallet...' 
                    : isConfirming 
                      ? 'Confirming...' 
                      : `Bet ${betAmount} ETH on ${selectedSide}`
                }
              </Button>
            ) : (
              <Button 
                size="lg" 
                fullWidth 
                onClick={handleConnect}
                isLoading={isConnecting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet to Bet
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
