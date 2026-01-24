'use client';

import { Achievement, ACHIEVEMENTS } from '@/types';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  achievementId: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  unlocked?: boolean;
}

export function AchievementBadge({ 
  achievementId, 
  size = 'md', 
  showName = false,
  unlocked = true 
}: AchievementBadgeProps) {
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  
  if (!achievement) return null;

  const sizes = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          sizes[size],
          unlocked 
            ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-purple-500'
            : 'bg-gray-800 border-2 border-gray-700 opacity-50'
        )}
      >
        <span className={cn(!unlocked && 'grayscale opacity-50')}>
          {achievement.icon}
        </span>
      </div>
      {showName && (
        <span className={cn(
          'text-xs text-center',
          unlocked ? 'text-gray-300' : 'text-gray-500'
        )}>
          {achievement.name}
        </span>
      )}
    </div>
  );
}

// Achievement unlock modal/notification
export function AchievementUnlock({ achievement }: { achievement: Achievement }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="animate-achievement-pop bg-gray-900 border-2 border-purple-500 rounded-2xl p-6 shadow-2xl shadow-purple-500/25 max-w-sm mx-4">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-bounce">
            {achievement.icon}
          </div>
          <div className="space-y-1">
            <p className="text-purple-400 font-medium text-sm">Achievement Unlocked!</p>
            <h3 className="text-2xl font-bold text-white">{achievement.name}</h3>
            <p className="text-gray-400 text-sm">{achievement.description}</p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
              +{achievement.xpReward} XP
            </div>
            {achievement.ethReward && (
              <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                +{achievement.ethReward} ETH
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Achievements grid
export function AchievementsGrid({ 
  unlockedIds, 
  category 
}: { 
  unlockedIds: string[]; 
  category?: Achievement['category'];
}) {
  const achievements = category 
    ? ACHIEVEMENTS.filter(a => a.category === category)
    : ACHIEVEMENTS;

  return (
    <div className="grid grid-cols-4 gap-3">
      {achievements.map((achievement) => (
        <AchievementBadge
          key={achievement.id}
          achievementId={achievement.id}
          unlocked={unlockedIds.includes(achievement.id)}
          showName
          size="md"
        />
      ))}
    </div>
  );
}
