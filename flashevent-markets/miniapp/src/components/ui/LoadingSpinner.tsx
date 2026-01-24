'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('relative', sizeClasses[size])}>
        <div className="absolute inset-0 rounded-full border-2 border-gray-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
      </div>
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
}

// Full page loading state
export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-4">
        <div className="text-5xl animate-pulse">⚡</div>
        <LoadingSpinner size="lg" />
        <p className="text-gray-400">{text}</p>
      </div>
    </div>
  );
}

// Skeleton loader for content
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-800',
        className
      )}
    />
  );
}

// Market card skeleton
export function MarketCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
