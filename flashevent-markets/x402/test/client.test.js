const { ethers } = require('ethers');
const X402Client = require('../src/client');

// Mock axios for testing
jest.mock('axios');
const axios = require('axios');

describe('X402Client', () => {
  const testConfig = {
    network: 'monad-testnet',
    chainId: 10143,
    rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
    paymentRecipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5eE31',
    paymentTimeout: 300,
  };

  let client;
  let testWallet;

  beforeEach(() => {
    client = new X402Client(testConfig);
    testWallet = ethers.Wallet.createRandom();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client.config.chainId).toBe(10143);
      expect(client.config.network).toBe('monad-testnet');
    });

    it('should apply default config', () => {
      const minimalClient = new X402Client({});
      expect(minimalClient.config.maxRetries).toBe(3);
      expect(minimalClient.config.useEIP712).toBe(true);
    });
  });

  describe('init', () => {
    it('should throw without private key', async () => {
      await expect(client.init()).rejects.toThrow('Private key required');
    });

    it('should throw with invalid private key', async () => {
      await expect(client.init('invalid')).rejects.toThrow();
    });
  });

  describe('initFromSigner', () => {
    it('should throw without signer', async () => {
      await expect(client.initFromSigner()).rejects.toThrow('Signer required');
    });
  });

  describe('paidRequest - success flow', () => {
    beforeEach(async () => {
      // Mock provider methods
      client.provider = {
        getBalance: jest.fn().mockResolvedValue(ethers.parseEther('10')),
        getNetwork: jest.fn().mockResolvedValue({ chainId: 10143 }),
      };
      client.wallet = testWallet;
    });

    it('should return response when no payment required', async () => {
      axios.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const response = await client.paidRequest('http://test.com/api');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should handle 402 and pay', async () => {
      // First request returns 402
      axios.mockResolvedValueOnce({
        status: 402,
        headers: {
          'x-402-price': '1000000000000000',
          'x-402-recipient': testConfig.paymentRecipient,
          'x-402-chain-id': '10143',
          'x-402-operation': 'TEST',
        },
        data: { error: 'Payment Required' },
      });

      // Second request with payment succeeds
      axios.mockResolvedValueOnce({
        status: 200,
        data: { success: true, paid: true },
      });

      const response = await client.paidRequest('http://test.com/api');
      expect(response.status).toBe(200);
      expect(axios).toHaveBeenCalledTimes(2);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      client.paidRequest = jest.fn().mockResolvedValue({ status: 200 });
    });

    it('get should call paidRequest with GET', async () => {
      await client.get('http://test.com');
      expect(client.paidRequest).toHaveBeenCalledWith('http://test.com', {
        method: 'GET',
        headers: {},
      });
    });

    it('post should call paidRequest with POST', async () => {
      await client.post('http://test.com', { data: 'test' });
      expect(client.paidRequest).toHaveBeenCalledWith('http://test.com', {
        method: 'POST',
        data: { data: 'test' },
        headers: {},
      });
    });

    it('put should call paidRequest with PUT', async () => {
      await client.put('http://test.com', { data: 'test' });
      expect(client.paidRequest).toHaveBeenCalledWith('http://test.com', {
        method: 'PUT',
        data: { data: 'test' },
        headers: {},
      });
    });

    it('delete should call paidRequest with DELETE', async () => {
      await client.delete('http://test.com');
      expect(client.paidRequest).toHaveBeenCalledWith('http://test.com', {
        method: 'DELETE',
        headers: {},
      });
    });
  });

  describe('getAddress', () => {
    it('should return null without wallet', async () => {
      const address = await client.getAddress();
      expect(address).toBeNull();
    });

    it('should return wallet address', async () => {
      client.wallet = testWallet;
      const address = await client.getAddress();
      expect(address).toBe(testWallet.address);
    });
  });

  describe('getBalance', () => {
    it('should return 0 without wallet', async () => {
      const balance = await client.getBalance();
      expect(balance).toBe(0n);
    });

    it('should return wallet balance', async () => {
      client.wallet = testWallet;
      client.provider = {
        getBalance: jest.fn().mockResolvedValue(ethers.parseEther('5')),
      };

      const balance = await client.getBalance();
      expect(balance).toBe(ethers.parseEther('5'));
    });
  });

  describe('hasSufficientBalance', () => {
    beforeEach(() => {
      client.wallet = testWallet;
      client.provider = {
        getBalance: jest.fn().mockResolvedValue(ethers.parseEther('5')),
      };
    });

    it('should return true when balance is sufficient', async () => {
      const result = await client.hasSufficientBalance(ethers.parseEther('1'));
      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient', async () => {
      const result = await client.hasSufficientBalance(ethers.parseEther('10'));
      expect(result).toBe(false);
    });
  });

  describe('X402Error', () => {
    it('should be exported and usable', () => {
      const error = new X402Client.X402Error('Test error', 'TEST_CODE', { detail: 'value' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details.detail).toBe('value');
      expect(error.name).toBe('X402Error');
    });
  });
});
