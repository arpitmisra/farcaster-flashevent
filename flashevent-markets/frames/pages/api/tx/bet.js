import { parseEther, encodeFunctionData } from 'viem';
import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

// Market ABI for placeYes/placeNo (Foundry deployed contracts)
const PLACE_YES_ABI = [
  {
    name: 'placeYes',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
];

const PLACE_NO_ABI = [
  {
    name: 'placeNo',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { market: marketId, position } = req.query;
    const { untrustedData } = req.body;
    
    // Get input text (bet amount)
    const inputText = untrustedData?.inputText || '0.01';
    const amount = parseFloat(inputText);
    
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Fetch market to get contract address
    const { data: marketData } = await axios.get(`${API_BASE_URL}/markets/${marketId}`);
    
    const marketAddress = marketData.contractAddress || marketData.address;
    if (!marketAddress) {
      return res.status(400).json({ error: 'Market contract not found' });
    }

    const isYes = position === 'YES';
    
    // Encode function call based on position
    const data = encodeFunctionData({
      abi: isYes ? PLACE_YES_ABI : PLACE_NO_ABI,
      functionName: isYes ? 'placeYes' : 'placeNo',
      args: [],
    });

    // Return transaction data for Farcaster frame
    const txData = {
      chainId: 'eip155:10143', // Monad Testnet
      method: 'eth_sendTransaction',
      params: {
        to: marketAddress,
        data,
        value: parseEther(amount.toString()).toString(16),
      },
    };

    return res.status(200).json(txData);
  } catch (error) {
    console.error('Transaction error:', error);
    return res.status(500).json({ error: 'Failed to create transaction' });
  }
}
