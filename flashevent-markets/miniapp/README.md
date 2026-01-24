# FlashEvent Markets - Farcaster Mini App

A decentralized prediction market platform built as a Farcaster Mini App. Create markets, place bets on real-world events, and earn rewards.

## Features

- **Prediction Markets**: Create and participate in binary prediction markets
- **Farcaster Native**: Built with Farcaster Mini App SDK for seamless integration
- **Gamification**: XP system, achievements, levels, and leaderboards
- **Creator Rewards**: Earn 5% of the pool when your market gets 10+ bets
- **Real-time Updates**: Live odds and pool updates via WebSocket
- **Share to Farcaster**: Share markets and wins directly to your feed

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Blockchain**: Monad Testnet
- **Wallet**: Privy + Farcaster Mini App Connector
- **State**: Zustand + React Query
- **Styling**: Tailwind CSS
- **Smart Contracts**: Solidity (Foundry)

## Project Structure

```
miniapp/
├── public/
│   └── .well-known/
│       └── farcaster.json    # Farcaster manifest
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── frame/        # Farcaster frame endpoints
│   │   │   ├── og/           # OG image generation
│   │   │   └── webhook/      # Farcaster webhooks
│   │   ├── create/           # Create market page
│   │   ├── leaderboard/      # Leaderboard page
│   │   ├── market/[id]/      # Market detail page
│   │   ├── profile/          # User profile page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Home page
│   │   └── providers.tsx     # App providers
│   ├── components/
│   │   ├── gamification/     # XP, achievements, levels
│   │   ├── market/           # Market cards, betting interface
│   │   ├── shared/           # Navbar, common components
│   │   ├── ui/               # Base UI components
│   │   └── wallet/           # Wallet connection
│   ├── lib/
│   │   ├── api/              # API client
│   │   ├── contracts/        # ABIs, addresses, hooks
│   │   ├── store/            # Zustand stores
│   │   └── utils.ts          # Utility functions
│   └── types/
│       └── index.ts          # TypeScript types
├── .env.example
├── next.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Privy App ID (get from https://console.privy.io)

### Installation

```bash
cd miniapp
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_MONAD_RPC_URL=https://monad-testnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x4a0F0d703e061c5F4fD0C8DDafDcBd2d45D36007
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Preview in Farcaster

1. Use a tunneling service (ngrok or cloudflared):
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

2. Open the [Mini App Debug Tool](https://farcaster.xyz/~/developers/mini-apps/debug)

3. Enter your tunnel URL and click Preview

### Build for Production

```bash
npm run build
npm start
```

## Publishing to Farcaster

### 1. Update farcaster.json

Generate your account association at:
https://farcaster.xyz/~/developers/new

Update `public/.well-known/farcaster.json` with your signed account association.

### 2. Deploy to Vercel

```bash
vercel deploy --prod
```

### 3. Verify Domain

Your domain must exactly match the one in your account association.

### 4. Submit to App Store

Once verified, your Mini App will appear in Farcaster app stores.

## Tokenomics

| Action | Fee |
|--------|-----|
| Create Market | Free |
| Place Bet | Bet amount only |
| Platform Fee (on resolution) | 2.5% of pool |
| Creator Reward (if 10+ bets) | 5% of pool |
| Winner Pool | 92.5% (or 97.5% if <10 bets) |

### Creator Rewards

- Must have 10+ total bets to qualify
- Earn 5% of total pool
- One-sided markets: 5% platform fee, 95% refund

## Smart Contracts

- **MarketFactory**: Deploys new prediction markets
- **Market**: Individual prediction market with betting and claims

Deployed on Monad Testnet (Chain ID: 10143)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT
