// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Market is ReentrancyGuard {
    enum Result {
        Pending,
        Yes,
        No
    }

    //errors
    error NotFactoryAddress(address sender);
    error MarketNotResolved();
    error AlreadyClaimed();
    error DidNotBetOnWinningSide();
    error NoWinningsToClaim();
    error ClaimTransferFailed();
    error FeeTooHigh();
    error InvalidTreasury();
    error NoFeesToWithdraw();
    error FeeWithdrawalFailed();
    error MarketExpired();
    error AlreadyVoted();
    error MarketAlreadyResolved();
    error CannotCancelResolvedMarket();
    error RefundFailed();
    error NotCreator();
    error NoCreatorFeesToWithdraw();
    error CreatorFeeWithdrawalFailed();
    error InvalidCreator();
    error BettingClosed();
    error InvalidBettingDeadline();

    // constants
    uint256 public constant MIN_BETS_FOR_CREATOR_FEE = 10; // Minimum 10 bets required for creator to earn fees

    // variables
    string public question;
    uint256 public expiry;
    uint256 public bettingDeadline; // Time when betting closes (before expiry)
    address public factory;
    Result public result;
    uint256 public totalYesBetsAmount;
    uint256 public totalNoBetsAmount;
    uint256 public totalYesBets;
    uint256 public totalNoBets;
    address[] public bettorsYes;
    address[] public bettorsNo;
    uint256 public protocolFeeBps = 250; // 2.5% fee (250 basis points)
    address public treasury;
    address public creator;
    uint256 public accruedFees; // Platform fees (2.5%)
    uint256 public accruedCreatorFees; // Creator fees (5%)
    uint256 public creatorFeesPercent = 500; // 5% fee to the creator

    // mappings
    mapping(address => uint256) public yesBets;
    mapping(address => uint256) public noBets;
    mapping(address => bool) public hasVoted;
    mapping(address => bool) public hasClaimed;

    // events
    event BetPlaced(address indexed bettor, bool yesSide, uint256 amount);
    event Resolved(Result outcome);
    event Claimed(address indexed user, uint256 winnings, uint256 platformFee, uint256 creatorFee);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event MarketCancelled();

    // modifiers
    modifier onlyFactory() {
        if (msg.sender != factory) {
            revert NotFactoryAddress(msg.sender);
        }
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) {
            revert NotCreator();
        }
        _;
    }

    constructor(string memory _question, uint256 _expiry, uint256 _bettingDeadline, address _treasury, address _creator) {
        factory = msg.sender;
        question = _question;
        expiry = _expiry;
        // Validate: bettingDeadline must be before expiry
        if (_bettingDeadline >= _expiry) revert InvalidBettingDeadline();
        bettingDeadline = _bettingDeadline;
        result = Result.Pending;
        if (_treasury == address(0)) revert InvalidTreasury();
        if (_creator == address(0)) revert InvalidCreator();
        treasury = _treasury;
        creator = _creator;
    }

    // functions
    function placeYes() external payable nonReentrant {
        if (block.timestamp > bettingDeadline) {
            revert BettingClosed();
        }
        if (hasVoted[msg.sender]) {
            revert AlreadyVoted();
        }
        totalYesBets += 1;
        bettorsYes.push(msg.sender);
        hasVoted[msg.sender] = true;
        yesBets[msg.sender] += msg.value;
        totalYesBetsAmount += msg.value;
        emit BetPlaced(msg.sender, true, msg.value);
    }

    function placeNo() external payable nonReentrant {
        if (block.timestamp > bettingDeadline) {
            revert BettingClosed();
        }
        if (hasVoted[msg.sender]) {
            revert AlreadyVoted();
        }

        bettorsNo.push(msg.sender);
        totalNoBets += 1;
        hasVoted[msg.sender] = true;
        noBets[msg.sender] += msg.value;
        totalNoBetsAmount += msg.value;
        emit BetPlaced(msg.sender, false, msg.value);
    }

    function resolve(Result _result) external onlyFactory {
        if (result != Result.Pending) {
            revert MarketAlreadyResolved();
        }
        result = _result;
        emit Resolved(_result);
    }

    // Check if market is one-sided (everyone bet on same side)
    function isOneSided() public view returns (bool) {
        return (totalYesBetsAmount > 0 && totalNoBetsAmount == 0) || 
               (totalYesBetsAmount == 0 && totalNoBetsAmount > 0);
    }

    // Calculate claimable amount for a user (without claiming)
    function getClaimableAmount(address user) external view returns (uint256 claimableAmount, uint256 feeDeducted) {
        if (result == Result.Pending) revert MarketNotResolved();

        uint256 userBet = 0;
        uint256 totalPool = totalYesBetsAmount + totalNoBetsAmount;
        uint256 totalBetsCount = totalYesBets + totalNoBets;
        
        // Check if market is one-sided
        bool oneSided = isOneSided();
        
        if (oneSided) {
            // One-sided market: 5% platform fee, 0% creator fee, refund 95% proportionally
            uint256 platformFeeAmount = (totalPool * 500) / 10000; // 5% platform fee
            uint256 distributablePool = totalPool - platformFeeAmount;
            
            // User can claim regardless of which side they bet on (everyone gets refund)
            userBet = yesBets[user] + noBets[user];
            if (userBet == 0) revert DidNotBetOnWinningSide();
            
            // User's proportional share of the refund
            claimableAmount = (userBet * distributablePool) / totalPool;
            feeDeducted = (userBet * platformFeeAmount) / totalPool;
        } else {
            // Normal two-sided market
            uint256 totalWinningPool = 0;
            
            // Calculate platform fee on total pool (always applies)
            uint256 platformFeeAmount = (totalPool * protocolFeeBps) / 10000;
            
            // Creator fee only applies if minimum bets threshold is met
            uint256 creatorFeeAmount = 0;
            if (totalBetsCount >= MIN_BETS_FOR_CREATOR_FEE) {
                creatorFeeAmount = (totalPool * creatorFeesPercent) / 10000;
            }
            
            uint256 distributablePool = totalPool - platformFeeAmount - creatorFeeAmount;

            if (result == Result.Yes) {
                userBet = yesBets[user];
                totalWinningPool = totalYesBetsAmount;
                if (userBet == 0) revert DidNotBetOnWinningSide();

                // User's share of the distributable pool proportional to their bet
                claimableAmount = (userBet * distributablePool) / totalWinningPool;
                
                // User's proportional share of total fees
                feeDeducted = (userBet * (platformFeeAmount + creatorFeeAmount)) / totalWinningPool;

            } else if (result == Result.No) {
                userBet = noBets[user];
                totalWinningPool = totalNoBetsAmount;
                if (userBet == 0) revert DidNotBetOnWinningSide();

                // User's share of the distributable pool proportional to their bet
                claimableAmount = (userBet * distributablePool) / totalWinningPool;
                
                // User's proportional share of total fees
                feeDeducted = (userBet * (platformFeeAmount + creatorFeeAmount)) / totalWinningPool;
            }
        }
    }

    // Actual claim function (matches getClaimableAmount logic)
    function claim() external nonReentrant returns (uint256) {
        if (result == Result.Pending) revert MarketNotResolved();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        uint256 claimableAmount;
        uint256 userPlatformFee;
        uint256 userCreatorFee;
        uint256 totalPool = totalYesBetsAmount + totalNoBetsAmount;
        uint256 totalBetsCount = totalYesBets + totalNoBets;
        
        // Check if market is one-sided
        bool oneSided = isOneSided();
        
        if (oneSided) {
            // One-sided market: 5% platform fee, 0% creator fee, refund 95% proportionally
            uint256 platformFee = (totalPool * 500) / 10000; // 5% platform fee
            uint256 distributablePool = totalPool - platformFee;
            
            // User can claim regardless of which side they bet on (everyone gets refund)
            uint256 userBet = yesBets[msg.sender] + noBets[msg.sender];
            if (userBet == 0) revert DidNotBetOnWinningSide();
            
            // User's proportional share of the refund
            claimableAmount = (userBet * distributablePool) / totalPool;
            userPlatformFee = (userBet * platformFee) / totalPool;
            userCreatorFee = 0; // No creator fees on one-sided markets
        } else {
            // Normal two-sided market
            // Calculate platform fee on total pool (always applies)
            uint256 platformFee = (totalPool * protocolFeeBps) / 10000;
            
            // Creator fee only applies if minimum bets threshold is met
            uint256 creatorFee = 0;
            bool creatorEligible = totalBetsCount >= MIN_BETS_FOR_CREATOR_FEE;
            if (creatorEligible) {
                creatorFee = (totalPool * creatorFeesPercent) / 10000;
            }
            
            uint256 distributablePool = totalPool - platformFee - creatorFee;

            if (result == Result.Yes) {
                uint256 userBet = yesBets[msg.sender];
                if (userBet == 0) revert DidNotBetOnWinningSide();

                // User's share of the distributable pool proportional to their bet
                claimableAmount = (userBet * distributablePool) / totalYesBetsAmount;
                
                // Calculate user's proportional share of fees
                userPlatformFee = (userBet * platformFee) / totalYesBetsAmount;
                if (creatorEligible) {
                    userCreatorFee = (userBet * creatorFee) / totalYesBetsAmount;
                }
            } else {
                uint256 userBet = noBets[msg.sender];
                if (userBet == 0) revert DidNotBetOnWinningSide();

                // User's share of the distributable pool proportional to their bet
                claimableAmount = (userBet * distributablePool) / totalNoBetsAmount;
                
                // Calculate user's proportional share of fees
                userPlatformFee = (userBet * platformFee) / totalNoBetsAmount;
                if (creatorEligible) {
                    userCreatorFee = (userBet * creatorFee) / totalNoBetsAmount;
                }
            }
        }

        if (claimableAmount == 0) revert NoWinningsToClaim();

        hasClaimed[msg.sender] = true;
        accruedFees += userPlatformFee; // Platform fees
        if (!oneSided && totalBetsCount >= MIN_BETS_FOR_CREATOR_FEE) {
            accruedCreatorFees += userCreatorFee; // Creator fees (only on two-sided markets above threshold)
        }

        (bool success,) = msg.sender.call{value: claimableAmount}("");
        if (!success) revert ClaimTransferFailed();

        emit Claimed(msg.sender, claimableAmount, userPlatformFee, userCreatorFee);

        return claimableAmount;
    }

    // Set protocol fee (factory-only)
    function setProtocolFee(uint256 newFeeBps) external onlyFactory {
        if (newFeeBps > 1000) revert FeeTooHigh(); // Max 10%
        protocolFeeBps = newFeeBps;
    }

    // Set treasury address (factory-only)
    function setTreasury(address _treasury) external onlyFactory {
        if (_treasury == address(0)) revert InvalidTreasury();
        treasury = _treasury;
    }

    // Withdraw accumulated platform fees (factory-only, sends to treasury)
    function withdrawFees() external onlyFactory {
        uint256 amount = accruedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        if (address(this).balance < amount) revert FeeWithdrawalFailed();

        accruedFees = 0;
        (bool success,) = treasury.call{value: amount}("");
        if (!success) revert FeeWithdrawalFailed();

        emit FeesWithdrawn(treasury, amount);
    }

    // Withdraw accumulated creator fees (creator-only)
    function withdrawCreatorFees() external onlyCreator nonReentrant {
        uint256 amount = accruedCreatorFees;
        if (amount == 0) revert NoCreatorFeesToWithdraw();
        if (address(this).balance < amount) revert CreatorFeeWithdrawalFailed();

        accruedCreatorFees = 0;
        (bool success,) = creator.call{value: amount}("");
        if (!success) revert CreatorFeeWithdrawalFailed();

        emit CreatorFeesWithdrawn(creator, amount);
    }

    // incase the bet is invalid or cancelled by the factory
    function cancelMarket() external onlyFactory {
        if (result != Result.Pending) revert CannotCancelResolvedMarket();

        // Refund all YES bettors
        for (uint256 i = 0; i < bettorsYes.length; i++) {
            address bettor = bettorsYes[i];
            uint256 amount = yesBets[bettor];
            if (amount > 0) {
                yesBets[bettor] = 0;
                (bool success,) = bettor.call{value: amount}("");
                if (!success) revert RefundFailed();
            }
        }

        // Refund all NO bettors
        for (uint256 i = 0; i < bettorsNo.length; i++) {
            address bettor = bettorsNo[i];
            uint256 amount = noBets[bettor];
            if (amount > 0) {
                noBets[bettor] = 0;
                (bool success,) = bettor.call{value: amount}("");
                if (!success) revert RefundFailed();
            }
        }

        emit MarketCancelled();
    }

    // getters
    function getTotalYesBetsAmount() external view returns (uint256) {
        return totalYesBetsAmount;
    }

    function getTotalNoBetsAmount() external view returns (uint256) {
        return totalNoBetsAmount;
    }
    function getTotalBets() external view returns (uint256) {
        return totalYesBets + totalNoBets;
    }

    function getTotalPoolAmount() external view returns (uint256) {
        return totalYesBets + totalNoBets;
    }

    function getUserBet(address user) external view returns (uint256 totalAmountUserBet) {
        uint256 yesBet = yesBets[user];
        uint256 noBet = noBets[user];
        totalAmountUserBet = yesBet + noBet;
        return totalAmountUserBet;
    }

    function getProbablityYes() external view returns (uint256) {
        uint256 totalPool = totalYesBetsAmount + totalNoBetsAmount;
        if (totalPool == 0) {
            return 0;
        }
        return (totalYesBetsAmount * 100) / totalPool;
    }

    function getProbablityNo() external view returns (uint256) {
        uint256 totalPool = totalYesBetsAmount + totalNoBetsAmount;
        if (totalPool == 0) {
            return 0;
        }
        return (totalNoBetsAmount * 100) / totalPool;
    }

    function getIsExpired() external view returns (bool) {
        return block.timestamp > expiry;
    }

    // Betting period helper functions
    function isBettingOpen() external view returns (bool) {
        return block.timestamp <= bettingDeadline && result == Result.Pending;
    }

    function isLocked() external view returns (bool) {
        return block.timestamp > bettingDeadline && block.timestamp <= expiry;
    }

    function getTimeUntilBettingEnds() external view returns (uint256) {
        if (block.timestamp >= bettingDeadline) {
            return 0;
        }
        return bettingDeadline - block.timestamp;
    }

    function getTimeUntilExpiry() external view returns (uint256) {
        if (block.timestamp >= expiry) {
            return 0;
        }
        return expiry - block.timestamp;
    }

    function getBettingDeadline() external view returns (uint256) {
        return bettingDeadline;
    }

    function getLockDuration() external view returns (uint256) {
        return expiry - bettingDeadline;
    }

    function getIsresolved() external view returns (bool) {
        return result != Result.Pending;
    }

    function getFactoryAddress() external view returns (address) {
        return factory;
    }

    function getMarketQuestion() external view returns (string memory) {
        return question;
    }

    function getMarketExpiry() external view returns (uint256) {
        return expiry;
    }

    function getTotalAmountToBeClaimedByTheWinningSide() external view returns (uint256) {
        return totalYesBetsAmount + totalNoBetsAmount;
    }

    function getCreator() external view returns (address) {
        return creator;
    }

    function getAccruedFees() external view returns (uint256) {
        return accruedFees;
    }

    function getAccruedCreatorFees() external view returns (uint256) {
        return accruedCreatorFees;
    }

    function getFeeInfo() external view returns (
        uint256 platformFeeBps,
        uint256 creatorFeeBps,
        uint256 platformFeesAccrued,
        uint256 creatorFeesAccrued,
        address treasuryAddress,
        address creatorAddress,
        uint256 minBetsRequired,
        bool creatorEligibleForFees
    ) {
        uint256 totalBetsCount = totalYesBets + totalNoBets;
        return (
            protocolFeeBps,
            creatorFeesPercent,
            accruedFees,
            accruedCreatorFees,
            treasury,
            creator,
            MIN_BETS_FOR_CREATOR_FEE,
            totalBetsCount >= MIN_BETS_FOR_CREATOR_FEE
        );
    }

    function getMinBetsForCreatorFee() external pure returns (uint256) {
        return MIN_BETS_FOR_CREATOR_FEE;
    }

    function isCreatorEligibleForFees() external view returns (bool) {
        uint256 totalBetsCount = totalYesBets + totalNoBets;
        return totalBetsCount >= MIN_BETS_FOR_CREATOR_FEE;
    }

    function getBetsUntilCreatorEligible() external view returns (uint256) {
        uint256 totalBetsCount = totalYesBets + totalNoBets;
        if (totalBetsCount >= MIN_BETS_FOR_CREATOR_FEE) {
            return 0;
        }
        return MIN_BETS_FOR_CREATOR_FEE - totalBetsCount;
    }
}
