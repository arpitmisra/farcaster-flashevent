// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/Market.sol";

contract MarketFactoryTest is Test {
    MarketFactory factory;
    address treasury = makeAddr("treasury");
    address owner = address(this);
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address randomAddress = makeAddr("random");

    // Events to match MarketFactory contract
    event MarketCreated(address indexed market, string question, uint256 expiry, uint256 bettingDeadline, address indexed creator);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event CreationPaused();
    event CreationResumed();
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event ProtocolFeeChanged(uint256 newFeeBps);
    event MinLockDurationChanged(uint256 oldDuration, uint256 newDuration);

    function setUp() public {
        factory = new MarketFactory(treasury);
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
    }

    // Helper function to create market with proper betting deadline
    function _createMarket(string memory question, uint256 expiry) internal returns (address) {
        // Default: betting deadline is 30 minutes before expiry (ensures >= 15 min lock)
        uint256 bettingDeadline = expiry - 30 minutes;
        return factory.createMarket(question, expiry, bettingDeadline);
    }

    // ============ Constructor Tests ============

    function test_constructor_initialization() public view {
        assertEq(factory.treasury(), treasury);
        assertEq(factory.owner(), owner);
        assertEq(factory.creationPaused(), false);
        assertEq(factory.defaultProtocolFeeBps(), 250);
        assertEq(factory.minLockDuration(), 15 minutes);
    }

    function test_constructor_invalid_treasury() public {
        vm.expectRevert(MarketFactory.InvalidTreasury.selector);
        new MarketFactory(address(0));
    }

    // ============ createMarket() Tests ============

    function test_createMarket_success() public {
        address marketAddr = _createMarket("Will BTC reach $100k?", block.timestamp + 1 weeks);
        assertTrue(marketAddr != address(0));
        assertEq(factory.marketsCount(), 1);
    }

    function test_createMarket_multiple_markets() public {
        _createMarket("Market 1", block.timestamp + 1 weeks);
        _createMarket("Market 2", block.timestamp + 2 weeks);
        _createMarket("Market 3", block.timestamp + 3 weeks);

        assertEq(factory.marketsCount(), 3);
    }

    function test_createMarket_creation_paused() public {
        factory.pauseCreation();

        vm.expectRevert(MarketFactory.CreationPausedError.selector);
        _createMarket("Will ETH reach $5000?", block.timestamp + 1 weeks);
    }

    function test_createMarket_inherits_treasury() public {
        address marketAddr = _createMarket("Test Market", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        assertEq(market.treasury(), treasury);
    }

    function test_createMarket_returns_address() public {
        address marketAddr = _createMarket("Test Market", block.timestamp + 1 weeks);
        assertTrue(marketAddr != address(0));
        assertTrue(factory.isValidMarket(marketAddr));
    }

    function test_createMarket_same_question_different_expiry() public {
        address market1 = _createMarket("Same Question", block.timestamp + 1 weeks);
        address market2 = _createMarket("Same Question", block.timestamp + 2 weeks);

        assertTrue(market1 != market2);
        assertTrue(factory.isValidMarket(market1));
        assertTrue(factory.isValidMarket(market2));
    }

    function test_createMarket_event_emitted() public {
        string memory question = "Test Question";
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;

        vm.expectEmit(false, true, true, true);
        emit MarketCreated(address(0), question, expiry, bettingDeadline, address(this));
        factory.createMarket(question, expiry, bettingDeadline);
    }

    // ============ Betting Deadline Validation Tests ============

    function test_createMarket_invalid_betting_deadline_after_expiry() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry + 1 hours; // After expiry - invalid

        vm.expectRevert(MarketFactory.InvalidBettingDeadline.selector);
        factory.createMarket("Test", expiry, bettingDeadline);
    }

    function test_createMarket_invalid_betting_deadline_equals_expiry() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry; // Same as expiry - invalid

        vm.expectRevert(MarketFactory.InvalidBettingDeadline.selector);
        factory.createMarket("Test", expiry, bettingDeadline);
    }

    function test_createMarket_invalid_betting_deadline_in_past() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = block.timestamp - 1; // In past - invalid

        vm.expectRevert(MarketFactory.InvalidBettingDeadline.selector);
        factory.createMarket("Test", expiry, bettingDeadline);
    }

    function test_createMarket_lock_duration_too_short() public {
        uint256 expiry = block.timestamp + 1 hours;
        uint256 bettingDeadline = expiry - 10 minutes; // Only 10 min lock, but min is 15

        vm.expectRevert(MarketFactory.LockDurationTooShort.selector);
        factory.createMarket("Test", expiry, bettingDeadline);
    }

    function test_createMarket_lock_duration_exactly_minimum() public {
        uint256 expiry = block.timestamp + 1 hours;
        uint256 bettingDeadline = expiry - 15 minutes; // Exactly 15 min lock

        address marketAddr = factory.createMarket("Test", expiry, bettingDeadline);
        assertTrue(marketAddr != address(0));
        
        Market market = Market(payable(marketAddr));
        assertEq(market.getLockDuration(), 15 minutes);
    }

    function test_createMarket_sets_betting_deadline() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 2 hours;

        address marketAddr = factory.createMarket("Test", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));

        assertEq(market.bettingDeadline(), bettingDeadline);
        assertEq(market.expiry(), expiry);
        assertEq(market.getLockDuration(), 2 hours);
    }

    // ============ setMinLockDuration Tests ============

    function test_setMinLockDuration_success() public {
        factory.setMinLockDuration(30 minutes);
        assertEq(factory.minLockDuration(), 30 minutes);
    }

    function test_setMinLockDuration_only_owner() public {
        vm.prank(user1);
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.setMinLockDuration(30 minutes);
    }

    function test_setMinLockDuration_event_emitted() public {
        vm.expectEmit(true, true, true, true);
        emit MinLockDurationChanged(15 minutes, 30 minutes);
        factory.setMinLockDuration(30 minutes);
    }

    function test_setMinLockDuration_affects_new_markets() public {
        // Increase min lock duration
        factory.setMinLockDuration(1 hours);

        uint256 expiry = block.timestamp + 2 hours;
        uint256 bettingDeadline = expiry - 30 minutes; // 30 min lock, but now min is 1 hour

        vm.expectRevert(MarketFactory.LockDurationTooShort.selector);
        factory.createMarket("Test", expiry, bettingDeadline);
    }

    function test_setMinLockDuration_zero_allowed() public {
        factory.setMinLockDuration(0);
        assertEq(factory.minLockDuration(), 0);

        // Now any lock duration works
        uint256 expiry = block.timestamp + 1 hours;
        uint256 bettingDeadline = expiry - 1 minutes;
        address marketAddr = factory.createMarket("Test", expiry, bettingDeadline);
        assertTrue(marketAddr != address(0));
    }

    // ============ marketsCount() Tests ============

    function test_marketsCount_zero() public view {
        assertEq(factory.marketsCount(), 0);
    }

    function test_marketsCount_increments() public {
        assertEq(factory.marketsCount(), 0);
        _createMarket("Market 1", block.timestamp + 1 weeks);
        assertEq(factory.marketsCount(), 1);
        _createMarket("Market 2", block.timestamp + 1 weeks);
        assertEq(factory.marketsCount(), 2);
    }

    function test_marketsCount_large_number() public {
        for (uint256 i = 0; i < 100; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }
        assertEq(factory.marketsCount(), 100);
    }

    // ============ getMarket() Tests ============

    function test_getMarket_valid_index() public {
        address market1 = _createMarket("Market 1", block.timestamp + 1 weeks);
        address market2 = _createMarket("Market 2", block.timestamp + 1 weeks);
        address market3 = _createMarket("Market 3", block.timestamp + 1 weeks);

        assertEq(factory.getMarket(0), market1);
        assertEq(factory.getMarket(1), market2);
        assertEq(factory.getMarket(2), market3);
    }

    function test_getMarket_out_of_bounds() public {
        _createMarket("Market 1", block.timestamp + 1 weeks);
        _createMarket("Market 2", block.timestamp + 1 weeks);

        vm.expectRevert(MarketFactory.OutOfBounds.selector);
        factory.getMarket(5);
    }

    function test_getMarket_empty_factory() public {
        vm.expectRevert(MarketFactory.OutOfBounds.selector);
        factory.getMarket(0);
    }

    // ============ getMarkets() Tests ============

    function test_getMarkets_pagination() public {
        for (uint256 i = 0; i < 10; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        address[] memory first5 = factory.getMarkets(0, 5);
        assertEq(first5.length, 5);

        address[] memory second5 = factory.getMarkets(5, 5);
        assertEq(second5.length, 5);

        assertEq(first5[0], factory.getMarket(0));
        assertEq(second5[0], factory.getMarket(5));
    }

    function test_getMarkets_single_page() public {
        for (uint256 i = 0; i < 5; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        address[] memory markets = factory.getMarkets(0, 5);
        assertEq(markets.length, 5);
    }

    function test_getMarkets_offset_out_of_bounds() public {
        for (uint256 i = 0; i < 5; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        vm.expectRevert(MarketFactory.OutOfBounds.selector);
        factory.getMarkets(3, 5);
    }

    function test_getMarkets_limit_zero() public {
        for (uint256 i = 0; i < 5; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        address[] memory markets = factory.getMarkets(0, 0);
        assertEq(markets.length, 0);
    }

    function test_getMarkets_exact_boundary() public {
        for (uint256 i = 0; i < 10; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        address[] memory markets = factory.getMarkets(0, 10);
        assertEq(markets.length, 10);
    }

    // ============ getAllMarkets() Tests ============

    function test_getAllMarkets_populated() public {
        for (uint256 i = 0; i < 5; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        address[] memory markets = factory.getAllMarkets();
        assertEq(markets.length, 5);
    }

    function test_getAllMarkets_empty() public {
        address[] memory markets = factory.getAllMarkets();
        assertEq(markets.length, 0);
    }

    function test_getAllMarkets_large_list() public {
        for (uint256 i = 0; i < 50; i++) {
            _createMarket(string(abi.encodePacked("Market ", i)), block.timestamp + 1 weeks);
        }

        address[] memory markets = factory.getAllMarkets();
        assertEq(markets.length, 50);
    }

    // ============ isValidMarket() Tests ============

    function test_isValidMarket_valid_address() public {
        address marketAddr = _createMarket("Test Market", block.timestamp + 1 weeks);
        assertTrue(factory.isValidMarket(marketAddr));
    }

    function test_isValidMarket_invalid_address() public {
        _createMarket("Test Market", block.timestamp + 1 weeks);
        assertFalse(factory.isValidMarket(randomAddress));
    }

    function test_isValidMarket_zero_address() public {
        assertFalse(factory.isValidMarket(address(0)));
    }

    function test_isValidMarket_empty_factory() public {
        assertFalse(factory.isValidMarket(randomAddress));
    }

    // ============ getMarketIndex() Tests ============

    function test_getMarketIndex_valid() public {
        address market1 = _createMarket("Market 1", block.timestamp + 1 weeks);
        address market2 = _createMarket("Market 2", block.timestamp + 1 weeks);
        address market3 = _createMarket("Market 3", block.timestamp + 1 weeks);

        assertEq(factory.getMarketIndex(market1), 0);
        assertEq(factory.getMarketIndex(market2), 1);
        assertEq(factory.getMarketIndex(market3), 2);
    }

    function test_getMarketIndex_invalid_address() public {
        _createMarket("Market 1", block.timestamp + 1 weeks);
        _createMarket("Market 2", block.timestamp + 1 weeks);

        vm.expectRevert(MarketFactory.MarketNotFound.selector);
        factory.getMarketIndex(randomAddress);
    }

    function test_getMarketIndex_not_in_factory() public {
        // Create a market in a different factory
        MarketFactory otherFactory = new MarketFactory(treasury);
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        address otherMarket = otherFactory.createMarket("Other Market", expiry, bettingDeadline);

        _createMarket("Market 1", block.timestamp + 1 weeks);

        vm.expectRevert(MarketFactory.MarketNotFound.selector);
        factory.getMarketIndex(otherMarket);
    }

    // ============ setTreasury() Tests ============

    function test_setTreasury_by_owner() public {
        address newTreasury = makeAddr("newTreasury");
        factory.setTreasury(newTreasury);
        assertEq(factory.treasury(), newTreasury);
    }

    function test_setTreasury_not_owner() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(user1);
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.setTreasury(newTreasury);
    }

    function test_setTreasury_invalid_address() public {
        vm.expectRevert(MarketFactory.InvalidTreasury.selector);
        factory.setTreasury(address(0));
    }

    function test_setTreasury_new_markets_inherit() public {
        address newTreasury = makeAddr("newTreasury");
        factory.setTreasury(newTreasury);

        address marketAddr = _createMarket("Test Market", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        assertEq(market.treasury(), newTreasury);
    }

    function test_setTreasury_event_emitted() public {
        address newTreasury = makeAddr("newTreasury");
        vm.expectEmit(true, true, true, true);
        emit TreasuryChanged(treasury, newTreasury);
        factory.setTreasury(newTreasury);
    }

    // ============ pauseCreation() Tests ============

    function test_pauseCreation_by_owner() public {
        factory.pauseCreation();
        assertTrue(factory.creationPaused());
    }

    function test_pauseCreation_blocks_creation() public {
        factory.pauseCreation();

        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        vm.expectRevert(MarketFactory.CreationPausedError.selector);
        factory.createMarket("Test Market", expiry, bettingDeadline);
    }

    function test_pauseCreation_not_owner() public {
        vm.prank(user1);
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.pauseCreation();
    }

    function test_pauseCreation_event_emitted() public {
        vm.expectEmit(true, true, true, true);
        emit CreationPaused();
        factory.pauseCreation();
    }

    // ============ resumeCreation() Tests ============

    function test_resumeCreation_by_owner() public {
        factory.pauseCreation();
        factory.resumeCreation();
        assertFalse(factory.creationPaused());
    }

    function test_resumeCreation_allows_creation() public {
        factory.pauseCreation();
        factory.resumeCreation();

        address marketAddr = _createMarket("Test Market", block.timestamp + 1 weeks);
        assertTrue(factory.isValidMarket(marketAddr));
    }

    function test_resumeCreation_not_owner() public {
        factory.pauseCreation();

        vm.prank(user1);
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.resumeCreation();
    }

    function test_resumeCreation_event_emitted() public {
        factory.pauseCreation();

        vm.expectEmit(true, true, true, true);
        emit CreationResumed();
        factory.resumeCreation();
    }

    // ============ transferOwnership() Tests ============

    function test_transferOwnership_by_owner() public {
        address newOwner = makeAddr("newOwner");
        factory.transferOwnership(newOwner);
        assertEq(factory.owner(), newOwner);
    }

    function test_transferOwnership_new_owner_has_control() public {
        address newOwner = makeAddr("newOwner");
        factory.transferOwnership(newOwner);

        vm.prank(newOwner);
        address newTreasury = makeAddr("newTreasury");
        factory.setTreasury(newTreasury);

        assertEq(factory.treasury(), newTreasury);
    }

    function test_transferOwnership_old_owner_loses_control() public {
        address newOwner = makeAddr("newOwner");
        factory.transferOwnership(newOwner);

        address newTreasury = makeAddr("newTreasury");
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.setTreasury(newTreasury);
    }

    function test_transferOwnership_not_owner() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(user1);
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.transferOwnership(newOwner);
    }

    function test_transferOwnership_invalid_address() public {
        vm.expectRevert(MarketFactory.InvalidAddress.selector);
        factory.transferOwnership(address(0));
    }

    function test_transferOwnership_event_emitted() public {
        address newOwner = makeAddr("newOwner");
        vm.expectEmit(true, true, true, true);
        emit OwnershipTransferred(owner, newOwner);
        factory.transferOwnership(newOwner);
    }

    // ============ setDefaultProtocolFee() Tests ============

    function test_setDefaultProtocolFee_by_owner() public {
        factory.setDefaultProtocolFee(500);
        assertEq(factory.defaultProtocolFeeBps(), 500);
    }

    function test_setDefaultProtocolFee_too_high() public {
        vm.expectRevert(MarketFactory.InvalidTreasury.selector);
        factory.setDefaultProtocolFee(1001);
    }

    function test_setDefaultProtocolFee_not_owner() public {
        vm.prank(user1);
        vm.expectRevert(MarketFactory.Unauthorized.selector);
        factory.setDefaultProtocolFee(500);
    }

    function test_setDefaultProtocolFee_zero() public {
        factory.setDefaultProtocolFee(0);
        assertEq(factory.defaultProtocolFeeBps(), 0);
    }

    function test_setDefaultProtocolFee_max_valid() public {
        factory.setDefaultProtocolFee(1000);
        assertEq(factory.defaultProtocolFeeBps(), 1000);
    }

    function test_setDefaultProtocolFee_event_emitted() public {
        vm.expectEmit(true, true, true, true);
        emit ProtocolFeeChanged(500);
        factory.setDefaultProtocolFee(500);
    }

    // ============ Additional Edge Cases ============

    function test_multiple_operations_sequence() public {
        // Create initial market
        address market1 = _createMarket("Market 1", block.timestamp + 1 weeks);

        // Pause creation
        factory.pauseCreation();
        assertFalse(factory.isValidMarket(randomAddress));

        // Resume creation
        factory.resumeCreation();
        address market2 = _createMarket("Market 2", block.timestamp + 2 weeks);

        // Change treasury
        address newTreasury = makeAddr("newTreasury");
        factory.setTreasury(newTreasury);

        // Create another market with new treasury
        address market3 = _createMarket("Market 3", block.timestamp + 3 weeks);

        // Verify all markets exist
        assertEq(factory.marketsCount(), 3);
        assertTrue(factory.isValidMarket(market1));
        assertTrue(factory.isValidMarket(market2));
        assertTrue(factory.isValidMarket(market3));

        // Verify new treasury is set
        Market newMarket = Market(payable(market3));
        assertEq(newMarket.treasury(), newTreasury);
    }

    function test_ownership_transfer_complete() public {
        address newOwner = makeAddr("newOwner");

        // Original owner can perform operations
        factory.setDefaultProtocolFee(500);

        // Transfer ownership
        factory.transferOwnership(newOwner);

        // New owner can perform operations
        vm.prank(newOwner);
        factory.setDefaultProtocolFee(600);

        assertEq(factory.defaultProtocolFeeBps(), 600);
    }

    // ============ Creator Tests ============

    function test_createMarket_sets_creator_to_msg_sender() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        vm.prank(user1);
        address marketAddr = factory.createMarket("User1 Market", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));

        assertEq(market.creator(), user1);
    }

    function test_different_users_create_markets_different_creators() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address market1Addr = factory.createMarket("User1 Market", expiry, bettingDeadline);
        
        vm.prank(user2);
        address market2Addr = factory.createMarket("User2 Market", expiry, bettingDeadline);

        Market market1 = Market(payable(market1Addr));
        Market market2 = Market(payable(market2Addr));

        assertEq(market1.creator(), user1);
        assertEq(market2.creator(), user2);
        assertTrue(market1.creator() != market2.creator());
    }

    function test_owner_creates_market_is_creator() public {
        // Owner (this contract) creates market
        address marketAddr = _createMarket("Owner Market", block.timestamp + 1 weeks);
        Market market = Market(payable(marketAddr));

        assertEq(market.creator(), address(this));
    }

    function test_creator_can_vote_in_own_market_via_factory() public {
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address marketAddr = factory.createMarket("User1 Market", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));

        // Creator votes in their own market
        vm.prank(user1);
        market.placeYes{value: 1 ether}();

        assertEq(market.yesBets(user1), 1 ether);
        assertTrue(market.hasVoted(user1));
    }

    function test_creator_fees_flow_to_market_creator() public {
        // User1 creates market
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address marketAddr = factory.createMarket("User1 Market", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));

        // Create 10 bets (5 YES, 5 NO) to reach threshold
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

        // Factory resolves
        factory.resolveMarket(marketAddr, Market.Result.Yes);

        // All winners claim
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }

        // User1 (creator) withdraws creator fees
        uint256 creatorBalanceBefore = user1.balance;
        vm.prank(user1);
        market.withdrawCreatorFees();
        uint256 creatorBalanceAfter = user1.balance;

        // Creator should receive 5% of 100 ETH = 5 ETH
        assertEq(creatorBalanceAfter - creatorBalanceBefore, 5 ether);
    }

    function test_non_creator_cannot_withdraw_creator_fees() public {
        // User1 creates market
        uint256 expiry = block.timestamp + 1 weeks;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address marketAddr = factory.createMarket("User1 Market", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));

        // Create 10 bets
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

        // Factory resolves
        factory.resolveMarket(marketAddr, Market.Result.Yes);

        // One winner claims
        vm.prank(yesBettors[0]);
        market.claim();

        // User2 (NOT creator) tries to withdraw
        vm.prank(user2);
        vm.expectRevert(Market.NotCreator.selector);
        market.withdrawCreatorFees();
    }

    // ============ Full End-to-End Tests ============

    function test_full_market_lifecycle_via_factory() public {
        // 1. User1 creates a market
        uint256 expiry = block.timestamp + 1 days;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address marketAddr = factory.createMarket("Will it rain tomorrow?", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));
        
        // Verify market setup
        assertEq(market.creator(), user1);
        assertEq(market.factory(), address(factory));
        assertEq(market.treasury(), treasury);
        
        // 2. Multiple users place bets
        address[] memory yesBettors = new address[](6);
        address[] memory noBettors = new address[](4);
        
        for (uint256 i = 0; i < 6; i++) {
            yesBettors[i] = makeAddr(string(abi.encodePacked("yes", i)));
            vm.deal(yesBettors[i], 100 ether);
            vm.prank(yesBettors[i]);
            market.placeYes{value: 10 ether}();
        }
        
        for (uint256 i = 0; i < 4; i++) {
            noBettors[i] = makeAddr(string(abi.encodePacked("no", i)));
            vm.deal(noBettors[i], 100 ether);
            vm.prank(noBettors[i]);
            market.placeNo{value: 10 ether}();
        }
        
        // Total: 100 ETH (60 YES, 40 NO), 10 bets
        assertEq(market.getTotalBets(), 10);
        assertTrue(market.isCreatorEligibleForFees());
        assertFalse(market.isOneSided());
        
        // 3. Factory resolves market
        factory.resolveMarket(marketAddr, Market.Result.Yes);
        assertTrue(market.getIsresolved());
        
        // 4. Winners claim
        for (uint256 i = 0; i < 6; i++) {
            vm.prank(yesBettors[i]);
            market.claim();
        }
        
        // 5. Verify fees
        // Platform: 2.5% of 100 = 2.5 ETH
        // Creator: 5% of 100 = 5 ETH
        assertApproxEqAbs(market.accruedFees(), 2.5 ether, 5 wei);
        assertApproxEqAbs(market.accruedCreatorFees(), 5 ether, 5 wei);
        
        // 6. Platform withdraws fees
        uint256 treasuryBefore = treasury.balance;
        factory.withdrawMarketFees(marketAddr);
        assertApproxEqAbs(treasury.balance - treasuryBefore, 2.5 ether, 5 wei);
        
        // 7. Creator (user1) withdraws fees
        uint256 creatorBefore = user1.balance;
        vm.prank(user1);
        market.withdrawCreatorFees();
        assertApproxEqAbs(user1.balance - creatorBefore, 5 ether, 5 wei);
    }

    function test_full_oneSided_market_lifecycle_via_factory() public {
        // 1. User1 creates a market
        uint256 expiry = block.timestamp + 1 days;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address marketAddr = factory.createMarket("Will X win?", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));
        
        // 2. All users bet on YES
        address[] memory bettors = new address[](10);
        
        for (uint256 i = 0; i < 10; i++) {
            bettors[i] = makeAddr(string(abi.encodePacked("bettor", i)));
            vm.deal(bettors[i], 100 ether);
            vm.prank(bettors[i]);
            market.placeYes{value: 10 ether}();
        }
        
        // Total: 100 ETH, 10 bets, ONE-SIDED
        assertTrue(market.isOneSided());
        
        // 3. Factory resolves market (result doesn't matter for one-sided)
        factory.resolveMarket(marketAddr, Market.Result.No); // Opposite result!
        
        // 4. ALL bettors can claim (refund)
        for (uint256 i = 0; i < 10; i++) {
            uint256 balanceBefore = bettors[i].balance;
            vm.prank(bettors[i]);
            market.claim();
            // Each gets 10% of 95 ETH = 9.5 ETH
            assertEq(bettors[i].balance - balanceBefore, 9.5 ether);
        }
        
        // 5. Verify fees - 5% platform, 0% creator
        assertEq(market.accruedFees(), 5 ether);
        assertEq(market.accruedCreatorFees(), 0);
        
        // 6. Platform withdraws
        uint256 treasuryBefore = treasury.balance;
        factory.withdrawMarketFees(marketAddr);
        assertEq(treasury.balance - treasuryBefore, 5 ether);
        
        // 7. Creator cannot withdraw (no fees)
        vm.prank(user1);
        vm.expectRevert(Market.NoCreatorFeesToWithdraw.selector);
        market.withdrawCreatorFees();
    }

    function test_cancel_market_via_factory() public {
        // User1 creates market
        uint256 expiry = block.timestamp + 1 days;
        uint256 bettingDeadline = expiry - 30 minutes;
        
        vm.prank(user1);
        address marketAddr = factory.createMarket("Will it snow?", expiry, bettingDeadline);
        Market market = Market(payable(marketAddr));
        
        // Users place bets
        vm.prank(user2);
        market.placeYes{value: 10 ether}();
        
        address user3 = makeAddr("user3");
        vm.deal(user3, 100 ether);
        vm.prank(user3);
        market.placeNo{value: 5 ether}();
        
        // Store balances
        uint256 user2Before = user2.balance;
        uint256 user3Before = user3.balance;
        
        // Factory cancels
        factory.cancelMarket(marketAddr);
        
        // Users get full refund
        assertEq(user2.balance - user2Before, 10 ether);
        assertEq(user3.balance - user3Before, 5 ether);
    }
}
