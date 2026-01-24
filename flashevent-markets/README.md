# FlashEvent Markets

A decentralized prediction market platform built on Monad blockchain, now available as a Farcaster Mini App.

## Project Structure

```
flashevent-markets/
├── backend/          # Node.js/Express API server
├── contracts/        # Solidity smart contracts (Foundry)
├── miniapp/          # Farcaster Mini App (Next.js 14) ⭐ NEW
├── mobile/           # React Native app (legacy)
├── frames/           # Farcaster Frames (legacy)
└── x402/             # x402 payment integration
```

## Quick Start

### 1. Start the Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure your .env file
npm run dev
```

### 2. Run the Mini App

```bash
cd miniapp
npm install
cp .env.example .env.local
# Configure your .env.local file
npm run dev
```

### 3. Deploy Contracts (optional)

```bash
cd contracts
forge install
forge build
forge script script/Deploy.s.sol --broadcast
```

## Farcaster Mini App

The `miniapp/` directory contains the new Farcaster Mini App built with:

- **Next.js 14** - React framework with App Router
- **Farcaster Mini App SDK** - Native Farcaster integration
- **Privy** - Wallet management (embedded + external)
- **Wagmi/Viem** - Ethereum interactions
- **Tailwind CSS** - Styling

See `miniapp/README.md` for detailed documentation.

## Features

### For Bettors
- Browse trending prediction markets
- Place YES/NO bets with live odds
- Track positions and claim winnings
- Earn XP, unlock achievements, climb leaderboards

### For Creators
- Create prediction markets for free
- Earn 5% of pool when market gets 10+ bets
- View creator dashboard with analytics
- Share markets to Farcaster feed

### Gamification
- 5 Level progression system (Rookie → Legend)
- 20+ achievements across categories
- Daily challenges with XP + ETH rewards
- Global and periodic leaderboards

## Tokenomics

| Fee Type | Amount |
|----------|--------|
| Market Creation | Free |
| Betting Fee | None |
| Platform Fee | 2.5% of pool |
| Creator Reward | 5% of pool (if 10+ bets) |
| Winner Pool | 92.5% - 97.5% |

## Smart Contracts

Deployed on Monad Testnet (Chain ID: 10143):

- **MarketFactory**: `0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007`
- Creates individual Market contracts for each prediction

## Environment Variables

### Backend (.env)
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/flashevent
REDIS_URL=redis://localhost:6379
RPC_URL=https://monad-testnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=10143
MARKET_FACTORY_ADDRESS=0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007
```

### Mini App (.env.local)
```env
NEXT_PUBLIC_APP_URL=https://flashevent.vercel.app
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_MONAD_RPC_URL=https://monad-testnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Deployment

### Backend
- Deploy to Railway, Render, or AWS
- Requires MongoDB and Redis

### Mini App
- Deploy to Vercel (recommended)
- Configure environment variables
- Update farcaster.json with account association

### Farcaster Publishing
1. Generate account association at https://farcaster.xyz/~/developers/new
2. Update `miniapp/public/.well-known/farcaster.json`
3. Deploy to your domain
4. Verify in Warpcast developer tools

## Development

### Prerequisites
- Node.js 18+
- MongoDB (optional, has fallback)
- Redis (optional, has fallback)
- Foundry (for contract development)

### Running Tests
```bash
# Backend
cd backend && npm test

# Contracts
cd contracts && forge test
```

## License

MIT
