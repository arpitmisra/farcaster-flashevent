'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateMarket } from '@/lib/contracts/hooks';
import { useFarcaster } from '@/app/providers';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';
import { cn } from '@/lib/utils';

// Market types matching contract enum
const MARKET_TYPES = {
  PRICE_TOUCH: 0,
  ONCHAIN_EVENT: 1,
  API_COUNT: 2,
  SPORTS: 3,
};

const MARKET_TYPE_ICONS = {
  [MARKET_TYPES.PRICE_TOUCH]: '📈',
  [MARKET_TYPES.ONCHAIN_EVENT]: '⛓️',
  [MARKET_TYPES.API_COUNT]: '🔢',
  [MARKET_TYPES.SPORTS]: '⚽',
};

const MARKET_TYPE_LABELS = {
  [MARKET_TYPES.PRICE_TOUCH]: 'Price Touch',
  [MARKET_TYPES.ONCHAIN_EVENT]: 'On-Chain Event',
  [MARKET_TYPES.API_COUNT]: 'API Count',
  [MARKET_TYPES.SPORTS]: 'Sports',
};

const TEMPLATES = [
  {
    type: MARKET_TYPES.PRICE_TOUCH,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.PRICE_TOUCH],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.PRICE_TOUCH],
    description: '"Will [ASSET] touch [PRICE] in [TIME]?"',
    source: 'Chainlink',
  },
  {
    type: MARKET_TYPES.SPORTS,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.SPORTS],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.SPORTS],
    description: '"Will [TEAM] win against [OPPONENT]?"',
    source: 'Sports API',
  },
  {
    type: MARKET_TYPES.ONCHAIN_EVENT,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.ONCHAIN_EVENT],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.ONCHAIN_EVENT],
    description: '"Will [ADDRESS] do [ACTION] in [TIME]?"',
    source: 'Blockchain',
  },
  {
    type: MARKET_TYPES.API_COUNT,
    icon: MARKET_TYPE_ICONS[MARKET_TYPES.API_COUNT],
    label: MARKET_TYPE_LABELS[MARKET_TYPES.API_COUNT],
    description: '"Will [@USER] post [N] times in [TIME]?"',
    source: 'API + ZK',
  },
];

const SUPPORTED_ASSETS = [
  { symbol: 'ETH', icon: '⟠' },
  { symbol: 'BTC', icon: '₿' },
  { symbol: 'SOL', icon: '◎' },
  { symbol: 'MATIC', icon: '⬡' },
];

const MARKET_DURATIONS = [
  { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '7 days', value: 604800 },
];

const SPORTS_OPTIONS = [
  { id: 'soccer', icon: '⚽', label: 'Football' },
  { id: 'cricket', icon: '🏏', label: 'Cricket' },
  { id: 'basketball', icon: '🏀', label: 'NBA' },
  { id: 'american_football', icon: '🏈', label: 'NFL' },
  { id: 'tennis', icon: '🎾', label: 'Tennis' },
];

