import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { BookHeart, CalendarHeart, Flame, House, Settings2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/home', label: 'Us', icon: House },
  { href: '/memories', label: 'Memories', icon: BookHeart },
  { href: '/dates', label: 'Dates', icon: CalendarHeart },
  { href: '/streaks', label: 'Streak', icon: Flame },
  { href: '/recap', label: 'Recap', icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto flex max-w-xl items-center justify-between px-5 pt-5">
        <Link href="/home" data-testid="link-logo" className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-8 w-8" />
          <span className="font-display text-lg italic">Couple Dates</span>
        </Link>
        <Link href="/settings" data-testid="link-settings" aria-label="Settings" className={cn('grid h-10 w-10 place-items-center rounded-full border border-foreground/10 bg-card/70 transition active:scale-90', loc === '/settings' && 'bg-foreground text-background')}>
          <Settings2 className="h-[18px] w-[18px]" />
        </Link>
      </div>
      <main className="pb-nav mx-auto max-w-xl px-5 pt-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-[28px] bg-foreground px-2 py-2 text-background shadow-[0_18px_40px_-16px_hsl(330_40%_15%/.6)]">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = loc === href;
            return (
              <Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`} className="relative flex flex-1 flex-col items-center gap-0.5 rounded-[22px] py-2 text-[10px] font-medium tracking-wide">
                {active && <motion.span layoutId="navpill" className="absolute inset-0 rounded-[22px] bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <Icon className={cn('relative h-5 w-5 transition-transform', active && 'scale-110')} strokeWidth={active ? 2.2 : 1.7} />
                <span className={cn('relative', !active && 'opacity-60')}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
