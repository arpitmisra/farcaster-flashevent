'use client';

import { cn } from '@/lib/utils';
import { getLevelFromXP, LEVELS } from '@/types/index';

interface LevelProgressProps {
  xp: number;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelProgress({ xp, showDetails = false, size = 'md' }: LevelProgressProps) {
  const levelInfo = getLevelFromXP(xp);
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="space-y-2">
      {/* Level Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-lg',
            size === 'lg' && 'text-2xl'
          )}>
            {levelInfo.icon}
          </span>
          <span className={cn(
            'font-medium text-white',
            size === 'sm' && 'text-sm',
            size === 'lg' && 'text-lg'
          )}>
            Level {levelInfo.level} {levelInfo.name}
          </span>
        </div>
        <span className={cn(
          'text-gray-400',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm'
        )}>
          {xp} / {levelInfo.nextLevelXp === Infinity ? '∞' : levelInfo.nextLevelXp} XP
        </span>
      </div>

      {/* Progress Bar */}
      <div className={cn('w-full rounded-full bg-gray-800 overflow-hidden', heights[size])}>
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
          style={{ width: `${levelInfo.progress}%` }}
        />
      </div>

      {/* Level Perks */}
      {showDetails && levelInfo.level < 5 && (
        <div className="mt-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <p className="text-xs text-gray-400 mb-2">Next level unlocks:</p>
          <ul className="space-y-1">
            {LEVELS[levelInfo.level]?.perks.map((perk, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-center gap-2">
                <span className="text-purple-400">✓</span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Compact level badge
export function LevelBadge({ level, icon, name }: { level: number; icon: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800 border border-gray-700">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-medium text-gray-300">Lv.{level}</span>
    </div>
  );
}

// XP gain notification
export function XPGain({ amount, reason }: { amount: number; reason?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 animate-bounce-in">
      <span className="text-lg">✨</span>
      <span className="text-purple-400 font-bold">+{amount} XP</span>
      {reason && <span className="text-gray-400 text-sm">({reason})</span>}
    </div>
  );
}
