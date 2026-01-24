# x402 Micropayments Protocol

A robust implementation of the x402 micropayments protocol for FlashEvent Markets.

## Overview

x402 enables instant micropayments without deposits by using HTTP headers to authorize and verify payments. When a client requests a paid endpoint, the server returns HTTP 402 Payment Required with pricing information. The client signs a payment authorization using their wallet and resends the request with the payment header.

## Features

- **EIP-712 Typed Data Signatures**: Secure, human-readable signing requests
- **Nonce-based Replay Protection**: Prevents double-spending of payment authorizations
- **Automatic Balance Verification**: Optional on-chain balance checks
- **Payment Receipts**: Track and verify all payments
- **Dynamic Pricing**: Support for variable pricing based on request parameters
- **Multiple Network Support**: Works with Monad, Ethereum, Base, and more

## Installation

```bash
cd x402
npm install
```

## Quick Start

### Server Setup (Express)

```javascript
const express = require('express');
const { createServerMiddleware, createServer } = require('@flashevent/x402');

const app = express();

// Option 1: Use middleware for all routes
const x402Middleware = createServerMiddleware({
  paymentRecipient: '0xYourAddress',
  chainId: 10143,
  network: 'monad-testnet',
});

// Option 2: Create server instance for more control
const x402Server = createServer({
  paymentRecipient: '0xYourAddress',
  chainId: 10143,
});

// Set prices for specific routes
x402Server.setPrice('/api/premium', '0.01'); // 0.01 ETH
x402Server.setPrice('/api/analytics/*', '0.005'); // 0.005 ETH for all analytics routes

// Use the paid decorator for individual routes
app.get('/api/data', x402Server.paid('0.001', async (req, res) => {
  // req.x402 contains payment info
  res.json({
    data: 'Premium data',
    receipt: req.x402.receipt,
  });
}));

app.listen(3000);
```

### Client Setup (Node.js)

```javascript
const { createClient } = require('@flashevent/x402');

const client = createClient({
  network: 'monad-testnet',
  chainId: 10143,
});

// Initialize with private key
await client.init(process.env.PRIVATE_KEY);

// Make paid request - handles 402 automatically
const response = await client.get('http://api.example.com/premium');
console.log(response.data);

// Or use pre-authorization for multiple requests
const paymentHeader = await client.preAuthorize(
  '1000000000000000', // amount in wei
  '0xRecipientAddress',
  'PREMIUM_ANALYTICS'
);
```

### Client Setup (Browser with MetaMask)

```javascript
const { createClient } = require('@flashevent/x402');
const { ethers } = require('ethers');

// Connect to MetaMask
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = createClient({
  network: 'monad-testnet',
});

// Initialize from signer
await client.initFromSigner(signer);

// Make paid requests
const response = await client.get('http://api.example.com/premium');
```

## Protocol Flow

```
Client                                Server
  |                                     |
  |  1. GET /api/premium                |
  |------------------------------------>|
  |                                     |
  |  2. 402 Payment Required            |
  |     X-402-Price: 10000000000000000  |
  |     X-402-Recipient: 0x...          |
  |     X-402-Chain-ID: 10143           |
  |<------------------------------------|
  |                                     |
  |  3. Sign payment with wallet        |
  |                                     |
  |  4. GET /api/premium                |
  |     X-402-Payment: <signed header>  |
  |------------------------------------>|
  |                                     |
  |  5. Verify signature & nonce        |
  |                                     |
  |  6. 200 OK + data                   |
  |     X-402-Receipt: <receipt-id>     |
  |<------------------------------------|
```

## API Reference

### Client

#### `createClient(config)`

Creates a new x402 client.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| network | string | 'monad-testnet' | Network name |
| chainId | number | 10143 | Chain ID |
| rpcUrl | string | auto | RPC endpoint URL |
| paymentTimeout | number | 300 | Payment validity in seconds |
| maxRetries | number | 3 | Max retry attempts |
| useEIP712 | boolean | true | Use EIP-712 signatures |

#### Client Methods

- `init(privateKey)` - Initialize with private key
- `initFromSigner(signer)` - Initialize with ethers.js signer
- `paidRequest(url, options)` - Make a request, handle 402 automatically
- `get(url, headers)` - GET request with payment
- `post(url, data, headers)` - POST request with payment
- `preAuthorize(amount, recipient, operation)` - Create payment header without sending
- `getBalance()` - Get wallet balance
- `getAddress()` - Get wallet address

### Server

#### `createServer(config)`

Creates a new x402 server instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| paymentRecipient | string | required | Address to receive payments |
| chainId | number | 10143 | Chain ID to accept |
| network | string | 'monad-testnet' | Network name |
| verifyBalance | boolean | true | Verify payer balance on-chain |
| nonceWindowMs | number | 300000 | Nonce validity window (ms) |

#### Server Methods

- `middleware()` - Returns Express middleware
- `paid(price, handler)` - Decorator for paid routes
- `setPrice(pattern, price)` - Set price for route pattern
- `setDynamicPrice(pattern, priceFn)` - Set dynamic pricing function
- `getReceipt(receiptId)` - Get payment receipt

## Pricing

Default operation prices:

| Operation | Price (ETH) |
|-----------|-------------|
| CREATE_MARKET | 0.01 |
| PLACE_BET | 0.001 |
| PREMIUM_ANALYTICS | 0.005 |
| PRIORITY_RESOLUTION | 0.02 |
| API_ACCESS | 0.0001 |

## Security Considerations

1. **Always verify the recipient address** - Never accept payments to wrong addresses
2. **Use nonce tracking** - Prevents replay attacks
3. **Verify chain ID** - Prevents cross-chain attacks
4. **Check deadlines** - Reject expired payment authorizations
5. **Use EIP-712 signatures** - More secure than legacy eth_sign
6. **Store nonces in Redis** - For production deployments with multiple servers

## Error Codes

| Code | Description |
|------|-------------|
| PAYMENT_REQUIRED | No payment header provided |
| INVALID_SIGNATURE | Signature verification failed |
| INSUFFICIENT_AMOUNT | Payment amount too low |
| INVALID_RECIPIENT | Wrong payment recipient |
| INVALID_CHAIN | Wrong chain ID |
| PAYMENT_EXPIRED | Payment deadline passed |
| NONCE_REUSED | Nonce already used (replay attack) |
| INSUFFICIENT_BALANCE | Payer doesn't have enough balance |

## Testing

```bash
npm test
```

## License

MIT
