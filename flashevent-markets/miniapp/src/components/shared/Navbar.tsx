'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Markets', icon: '📊' },
  { href: '/create', label: 'Create', icon: '➕' },
  { href: '/profile', label: 'Profile', icon: '👤' },
  { href: '/leaderboard', label: 'Ranks', icon: '🏆' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 safe-area-bottom">
      <div className="max-w-lg mx-auto px-2">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                  isActive 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Top header for app
export function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 safe-area-top">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-lg text-white">
            {title || 'FlashEvent'}
          </span>
        </div>
        
        {/* Wallet button will be added here */}
      </div>
    </header>
  );
}
