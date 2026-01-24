'use client';

import { cn } from '@/lib/utils';

interface OddsBarProps {
  yesPercentage: number;
  noPercentage: number;
  yesPool?: string;
  noPool?: string;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export function OddsBar({
  yesPercentage,
  noPercentage,
  yesPool,
  noPool,
  animated = true,
  size = 'md',
  showLabels = true,
}: OddsBarProps) {
  const heights = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  return (
    <div className="w-full space-y-2">
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-medium">YES</span>
            <span className="text-green-400 font-bold">{yesPercentage.toFixed(1)}%</span>
            {yesPool && <span className="text-gray-500 text-xs">({yesPool} ETH)</span>}
          </div>
          <div className="flex items-center gap-2">
            {noPool && <span className="text-gray-500 text-xs">({noPool} ETH)</span>}
            <span className="text-red-400 font-bold">{noPercentage.toFixed(1)}%</span>
            <span className="text-red-400 font-medium">NO</span>
          </div>
        </div>
      )}
      
      {/* Bar */}
      <div className={cn('w-full rounded-full overflow-hidden flex', heights[size], 'bg-gray-800')}>
        {/* YES bar */}
        <div
          className={cn(
            'bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500',
            animated && 'animate-fill-bar'
          )}
          style={{ 
            width: `${yesPercentage}%`,
            '--fill-width': `${yesPercentage}%`,
          } as React.CSSProperties}
        />
        
        {/* NO bar */}
        <div
          className={cn(
            'bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-500',
            animated && 'animate-fill-bar'
          )}
          style={{ 
            width: `${noPercentage}%`,
            '--fill-width': `${noPercentage}%`,
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

// Compact odds display for cards
export function OddsDisplay({
  yesPercentage,
  noPercentage,
}: {
  yesPercentage: number;
  noPercentage: number;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-400 font-medium">{yesPercentage.toFixed(0)}%</span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden flex">
        <div 
          className="bg-green-500" 
          style={{ width: `${yesPercentage}%` }} 
        />
        <div 
          className="bg-red-500" 
          style={{ width: `${noPercentage}%` }} 
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-red-400 font-medium">{noPercentage.toFixed(0)}%</span>
        <div className="w-2 h-2 rounded-full bg-red-500" />
      </div>
    </div>
  );
}
