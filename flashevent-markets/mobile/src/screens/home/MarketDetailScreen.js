/**
 * MarketDetailScreen - View market details and place bets
 * 
 * This screen displays market information and allows users to place bets
 * by calling the Market.sol contract functions directly through MetaMask.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { ethers } from 'ethers';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import OddsBar from '../../components/market/OddsBar';
import CountdownTimer from '../../components/market/CountdownTimer';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import { useWallet } from '../../context/WalletContext';
import { contractService } from '../../services/contractService';
import { colors, typography, spacing } from '../../styles/theme';
import { MARKET_ABI, MARKET_TYPE_ICONS, MARKET_TYPE_LABELS, NETWORK_CONFIG } from '../../config/contracts';
import config from '../../config';

// Logger
const logger = {
  info: (msg, data) => console.log('[MarketDetail]', msg, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error('[MarketDetail]', msg, data ? JSON.stringify(data) : ''),
};

// Native token symbol
const TOKEN_SYMBOL = NETWORK_CONFIG.nativeCurrency?.symbol || 'MON';

// Default bet amounts
const BET_AMOUNTS = config.DEFAULT_BET_AMOUNTS || [0.01, 0.05, 0.1, 0.5, 1];

export default function MarketDetailScreen({ route, navigation }) {
  const { marketAddress, market: initialMarket, initialBet } = route.params;
  
  // Wallet context for transactions
  const walletContext = useWallet();
  const { isConnected, address: walletAddress, sendTransaction, getProvider } = walletContext;
  
  // Auth store for user info
  const user = useAuthStore((state) => state.user);

  // State
  const [market, setMarket] = useState(initialMarket || null);
  const [selectedSide, setSelectedSide] = useState(initialBet || null);
  const [betAmount, setBetAmount] = useState(BET_AMOUNTS[1]); // Default 0.05
  const [isLoading, setIsLoading] = useState(!initialMarket);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  
  // Creator fee states
  const [accruedCreatorFees, setAccruedCreatorFees] = useState('0');
  const [isWithdrawingFees, setIsWithdrawingFees] = useState(false);

  // Register wallet context with contract service
  useEffect(() => {
    contractService.setWalletContext(walletContext);
  }, [walletContext, isConnected, walletAddress]);

  // Fetch market data
  const fetchMarketData = useCallback(async () => {
    if (!marketAddress) {
      logger.error('No market address provided');
      return;
    }

    try {
      logger.info('Fetching market data', { marketAddress });
      const details = await contractService.getMarketDetails(marketAddress);
      setMarket(details);
      logger.info('Market data fetched', { question: details.question });

      // Fetch user position if wallet connected
      if (isConnected && walletAddress) {
        const position = await contractService.getUserPosition(marketAddress, walletAddress);
        setUserPosition(position);
        logger.info('User position fetched', position);
        
        // Fetch creator fees if this user is the creator
        try {
          const monadProvider = getProvider();
          const marketContract = new ethers.Contract(marketAddress, MARKET_ABI, monadProvider);
          const creatorAddress = await marketContract.creator();
          
          if (walletAddress.toLowerCase() === creatorAddress.toLowerCase()) {
            const fees = await marketContract.accruedCreatorFees();
            const feesFormatted = ethers.formatEther(fees);
            setAccruedCreatorFees(feesFormatted);
            logger.info('Creator fees fetched', { fees: feesFormatted });
          }
        } catch (feeError) {
          logger.error('Failed to fetch creator fees', { error: feeError.message });
        }
      }
    } catch (error) {
      logger.error('Failed to fetch market data', { error: error.message });
      Alert.alert('Error', 'Failed to load market data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [marketAddress, isConnected, walletAddress]);

  // Initial load
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchMarketData();
  };

  // Loading state
  if (isLoading || !market) {
    return <LoadingSpinner fullScreen text="Loading market..." />;
  }

  // Market data
  const {
    question,
    marketType = 0,
    creator,
    yesPool = '0',
    noPool = '0',
    totalPool = '0',
    bettorCount = 0,
    endTime,
    bettingDeadlineTime, // New: when betting closes
    isBettingOpen = true, // New: whether betting is still open
    resolved,
    outcome,
    isExpired,
  } = market;

  // Calculate odds
  const yesPoolNum = parseFloat(yesPool) || 0;
  const noPoolNum = parseFloat(noPool) || 0;
  const total = yesPoolNum + noPoolNum;
  const yesOdds = total > 0 ? (yesPoolNum / total) * 100 : 50;
  const noOdds = total > 0 ? (noPoolNum / total) * 100 : 50;
  
  // Get bet counts for fee calculation
  const totalYesBets = market.totalYesBets || 0;
  const totalNoBets = market.totalNoBets || 0;
  const totalBetsCount = totalYesBets + totalNoBets;
  
  // Fee constants (matching contract)
  const PROTOCOL_FEE_BPS = 250; // 2.5%
  const CREATOR_FEE_BPS = 500;  // 5%
  const ONE_SIDED_FEE_BPS = 500; // 5% for one-sided markets
  const MIN_BETS_FOR_CREATOR_FEE = 10;

  // Check if current user is the market creator
  const isCreator = walletAddress && creator && 
    walletAddress.toLowerCase() === creator.toLowerCase();

  /**
   * Calculate potential payout with proper fee handling
   * 
   * FEE LOGIC (always shown as non-creator since creator fees are withdrawn separately):
   * - One-sided market: 5% platform fee for everyone (no creator fee)
   * - Two-sided market (< 10 bets): 2.5% platform fee only
   * - Two-sided market (>= 10 bets): 7.5% total (2.5% platform + 5% creator)
   * 
   * Note: Creator fee rebates are NOT included in payout display because
   * creators withdraw their accumulated fees separately via withdrawCreatorFees()
   * 
   * @param {string} side - 'yes' or 'no'
   * @param {number} amount - bet amount
   * @returns {object} { amount, feeDeducted, feePercent, isOneSided, isCreator }
   */
  const getPotentialPayout = (side, amount) => {
    const amountNum = parseFloat(amount) || 0;
    if (amountNum === 0) {
      return { 
        amount: '0.0000', 
        feeDeducted: '0.0000', 
        feePercent: 0,
        isOneSided: false, 
        isCreator 
      };
    }
    
    // Calculate pools AFTER user places bet
    const newYesPool = side === 'yes' ? yesPoolNum + amountNum : yesPoolNum;
    const newNoPool = side === 'no' ? noPoolNum + amountNum : noPoolNum;
    const newTotalPool = newYesPool + newNoPool;
    
    // New bet counts after user bets
    const newYesBets = side === 'yes' ? totalYesBets + 1 : totalYesBets;
    const newNoBets = side === 'no' ? totalNoBets + 1 : totalNoBets;
    const newTotalBetsCount = newYesBets + newNoBets;
    
    // Check if market would be one-sided after this bet
    const wouldBeOneSided = newYesPool === 0 || newNoPool === 0;
    
    let claimableAmount = 0;
    let feeDeducted = 0;
    let feePercent = 0;
    
    if (wouldBeOneSided) {
      // ONE-SIDED MARKET: 5% platform fee, everyone gets 95% refund
      feePercent = 5;
      const platformFee = (newTotalPool * ONE_SIDED_FEE_BPS) / 10000; // 5%
      const distributablePool = newTotalPool - platformFee;
      
      // User's proportional share of the refund
      claimableAmount = (amountNum * distributablePool) / newTotalPool;
      feeDeducted = (amountNum * platformFee) / newTotalPool;
    } else {
      // TWO-SIDED MARKET
      const userBet = amountNum;
      const winningPool = side === 'yes' ? newYesPool : newNoPool;
      
      // Determine which fees apply based on bet count
      const hasCreatorFee = newTotalBetsCount >= MIN_BETS_FOR_CREATOR_FEE;
      
      // Always calculate as non-creator since creator fees are withdrawn separately
      if (!hasCreatorFee) {
        // Market has < 10 bets: only 2.5% platform fee
        feePercent = 2.5;
        const totalFee = (newTotalPool * PROTOCOL_FEE_BPS) / 10000; // 2.5%
        const distributablePool = newTotalPool - totalFee;
        
        claimableAmount = (userBet * distributablePool) / winningPool;
        feeDeducted = (userBet * totalFee) / winningPool;
      } else {
        // Market has >= 10 bets: 7.5% total fee (2.5% platform + 5% creator)
        feePercent = 7.5;
        const platformFee = (newTotalPool * PROTOCOL_FEE_BPS) / 10000; // 2.5%
        const creatorFee = (newTotalPool * CREATOR_FEE_BPS) / 10000;  // 5%
        const totalFee = platformFee + creatorFee;
        const distributablePool = newTotalPool - totalFee;
        
        claimableAmount = (userBet * distributablePool) / winningPool;
        feeDeducted = (userBet * totalFee) / winningPool;
      }
    }
    
    return {
      amount: claimableAmount.toFixed(4),
      feeDeducted: feeDeducted.toFixed(4),
      feePercent,
      isOneSided: wouldBeOneSided,
      isCreator,
    };
  };
  
  // Calculate multiplier for display (what you get per 1 MON bet)
  const getMultiplier = (side) => {
    const payout = getPotentialPayout(side, 1);
    return parseFloat(payout.amount);
  };

  // Share market
  const handleShare = async () => {
    try {
      await Share.share({
        message: `🔮 ${question}\n\nBet now on FlashEvent Markets!\n${config.FRAMES_URL}/market/${marketAddress}`,
      });
    } catch (error) {
      logger.error('Share error', { error: error.message });
    }
  };

  /**
   * Place a bet by calling the Market contract
   */
  const handlePlaceBet = async () => {
    if (!selectedSide) {
      Alert.alert('Select Side', 'Please choose YES or NO to place a bet');
      return;
    }

    if (!isConnected || !walletAddress) {
      Alert.alert('Wallet Required', 'Please connect your MetaMask wallet to place a bet');
      return;
    }

    // Check if betting is still open
    if (!isBettingOpen) {
      Alert.alert('Betting Closed', 'Betting has closed for this market. You can no longer place bets.');
      return;
    }

    if (isExpired || resolved) {
      Alert.alert('Market Closed', 'This market has expired or been resolved');
      return;
    }

    // Check if user has already voted BEFORE sending transaction
    if (userPosition?.hasVoted) {
      Alert.alert(
        '⚠️ Already Voted',
        'You have already placed a bet on this market. You can only bet once per market.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsPlacingBet(true);
      
      // Double-check on-chain if user has already voted
      const monadProvider = getProvider();
      const marketContract = new ethers.Contract(marketAddress, MARKET_ABI, monadProvider);
      const hasAlreadyVoted = await marketContract.hasVoted(walletAddress);
      
      if (hasAlreadyVoted) {
        Alert.alert(
          '⚠️ Already Voted',
          'You have already placed a bet on this market. You can only bet once per market.',
          [{ text: 'OK' }]
        );
        setIsPlacingBet(false);
        // Refresh data to update UI
        fetchMarketData();
        return;
      }
      
      const isYes = selectedSide === 'yes';
      const amountStr = betAmount.toString();
      const valueWei = ethers.parseEther(amountStr);
      
      logger.info('Placing bet', {
        marketAddress,
        side: isYes ? 'YES' : 'NO',
        amount: amountStr,
        valueWei: valueWei.toString(),
      });

      // Encode function data
      const marketInterface = new ethers.Interface(MARKET_ABI);
      const functionName = isYes ? 'placeYes' : 'placeNo';
      const data = marketInterface.encodeFunctionData(functionName, []);

      logger.info('Encoded call data', {
        functionName,
        data: data,
      });

      // Send transaction via MetaMask
      const txResult = await sendTransaction({
        to: marketAddress,
        data: data,
        value: ethers.toQuantity(valueWei), // Convert to hex string
      });

      const txHash = txResult?.hash || txResult?.transactionHash || txResult;
      logger.info('Bet transaction sent!', { txHash });

      // Check transaction receipt status to verify it actually succeeded
      const receipt = txResult?.status !== undefined ? txResult : await monadProvider.getTransactionReceipt(txHash);
      
      if (receipt && receipt.status === 0) {
        // Transaction reverted on-chain
        logger.error('Transaction reverted on-chain', { txHash, status: receipt.status });
        Alert.alert(
          '❌ Transaction Failed',
          'The transaction was rejected by the smart contract. You may have already voted on this market.',
          [{ text: 'OK' }]
        );
        fetchMarketData();
        return;
      }

      // Success alert
      Alert.alert(
        '🎉 Bet Placed!',
        `You bet ${amountStr} ${TOKEN_SYMBOL} on ${selectedSide.toUpperCase()}\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        [
          {
            text: 'View My Bets',
            onPress: () => navigation.navigate('Main', { screen: 'MyBets' }),
          },
          { text: 'OK' },
        ]
      );

      // Refresh market data
      setTimeout(() => fetchMarketData(), 2000);
      
    } catch (error) {
      logger.error('Bet failed', { error: error.message });
      
      let errorMessage = 'Failed to place bet. ';
      let errorTitle = 'Error';
      
      if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient balance in your wallet.';
      } else if (error.message?.includes('user rejected') || error.message?.includes('rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (error.message?.includes('MarketExpired')) {
        errorMessage = 'This market has expired.';
      } else if (error.message?.includes('BettingClosed')) {
        errorMessage = 'Betting has closed for this market. The locking period has started.';
      } else if (error.message?.includes('AlreadyVoted') || error.message?.includes('already voted')) {
        errorTitle = '⚠️ Already Voted';
        errorMessage = 'You have already placed a bet on this market. You can only bet once per market.';
      } else if (error.message?.includes('revert') || error.message?.includes('execution reverted')) {
        // Generic revert - likely AlreadyVoted
        errorTitle = '⚠️ Transaction Failed';
        errorMessage = 'The transaction was rejected. You may have already voted on this market.';
      } else {
        errorMessage += error.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsPlacingBet(false);
    }
  };

  /**
   * Claim winnings from a resolved market
   */
  const handleClaimWinnings = async () => {
    if (!isConnected || !walletAddress) {
      Alert.alert('Wallet Required', 'Please connect your MetaMask wallet to claim');
      return;
    }

    try {
      setIsClaiming(true);
      
      logger.info('Claiming winnings', { marketAddress });

      // Encode claim function
      const marketInterface = new ethers.Interface(MARKET_ABI);
      const data = marketInterface.encodeFunctionData('claim', []);

      // Send transaction
      const txResult = await sendTransaction({
        to: marketAddress,
        data: data,
        value: '0x0',
      });

      const txHash = txResult?.hash || txResult?.transactionHash || txResult;
      logger.info('Claim transaction sent!', { txHash });

      Alert.alert(
        '🎉 Winnings Claimed!',
        `Your winnings have been sent to your wallet.\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
      );

      // Refresh market data
      setTimeout(() => fetchMarketData(), 2000);
      
    } catch (error) {
      logger.error('Claim failed', { error: error.message });
      
      let errorMessage = 'Failed to claim winnings. ';
      if (error.message?.includes('DidNotBetOnWinningSide')) {
        errorMessage = 'You did not bet on the winning side.';
      } else if (error.message?.includes('AlreadyClaimed')) {
        errorMessage = 'You have already claimed your winnings.';
      } else if (error.message?.includes('MarketNotResolved')) {
        errorMessage = 'Market has not been resolved yet.';
      } else {
        errorMessage += error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsClaiming(false);
    }
  };

  /**
   * Withdraw accumulated creator fees
   */
  const handleWithdrawCreatorFees = async () => {
    if (!isConnected || !walletAddress) {
      Alert.alert('Wallet Required', 'Please connect your MetaMask wallet to withdraw fees');
      return;
    }

    const feesNum = parseFloat(accruedCreatorFees);
    if (feesNum <= 0) {
      Alert.alert('No Fees', 'There are no creator fees to withdraw yet.');
      return;
    }

    try {
      setIsWithdrawingFees(true);
      
      logger.info('Withdrawing creator fees', { marketAddress, amount: accruedCreatorFees });

      // Encode withdrawCreatorFees function
      const marketInterface = new ethers.Interface(MARKET_ABI);
      const data = marketInterface.encodeFunctionData('withdrawCreatorFees', []);

      logger.info('Encoded withdraw data', { data });

      // Send transaction
      const txResult = await sendTransaction({
        to: marketAddress,
        data: data,
        value: '0x0',
      });

      const txHash = typeof txResult === 'string' 
        ? txResult 
        : (txResult?.hash || txResult?.transactionHash);
        
      if (!txHash) {
        throw new Error('No transaction hash received');
      }

      logger.info('Withdraw transaction sent!', { txHash });

      Alert.alert(
        '💰 Fees Withdrawn!',
        `Successfully withdrew ${parseFloat(accruedCreatorFees).toFixed(4)} ${TOKEN_SYMBOL} in creator fees!\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        [{ text: 'Great!', style: 'default' }]
      );

      // Reset accrued fees and refresh
      setAccruedCreatorFees('0');
      setTimeout(() => fetchMarketData(), 2000);
      
    } catch (error) {
      logger.error('Fee withdrawal failed', { error: error.message });
      
      let errorMessage = 'Failed to withdraw fees. ';
      if (error.message?.includes('NoCreatorFeesToWithdraw')) {
        errorMessage = 'No creator fees available to withdraw.';
      } else if (error.message?.includes('CreatorFeeWithdrawalFailed')) {
        errorMessage = 'Fee withdrawal failed. The contract may not have enough balance.';
      } else if (error.message?.includes('user rejected') || error.message?.includes('rejected') || error.message?.includes('denied')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (error.message?.includes('timeout') || error.message?.includes('expired')) {
        errorMessage = 'Request timed out. Please check MetaMask and try again.';
      } else {
        errorMessage += error.message;
      }
      
      Alert.alert('Withdrawal Failed', errorMessage);
    } finally {
      setIsWithdrawingFees(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Share button */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Text style={styles.shareIcon}>📤</Text>
      </TouchableOpacity>

      {/* Market Type Badge */}
      <View style={styles.typeBadge}>
        <Text style={styles.typeIcon}>{MARKET_TYPE_ICONS[marketType] || '📊'}</Text>
        <Text style={styles.typeLabel}>{MARKET_TYPE_LABELS[marketType] || 'Market'}</Text>
      </View>

      {/* Contract Address */}
      <TouchableOpacity 
        style={styles.addressBadge}
        onPress={() => {
          Alert.alert('Market Address', marketAddress);
        }}
      >
        <Text style={styles.addressText}>
          📄 {marketAddress.slice(0, 8)}...{marketAddress.slice(-6)}
        </Text>
      </TouchableOpacity>

      {/* Creator */}
      <TouchableOpacity
        style={styles.creator}
        onPress={() =>
          creator?.username &&
          navigation.navigate('UserProfile', { username: creator.username })
        }
      >
        <Avatar
          source={creator?.pfp_url ? { uri: creator.pfp_url } : null}
          name={creator?.display_name || creator?.username || 'Creator'}
          size="sm"
        />
        <View style={styles.creatorInfo}>
          <Text style={styles.creatorName}>@{creator?.username || 'creator'}</Text>
          <Text style={styles.creatorLabel}>created this market</Text>
        </View>
      </TouchableOpacity>

      {/* Question Card */}
      <Card style={styles.questionCard}>
        <Text style={styles.question}>{question}</Text>
        
        <View style={styles.sourceInfo}>
          <Text style={styles.sourceLabel}>📊 Source: </Text>
          <Text style={styles.sourceValue}>
            {marketType === 0 ? 'Chainlink' : marketType === 1 ? 'Blockchain' : 'API + ZK'}
          </Text>
        </View>
      </Card>

      {/* Countdown or Resolution Status */}
      <View style={styles.countdown}>
        {resolved ? (
          <View
            style={[
              styles.resolvedBadge,
              outcome ? styles.resolvedYes : styles.resolvedNo,
            ]}
          >
            <Text style={styles.resolvedText}>
              {outcome ? '✅ Resolved YES' : '❌ Resolved NO'}
            </Text>
          </View>
        ) : isExpired ? (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredText}>⏰ Market Expired - Awaiting Resolution</Text>
          </View>
        ) : !isBettingOpen ? (
          <View style={styles.bettingClosedBadge}>
            <Text style={styles.bettingClosedText}>🔒 Betting Closed - Locking Period</Text>
            <Text style={styles.countdownLabel}>⏱️ Resolves in</Text>
            <CountdownTimer endTime={endTime} />
          </View>
        ) : (
          <>
            {bettingDeadlineTime && bettingDeadlineTime < endTime && (
              <>
                <Text style={styles.bettingDeadlineLabel}>🎯 Betting closes in</Text>
                <CountdownTimer endTime={bettingDeadlineTime} />
                <View style={styles.spacer} />
              </>
            )}
            <Text style={styles.countdownLabel}>⏱️ Market ends in</Text>
            <CountdownTimer endTime={endTime} />
          </>
        )}
      </View>

      {/* User Position (if any) */}
      {userPosition && userPosition.hasVoted && (
        <Card style={styles.positionCard}>
          <Text style={styles.positionTitle}>📍 Your Position</Text>
          <View style={styles.positionRow}>
            <Text style={styles.positionLabel}>Side:</Text>
            <Text style={[styles.positionValue, userPosition.side === 'YES' ? styles.yesText : styles.noText]}>
              {userPosition.side}
            </Text>
          </View>
          <View style={styles.positionRow}>
            <Text style={styles.positionLabel}>Amount:</Text>
            <Text style={styles.positionValue}>
              {(userPosition.yesBets + userPosition.noBets).toFixed(4)} {TOKEN_SYMBOL}
            </Text>
          </View>
        </Card>
      )}

      {/* Betting Section (if not resolved and not expired) */}
      {!resolved && !isExpired && isBettingOpen && (
        <>
          {/* One-sided market warning */}
          {(yesPoolNum === 0 || noPoolNum === 0) && total > 0 && (
            <Card style={styles.warningCard}>
              <Text style={styles.warningTitle}>⚠️ One-Sided Market</Text>
              <Text style={styles.warningMessage}>
                Currently all bets are on {yesPoolNum > 0 ? 'YES' : 'NO'}. If no one bets on the other side, everyone gets a 95% refund (5% platform fee).
              </Text>
            </Card>
          )}
          
          <Text style={styles.sectionTitle}>CHOOSE YOUR SIDE</Text>
          
          <View style={styles.sides}>
            {/* YES Side */}
            <TouchableOpacity
              style={[
                styles.sideCard,
                styles.yesSide,
                selectedSide === 'yes' && styles.selectedYes,
              ]}
              onPress={() => setSelectedSide('yes')}
              activeOpacity={0.8}
            >
              <Text style={styles.sideTitle}>YES</Text>
              <Text style={styles.sideOdds}>{Math.round(yesOdds)}%</Text>
              <Text style={styles.sidePayout}>
                {yesPoolNum === 0 ? 'Be first!' : `${getMultiplier('yes').toFixed(2)}x payout`}
              </Text>
              {selectedSide === 'yes' && (
                <Text style={styles.selectedBadge}>🟢 SELECTED</Text>
              )}
            </TouchableOpacity>

            {/* NO Side */}
            <TouchableOpacity
              style={[
                styles.sideCard,
                styles.noSide,
                selectedSide === 'no' && styles.selectedNo,
              ]}
              onPress={() => setSelectedSide('no')}
              activeOpacity={0.8}
            >
              <Text style={styles.sideTitle}>NO</Text>
              <Text style={styles.sideOdds}>{Math.round(noOdds)}%</Text>
              <Text style={styles.sidePayout}>
                {noPoolNum === 0 ? 'Be first!' : `${getMultiplier('no').toFixed(2)}x payout`}
              </Text>
              {selectedSide === 'no' && (
                <Text style={styles.selectedBadge}>🔴 SELECTED</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Bet Amount */}
          <Text style={styles.sectionTitle}>BET AMOUNT</Text>
          
          <View style={styles.amountButtons}>
            {BET_AMOUNTS.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.amountButton,
                  betAmount === amount && styles.amountButtonActive,
                ]}
                onPress={() => setBetAmount(amount)}
              >
                <Text
                  style={[
                    styles.amountText,
                    betAmount === amount && styles.amountTextActive,
                  ]}
                >
                  {amount} {TOKEN_SYMBOL}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Potential Payout */}
          {selectedSide && (() => {
            const payoutInfo = getPotentialPayout(selectedSide, betAmount);
            return (
              <Card style={styles.payoutCard}>
                <Text style={styles.payoutLabel}>Estimated Payout (if you win)</Text>
                <Text style={styles.payoutValue}>
                  {payoutInfo.amount} {TOKEN_SYMBOL}
                </Text>
                <Text style={styles.payoutFeeText}>
                  Fee: {payoutInfo.feePercent}% (~{payoutInfo.feeDeducted} {TOKEN_SYMBOL})
                </Text>
                {payoutInfo.isOneSided && (
                  <Text style={styles.payoutWarning}>
                    ⚠️ One-sided: 95% refund if no opposing bets
                  </Text>
                )}
              </Card>
            );
          })()}

          {/* Place Bet Button */}
          <Button
            title={isPlacingBet ? 'Placing Bet...' : `⚡ PLACE BET (${betAmount} ${TOKEN_SYMBOL})`}
            onPress={handlePlaceBet}
            disabled={!selectedSide || isPlacingBet || !isConnected}
            loading={isPlacingBet}
            style={styles.betButton}
          />

          {!isConnected && (
            <Text style={styles.warningText}>
              ⚠️ Connect your wallet to place a bet
            </Text>
          )}
        </>
      )}

      {/* Result Section for users who bet (after resolution) */}
      {resolved && userPosition?.hasVoted && (() => {
        // Determine if user won
        // outcome = true means YES won, outcome = false means NO won
        const userSide = userPosition.side; // 'YES' or 'NO'
        const winningSide = outcome ? 'YES' : 'NO';
        const userWon = userSide === winningSide;
        const isOneSided = (yesPoolNum === 0 || noPoolNum === 0);
        
        if (userPosition.hasClaimed) {
          // Already claimed
          return (
            <Card style={styles.resultCard}>
              <Text style={styles.resultTitle}>✅ Winnings Claimed</Text>
              <Text style={styles.resultMessage}>
                You have already claimed your winnings from this market.
              </Text>
            </Card>
          );
        } else if (userWon || isOneSided) {
          // User won OR one-sided market (everyone gets refund)
          return (
            <Button
              title={isClaiming ? 'Claiming...' : '🎉 CLAIM WINNINGS'}
              onPress={handleClaimWinnings}
              disabled={isClaiming || !isConnected}
              loading={isClaiming}
              style={styles.claimButton}
            />
          );
        } else {
          // User lost
          return (
            <Card style={styles.lostCard}>
              <Text style={styles.lostTitle}>❌ You Lost</Text>
              <Text style={styles.lostMessage}>
                You bet on {userSide} but the market resolved to {winningSide}.
              </Text>
              <Text style={styles.lostSubtext}>
                Your bet of {(userPosition.yesBets + userPosition.noBets).toFixed(4)} {TOKEN_SYMBOL} has been distributed to the winners.
              </Text>
            </Card>
          );
        }
      })()}

      {/* Creator Fee Withdrawal Section - Only visible to market creator */}
      {isCreator && isConnected && (() => {
        const feesNum = parseFloat(accruedCreatorFees);
        const hasFeesToWithdraw = feesNum > 0;
        
        return (
          <Card style={styles.creatorFeeCard}>
            <View style={styles.creatorFeeHeader}>
              <Text style={styles.creatorFeeIcon}>👑</Text>
              <Text style={styles.creatorFeeTitle}>Creator Earnings</Text>
            </View>
            
            <Text style={styles.creatorFeeDescription}>
              As the market creator, you earn 5% of the pool from winning claims (when there are 10+ total bets).
            </Text>
            
            <View style={styles.creatorFeeAmountRow}>
              <Text style={styles.creatorFeeLabel}>Available to Withdraw:</Text>
              <Text style={[
                styles.creatorFeeAmount,
                hasFeesToWithdraw && styles.creatorFeeAmountPositive
              ]}>
                {parseFloat(accruedCreatorFees).toFixed(4)} {TOKEN_SYMBOL}
              </Text>
            </View>
            
            {hasFeesToWithdraw ? (
              <TouchableOpacity
                style={[
                  styles.withdrawButton,
                  isWithdrawingFees && styles.withdrawButtonDisabled
                ]}
                onPress={handleWithdrawCreatorFees}
                disabled={isWithdrawingFees}
                activeOpacity={0.8}
              >
                {isWithdrawingFees ? (
                  <Text style={styles.withdrawButtonText}>⏳ Withdrawing...</Text>
                ) : (
                  <Text style={styles.withdrawButtonText}>💰 Withdraw Fees</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.noFeesNote}>
                <Text style={styles.noFeesText}>
                  💡 Fees accumulate when users claim winnings from your market.
                </Text>
              </View>
            )}
          </Card>
        );
      })()}

      {/* Pool Stats */}
      <Text style={styles.sectionTitle}>POOL STATS</Text>
      <Card style={styles.statsCard}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>YES Pool</Text>
          <Text style={[styles.statValue, styles.yesText]}>
            {parseFloat(yesPool).toFixed(4)} {TOKEN_SYMBOL}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>NO Pool</Text>
          <Text style={[styles.statValue, styles.noText]}>
            {parseFloat(noPool).toFixed(4)} {TOKEN_SYMBOL}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Pool</Text>
          <Text style={styles.statValue}>{parseFloat(totalPool).toFixed(4)} {TOKEN_SYMBOL}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Bettors</Text>
          <Text style={styles.statValue}>{bettorCount}</Text>
        </View>
      </Card>

      {/* Odds Bar */}
      <OddsBar yesPercent={yesOdds} noPercent={noOdds} style={styles.oddsBar} />

      {/* Technical Info */}
      <Card style={styles.techCard}>
        <Text style={styles.techTitle}>📋 Contract Info</Text>
        <Text style={styles.techText}>Market: {marketAddress}</Text>
        <Text style={styles.techText}>Network: {NETWORK_CONFIG.chainName}</Text>
        <Text style={styles.techText}>Chain ID: {NETWORK_CONFIG.chainId}</Text>
      </Card>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.screenHorizontal,
  },
  shareButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 20,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  typeLabel: {
    ...typography.styles.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  addressBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  addressText: {
    ...typography.styles.caption,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  creator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  creatorInfo: {
    marginLeft: spacing.sm,
  },
  creatorName: {
    ...typography.styles.label,
    color: colors.primary,
  },
  creatorLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  questionCard: {
    marginBottom: spacing.md,
  },
  question: {
    ...typography.styles.h4,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceLabel: {
    ...typography.styles.bodySmall,
    color: colors.textSecondary,
  },
  sourceValue: {
    ...typography.styles.bodySmall,
    color: colors.primary,
  },
  countdown: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  countdownLabel: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  resolvedBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
  },
  resolvedYes: {
    backgroundColor: colors.yesBackground,
  },
  resolvedNo: {
    backgroundColor: colors.noBackground,
  },
  resolvedText: {
    ...typography.styles.h5,
    color: colors.text,
  },
  expiredBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
    backgroundColor: colors.warning + '30',
  },
  expiredText: {
    ...typography.styles.body,
    color: colors.warning,
  },
  bettingClosedBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
  },
  bettingClosedText: {
    ...typography.styles.body,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  bettingDeadlineLabel: {
    ...typography.styles.label,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  spacer: {
    height: spacing.sm,
  },
  positionCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  positionTitle: {
    ...typography.styles.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  positionLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  positionValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  sides: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sideCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: spacing.cardBorderRadius,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  yesSide: {
    backgroundColor: colors.yesBackground,
  },
  noSide: {
    backgroundColor: colors.noBackground,
  },
  selectedYes: {
    borderColor: colors.yes,
  },
  selectedNo: {
    borderColor: colors.no,
  },
  sideTitle: {
    ...typography.styles.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sideOdds: {
    ...typography.styles.numberLarge,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sidePayout: {
    ...typography.styles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  selectedBadge: {
    ...typography.styles.labelSmall,
    color: colors.text,
  },
  amountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  amountButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountButtonActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  amountText: {
    ...typography.styles.label,
    color: colors.textSecondary,
  },
  amountTextActive: {
    color: colors.primary,
  },
  payoutCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  payoutLabel: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  payoutValue: {
    ...typography.styles.numberLarge,
    color: colors.success,
  },
  betButton: {
    marginBottom: spacing.md,
  },
  claimButton: {
    marginBottom: spacing.xl,
    backgroundColor: colors.success,
  },
  // Result cards for won/lost/claimed states
  resultCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.success + '15',
    borderColor: colors.success,
    borderWidth: 1,
  },
  resultTitle: {
    ...typography.styles.h3,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  resultMessage: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  lostCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.error + '15',
    borderColor: colors.error,
    borderWidth: 1,
  },
  lostTitle: {
    ...typography.styles.h3,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  lostMessage: {
    ...typography.styles.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  lostSubtext: {
    ...typography.styles.caption,
    color: colors.textSecondary,
  },
  warningText: {
    ...typography.styles.caption,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.styles.body,
    color: colors.text,
    fontWeight: '600',
  },
  yesText: {
    color: colors.yes,
  },
  noText: {
    color: colors.no,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  oddsBar: {
    marginBottom: spacing.xl,
  },
  techCard: {
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  techTitle: {
    ...typography.styles.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  techText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  bottomPadding: {
    height: spacing['3xl'],
  },
  warningCard: {
    backgroundColor: colors.warning + '20',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTitle: {
    ...typography.styles.label,
    color: colors.warning,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  warningMessage: {
    ...typography.styles.caption,
    color: colors.warning,
    lineHeight: 18,
  },
  payoutFeeText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  creatorNote: {
    ...typography.styles.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  payoutWarning: {
    ...typography.styles.caption,
    color: colors.warning,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Creator Fee Withdrawal Styles
  creatorFeeCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  creatorFeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  creatorFeeIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  creatorFeeTitle: {
    ...typography.styles.h4,
    color: colors.primary,
    fontWeight: '700',
  },
  creatorFeeDescription: {
    ...typography.styles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  creatorFeeAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  creatorFeeLabel: {
    ...typography.styles.body,
    color: colors.textSecondary,
  },
  creatorFeeAmount: {
    ...typography.styles.h4,
    color: colors.textMuted,
    fontWeight: '700',
  },
  creatorFeeAmountPositive: {
    color: colors.success,
  },
  withdrawButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawButtonDisabled: {
    backgroundColor: colors.primary + '60',
    shadowOpacity: 0,
    elevation: 0,
  },
  withdrawButtonText: {
    ...typography.styles.button,
    color: colors.buttonText,
    fontWeight: '700',
    fontSize: 16,
  },
  noFeesNote: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    borderRadius: spacing.sm,
  },
  noFeesText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
