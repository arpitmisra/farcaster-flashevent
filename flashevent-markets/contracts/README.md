# FlashEvent Markets - Smart Contracts (Foundry)

This package contains the Solidity smart contracts for FlashEvent Markets, deployed using Foundry.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Installation

```bash
# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts
```

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your environment variables:
- `DEPLOYER_PRIVATE_KEY`: Your deployer wallet private key
- `TREASURY_ADDRESS`: Address to receive protocol fees
- `MONAD_TESTNET_RPC`: RPC URL (default is already set)

3. Deploy to Monad Testnet:
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $MONAD_TESTNET_RPC --broadcast
```

4. After deployment, copy the contract addresses to your other `.env` files.

## Contract Structure

```
src/
├── Market.sol           # Individual prediction market
└── MarketFactory.sol    # Factory for creating markets
```

## Key Functions

### MarketFactory

| Function | Description |
|----------|-------------|
| `createMarket(question, expiry)` | Create a new prediction market |
| `getAllMarkets()` | Get all market addresses |
| `resolveMarket(market, outcome)` | Resolve a market (owner only) |

### Market

| Function | Description |
|----------|-------------|
| `placeYes()` | Place a YES bet (send ETH) |
| `placeNo()` | Place a NO bet (send ETH) |
| `claim()` | Claim winnings after resolution |
| `getProbablityYes()` | Get YES probability (0-100) |
| `getProbablityNo()` | Get NO probability (0-100) |

## Market Result Enum

```solidity
enum Result {
    Pending,  // 0 - Not resolved
    Yes,      // 1 - Resolved YES
    No        // 2 - Resolved NO
}
```

## License

MIT
