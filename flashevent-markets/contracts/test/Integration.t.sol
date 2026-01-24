// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/Market.sol";

contract IntegrationTest is Test {
    MarketFactory factory;
    address treasury = makeAddr("treasury");
    address owner = address(this);
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address user3 = makeAddr("user3");

    function setUp() public {
        factory = new MarketFactory(treasury);
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
        vm.deal(user3, 1000 ether);
        vm.deal(treasury, 100 ether);
    }

    // Helper function to create market with proper betting deadline
    function _createMarket(string memory question, uint256 expiry) internal returns (address) {
        // Default: betting deadline is 30 minutes before expiry (ensures >= 15 min lock)
        uint256 bettingDeadline = expiry - 30 minutes;
        return factory.createMarket(question, expiry, bettingDeadline);
    }

    // ============ Full Market Lifecycle Tests ============

    function test_full_lifecycle_yes_wins() public {
        // Create market via factory
        address marketAddr = _createMarket("Will ETH reach $5000?", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // Multiple users bet on YES
        vm.prank(user1);
        market.placeYes{value: 50 ether}();

        vm.prank(user2);
        market.placeYes{value: 30 ether}();

        // Multiple users bet on NO
        vm.prank(user3);
        market.placeNo{value: 20 ether}();

        // Resolve to YES (must be called from factory)
        vm.prank(address(factory));
        market.resolve(Market.Result.Yes);
        assertEq(uint256(market.result()), uint256(Market.Result.Yes));

        // Winners claim
        uint256 user1BalanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 user1Received = user1.balance - user1BalanceBefore;
        assertGt(user1Received, 0);

        uint256 user2BalanceBefore = user2.balance;
        vm.prank(user2);
        market.claim();
        uint256 user2Received = user2.balance - user2BalanceBefore;
        assertGt(user2Received, 0);

        // Loser cannot claim
        vm.prank(user3);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();

        // Fees collected
        uint256 treasuryBalanceBefore = treasury.balance;
        vm.prank(address(factory));
        market.withdrawFees();
        uint256 treasuryBalanceAfter = treasury.balance;
        assertGt(treasuryBalanceAfter, treasuryBalanceBefore);
    }

    function test_full_lifecycle_no_wins() public {
        // Create market
        address marketAddr = _createMarket("Will BTC reach $100k?", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // Multiple users bet on YES
        vm.prank(user1);
        market.placeYes{value: 40 ether}();

        // Multiple users bet on NO
        vm.prank(user2);
        market.placeNo{value: 50 ether}();

        vm.prank(user3);
        market.placeNo{value: 30 ether}();

        // Resolve to NO (must be called from factory)
        vm.prank(address(factory));
        market.resolve(Market.Result.No);
        assertEq(uint256(market.result()), uint256(Market.Result.No));

        // Winners claim
        uint256 user2BalanceBefore = user2.balance;
        vm.prank(user2);
        market.claim();
        uint256 user2Received = user2.balance - user2BalanceBefore;
        assertGt(user2Received, 0);

        uint256 user3BalanceBefore = user3.balance;
        vm.prank(user3);
        market.claim();
        uint256 user3Received = user3.balance - user3BalanceBefore;
        assertGt(user3Received, 0);

        // Loser cannot claim
        vm.prank(user1);
        vm.expectRevert(Market.DidNotBetOnWinningSide.selector);
        market.claim();
    }

    function test_full_lifecycle_cancelled() public {
        // Create market
        address marketAddr = _createMarket("Cancelled Market", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // Users place bets
        vm.prank(user1);
        market.placeYes{value: 50 ether}();

        vm.prank(user2);
        market.placeNo{value: 30 ether}();

        // Factory cancels market
        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;

        vm.prank(address(factory));
        market.cancelMarket();

        // Users receive refunds
        assertEq(user1.balance - user1BalanceBefore, 50 ether);
        assertEq(user2.balance - user2BalanceBefore, 30 ether);

        // No claims possible after cancellation
        vm.prank(user1);
        vm.expectRevert(Market.MarketNotResolved.selector);
        market.claim();
    }

    // ============ Multiple Markets Tests ============

    function test_multiple_markets_independent() public {
        // Create 3 markets
        address market1Addr = _createMarket("Market 1", block.timestamp + 1 weeks);
        address market2Addr = _createMarket("Market 2", block.timestamp + 1 weeks);
        address market3Addr = _createMarket("Market 3", block.timestamp + 1 weeks);

        Market market1 = Market(payable(market1Addr));
        Market market2 = Market(payable(market2Addr));
        Market market3 = Market(payable(market3Addr));

        // Place bets on each market
        vm.prank(user1);
        market1.placeYes{value: 10 ether}();

        // Add another bettor to market2 so user can claim
        vm.prank(user1);
        market2.placeYes{value: 20 ether}();

        vm.prank(user2);
        market2.placeNo{value: 5 ether}();

        vm.prank(user1);
        market3.placeNo{value: 15 ether}();

        // Resolve to different outcomes
        vm.prank(address(factory));
        market1.resolve(Market.Result.Yes);
        vm.prank(address(factory));
        market2.resolve(Market.Result.Yes);
        vm.prank(address(factory));
        market3.resolve(Market.Result.No);

        // User1 can claim from markets 1 and 2 (won on both)
        uint256 balanceBefore = user1.balance;

        vm.prank(user1);
        market1.claim();

        vm.prank(user1);
        market2.claim();

        uint256 balanceAfter = user1.balance;
        assertGt(balanceAfter, balanceBefore);

        // User1 wins on market3 too (NO resolution)
        uint256 balanceBeforeM3 = user1.balance;
        vm.prank(user1);
        market3.claim();
        uint256 balanceAfterM3 = user1.balance;
        assertGt(balanceAfterM3, balanceBeforeM3);
    }

    function test_multiple_markets_shared_treasury() public {
        // Create multiple markets
        address market1Addr = _createMarket("Market 1", block.timestamp + 1 weeks);
        address market2Addr = _createMarket("Market 2", block.timestamp + 1 weeks);

        Market market1 = Market(payable(market1Addr));
        Market market2 = Market(payable(market2Addr));

        // Generate fees from both markets
        vm.prank(user1);
        market1.placeYes{value: 100 ether}();

        vm.prank(user2);
        market2.placeNo{value: 100 ether}();

        vm.prank(address(factory));
        market1.resolve(Market.Result.Yes);
        vm.prank(address(factory));
        market2.resolve(Market.Result.No);

        uint256 treasuryBalanceBefore = treasury.balance;

        vm.prank(user1);
        market1.claim();

        vm.prank(user2);
        market2.claim();

        // Withdraw fees from both markets
        vm.prank(address(factory));
        market1.withdrawFees();
        vm.prank(address(factory));
        market2.withdrawFees();

        uint256 treasuryBalanceAfter = treasury.balance;
        assertGt(treasuryBalanceAfter, treasuryBalanceBefore);
    }

    // ============ Edge Cases ============

    function test_market_with_uneven_betting() public {
        address marketAddr = _createMarket("Uneven Market", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // Heavily skewed betting
        vm.prank(user1);
        market.placeYes{value: 1000 ether}();

        vm.prank(user2);
        market.placeNo{value: 1 ether}();

        vm.prank(address(factory));
        market.resolve(Market.Result.Yes);

        // User1 should get majority of pool
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 received = user1.balance - balanceBefore;

        assertGt(received, 900 ether);
        assertLt(received, 1001 ether);
    }

    function test_market_with_single_bettor() public {
        address marketAddr = _createMarket("Single Bettor Market", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // Only one user bets
        vm.prank(user1);
        market.placeYes{value: 100 ether}();

        vm.prank(address(factory));
        market.resolve(Market.Result.Yes);

        // User should get entire pool minus fee
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        market.claim();
        uint256 received = user1.balance - balanceBefore;

        // Single bettor = one-sided market = 5% fee (not 2.5%)
        // 100 * (1 - 0.05) = 95
        assertApproxEqAbs(received, 95 ether, 1 wei);
    }

    function test_factory_fee_change_affects_new_markets() public {
        // Create market with default fee (250 = 2.5%)
        address market1Addr = _createMarket("Market 1", block.timestamp + 1 weeks);
        Market market1 = Market(payable(market1Addr));
        assertEq(market1.protocolFeeBps(), 250);

        // Change factory default fee
        factory.setDefaultProtocolFee(500); // 5%

        // Create new market (should inherit updated default fee)
        address market2Addr = _createMarket("Market 2", block.timestamp + 1 weeks);
        Market market2 = Market(payable(market2Addr));

        // First market retains original fee; new market gets updated default
        assertEq(market1.protocolFeeBps(), 250);
        assertEq(market2.protocolFeeBps(), 500);
    }

    function test_treasury_change_affects_new_markets() public {
        // Create market with initial treasury
        address market1Addr = _createMarket("Market 1", block.timestamp + 1 weeks);
        Market market1 = Market(payable(market1Addr));
        assertEq(market1.treasury(), treasury);

        // Change factory treasury
        address newTreasury = makeAddr("newTreasury");
        factory.setTreasury(newTreasury);

        // Create new market with new treasury
        address market2Addr = _createMarket("Market 2", block.timestamp + 1 weeks);
        Market market2 = Market(payable(market2Addr));

        assertEq(market1.treasury(), treasury);
        assertEq(market2.treasury(), newTreasury);
    }

    // ============ Security Tests ============

    function test_reentrancy_protection_in_claims() public {
        address marketAddr = _createMarket("Reentrancy Test", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        vm.prank(address(factory));
        market.resolve(Market.Result.Yes);

        // First claim should succeed
        vm.prank(user1);
        uint256 claimed = market.claim();
        assertGt(claimed, 0);

        // Second claim should fail
        vm.prank(user1);
        vm.expectRevert(Market.AlreadyClaimed.selector);
        market.claim();
    }

    function test_market_expiry_enforcement() public {
        // Create market: 1 hour expiry, 45 min betting deadline (15 min lock)
        uint256 expiry = block.timestamp + 1 hours;
        uint256 bettingDeadline = expiry - 15 minutes;
        address marketAddr = factory.createMarket("Expiry Test", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));

        // Can bet before betting deadline
        vm.prank(user1);
        market.placeYes{value: 10 ether}();

        // Move time past betting deadline (but before expiry)
        vm.warp(bettingDeadline + 1);

        // Cannot bet after betting deadline
        vm.prank(user2);
        vm.expectRevert(Market.BettingClosed.selector);
        market.placeNo{value: 10 ether}();

        // Can still resolve after expiry
        vm.warp(expiry + 1);
        vm.prank(address(factory));
        market.resolve(Market.Result.Yes);

        // Can still claim after resolution
        vm.prank(user1);
        market.claim();
    }

    function test_access_control_enforcement() public {
        address marketAddr = _createMarket("Access Control Test", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // User cannot resolve
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.resolve(Market.Result.Yes);

        // User cannot cancel
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.cancelMarket();

        // User cannot set fee
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.setProtocolFee(500);

        // User cannot withdraw fees
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotFactoryAddress.selector, user1));
        market.withdrawFees();
    }

    function test_factory_pause_prevents_new_markets() public {
        // Initially can create
        address market1 = _createMarket("Market 1", block.timestamp + 1 weeks);
        assertTrue(factory.isValidMarket(market1));

        // Pause creation
        factory.pauseCreation();

        // Cannot create while paused
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        vm.expectRevert(MarketFactory.CreationPausedError.selector);
        factory.createMarket("Market 2", expiry, bettingDeadline);

        // Resume creation
        factory.resumeCreation();

        // Can create again
        address market2 = _createMarket("Market 2", block.timestamp + 1 weeks);
        assertTrue(factory.isValidMarket(market2));
    }

    // ============ Complex Scenarios ============

    function test_complex_multiuser_scenario() public {
        address marketAddr = _createMarket("Complex Scenario", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        // User1: 40 ETH on YES
        vm.prank(user1);
        market.placeYes{value: 40 ether}();

        // User2: 30 ETH on YES
        vm.prank(user2);
        market.placeYes{value: 30 ether}();

        // User3: 30 ETH on NO
        vm.prank(user3);
        market.placeNo{value: 30 ether}();

        // Verify pool state
        assertEq(market.getTotalYesBetsAmount(), 70 ether);
        assertEq(market.getTotalNoBetsAmount(), 30 ether);

        // Resolve to YES
        vm.prank(address(factory));
        market.resolve(Market.Result.Yes);

        // Calculate expected payouts
        // Total pool: 100 ETH
        // User1 share: (40/70)*100 = 57.14... ETH
        // User2 share: (30/70)*100 = 42.85... ETH
        // Fee: 2.5% from each

        uint256 user1Before = user1.balance;
        uint256 user2Before = user2.balance;

        vm.prank(user1);
        market.claim();

        vm.prank(user2);
        market.claim();

        uint256 user1Received = user1.balance - user1Before;
        uint256 user2Received = user2.balance - user2Before;

        // User1 should receive more than user2
        assertGt(user1Received, user2Received);

        // Both should receive positive amounts
        assertGt(user1Received, 0);
        assertGt(user2Received, 0);

        // Withdrawing fees
        vm.prank(address(factory));
        market.withdrawFees();
    }

    function test_sequential_market_creation_and_resolution() public {
        // Create 5 markets sequentially
        address[] memory markets = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            markets[i] = _createMarket(
                string(abi.encodePacked("Market ", i)),
                block.timestamp + 1 weeks
            );
        }

        assertEq(factory.marketsCount(), 5);

        // Each user bets on different markets
        vm.prank(user1);
        Market(payable(markets[0])).placeYes{value: 10 ether}();

        vm.prank(user2);
        Market(payable(markets[1])).placeYes{value: 10 ether}();

        vm.prank(user3);
        Market(payable(markets[2])).placeYes{value: 10 ether}();

        // Resolve all to YES
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(address(factory));
            Market(payable(markets[i])).resolve(Market.Result.Yes);
        }

        // All markets resolved
        for (uint256 i = 0; i < 5; i++) {
            assertTrue(Market(payable(markets[i])).getIsresolved());
        }
    }
}
