const { ethers } = require('ethers');
const {
  createPaymentHeader,
  decodePaymentHeader,
  verifyPaymentHeader,
  generateNonce,
  calculateDeadline,
  isPaymentExpired,
  createTypedData,
  encodePaymentData,
  validatePayment,
  formatPrice,
  parsePrice,
} = require('../src/utils');

describe('x402 Utils', () => {
  // Test wallet for signing
  const testWallet = ethers.Wallet.createRandom();
  // Use randomly generated valid address
  const testRecipient = ethers.Wallet.createRandom().address;
  const testChainId = 10143;

  describe('generateNonce', () => {
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toEqual(nonce2);
    });

    it('should generate string nonces', () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(10);
    });
  });

  describe('calculateDeadline', () => {
    it('should calculate future deadline', () => {
      const deadline = calculateDeadline(300);
      const now = Math.floor(Date.now() / 1000);
      
      expect(deadline).toBeGreaterThan(now);
      expect(deadline).toBeLessThanOrEqual(now + 305); // Allow 5s buffer
    });

    it('should use default validity', () => {
      const deadline = calculateDeadline();
      const now = Math.floor(Date.now() / 1000);
      
      expect(deadline).toBeGreaterThan(now);
      expect(deadline).toBeLessThanOrEqual(now + 305);
    });
  });

  describe('isPaymentExpired', () => {
    it('should detect expired payment', () => {
      const payment = {
        deadline: Math.floor(Date.now() / 1000) - 100,
      };
      
      expect(isPaymentExpired(payment)).toBe(true);
    });

    it('should detect valid payment', () => {
      const payment = {
        deadline: Math.floor(Date.now() / 1000) + 100,
      };
      
      expect(isPaymentExpired(payment)).toBe(false);
    });
  });

  describe('createPaymentHeader / decodePaymentHeader', () => {
    it('should create and decode payment header', () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: generateNonce(),
        operation: 'TEST',
      };
      
      const header = createPaymentHeader(payment, '0x1234567890abcdef');
      expect(typeof header).toBe('string');
      
      const decoded = decodePaymentHeader(header);
      expect(decoded.payer).toBe(payment.payer);
      expect(decoded.recipient).toBe(payment.recipient);
      expect(decoded.amount).toBe(payment.amount);
      expect(decoded.chainId).toBe(payment.chainId);
      expect(decoded.operation).toBe(payment.operation);
    });

    it('should throw on invalid header', () => {
      expect(() => decodePaymentHeader('invalid')).toThrow();
      expect(() => decodePaymentHeader('')).toThrow();
      expect(() => decodePaymentHeader(null)).toThrow();
    });
  });

  describe('verifyPaymentHeader', () => {
    it('should reject missing signature', () => {
      // Test that verifyPaymentHeader handles missing signature correctly
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: generateNonce(),
        operation: 'TEST',
      };

      // Create header with proper signature but test verify result
      const header = createPaymentHeader(payment, '0xinvalidsignature');
      const result = verifyPaymentHeader(header);
      
      // Should return valid: false due to invalid signature
      expect(result.valid).toBe(false);
    });

    it('should verify valid EIP-712 signature', async () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: Date.now().toString(),
        operation: 'TEST',
      };

      // Create EIP-712 signature
      const typedData = createTypedData(payment, testChainId);
      const signature = await testWallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      
      const header = createPaymentHeader(payment, signature);
      const result = verifyPaymentHeader(header);
      
      expect(result.valid).toBe(true);
      expect(result.method).toBe('EIP-712');
    });
  });

  describe('validatePayment', () => {
    it('should validate correct payment', () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: generateNonce(),
      };
      
      expect(() => validatePayment(payment)).not.toThrow();
    });

    it('should reject invalid payer address', () => {
      const payment = {
        payer: 'invalid',
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: generateNonce(),
      };
      
      expect(() => validatePayment(payment)).toThrow('Invalid payer address');
    });

    it('should reject zero amount', () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '0',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: generateNonce(),
      };
      
      expect(() => validatePayment(payment)).toThrow('Amount must be greater than 0');
    });

    it('should reject expired deadline', () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: Math.floor(Date.now() / 1000) - 100,
        nonce: generateNonce(),
      };
      
      expect(() => validatePayment(payment)).toThrow('Deadline must be in the future');
    });
  });

  describe('formatPrice / parsePrice', () => {
    it('should format wei to ether', () => {
      const wei = '1000000000000000000';
      const eth = formatPrice(wei);
      expect(eth).toBe('1.0');
    });

    it('should parse ether to wei', () => {
      const eth = '1.5';
      const wei = parsePrice(eth);
      expect(wei.toString()).toBe('1500000000000000000');
    });

    it('should handle small amounts', () => {
      const wei = '100000000000000'; // 0.0001 ETH
      const eth = formatPrice(wei);
      expect(eth).toBe('0.0001');
    });
  });

  describe('createTypedData', () => {
    it('should create valid EIP-712 typed data', () => {
      const payment = {
        payer: testWallet.address,
        recipient: testRecipient,
        amount: '1000000000000000',
        chainId: testChainId,
        deadline: calculateDeadline(),
        nonce: '12345',
        operation: 'TEST',
      };

      const typedData = createTypedData(payment, testChainId);
      
      expect(typedData.domain).toBeDefined();
      expect(typedData.types).toBeDefined();
      expect(typedData.message).toBeDefined();
      expect(typedData.primaryType).toBe('Payment');
      expect(typedData.domain.chainId).toBe(testChainId);
    });
  });
});