const BET_TYPES = [
  { id: 'win', label: '🏆 Team 1 Wins' },
  { id: 'draw', label: '🤝 Draw' },
  { id: 'over', label: '📊 Over/Under' },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { authenticated, user: privyUser } = usePrivy();
  const { isCorrectChain: wagmiIsCorrectChain, isSwitching, switchToMonad, targetChainName, chainId } = useChainSwitch();
  
  // Local state for actual chain verification
  const [actualChainId, setActualChainId] = useState<number | null>(null);
  
  // Poll for actual chain ID directly from wallet
  useEffect(() => {
    if (!isConnected) {
      setActualChainId(null);
      return;
    }

    const checkChain = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const id = parseInt(chainIdHex, 16);
          setActualChainId(id);
        } catch (e) {
          console.error('Failed to get chain:', e);
        }
      }
    };

    // Check immediately
    checkChain();
    
    // Poll every second
    const interval = setInterval(checkChain, 1000);
    
    // Listen for chain changes
    const handleChainChanged = () => {
      checkChain();
    };
    
    if (typeof window !== 'undefined' && window.ethereum?.on) {
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined' && window.ethereum?.removeListener) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected]);

  // Use ACTUAL chain check, not wagmi cache
  const isCorrectChain = actualChainId === 10143;
  
  // For UI purposes: user is logged in via either method
  const isUserLoggedIn = isConnected || authenticated;
  
  // For transactions: MUST have wagmi connected (MetaMask directly) AND on correct chain
  const canTransact = isConnected && !!address;
  const canCreateMarket = canTransact && isCorrectChain;
  
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [preview, setPreview] = useState('');
  const [autoCast, setAutoCast] = useState(true);
  
  const { createMarket, isPending, isConfirming, isSuccess, hash, error } = useCreateMarket();

  // Handle successful creation
  useEffect(() => {
    if (isSuccess && hash) {
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  }, [isSuccess, hash, router]);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setFormData({});
    setPreview('');
  };

  const updateFormData = (key: string, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    generatePreview(selectedTemplate?.type, newData);
  };

  const generatePreview = (type: number, data: any) => {
    switch (type) {
      case MARKET_TYPES.PRICE_TOUCH:
        if (data.asset && data.price && data.duration) {
          setPreview(
            `Will ${data.asset} touch $${data.price} in the next ${data.duration}?`
          );
        }
        break;
      case MARKET_TYPES.ONCHAIN_EVENT:
        if (data.address && data.action && data.duration) {
          setPreview(
            `Will ${data.address.slice(0, 8)}... ${data.action} in the next ${data.duration}?`
          );
        }
        break;
      case MARKET_TYPES.SPORTS:
        if (data.team1 && data.team2 && data.sport && data.matchDate) {
          const betType = data.betType || 'win';
          if (betType === 'win') {
            setPreview(
              `[SPORTS:${data.sport.toUpperCase()}] Will ${data.team1} beat ${data.team2}?`
            );
          } else if (betType === 'draw') {
            setPreview(
              `[SPORTS:${data.sport.toUpperCase()}] Will ${data.team1} vs ${data.team2} end in a draw?`
            );
          } else if (betType === 'over') {
            setPreview(
              `[SPORTS:${data.sport.toUpperCase()}] Will ${data.team1} vs ${data.team2} total score be over ${data.totalGoals || '2.5'}?`
            );
          }
        }
        break;
      case MARKET_TYPES.API_COUNT:
        if (data.username && data.count && data.duration) {
          setPreview(
            `Will @${data.username} tweet ${data.count} times in the next ${data.duration}?`
          );
        }
        break;
      default:
        setPreview('');
    }
  };

  // Direct check of actual chain from MetaMask
  const checkActualChain = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }
    try {
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const actualChainId = parseInt(chainIdHex, 16);
      console.log('Actual chain ID from wallet:', actualChainId, 'Expected:', 10143);
      return actualChainId === 10143;
    } catch (e) {
      console.error('Failed to check chain:', e);
      return false;
    }
  };

  // Handle chain switch separately
  const handleSwitchChain = async () => {
    console.log('Manual chain switch triggered');
    const success = await switchToMonad();
    if (success) {
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Verify the switch worked
      const onCorrectChain = await checkActualChain();
      if (!onCorrectChain) {
        alert('Chain switch may have failed. Please manually switch to Monad Testnet in your wallet.');
      }
      // Force page refresh to update all state
      window.location.reload();
    }
  };

  const handleContinue = async () => {
    if (!preview) return;
    
    // ALWAYS check actual chain from wallet, not wagmi state
    const actuallyOnCorrectChain = await checkActualChain();
    
    if (!actuallyOnCorrectChain) {
      console.log('Wrong chain detected (actual check), forcing switch...');
      
      // Force the switch
      const switched = await switchToMonad();
      if (!switched) {
        alert('Please switch to Monad Testnet to create a market.\n\nClick the "Switch to Monad Testnet" button or manually switch in your wallet.');
        return;
      }
      
      // Wait for chain switch to complete
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Verify switch worked
      const verifyChain = await checkActualChain();
      if (!verifyChain) {
        alert('Still on wrong network. Please manually switch to Monad Testnet (Chain ID: 10143) in your wallet and try again.');
        window.location.reload();
        return;
      }
    }
    
    console.log('Chain verified, proceeding with market creation...');
    
    // Calculate duration in seconds
    const durationLabel = formData.duration;
    const durationObj = MARKET_DURATIONS.find(d => d.label === durationLabel);
    const durationSeconds = durationObj?.value || 86400; // Default 24h
    
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + durationSeconds;
    const bettingDeadline = expiry - 900; // 15 min before expiry
    
    try {
      await createMarket(preview, expiry, bettingDeadline);
    } catch (err) {
      console.error('Failed to create market:', err);
    }
  };

  const renderTemplateForm = () => {
    if (!selectedTemplate) return null;

    switch (selectedTemplate.type) {
      case MARKET_TYPES.PRICE_TOUCH:
        return (
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-400 uppercase">PRICE_TOUCH PARAMETERS</p>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Asset</label>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_ASSETS.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => updateFormData('asset', asset.symbol)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
                      formData.asset === asset.symbol
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <span className="text-lg">{asset.icon}</span>
                    <span className={cn(
                      'font-medium',
                      formData.asset === asset.symbol ? 'text-purple-400' : 'text-gray-400'
                    )}>{asset.symbol}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Target Price ($)"
              placeholder="3500.00"
              type="number"
              value={formData.price || ''}
              onChange={(e) => updateFormData('price', e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {MARKET_DURATIONS.map((dur) => (
                  <button
                    key={dur.value}
                    onClick={() => updateFormData('duration', dur.label)}
                    className={cn(
                      'px-4 py-2 rounded-lg border transition-all',
                      formData.duration === dur.label
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    )}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case MARKET_TYPES.ONCHAIN_EVENT:
        return (
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-400 uppercase">ONCHAIN_EVENT PARAMETERS</p>
            
            <Input
              label="Target Address"
              placeholder="0x..."
              value={formData.address || ''}
              onChange={(e) => updateFormData('address', e.target.value)}
            />

            <Input
              label="Action"
              placeholder="make a transaction"
              value={formData.action || ''}
              onChange={(e) => updateFormData('action', e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {MARKET_DURATIONS.map((dur) => (
                  <button
                    key={dur.value}
                    onClick={() => updateFormData('duration', dur.label)}
                    className={cn(
                      'px-4 py-2 rounded-lg border transition-all',
                      formData.duration === dur.label
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    )}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case MARKET_TYPES.SPORTS:
        return (
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-400 uppercase">⚽ SPORTS MARKET PARAMETERS</p>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sport</label>
              <div className="grid grid-cols-2 gap-2">
                {SPORTS_OPTIONS.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => updateFormData('sport', sport.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
                      formData.sport === sport.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <span className="text-lg">{sport.icon}</span>
                    <span className={cn(
                      'font-medium',
                      formData.sport === sport.id ? 'text-purple-400' : 'text-gray-400'
                    )}>{sport.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Team 1 (Your pick to win)"
              placeholder="e.g., Manchester United, India, Lakers"
              value={formData.team1 || ''}
              onChange={(e) => updateFormData('team1', e.target.value)}
            />

            <Input
              label="Team 2 (Opponent)"
              placeholder="e.g., Liverpool, Australia, Celtics"
              value={formData.team2 || ''}
              onChange={(e) => updateFormData('team2', e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Bet Type</label>
              <div className="grid grid-cols-2 gap-2">
                {BET_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => updateFormData('betType', type.id)}
                    className={cn(
                      'px-4 py-2 rounded-lg border transition-all text-sm',
                      formData.betType === type.id
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {formData.betType === 'over' && (
              <Input
                label="Total Goals/Points Line"
                placeholder="2.5"
                type="number"
                step="0.5"
                value={formData.totalGoals || ''}
                onChange={(e) => updateFormData('totalGoals', e.target.value)}
              />
            )}

            <Input
              label="Match Date & Time"
              placeholder="e.g., 2026-01-25 20:00"
              value={formData.matchDate || ''}
              onChange={(e) => updateFormData('matchDate', e.target.value)}
            />

            <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <span className="text-xl">🏟️</span>
              <p className="text-xs text-purple-400">
                This market will auto-resolve based on official match results from sports APIs (TheSportsDB, ESPN).
              </p>
            </div>
          </div>
        );

      case MARKET_TYPES.API_COUNT:
        return (
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-400 uppercase">API_COUNT PARAMETERS</p>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Twitter Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                <input
                  type="text"
                  placeholder="elonmusk"
                  value={formData.username || ''}
                  onChange={(e) => updateFormData('username', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <Input
              label="Minimum Tweets"
              placeholder="1"
              type="number"
              value={formData.count || ''}
              onChange={(e) => updateFormData('count', e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {MARKET_DURATIONS.map((dur) => (
                  <button
                    key={dur.value}
                    onClick={() => updateFormData('duration', dur.label)}
                    className={cn(
                      'px-4 py-2 rounded-lg border transition-all',
                      formData.duration === dur.label
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    )}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <span className="text-xl">🔒</span>
              <p className="text-xs text-purple-400">
                This market will be resolved using ZK proofs for trustless verification
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <button 
            onClick={() => router.back()}
            className="text-2xl">
            ←
          </button>
          <span className="text-xl font-bold text-white">Create Market</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Success State */}
        {isSuccess && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="text-6xl animate-bounce">🚀</div>
              <div>
                <h2 className="text-2xl font-bold text-white">Market Created!</h2>
                <p className="text-gray-400">Your prediction market is now live</p>
              </div>
              <div className="text-sm text-gray-400">
                Redirecting to markets...
              </div>
            </CardContent>
          </Card>
        )}

        {!isSuccess && (
          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <p className="text-sm font-medium text-gray-400 uppercase mb-4">SELECT TEMPLATE</p>
              
              <div className="space-y-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full text-left"
                  >
                    <Card className={cn(
                      'transition-all',
                      selectedTemplate?.type === template.type && 'border-purple-500 bg-purple-500/10'
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{template.icon}</span>
                            <span className="font-medium text-white">{template.label}</span>
                          </div>
                          {selectedTemplate?.type === template.type && (
                            <span className="text-purple-400 text-xl">✓</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-1">{template.description}</p>
                        <p className="text-xs text-gray-500">Source: {template.source}</p>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            {renderTemplateForm()}

            {/* Preview */}
            {preview && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-400 uppercase">📝 PREVIEW</p>
                <Card className="border-purple-500/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-lg font-medium text-white mb-2">"{preview}"</p>
                    <p className="text-xs text-purple-400">Source: {selectedTemplate?.source}</p>
                  </CardContent>
                </Card>

                {/* Auto-cast toggle */}
                <button
                  onClick={() => setAutoCast(!autoCast)}
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="text-white">Auto-cast to Farcaster</span>
                  <div className={cn(
                    'w-12 h-6 rounded-full transition-colors relative',
                    autoCast ? 'bg-purple-500' : 'bg-gray-700'
                  )}>
                    <div className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                      autoCast ? 'left-7' : 'left-1'
                    )} />
                  </div>
                </button>

                <p className="text-sm text-gray-400 text-center">
                  Creation Fee: 0.001 MON
                </p>

                {/* Error Display */}
                {error && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error.message || 'Failed to create market'}
                  </div>
                )}

                {/* Show different buttons based on state */}
                
                {/* Step 1: Not connected */}
                {!canTransact && (
                  <div className="space-y-3">
                    <Button fullWidth size="lg" disabled>
                      Connect Wallet First
                    </Button>
                    <p className="text-center text-sm text-yellow-500">
                      ⚠️ Connect MetaMask to create a market (click Connect in header)
                    </p>
                  </div>
                )}
                
                {/* Step 2: Connected but wrong chain - MUST switch first */}
                {canTransact && !isCorrectChain && (
                  <div className="space-y-3">
                    <Button
                      fullWidth
                      size="lg"
                      onClick={handleSwitchChain}
                      isLoading={isSwitching}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {isSwitching ? 'Switching Network...' : `🔄 Switch to ${targetChainName}`}
                    </Button>
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                      <p className="text-center text-sm text-orange-400">
                        ⚠️ You are on <strong>Chain ID: {actualChainId}</strong> (wrong network).
                        <br />Click the button above to switch to {targetChainName} (Chain ID: 10143).
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Step 3: Connected and on correct chain - can create */}
                {canTransact && isCorrectChain && (
                  <div className="space-y-3">
                    <Button
                      fullWidth
                      size="lg"
                      onClick={handleContinue}
                      disabled={isPending || isConfirming}
                      isLoading={isPending || isConfirming}
                    >
                      {isPending 
                        ? 'Confirm in Wallet...' 
                        : isConfirming 
                          ? 'Creating Market...' 
                          : 'Continue →'
                      }
                    </Button>
                    <p className="text-center text-xs text-green-500">
                      ✓ Connected to {targetChainName} (Chain ID: {actualChainId})
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
