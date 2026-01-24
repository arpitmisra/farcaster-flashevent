const { ethers } = require('ethers');
const X402Server = require('../src/server');
const { createPaymentHeader, createTypedData, generateNonce, calculateDeadline } = require('../src/utils');

describe('X402Server', () => {
  // Use checksum-valid address
  const testRecipient = ethers.Wallet.createRandom().address;
  const testConfig = {
    paymentRecipient: testRecipient,
    chainId: 10143,
    network: 'monad-testnet',
    rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
    verifyBalance: false, // Disable for testing
  };

  let server;
  let testWallet;

  beforeEach(() => {
    server = new X402Server(testConfig);
    testWallet = ethers.Wallet.createRandom();
  });

  afterEach(() => {
    server.destroy();
  });

  describe('constructor', () => {
    it('should throw without payment recipient', () => {
      expect(() => new X402Server({})).toThrow('paymentRecipient is required');
    });

    it('should create server with config', () => {
      expect(server.config.chainId).toBe(10143);
      expect(server.config.paymentRecipient).toBe(testRecipient);
    });
  });

  describe('middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = {
        path: '/test',
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should call next for free routes', async () => {
      const middleware = server.middleware();
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 402 for paid routes without payment', async () => {
      // Set a price for the route
      server.setPrice('/test', ethers.parseEther('0.01'));
      
      const middleware = server.middleware();
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('paid decorator', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let handler;

    beforeEach(() => {
      mockReq = {
        path: '/test',
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      handler = jest.fn();
    });

    it('should return 402 without payment', async () => {
      const paidHandler = server.paid('0.01', handler);
      await paidHandler(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should accept payment as string (ETH)', async () => {
      const paidHandler = server.paid('0.01', handler);
      expect(paidHandler).toBeDefined();
    });

    it('should accept payment as BigInt (wei)', async () => {
      const paidHandler = server.paid(ethers.parseEther('0.01'), handler);
      expect(paidHandler).toBeDefined();
    });
  });

  describe('setPrice', () => {
    it('should set price for route', () => {
      server.setPrice('/api/test', ethers.parseEther('0.01'));
      expect(server.pricingRules.has('/api/test')).toBe(true);
    });

    it('should accept string price', () => {
      server.setPrice('/api/test', '0.01');
      const price = server.pricingRules.get('/api/test');
      expect(price).toBe(ethers.parseEther('0.01'));
    });
  });

  describe('setDynamicPrice', () => {
    it('should set dynamic pricing function', () => {
      const priceFn = (req) => ethers.parseEther('0.01');
      server.setDynamicPrice('/api/test', priceFn);
      expect(server.pricingRules.get('/api/test')).toBe(priceFn);
    });
  });

  describe('_matchPattern', () => {
    it('should match exact path', () => {
      expect(server._matchPattern('/api/test', '/api/test')).toBe(true);
      expect(server._matchPattern('/api/test', '/api/other')).toBe(false);
    });

    it('should match wildcard pattern', () => {
      expect(server._matchPattern('/api/users/123', '/api/users/*')).toBe(true);
      expect(server._matchPattern('/api/users', '/api/users/*')).toBe(false);
    });

    it('should match global wildcard', () => {
      expect(server._matchPattern('/any/path', '*')).toBe(true);
    });
  });

  describe('_verifyPayment', () => {
    it('should reject invalid signature', async () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: ethers.parseEther('0.01').toString(),
        chainId: 10143,
        deadline: calculateDeadline(),
        nonce: '12345',
        operation: 'TEST',
      };

      const header = createPaymentHeader(payment, '0xinvalid');

      await expect(server._verifyPayment(header, ethers.parseEther('0.01')))
        .rejects.toThrow();
    });

    it('should reject wrong recipient', async () => {
      const wrongRecipient = ethers.Wallet.createRandom().address;
      const payment = {
        payer: testWallet.address,
        recipient: wrongRecipient, // Wrong recipient
        amount: ethers.parseEther('0.01').toString(),
        chainId: 10143,
        deadline: calculateDeadline(),
        nonce: '12345',
        operation: 'TEST',
      };

      // Create valid signature with EIP-712
      const typedData = createTypedData(payment, 10143);
      const signature = await testWallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );

      const header = createPaymentHeader(payment, signature);

      await expect(server._verifyPayment(header, ethers.parseEther('0.01')))
        .rejects.toThrow('Invalid payment recipient');
    });

    it('should reject expired payment', async () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: ethers.parseEther('0.01').toString(),
        chainId: 10143,
        deadline: Math.floor(Date.now() / 1000) - 100, // Expired
        nonce: '12345',
        operation: 'TEST',
      };

      const typedData = createTypedData(payment, 10143);
      const signature = await testWallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );

      const header = createPaymentHeader(payment, signature);

      await expect(server._verifyPayment(header, ethers.parseEther('0.01')))
        .rejects.toThrow('Payment has expired');
    });

    it('should reject insufficient amount', async () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: ethers.parseEther('0.001').toString(), // Too little
        chainId: 10143,
        deadline: calculateDeadline(),
        nonce: '12345',
        operation: 'TEST',
      };

      const typedData = createTypedData(payment, 10143);
      const signature = await testWallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );

      const header = createPaymentHeader(payment, signature);

      await expect(server._verifyPayment(header, ethers.parseEther('0.01')))
        .rejects.toThrow('Insufficient payment');
    });

    it('should reject reused nonce', async () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: ethers.parseEther('0.01').toString(),
        chainId: 10143,
        deadline: calculateDeadline(),
        nonce: Date.now().toString(),
        operation: 'TEST',
      };

      const typedData = createTypedData(payment, 10143);
      const signature = await testWallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );

      const header = createPaymentHeader(payment, signature);

      // First verification should succeed
      await server._verifyPayment(header, ethers.parseEther('0.01'));

      // Second should fail (replay attack)
      await expect(server._verifyPayment(header, ethers.parseEther('0.01')))
        .rejects.toThrow('nonce already used');
    });
  });

  describe('X402ServerError', () => {
    it('should be exported and usable', () => {
      const error = new X402Server.X402ServerError('Test', 'CODE', { key: 'value' });
      expect(error.message).toBe('Test');
      expect(error.code).toBe('CODE');
      expect(error.details.key).toBe('value');
    });
  });
});
