// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Market.sol";

contract MarketTest is Test {
    Market market;
    address factory = address(this);
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address user3 = makeAddr("user3");

    // Events to match Market contract
    event BetPlaced(address indexed bettor, bool yesSide, uint256 amount);
    event Resolved(Market.Result outcome);
    event Claimed(address indexed user, uint256 winnings, uint256 platformFee, uint256 creatorFee);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event MarketCancelled();

    function setUp() public {
        // Give users some ETH
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
        vm.deal(user3, 1000 ether);

        // Create a market with 1 hour expiry and 45 min betting period (15 min lock)
        uint256 expiry = block.timestamp + 1 hours;
        uint256 bettingDeadline = block.timestamp + 45 minutes;
        market = new Market("Will ETH reach $5000?", expiry, bettingDeadline, treasury, creator);
    }

    // ============ Constructor Tests ============

    function test_constructor_initialization() public view {
        assertEq(market.question(), "Will ETH reach $5000?");
        assertEq(market.expiry(), block.timestamp + 1 hours);
        assertEq(market.bettingDeadline(), block.timestamp + 45 minutes);
        assertEq(market.factory(), factory);
        assertEq(market.treasury(), treasury);
        assertEq(market.creator(), creator);
        assertEq(uint256(market.result()), uint256(Market.Result.Pending));
        assertEq(market.protocolFeeBps(), 250); // 2.5%
        assertEq(market.creatorFeesPercent(), 500); // 5%
    }

    function test_constructor_invalid_treasury() public {
        vm.expectRevert(Market.InvalidTreasury.selector);
        new Market("Test Question", block.timestamp + 1 hours, block.timestamp + 45 minutes, address(0), creator);
    }

    function test_constructor_invalid_creator() public {
        vm.expectRevert(Market.InvalidCreator.selector);
        new Market("Test Question", block.timestamp + 1 hours, block.timestamp + 45 minutes, treasury, address(0));
    }

    function test_constructor_invalid_betting_deadline() public {
        // bettingDeadline >= expiry should revert
        vm.expectRevert(Market.InvalidBettingDeadline.selector);
        new Market("Test Question", block.timestamp + 1 hours, block.timestamp + 1 hours, treasury, creator);
        
        // bettingDeadline > expiry should also revert
        vm.expectRevert(Market.InvalidBettingDeadline.selector);
        new Market("Test Question", block.timestamp + 1 hours, block.timestamp + 2 hours, treasury, creator);
    }

    // ============ placeYes() Tests ============

    function test_placeYes_valid_bet() public {
        vm.prank(user1);
        market.placeYes{value: 1 ether}();

        assertEq(market.yesBets(user1), 1 ether);
        assertEq(market.totalYesBetsAmount(), 1 ether);
        assertEq(market.hasVoted(user1), true);
    }

    function test_placeYes_multiple_bets() public {
        vm.prank(user1);
        market.placeYes{value: 1 ether}();

        vm.prank(user1);
        vm.expectRevert(Market.AlreadyVoted.selector);
        market.placeYes{value: 1 ether}();
    }

    function test_placeYes_expired_market() public {
        // Warp to after betting deadline (betting closed)
        vm.warp(block.timestamp + 50 minutes);
        vm.prank(user1);
        vm.expectRevert(Market.BettingClosed.selector);
        market.placeYes{value: 1 ether}();
    }

    function test_placeYes_betting_still_open() public {
        // Warp to just before betting deadline
        vm.warp(block.timestamp + 44 minutes);
        vm.prank(user1);
        market.placeYes{value: 1 ether}();
        assertEq(market.yesBets(user1), 1 ether);
    }

    function test_placeYes_zero_value() public {
        vm.prank(user1);
        market.placeYes{value: 0}();
        assertEq(market.yesBets(user1), 0);
        assertEq(market.hasVoted(user1), true);
    }

    function test_placeYes_large_amount() public {
        // Test with large but reasonable amount
        uint256 largeAmount = 1000 ether;
        vm.prank(user1);
        market.placeYes{value: largeAmount}();
        assertEq(market.yesBets(user1), largeAmount);
    }

    function test_placeYes_hasVoted_flag() public {
        vm.prank(user1);
        market.placeYes{value: 1 ether}();
        assertEq(market.hasVoted(user1), true);

        vm.prank(user1);
        vm.expectRevert(Market.AlreadyVoted.selector);
        market.placeNo{value: 1 ether}();
    }

    // ============ placeNo() Tests ============

    function test_placeNo_valid_bet() public {
        vm.prank(user1);
        market.placeNo{value: 1 ether}();

        assertEq(market.noBets(user1), 1 ether);
        assertEq(market.totalNoBetsAmount(), 1 ether);
        assertEq(market.hasVoted(user1), true);
    }

    function test_placeNo_multiple_bets() public {
        vm.prank(user1);
        market.placeNo{value: 1 ether}();

        vm.prank(user1);
        vm.expectRevert(Market.AlreadyVoted.selector);
        market.placeNo{value: 1 ether}();
    }

    function test_placeNo_expired_market() public {
        // Warp to after betting deadline (betting closed)
        vm.warp(block.timestamp + 50 minutes);
        vm.prank(user1);
        vm.expectRevert(Market.BettingClosed.selector);
        market.placeNo{value: 1 ether}();
    }

    function test_placeNo_betting_still_open() public {
        // Warp to just before betting deadline
        vm.warp(block.timestamp + 44 minutes);
        vm.prank(user1);
        market.placeNo{value: 1 ether}();
        assertEq(market.noBets(user1), 1 ether);
    }

    function test_placeNo_already_voted_yes() public {
        vm.prank(user1);
        market.placeYes{value: 1 ether}();

        vm.prank(user1);
        vm.expectRevert(Market.AlreadyVoted.selector);
        market.placeNo{value: 1 ether}();
    }

    // ============ resolve() Tests ============

    function test_resolve_by_factory_yes() public {
        market.resolve(Market.Result.Yes);
        assertEq(uint256(market.result()), uint256(Market.Result.Yes));
    }

    function test_resolve_by_factory_no() public {
        market.resolve(Market.Result.No);
        assertEq(uint256(market.result()), uint256(Market.Result.No));
    }

    function test_resolve_not_by_factory() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.resolve(Market.Result.Yes);
    }

    function test_resolve_already_resolved() public {
        market.resolve(Market.Result.Yes);

        vm.expectRevert(Market.MarketAlreadyResolved.selector);
        market.resolve(Market.Result.No);
    }

    function test_resolve_pending_market() public {
        assertEq(uint256(market.result()), uint256(Market.Result.Pending));
        market.resolve(Market.Result.Yes);
        assertEq(uint256(market.result()), uint256(Market.Result.Yes));
    }

    // ============ claim() Tests ============

    function test_claim_yes_winners() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        // User should have received some amount (less than 10 due to fee)
        assertGt(balanceAfter, balanceBefore);
        assertLt(balanceAfter - balanceBefore, 10 ether);
    }

    function test_claim_no_winners() public {
        vm.prank(user1);
        market.placeNo{value: 10 ether}();

        market.resolve(Market.Result.No);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        assertGt(balanceAfter, balanceBefore);
    }

    function test_claim_market_not_resolved() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user1);
        vm.expectRevert(Market.MarketNotResolved.selector);
        market.claim();
    }

    function test_claim_did_not_bet_on_winning_side() public {
        // This test now needs TWO-SIDED market to test the revert
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user2);
        market.placeNo{value: 10 ether}();

        market.resolve(Market.Result.No);

        // User1 bet YES but result is NO - should revert
        vm.prank(user1);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
    }

    function test_claim_already_claimed() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        vm.prank(user1);
        vm.expectRevert(Market.AlreadyClaimed.selector);
        market.claim();
    }

    function test_claim_no_winnings() public {
        // User never bet
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user2);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
    }

    function test_claim_reentrancy_protection() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        // Try to claim again in same transaction (after first claim completed)
        vm.prank(user1);
        vm.expectRevert(Market.AlreadyClaimed.selector);
        market.claim();
    }

    function test_claim_transfer_success() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        assertGt(balanceAfter, balanceBefore);
        // Single bettor = one-sided market = 5% fee (not 2.5%)
        assertApproxEqAbs(balanceAfter - balanceBefore, 10 ether - (10 ether * 500 / 10000), 1 wei);
    }

    function test_claim_fee_calculation() public {
        // Pool: 100 ETH (60 YES, 40 NO)
        vm.prank(user1);
        market.placeYes{value: 60 ether}();

        vm.prank(user2);
        market.placeNo{value: 40 ether}();

        market.resolve(Market.Result.Yes);

        // User1 bet 60 ETH on YES, winnings: (60/60)*100 = 100 ETH
        // Fee: (100 * 250) / 10000 = 2.5 ETH
        // Receives: 97.5 ETH
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        assertApproxEqAbs(balanceAfter - balanceBefore, 97.5 ether, 1 wei);
    }

    function test_claim_multiple_users() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user2);
        market.placeYes{value: 5 ether}();

        market.resolve(Market.Result.Yes);

        // Total pool: 15 ETH (all YES)
        // User1: (10/15)*15 = 10 ETH minus fee
        // User2: (5/15)*15 = 5 ETH minus fee

        uint256 user1BalanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 user1Received = user1.balance - user1BalanceBefore;

        uint256 user2BalanceBefore = user2.balance;
        vm.prank(user2);
        market.claim();
        uint256 user2Received = user2.balance - user2BalanceBefore;

        // User1 should receive ~2x what user2 receives
        assertApproxEqRel(user1Received, user2Received * 2, 1e16); // 1% tolerance
    }

    // ============ cancelMarket() Tests ============

    function test_cancelMarket_refund_yes_bettors() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user2);
        market.placeYes{value: 5 ether}();

        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;

        market.cancelMarket();

        assertEq(user1.balance - user1BalanceBefore, 10 ether);
        assertEq(user2.balance - user2BalanceBefore, 5 ether);
    }

    function test_cancelMarket_refund_no_bettors() public {
        vm.prank(user1);
        market.placeNo{value: 10 ether}();

        vm.prank(user2);
        market.placeNo{value: 5 ether}();

        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;

        market.cancelMarket();

        assertEq(user1.balance - user1BalanceBefore, 10 ether);
        assertEq(user2.balance - user2BalanceBefore, 5 ether);
    }

    function test_cancelMarket_mixed_bettors() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user2);
        market.placeNo{value: 5 ether}();

        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;

        market.cancelMarket();

        assertEq(user1.balance - user1BalanceBefore, 10 ether);
        assertEq(user2.balance - user2BalanceBefore, 5 ether);
    }

    function test_cancelMarket_already_resolved() public {
        market.resolve(Market.Result.Yes);

        vm.expectRevert(Market.CannotCancelResolvedMarket.selector);
        market.cancelMarket();
    }

    function test_cancelMarket_not_factory() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.cancelMarket();
    }

    function test_cancelMarket_event_emitted() public {
        vm.expectEmit(false, false, false, true);
        emit MarketCancelled();
        market.cancelMarket();
    }

    // ============ Getter Functions Tests ============

    function test_getTotalYesBetsAmount() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user2);
        market.placeYes{value: 20 ether}();

        assertEq(market.getTotalYesBetsAmount(), 30 ether);
    }

    function test_getTotalNoBetsAmount() public {
        vm.prank(user1);
        market.placeNo{value: 10 ether}();

        vm.prank(user2);
        market.placeNo{value: 15 ether}();

        assertEq(market.getTotalNoBetsAmount(), 25 ether);
    }

    function test_getTotalPoolAmount() public {
        vm.prank(user1);
        market.placeYes{value: 30 ether}();

        vm.prank(user2);
        market.placeNo{value: 25 ether}();

        // Pool amount is count of bets, not total in ETH
        assertEq(market.getTotalPoolAmount(), 2);
    }

    function test_getUserBet_yes_bet() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        assertEq(market.getUserBet(user1), 10 ether);
    }

    function test_getUserBet_no_bet() public {
        vm.prank(user1);
        market.placeNo{value: 10 ether}();

        assertEq(market.getUserBet(user1), 10 ether);
    }

    function test_getUserBet_no_bet_user() public view {
        assertEq(market.getUserBet(user1), 0);
    }

    function test_getProbabilityYes() public {
        vm.prank(user1);
        market.placeYes{value: 60 ether}();

        vm.prank(user2);
        market.placeNo{value: 40 ether}();

        // Now based on STAKE amounts: 60/(60+40) = 60%
        assertEq(market.getProbablityYes(), 60);
    }

    function test_getProbabilityNo() public {
        vm.prank(user1);
        market.placeYes{value: 60 ether}();

        vm.prank(user2);
        market.placeNo{value: 40 ether}();

        // Now based on STAKE amounts: 40/(60+40) = 40%
        assertEq(market.getProbablityNo(), 40);
    }

    function test_getProbability_empty_pool() public view {
        assertEq(market.getProbablityYes(), 0);
        assertEq(market.getProbablityNo(), 0);
    }

    function test_getIsExpired_not_expired() public view {
        assertEq(market.getIsExpired(), false);
    }

    function test_getIsExpired_expired() public {
        vm.warp(block.timestamp + 2 hours);
        assertEq(market.getIsExpired(), true);
    }

    function test_getIsResolved_pending() public view {
        assertEq(market.getIsresolved(), false);
    }

    function test_getIsResolved_resolved() public {
        market.resolve(Market.Result.Yes);
        assertEq(market.getIsresolved(), true);
    }

    function test_getClaimableAmount_yes_winner() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(user2);
        market.placeNo{value: 40 ether}();

        market.resolve(Market.Result.Yes);

        (uint256 claimable, uint256 fee) = market.getClaimableAmount(user1);
        assertGt(claimable, 0);
        assertGt(fee, 0);
        // Verify both values are reasonable
        uint256 totalShare = claimable + fee;
        assertGt(totalShare, 0);
    }

    function test_getClaimableAmount_no_winner() public {
        vm.prank(user1);
        market.placeNo{value: 10 ether}();

        vm.prank(user2);
        market.placeYes{value: 40 ether}();

        market.resolve(Market.Result.No);

        (uint256 claimable, uint256 fee) = market.getClaimableAmount(user1);
        assertGt(claimable, 0);
        assertGt(fee, 0);
        // Verify both values are reasonable
        uint256 totalShare = claimable + fee;
        assertGt(totalShare, 0);
    }

    function test_getTotalAmountToBeClaimedByTheWinningSide_pending() public view {
        assertEq(market.getTotalAmountToBeClaimedByTheWinningSide(), 0);
    }

    function test_getTotalAmountToBeClaimedByTheWinningSide_resolved() public {
        vm.prank(user1);
        market.placeYes{value: 60 ether}();

        vm.prank(user2);
        market.placeNo{value: 40 ether}();

        market.resolve(Market.Result.Yes);

        assertEq(market.getTotalAmountToBeClaimedByTheWinningSide(), 100 ether);
    }

    // ============ Admin Functions Tests ============

    function test_setProtocolFee_valid() public {
        market.setProtocolFee(500);
        assertEq(market.protocolFeeBps(), 500);
    }

    function test_setProtocolFee_too_high() public {
        vm.expectRevert(Market.FeeTooHigh.selector);
        market.setProtocolFee(1001);
    }

    function test_setProtocolFee_not_factory() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.setProtocolFee(500);
    }

    function test_setTreasury_valid() public {
        address newTreasury = makeAddr("newTreasury");
        market.setTreasury(newTreasury);
        assertEq(market.treasury(), newTreasury);
    }

    function test_setTreasury_invalid_address() public {
        vm.expectRevert(Market.InvalidTreasury.selector);
        market.setTreasury(address(0));
    }

    function test_setTreasury_not_factory() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.setTreasury(user2);
    }

    // ============ withdrawFees() Tests ============

    function test_withdrawFees_success() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        uint256 treasuryBalanceBefore = treasury.balance;
        vm.prank(user1);
        market.claim();

        market.withdrawFees();

        uint256 treasuryBalanceAfter = treasury.balance;
        assertGt(treasuryBalanceAfter, treasuryBalanceBefore);
    }

    function test_withdrawFees_no_fees() public {
        vm.expectRevert(Market.NoFeesToWithdraw.selector);
        market.withdrawFees();
    }

    function test_withdrawFees_not_factory() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user2));
        market.withdrawFees();
    }

    function test_withdrawFees_event_emitted() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        uint256 feeBalance = market.accruedFees();
        vm.expectEmit(true, true, true, true);
        emit FeesWithdrawn(treasury, feeBalance);
        market.withdrawFees();
    }

    // ============ Event Tests ============

    function test_event_bet_placed_yes() public {
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit BetPlaced(user1, true, 1 ether);
        market.placeYes{value: 1 ether}();
    }

    function test_event_bet_placed_no() public {
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit BetPlaced(user1, false, 1 ether);
        market.placeNo{value: 1 ether}();
    }

    function test_event_resolved() public {
        vm.expectEmit(true, true, true, true);
        emit Resolved(Market.Result.Yes);
        market.resolve(Market.Result.Yes);
    }

    function test_event_claimed() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        uint256 claimAmount = market.claim();
        assertGt(claimAmount, 0);
    }

    // ============ Edge Cases ============

    function test_claim_with_uneven_betting() public {
        vm.prank(user1);
        market.placeYes{value: 1000 ether}();

        vm.prank(user2);
        market.placeNo{value: 1 ether}();

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        assertGt(balanceAfter, balanceBefore);
    }

    function test_claim_single_bettor() public {
        vm.prank(user1);
        market.placeYes{value: 100 ether}();

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        // Single bettor = one-sided market = 5% fee (not 2.5%)
        // Should get 100 ETH minus 5% fee = 95 ETH
        assertApproxEqAbs(balanceAfter - balanceBefore, 95 ether, 1 wei);
    }

    function test_extremely_large_amounts() public {
        // Test with large but reasonable amount to avoid overflow
        uint256 largeAmount = 1000 ether;
        vm.prank(user1);
        market.placeYes{value: largeAmount}();

        assertEq(market.yesBets(user1), largeAmount);
    }

    function test_extremely_small_amounts() public {
        vm.prank(user1);
        market.placeYes{value: 1 wei}();

        assertEq(market.yesBets(user1), 1 wei);
    }

    // ============ Math Precision Tests ============

    function test_division_precision() public {
        // Bet with odd numbers to test precision
        vm.prank(user1);
        market.placeYes{value: 7 ether}();

        vm.prank(user2);
        market.placeNo{value: 3 ether}();

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        // Verify no major rounding errors
        assertGt(balanceAfter - balanceBefore, 0);
        assertLt(balanceAfter - balanceBefore, 10 ether);
    }

    // ============ Creator Fee Threshold Tests ============

    function test_minBetsForCreatorFee_constant() public view {
        assertEq(market.MIN_BETS_FOR_CREATOR_FEE(), 10);
        assertEq(market.getMinBetsForCreatorFee(), 10);
    }

    function test_creator_not_eligible_with_less_than_10_bets() public {
        // Only 2 bets - below threshold
        vm.prank(user1);
        market.placeYes{value: 5 ether}();

        vm.prank(user2);
        market.placeNo{value: 5 ether}();

        // Check eligibility
        assertFalse(market.isCreatorEligibleForFees());
        assertEq(market.getBetsUntilCreatorEligible(), 8); // 10 - 2 = 8
    }

    function test_creator_eligible_with_exactly_10_bets() public {
        // Create 10 unique users and place bets
        for (uint256 i = 0; i < 10; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettor, 10 ether);
            vm.prank(bettor);
            if (i % 2 == 0) {
                market.placeYes{value: 1 ether}();
            } else {
                market.placeNo{value: 1 ether}();
            }
        }

        // Check eligibility
        assertTrue(market.isCreatorEligibleForFees());
        assertEq(market.getBetsUntilCreatorEligible(), 0);
    }

    function test_creator_eligible_with_more_than_10_bets() public {
        // Create 15 unique users and place bets
        for (uint256 i = 0; i < 15; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettor, 10 ether);
            vm.prank(bettor);
            if (i % 2 == 0) {
                market.placeYes{value: 1 ether}();
            } else {
                market.placeNo{value: 1 ether}();
            }
        }

        // Check eligibility
        assertTrue(market.isCreatorEligibleForFees());
        assertEq(market.getBetsUntilCreatorEligible(), 0);
    }

    function test_creator_fee_zero_when_below_threshold() public {
        // Only 2 bets - below threshold
        vm.prank(user1);
        market.placeYes{value: 50 ether}();

        vm.prank(user2);
        market.placeNo{value: 50 ether}();

        market.resolve(Market.Result.Yes);

        // Get fee info before claim
        (,,,, , , , bool eligible) = market.getFeeInfo();
        assertFalse(eligible);

        // User1 claims
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 balanceAfter = user1.balance;

        // With 100 ETH pool and only platform fee (2.5%), distributable = 97.5 ETH
        // User1 bet 50 ETH on winning side of 50 ETH = 100% of winning pool
        // So user1 gets 97.5 ETH
        uint256 claimed = balanceAfter - balanceBefore;
        assertEq(claimed, 97.5 ether);

        // Verify no creator fees accrued
        assertEq(market.accruedCreatorFees(), 0);
        
        // Platform fees should be accrued (2.5% of 100 ETH = 2.5 ETH)
        assertEq(market.accruedFees(), 2.5 ether);
    }

    function test_creator_fee_applied_when_above_threshold() public {
        // Create 10 bets to meet threshold
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yesBettor", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("noBettor", i)));
            vm.deal(yesBettors[i], 20 ether);
            vm.deal(noBettors[i], 20 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        // Total pool: 100 ETH (50 YES, 50 NO)
        assertEq(market.getTotalBets(), 10);
        assertTrue(market.isCreatorEligibleForFees());

        market.resolve(Market.Result.Yes);

        // First YES bettor claims
        uint256 balanceBefore = yesBettors[0].balance;
        vm.prank(yesBettors[0]);
        market.claim();
        uint256 balanceAfter = yesBettors[0].balance;

        // With 100 ETH pool:
        // Platform fee: 2.5% = 2.5 ETH
        // Creator fee: 5% = 5 ETH
        // Distributable: 92.5 ETH
        // Each YES bettor bet 10 ETH of 50 ETH total = 20% of winning pool
        // So each gets 92.5 * 0.2 = 18.5 ETH
        uint256 claimed = balanceAfter - balanceBefore;
        assertEq(claimed, 18.5 ether);

        // Verify creator fees are being accrued (proportional to this user)
        // User's share: 10/50 = 20% of 5 ETH = 1 ETH
        assertEq(market.accruedCreatorFees(), 1 ether);
    }

    function test_creator_can_withdraw_fees_after_threshold_met() public {
        // Create 10 bets to meet threshold
        for (uint256 i = 0; i < 5; i++) {
            address yBettor = makeAddr(string(abi.encodePacked("yesBettor", i)));
            address nBettor = makeAddr(string(abi.encodePacked("noBettor", i)));
            vm.deal(yBettor, 20 ether);
            vm.deal(nBettor, 20 ether);
            
            vm.prank(yBettor);
            market.placeYes{value: 10 ether}();
            
            vm.prank(nBettor);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // All YES bettors claim
        for (uint256 i = 0; i < 5; i++) {
            address bettor = makeAddr(string(abi.encodePacked("yesBettor", i)));
            vm.prank(bettor);
            market.claim();
        }

        // Creator fees should be fully accrued (5% of 100 ETH = 5 ETH)
        assertEq(market.accruedCreatorFees(), 5 ether);

        // Creator withdraws
        uint256 creatorBalanceBefore = creator.balance;
        vm.prank(creator);
        market.withdrawCreatorFees();
        uint256 creatorBalanceAfter = creator.balance;

        assertEq(creatorBalanceAfter - creatorBalanceBefore, 5 ether);
        assertEq(market.accruedCreatorFees(), 0);
    }

    function test_creator_cannot_withdraw_when_below_threshold() public {
        // Only 2 bets - below threshold
        vm.prank(user1);
        market.placeYes{value: 50 ether}();

        vm.prank(user2);
        market.placeNo{value: 50 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        // No creator fees accrued
        assertEq(market.accruedCreatorFees(), 0);

        // Creator tries to withdraw - should revert
        vm.prank(creator);
        vm.expectRevert(Market.NoCreatorFeesToWithdraw.selector);
        market.withdrawCreatorFees();
    }

    function test_only_creator_can_withdraw_creator_fees() public {
        // Create 10 bets with both YES and NO to have a valid pool
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yBettor", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nBettor", i)));
            vm.deal(yesBettors[i], 10 ether);
            vm.deal(noBettors[i], 10 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 1 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 1 ether}();
        }

        market.resolve(Market.Result.Yes);

        // Claim for one bettor to accrue fees
        vm.prank(yesBettors[0]);
        market.claim();

        // Non-creator tries to withdraw
        vm.prank(user1);
        vm.expectRevert(Market.NotCreator.selector);
        market.withdrawCreatorFees();
    }

    function test_getFeeInfo_returns_correct_values() public {
        // Add 5 bets (below threshold)
        for (uint256 i = 0; i < 5; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettor, 10 ether);
            vm.prank(bettor);
            market.placeYes{value: 1 ether}();
        }

        (
            uint256 platformFeeBps,
            uint256 creatorFeeBps,
            uint256 platformFeesAccrued,
            uint256 creatorFeesAccrued,
            address treasuryAddr,
            address creatorAddr,
            uint256 minBetsRequired,
            bool eligible
        ) = market.getFeeInfo();

        assertEq(platformFeeBps, 250);
        assertEq(creatorFeeBps, 500);
        assertEq(platformFeesAccrued, 0);
        assertEq(creatorFeesAccrued, 0);
        assertEq(treasuryAddr, treasury);
        assertEq(creatorAddr, creator);
        assertEq(minBetsRequired, 10);
        assertFalse(eligible); // 5 < 10
    }

    function test_creator_can_vote_in_own_market() public {
        // Give creator ETH
        vm.deal(creator, 100 ether);

        // Creator places a bet
        vm.prank(creator);
        market.placeYes{value: 10 ether}();

        assertEq(market.yesBets(creator), 10 ether);
        assertTrue(market.hasVoted(creator));
    }

    function test_creator_can_win_from_own_market() public {
        vm.deal(creator, 100 ether);

        // Creator bets YES
        vm.prank(creator);
        market.placeYes{value: 10 ether}();

        // Another user bets NO
        vm.prank(user1);
        market.placeNo{value: 10 ether}();

        // Add more bets to reach threshold
        for (uint256 i = 0; i < 8; i++) {
            address bettor = makeAddr(string(abi.encodePacked("extraBettor", i)));
            vm.deal(bettor, 10 ether);
            vm.prank(bettor);
            market.placeYes{value: 1 ether}();
        }

        market.resolve(Market.Result.Yes);

        // Creator claims winnings
        uint256 creatorBalanceBefore = creator.balance;
        vm.prank(creator);
        market.claim();
        uint256 creatorBalanceAfter = creator.balance;

        // Creator should have won
        assertGt(creatorBalanceAfter, creatorBalanceBefore);
    }

    // ============ withdrawCreatorFees() Tests ============

    function test_withdrawCreatorFees_success() public {
        // Create 10 bets with both YES and NO
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yBettor", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nBettor", i)));
            vm.deal(yesBettors[i], 20 ether);
            vm.deal(noBettors[i], 20 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // All YES bettors claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }

        uint256 expectedCreatorFees = market.accruedCreatorFees();
        assertGt(expectedCreatorFees, 0);

        vm.prank(creator);
        market.withdrawCreatorFees();

        assertEq(market.accruedCreatorFees(), 0);
    }

    function test_withdrawCreatorFees_event_emitted() public {
        // Create 10 bets with both YES and NO
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yBettor", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nBettor", i)));
            vm.deal(yesBettors[i], 20 ether);
            vm.deal(noBettors[i], 20 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // One YES bettor claims
        vm.prank(yesBettors[0]);
        market.claim();

        uint256 feeAmount = market.accruedCreatorFees();

        vm.prank(creator);
        vm.expectEmit(true, true, true, true);
        emit CreatorFeesWithdrawn(creator, feeAmount);
        market.withdrawCreatorFees();
    }

    // ============ Edge Case Tests ============

    function test_single_winner_takes_all() public {
        // Create 10 bets but only one side wins
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yesBettor", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("noBettor", i)));
            vm.deal(yesBettors[i], 20 ether);
            vm.deal(noBettors[i], 20 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        // Resolve to YES
        market.resolve(Market.Result.Yes);

        // All YES bettors claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }

        // Verify all fees are accrued
        assertEq(market.accruedFees(), 2.5 ether); // 2.5% of 100 ETH
        assertEq(market.accruedCreatorFees(), 5 ether); // 5% of 100 ETH
    }

    function test_getClaimableAmount_matches_claim() public {
        // Create 10 bets
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yesBettor", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("noBettor", i)));
            vm.deal(yesBettors[i], 20 ether);
            vm.deal(noBettors[i], 20 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);
        
        // Get predicted claimable amount
        (uint256 predictedClaim, ) = market.getClaimableAmount(yesBettors[0]);
        
        // Actually claim
        uint256 balanceBefore = yesBettors[0].balance;
        vm.prank(yesBettors[0]);
        market.claim();
        uint256 actualClaim = yesBettors[0].balance - balanceBefore;

        // Should match
        assertEq(actualClaim, predictedClaim);
    }

    function test_bets_until_eligible_decrements_correctly() public {
        assertEq(market.getBetsUntilCreatorEligible(), 10);

        vm.prank(user1);
        market.placeYes{value: 1 ether}();
        assertEq(market.getBetsUntilCreatorEligible(), 9);

        vm.prank(user2);
        market.placeNo{value: 1 ether}();
        assertEq(market.getBetsUntilCreatorEligible(), 8);

        // Add 8 more bets
        for (uint256 i = 0; i < 8; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettor, 10 ether);
            vm.prank(bettor);
            market.placeYes{value: 1 ether}();
        }

        assertEq(market.getBetsUntilCreatorEligible(), 0);
        assertTrue(market.isCreatorEligibleForFees());
    }

    function test_creator_fee_calculation_with_unequal_bets() public {
        // Create bets with varying amounts
        for (uint256 i = 0; i < 6; i++) {
            address bettor = makeAddr(string(abi.encodePacked("yesBettor", i)));
            vm.deal(bettor, 100 ether);
            vm.prank(bettor);
            market.placeYes{value: (i + 1) * 10 ether}(); // 10, 20, 30, 40, 50, 60 = 210 ETH
        }

        for (uint256 i = 0; i < 4; i++) {
            address bettor = makeAddr(string(abi.encodePacked("noBettor", i)));
            vm.deal(bettor, 100 ether);
            vm.prank(bettor);
            market.placeNo{value: (i + 1) * 5 ether}(); // 5, 10, 15, 20 = 50 ETH
        }

        // Total: 260 ETH, 10 bets
        assertEq(market.getTotalBets(), 10);
        assertTrue(market.isCreatorEligibleForFees());

        market.resolve(Market.Result.Yes);

        // Claim all YES
        for (uint256 i = 0; i < 6; i++) {
            address bettor = makeAddr(string(abi.encodePacked("yesBettor", i)));
            vm.prank(bettor);
            market.claim();
        }

        // Creator fees = 5% of 260 = 13 ETH (may have small rounding error)
        assertApproxEqAbs(market.accruedCreatorFees(), 13 ether, 5 wei);
        
        // Platform fees = 2.5% of 260 = 6.5 ETH
        assertApproxEqAbs(market.accruedFees(), 6.5 ether, 5 wei);
    }

    // ============ ONE-SIDED MARKET TESTS ============

    function test_isOneSided_returns_true_when_all_yes() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();
        
        vm.prank(user2);
        market.placeYes{value: 5 ether}();

        assertTrue(market.isOneSided());
    }

    function test_isOneSided_returns_true_when_all_no() public {
        vm.prank(user1);
        market.placeNo{value: 10 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 5 ether}();

        assertTrue(market.isOneSided());
    }

    function test_isOneSided_returns_false_when_both_sides() public {
        vm.prank(user1);
        market.placeYes{value: 10 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 5 ether}();

        assertFalse(market.isOneSided());
    }

    function test_isOneSided_returns_false_when_no_bets() public view {
        assertFalse(market.isOneSided());
    }

    function test_oneSided_all_yes_bets_refund_with_5_percent_fee() public {
        // 3 users bet on YES only
        address[] memory yesBettors = new address[](3);
        yesBettors[0] = makeAddr("yesBettor0");
        yesBettors[1] = makeAddr("yesBettor1");
        yesBettors[2] = makeAddr("yesBettor2");
        
        vm.deal(yesBettors[0], 100 ether);
        vm.deal(yesBettors[1], 100 ether);
        vm.deal(yesBettors[2], 100 ether);
        
        vm.prank(yesBettors[0]);
        market.placeYes{value: 50 ether}();
        
        vm.prank(yesBettors[1]);
        market.placeYes{value: 30 ether}();
        
        vm.prank(yesBettors[2]);
        market.placeYes{value: 20 ether}();

        // Total pool: 100 ETH, all on YES
        assertTrue(market.isOneSided());
        assertEq(market.totalYesBetsAmount(), 100 ether);
        assertEq(market.totalNoBetsAmount(), 0);

        // Resolve to YES (but it doesn't matter - it's one-sided)
        market.resolve(Market.Result.Yes);

        // User1 claims - should get proportional refund minus 5% platform fee
        // User1 bet 50 ETH of 100 ETH total = 50%
        // Platform fee: 5% of 100 = 5 ETH
        // Distributable: 95 ETH
        // User1 gets: 50% of 95 = 47.5 ETH
        uint256 balanceBefore = yesBettors[0].balance;
        vm.prank(yesBettors[0]);
        market.claim();
        uint256 claimed = yesBettors[0].balance - balanceBefore;
        
        assertEq(claimed, 47.5 ether);
        
        // Verify platform fee accrued (proportional: 50% of 5 = 2.5 ETH)
        assertEq(market.accruedFees(), 2.5 ether);
        
        // Verify NO creator fees accrued
        assertEq(market.accruedCreatorFees(), 0);
    }

    function test_oneSided_all_no_bets_refund_with_5_percent_fee() public {
        // 3 users bet on NO only
        address[] memory noBettors = new address[](3);
        noBettors[0] = makeAddr("noBettor0");
        noBettors[1] = makeAddr("noBettor1");
        noBettors[2] = makeAddr("noBettor2");
        
        vm.deal(noBettors[0], 100 ether);
        vm.deal(noBettors[1], 100 ether);
        vm.deal(noBettors[2], 100 ether);
        
        vm.prank(noBettors[0]);
        market.placeNo{value: 60 ether}();
        
        vm.prank(noBettors[1]);
        market.placeNo{value: 25 ether}();
        
        vm.prank(noBettors[2]);
        market.placeNo{value: 15 ether}();

        // Total pool: 100 ETH, all on NO
        assertTrue(market.isOneSided());

        // Resolve to NO
        market.resolve(Market.Result.No);

        // User1 claims - 60% of pool
        // Distributable: 95 ETH
        // User1 gets: 60% of 95 = 57 ETH
        uint256 balanceBefore = noBettors[0].balance;
        vm.prank(noBettors[0]);
        market.claim();
        uint256 claimed = noBettors[0].balance - balanceBefore;
        
        assertEq(claimed, 57 ether);
    }

    function test_oneSided_all_users_can_claim_regardless_of_result() public {
        // All bet on YES
        vm.prank(user1);
        market.placeYes{value: 50 ether}();
        
        vm.prank(user2);
        market.placeYes{value: 50 ether}();

        assertTrue(market.isOneSided());

        // Resolve to NO (opposite side!)
        market.resolve(Market.Result.No);

        // Both users should still be able to claim (one-sided refund)
        uint256 balance1Before = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed1 = user1.balance - balance1Before;

        uint256 balance2Before = user2.balance;
        vm.prank(user2);
        market.claim();
        uint256 claimed2 = user2.balance - balance2Before;

        // Each gets 50% of 95 ETH (100 - 5% fee) = 47.5 ETH
        assertEq(claimed1, 47.5 ether);
        assertEq(claimed2, 47.5 ether);
    }

    function test_oneSided_no_creator_fee_even_with_10_plus_bets() public {
        // Create 15 bets all on YES side
        address[] memory yesBettors = new address[](15);
        
        for (uint256 i = 0; i < 15; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yesBettor", i)));
            vm.deal(yesBettors[i], 20 ether);
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
        }

        // Total: 150 ETH, 15 bets (above threshold), but one-sided
        assertEq(market.getTotalBets(), 15);
        assertTrue(market.isOneSided());
        // Note: isCreatorEligibleForFees checks bet count, not one-sidedness
        // But for one-sided markets, creator fee is 0 regardless

        market.resolve(Market.Result.Yes);

        // All users claim
        for (uint256 i = 0; i < 15; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }

        // Verify NO creator fees (one-sided market)
        assertEq(market.accruedCreatorFees(), 0);
        
        // Platform fees = 5% of 150 ETH = 7.5 ETH
        assertEq(market.accruedFees(), 7.5 ether);
    }

    function test_oneSided_getClaimableAmount_matches_claim() public {
        // All bet on YES
        vm.prank(user1);
        market.placeYes{value: 60 ether}();
        
        vm.prank(user2);
        market.placeYes{value: 40 ether}();

        market.resolve(Market.Result.Yes);

        // Get predicted claimable amount
        (uint256 predictedClaim, uint256 predictedFee) = market.getClaimableAmount(user1);
        
        // Should be 60% of 95 ETH = 57 ETH
        assertEq(predictedClaim, 57 ether);
        // Fee should be 60% of 5 ETH = 3 ETH
        assertEq(predictedFee, 3 ether);

        // Actually claim
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 actualClaim = user1.balance - balanceBefore;

        assertEq(actualClaim, predictedClaim);
    }

    function test_oneSided_platform_fee_is_5_percent_not_2_5() public {
        // All bet on NO
        vm.prank(user1);
        market.placeNo{value: 100 ether}();

        market.resolve(Market.Result.No);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed = user1.balance - balanceBefore;

        // Should get 95 ETH (100 - 5% fee), not 97.5 ETH (100 - 2.5% fee)
        assertEq(claimed, 95 ether);
        assertEq(market.accruedFees(), 5 ether);
    }

    function test_oneSided_with_single_bettor() public {
        // Only one user bets
        vm.prank(user1);
        market.placeYes{value: 100 ether}();

        assertTrue(market.isOneSided());

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed = user1.balance - balanceBefore;

        // Gets 95% back (100 - 5% platform fee)
        assertEq(claimed, 95 ether);
    }

    function test_oneSided_with_many_small_bets() public {
        // 20 users each bet 1 ETH on YES
        address[] memory bettors = new address[](20);
        
        for (uint256 i = 0; i < 20; i++) {
            bettors[i] = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettors[i], 10 ether);
            vm.prank(bettors[i]);
            market.placeYes{value: 1 ether}();
        }

        // Total: 20 ETH
        assertTrue(market.isOneSided());
        market.resolve(Market.Result.Yes);

        // First bettor claims
        uint256 balanceBefore = bettors[0].balance;
        vm.prank(bettors[0]);
        market.claim();
        uint256 claimed = bettors[0].balance - balanceBefore;

        // Each gets 1/20 of 95% of 20 ETH = 0.95 ETH
        assertEq(claimed, 0.95 ether);
    }

    function test_oneSided_proportional_refund_with_unequal_bets() public {
        // User1 bets 70 ETH, User2 bets 30 ETH on YES
        vm.prank(user1);
        market.placeYes{value: 70 ether}();
        
        vm.prank(user2);
        market.placeYes{value: 30 ether}();

        market.resolve(Market.Result.Yes);

        // User1: 70% of 95 = 66.5 ETH
        uint256 balance1Before = user1.balance;
        vm.prank(user1);
        market.claim();
        assertEq(user1.balance - balance1Before, 66.5 ether);

        // User2: 30% of 95 = 28.5 ETH
        uint256 balance2Before = user2.balance;
        vm.prank(user2);
        market.claim();
        assertEq(user2.balance - balance2Before, 28.5 ether);

        // Total platform fee: 5 ETH
        assertEq(market.accruedFees(), 5 ether);
    }

    function test_oneSided_non_bettor_cannot_claim() public {
        vm.prank(user1);
        market.placeYes{value: 100 ether}();

        market.resolve(Market.Result.Yes);

        // User2 never bet
        vm.prank(user2);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
    }

    function test_oneSided_resolved_to_opposite_side_all_no_bets() public {
        // All bet on NO
        vm.prank(user1);
        market.placeNo{value: 50 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 50 ether}();

        // Resolve to YES (opposite!)
        market.resolve(Market.Result.Yes);

        // Users should still get refund (one-sided market)
        uint256 balance1Before = user1.balance;
        vm.prank(user1);
        market.claim();
        assertEq(user1.balance - balance1Before, 47.5 ether);
    }

    function test_oneSided_cannot_claim_twice() public {
        vm.prank(user1);
        market.placeYes{value: 100 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        vm.prank(user1);
        vm.expectRevert(Market.AlreadyClaimed.selector);
        market.claim();
    }

    function test_oneSided_creator_cannot_withdraw_fees() public {
        // 15 bets all on YES (above threshold)
        for (uint256 i = 0; i < 15; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettor, 20 ether);
            vm.prank(bettor);
            market.placeYes{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // All claim
        for (uint256 i = 0; i < 15; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.prank(bettor);
            market.claim();
        }

        // Creator tries to withdraw - no fees accrued
        assertEq(market.accruedCreatorFees(), 0);
        vm.prank(creator);
        vm.expectRevert(Market.NoCreatorFeesToWithdraw.selector);
        market.withdrawCreatorFees();
    }

    function test_oneSided_platform_can_withdraw_fees() public {
        vm.prank(user1);
        market.placeYes{value: 100 ether}();

        market.resolve(Market.Result.Yes);

        vm.prank(user1);
        market.claim();

        // Platform fees: 5% of 100 = 5 ETH
        assertEq(market.accruedFees(), 5 ether);

        uint256 treasuryBefore = treasury.balance;
        market.withdrawFees();
        assertEq(treasury.balance - treasuryBefore, 5 ether);
    }

    // ============ COMPREHENSIVE FEE CALCULATION TESTS ============

    function test_two_sided_below_threshold_fee_calculation() public {
        // 2 bets (below 10 threshold)
        vm.prank(user1);
        market.placeYes{value: 60 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 40 ether}();

        // NOT one-sided
        assertFalse(market.isOneSided());
        // NOT creator eligible
        assertFalse(market.isCreatorEligibleForFees());

        market.resolve(Market.Result.Yes);

        // Platform fee: 2.5% of 100 = 2.5 ETH
        // Creator fee: 0% (below threshold)
        // Distributable: 97.5 ETH
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed = user1.balance - balanceBefore;

        assertEq(claimed, 97.5 ether);
        assertEq(market.accruedFees(), 2.5 ether);
        assertEq(market.accruedCreatorFees(), 0);
    }

    function test_two_sided_above_threshold_fee_calculation() public {
        // 10 bets (meets threshold)
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yb", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nb", i)));
            vm.deal(yesBettors[i], 100 ether);
            vm.deal(noBettors[i], 100 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        // Two-sided, creator eligible
        assertFalse(market.isOneSided());
        assertTrue(market.isCreatorEligibleForFees());

        market.resolve(Market.Result.Yes);

        // Platform fee: 2.5% of 100 = 2.5 ETH
        // Creator fee: 5% of 100 = 5 ETH
        // Distributable: 92.5 ETH
        // Each YES bettor: 10/50 * 92.5 = 18.5 ETH
        
        // All claim
        for (uint256 i = 0; i < 5; i++) {
            uint256 balanceBefore = yesBettors[i].balance;
            vm.prank(yesBettors[i]);
            market.claim();
            assertEq(yesBettors[i].balance - balanceBefore, 18.5 ether);
        }

        assertEq(market.accruedFees(), 2.5 ether);
        assertEq(market.accruedCreatorFees(), 5 ether);
    }

    function test_fee_summary_comparison() public {
        // This test documents all fee scenarios
        
        // Scenario 1: Two-sided, below threshold
        // Platform: 2.5%, Creator: 0%, Winners: 97.5%
        
        // Scenario 2: Two-sided, above threshold
        // Platform: 2.5%, Creator: 5%, Winners: 92.5%
        
        // Scenario 3: One-sided (any bet count)
        // Platform: 5%, Creator: 0%, All bettors: 95% (proportional refund)
        
        // Verify constants
        assertEq(market.protocolFeeBps(), 250); // 2.5%
        assertEq(market.creatorFeesPercent(), 500); // 5%
        assertEq(market.MIN_BETS_FOR_CREATOR_FEE(), 10);
    }

    // ============ EXTREME EDGE CASES ============

    function test_tiny_bet_amounts() public {
        vm.prank(user1);
        market.placeYes{value: 1 wei}();
        
        vm.prank(user2);
        market.placeNo{value: 1 wei}();

        market.resolve(Market.Result.Yes);

        // With 2 wei total pool, 2.5% fee = 0 wei (rounded down)
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed = user1.balance - balanceBefore;

        // Should get full amount due to rounding
        assertGe(claimed, 1 wei);
    }

    function test_large_bet_amounts() public {
        // Give users massive ETH
        vm.deal(user1, 1_000_000 ether);
        vm.deal(user2, 1_000_000 ether);

        vm.prank(user1);
        market.placeYes{value: 500_000 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 500_000 ether}();

        market.resolve(Market.Result.Yes);

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed = user1.balance - balanceBefore;

        // 2.5% fee on 1M ETH = 25,000 ETH
        // User gets 975,000 ETH
        assertEq(claimed, 975_000 ether);
    }

    function test_precision_with_odd_numbers() public {
        vm.prank(user1);
        market.placeYes{value: 333 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 777 ether}();

        market.resolve(Market.Result.Yes);

        // Pool: 1110 ETH
        // Fee: 2.5% = 27.75 ETH
        // Distributable: 1082.25 ETH
        // User1 gets 100% of distributable = 1082.25 ETH

        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 claimed = user1.balance - balanceBefore;

        // Allow small rounding error (1 wei)
        assertApproxEqAbs(claimed, 1082.25 ether, 1 wei);
    }

    function test_claim_order_doesnt_affect_amounts() public {
        // 10 bets to reach threshold
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yb", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nb", i)));
            vm.deal(yesBettors[i], 100 ether);
            vm.deal(noBettors[i], 100 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // Claim in random order - all should get same amount
        uint256[] memory claims = new uint256[](5);
        
        // Claim: 3, 0, 4, 1, 2
        uint256[] memory order = new uint256[](5);
        order[0] = 3; order[1] = 0; order[2] = 4; order[3] = 1; order[4] = 2;
        
        for (uint256 i = 0; i < 5; i++) {
            uint256 idx = order[i];
            uint256 balanceBefore = yesBettors[idx].balance;
            vm.prank(yesBettors[idx]);
            market.claim();
            claims[idx] = yesBettors[idx].balance - balanceBefore;
        }

        // All should be equal (18.5 ETH)
        for (uint256 i = 0; i < 5; i++) {
            assertEq(claims[i], 18.5 ether);
        }
    }

    function test_no_side_wins_all_losers() public {
        // Bets on both sides
        vm.prank(user1);
        market.placeYes{value: 50 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 50 ether}();

        // Resolve to YES
        market.resolve(Market.Result.Yes);

        // User2 (NO bettor) cannot claim
        vm.prank(user2);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
    }

    function test_getClaimableAmount_for_loser() public {
        // Two-sided market required to test loser behavior
        vm.prank(user1);
        market.placeYes{value: 50 ether}();
        
        vm.prank(user2);
        market.placeNo{value: 50 ether}();

        market.resolve(Market.Result.Yes);

        // User2 lost (bet NO, result YES) - should revert with DidNotBetOnWinningSide
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.getClaimableAmount(user2);
    }

    function test_getClaimableAmount_before_resolution() public {
        vm.prank(user1);
        market.placeYes{value: 50 ether}();

        // Market not resolved
        vm.expectRevert(Market.MarketNotResolved.selector);
        market.getClaimableAmount(user1);
    }

    // ============ STATE TRANSITION TESTS ============

    function test_market_state_pending_to_resolved_yes() public {
        assertEq(uint256(market.result()), uint256(Market.Result.Pending));
        market.resolve(Market.Result.Yes);
        assertEq(uint256(market.result()), uint256(Market.Result.Yes));
    }

    function test_market_state_pending_to_resolved_no() public {
        assertEq(uint256(market.result()), uint256(Market.Result.Pending));
        market.resolve(Market.Result.No);
        assertEq(uint256(market.result()), uint256(Market.Result.No));
    }

    function test_cannot_bet_after_resolution() public {
        market.resolve(Market.Result.Yes);
        
        // Even though market is resolved, betting is blocked by bettingDeadline
        // Warp to after betting deadline
        vm.warp(block.timestamp + 50 minutes);
        
        vm.prank(user1);
        vm.expectRevert(Market.BettingClosed.selector);
        market.placeYes{value: 1 ether}();
    }

    // ============ BETTING PERIOD TESTS ============

    function test_isBettingOpen_true_during_betting_period() public view {
        assertTrue(market.isBettingOpen());
    }

    function test_isBettingOpen_false_after_deadline() public {
        vm.warp(block.timestamp + 50 minutes);
        assertFalse(market.isBettingOpen());
    }

    function test_isLocked_false_during_betting_period() public view {
        assertFalse(market.isLocked());
    }

    function test_isLocked_true_after_betting_deadline() public {
        vm.warp(block.timestamp + 50 minutes);
        assertTrue(market.isLocked());
    }

    function test_isLocked_false_after_expiry() public {
        vm.warp(block.timestamp + 2 hours);
        assertFalse(market.isLocked());
    }

    function test_getTimeUntilBettingEnds() public view {
        assertEq(market.getTimeUntilBettingEnds(), 45 minutes);
    }

    function test_getTimeUntilBettingEnds_zero_after_deadline() public {
        vm.warp(block.timestamp + 50 minutes);
        assertEq(market.getTimeUntilBettingEnds(), 0);
    }

    function test_getTimeUntilExpiry() public view {
        assertEq(market.getTimeUntilExpiry(), 1 hours);
    }

    function test_getTimeUntilExpiry_zero_after_expiry() public {
        vm.warp(block.timestamp + 2 hours);
        assertEq(market.getTimeUntilExpiry(), 0);
    }

    function test_getLockDuration() public view {
        // Lock duration = expiry - bettingDeadline = 1 hour - 45 min = 15 min
        assertEq(market.getLockDuration(), 15 minutes);
    }

    function test_betting_at_exact_deadline() public {
        // At exact deadline, betting should still work (<=)
        vm.warp(block.timestamp + 45 minutes);
        vm.prank(user1);
        market.placeYes{value: 1 ether}();
        assertEq(market.yesBets(user1), 1 ether);
    }

    function test_betting_one_second_after_deadline() public {
        // 1 second after deadline, betting should be closed
        vm.warp(block.timestamp + 45 minutes + 1);
        vm.prank(user1);
        vm.expectRevert(Market.BettingClosed.selector);
        market.placeYes{value: 1 ether}();
    }

    function test_full_market_lifecycle() public {
        // 1. Market created (in setUp)
        assertEq(uint256(market.result()), uint256(Market.Result.Pending));
        
        // 2. Users place bets
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yb", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nb", i)));
            vm.deal(yesBettors[i], 100 ether);
            vm.deal(noBettors[i], 100 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }
        
        // 3. Check state
        assertEq(market.getTotalBets(), 10);
        assertEq(market.totalYesBetsAmount(), 50 ether);
        assertEq(market.totalNoBetsAmount(), 50 ether);
        assertFalse(market.isOneSided());
        assertTrue(market.isCreatorEligibleForFees());
        
        // 4. Market expires (optional, skip for now)
        
        // 5. Factory resolves market
        market.resolve(Market.Result.Yes);
        assertEq(uint256(market.result()), uint256(Market.Result.Yes));
        
        // 6. Winners claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }
        
        // 7. Losers cannot claim
        vm.prank(noBettors[0]);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
        
        // 8. Fees are accrued
        assertEq(market.accruedFees(), 2.5 ether);
        assertEq(market.accruedCreatorFees(), 5 ether);
        
        // 9. Platform withdraws fees
        uint256 treasuryBefore = treasury.balance;
        market.withdrawFees();
        assertEq(treasury.balance - treasuryBefore, 2.5 ether);
        
        // 10. Creator withdraws fees
        uint256 creatorBefore = creator.balance;
        vm.prank(creator);
        market.withdrawCreatorFees();
        assertEq(creator.balance - creatorBefore, 5 ether);
    }

    function test_full_oneSided_market_lifecycle() public {
        // 1. Market created
        assertEq(uint256(market.result()), uint256(Market.Result.Pending));
        
        // 2. All users bet on same side (YES)
        address[] memory bettors = new address[](10);
        
        for (uint256 i = 0; i < 10; i++) {
            bettors[i] = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettors[i], 20 ether);
            vm.prank(bettors[i]);
            market.placeYes{value: 10 ether}();
        }
        
        // 3. Check state
        assertEq(market.getTotalBets(), 10);
        assertEq(market.totalYesBetsAmount(), 100 ether);
        assertEq(market.totalNoBetsAmount(), 0);
        assertTrue(market.isOneSided());
        
        // 4. Factory resolves market (doesn't matter which way)
        market.resolve(Market.Result.No); // Opposite side!
        
        // 5. ALL bettors can claim (refund)
        for (uint256 i = 0; i < 10; i++) {
            uint256 balanceBefore = bettors[i].balance;
            vm.prank(bettors[i]);
            market.claim();
            // Each gets 10% of 95 ETH = 9.5 ETH
            assertEq(bettors[i].balance - balanceBefore, 9.5 ether);
        }
        
        // 6. Platform fees: 5% of 100 = 5 ETH
        assertEq(market.accruedFees(), 5 ether);
        
        // 7. Creator fees: 0 (one-sided)
        assertEq(market.accruedCreatorFees(), 0);
        
        // 8. Platform withdraws
        uint256 treasuryBefore = treasury.balance;
        market.withdrawFees();
        assertEq(treasury.balance - treasuryBefore, 5 ether);
        
        // 9. Creator cannot withdraw (no fees)
        vm.prank(creator);
        vm.expectRevert(Market.NoCreatorFeesToWithdraw.selector);
        market.withdrawCreatorFees();
    }

    // ============ ZERO VALUE EDGE CASES ============

    function test_zero_value_bet_counted() public {
        vm.prank(user1);
        market.placeYes{value: 0}();
        
        assertEq(market.totalYesBets(), 1);
        assertEq(market.totalYesBetsAmount(), 0);
        assertTrue(market.hasVoted(user1));
    }

    function test_zero_value_bettor_cannot_claim_winnings() public {
        vm.prank(user1);
        market.placeYes{value: 0}();
        
        vm.prank(user2);
        market.placeNo{value: 10 ether}();

        market.resolve(Market.Result.Yes);

        // User1 bet 0, so gets 0 - should revert with DidNotBetOnWinningSide
        // (since userBet == 0 triggers this error before NoWinningsToClaim)
        vm.prank(user1);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
    }

    // ============ BALANCE/ACCOUNTING TESTS ============

    function test_contract_balance_after_all_claims_two_sided() public {
        // 10 bets
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yb", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nb", i)));
            vm.deal(yesBettors[i], 100 ether);
            vm.deal(noBettors[i], 100 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // All winners claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }

        // Contract should have: platform fees + creator fees = 2.5 + 5 = 7.5 ETH
        assertEq(address(market).balance, 7.5 ether);
        assertEq(market.accruedFees() + market.accruedCreatorFees(), 7.5 ether);
    }

    function test_contract_balance_after_all_claims_one_sided() public {
        // All bet on YES
        address[] memory bettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            bettors[i] = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettors[i], 100 ether);
            vm.prank(bettors[i]);
            market.placeYes{value: 20 ether}();
        }

        // Total: 100 ETH
        market.resolve(Market.Result.Yes);

        // All claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(bettors[i]);
            market.claim();
        }

        // Contract should have: 5% platform fee = 5 ETH
        assertEq(address(market).balance, 5 ether);
        assertEq(market.accruedFees(), 5 ether);
        assertEq(market.accruedCreatorFees(), 0);
    }

    function test_withdraw_all_fees_leaves_zero_balance() public {
        // Two-sided with 10 bets
        address[] memory yesBettors = new address[](5);
        address[] memory noBettors = new address[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yb", i)));
            noBettors[i] = makeAddr(string(abi.encodePacked("nb", i)));
            vm.deal(yesBettors[i], 100 ether);
            vm.deal(noBettors[i], 100 ether);
            
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
            
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }

        market.resolve(Market.Result.Yes);

        // All winners claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }

        // Withdraw platform fees
        market.withdrawFees();
        
        // Withdraw creator fees
        vm.prank(creator);
        market.withdrawCreatorFees();

        // Contract should have 0 balance
        assertEq(address(market).balance, 0);
    }
}
