// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Market} from "./Market.sol";

contract MarketFactory {

    //mappings 
    mapping(address => address[]) public creatorToMarkets; // One creator can have multiple markets
    // Errors
    error InvalidTreasury();
    error Unauthorized();
    error MarketNotFound();
    error InvalidAddress();
    error OutOfBounds();
    error CreationPausedError();
    error InvalidBettingDeadline();
    error LockDurationTooShort();

    // Events
    event MarketCreated(address indexed market, string question, uint256 expiry, uint256 bettingDeadline, address indexed creator);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event CreationPaused();
    event CreationResumed();
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event ProtocolFeeChanged(uint256 newFeeBps);
    event MinLockDurationChanged(uint256 oldDuration, uint256 newDuration);

    // State Variables
    Market[] public markets;
    address public treasury;
    address public owner;
    bool public creationPaused;
    uint256 public defaultProtocolFeeBps = 250; // 2.5%
    uint256 public minLockDuration = 15 minutes; // Minimum 15 minutes lock period before expiry

    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _treasury) {
        if (_treasury == address(0)) revert InvalidTreasury();
        treasury = _treasury;
        owner = msg.sender;
        creationPaused = false;
    }

    // Core Functions
    function createMarket(string memory question, uint256 expiry, uint256 bettingDeadline) external returns (address) {
        if (creationPaused) revert CreationPausedError();
        
        // Validate betting deadline
        if (bettingDeadline >= expiry) revert InvalidBettingDeadline();
        if (bettingDeadline <= block.timestamp) revert InvalidBettingDeadline();
        
        // Validate minimum lock duration
        uint256 lockDuration = expiry - bettingDeadline;
        if (lockDuration < minLockDuration) revert LockDurationTooShort();
        
        Market market = new Market(question, expiry, bettingDeadline, treasury, msg.sender);
        // Propagate default protocol fee to newly created markets
        market.setProtocolFee(defaultProtocolFeeBps);
        markets.push(market);
        creatorToMarkets[msg.sender].push(address(market)); // Track all markets by this creator
        emit MarketCreated(address(market), question, expiry, bettingDeadline, msg.sender);
        return address(market);
    }
    
    // Getter Functions
    function marketsCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarket(uint256 index) external view returns (address) {
        if (index >= markets.length) revert OutOfBounds();
        return address(markets[index]);
    }

    function getMarkets(uint256 offset, uint256 limit) external view returns (address[] memory) {
        if (offset + limit > markets.length) revert OutOfBounds();

        address[] memory result = new address[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = address(markets[offset + i]);
        }
        return result;
    }

    function getAllMarkets() external view returns (address[] memory) {
        address[] memory result = new address[](markets.length);
        for (uint256 i = 0; i < markets.length; i++) {
            result[i] = address(markets[i]);
        }
        return result;
    }

    function isValidMarket(address market) external view returns (bool) {
        for (uint256 i = 0; i < markets.length; i++) {
            if (address(markets[i]) == market) return true;
        }
        return false;
    }

    function getMarketIndex(address market) external view returns (uint256) {
        for (uint256 i = 0; i < markets.length; i++) {
            if (address(markets[i]) == market) return i;
        }
        revert MarketNotFound();
    }

    function getMarketsByCreator(address creator) external view returns (address[] memory) {
        return creatorToMarkets[creator];
    }

    function getCreatorMarketsCount(address creator) external view returns (uint256) {
        return creatorToMarkets[creator].length;
    }

    // Admin Functions
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryChanged(oldTreasury, newTreasury);
    }

    function pauseCreation() external onlyOwner {
        creationPaused = true;
        emit CreationPaused();
    }

    function resumeCreation() external onlyOwner {
        creationPaused = false;
        emit CreationResumed();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function setDefaultProtocolFee(uint256 feeBps) external onlyOwner {
        if (feeBps > 1000) revert InvalidTreasury(); // Max 10%
        defaultProtocolFeeBps = feeBps;
        emit ProtocolFeeChanged(feeBps);
    }

    function setMinLockDuration(uint256 newMinLockDuration) external onlyOwner {
        uint256 oldDuration = minLockDuration;
        minLockDuration = newMinLockDuration;
        emit MinLockDurationChanged(oldDuration, newMinLockDuration);
    }

    // Passthrough admin functions to interact with markets
    function resolveMarket(address marketAddr, Market.Result outcome) external onlyOwner {
        Market(marketAddr).resolve(outcome);
    }

    function cancelMarket(address marketAddr) external onlyOwner {
        Market(marketAddr).cancelMarket();
    }

    function setMarketProtocolFee(address marketAddr, uint256 feeBps) external onlyOwner {
        Market(marketAddr).setProtocolFee(feeBps);
    }

    function setMarketTreasury(address marketAddr, address newTreasury) external onlyOwner {
        Market(marketAddr).setTreasury(newTreasury);
    }

    function withdrawMarketFees(address marketAddr) external onlyOwner {
        Market(marketAddr).withdrawFees();
    }
}
