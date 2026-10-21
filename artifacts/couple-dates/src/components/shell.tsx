import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { BookHeart, CalendarHeart, House, Lightbulb, Settings2, Sparkles } from 'lucide-react';
import { useDatesQ } from '@/lib/data';
import { cn } from '@/lib/utils';
import { ReminderInbox } from '@/components/reminder-inbox';

const NAV = [
  { href: '/home', label: 'Us', icon: House },
  { href: '/assistant', label: 'Ideas', icon: Lightbulb },
  { href: '/dates', label: 'Dates', icon: CalendarHeart },
  { href: '/memories', label: 'Memories', icon: BookHeart },
  { href: '/recap', label: 'Recap', icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const dates = useDatesQ();
  const inbox = (dates.data ?? []).filter((d) => d.status === 'proposed' && d.canRespond).length;
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link href="/home" data-testid="link-logo" className="-ml-1 flex items-center gap-2 rounded-lg px-1 py-1">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-7 w-7" />
            <span className="font-display text-[17px] font-medium">Couple Dates</span>
          </Link>
          <Link href="/settings" data-testid="link-settings" aria-label="Settings" aria-current={loc === '/settings' ? 'page' : undefined} className={cn('grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground', loc === '/settings' && 'bg-secondary text-primary')}>
            <Settings2 className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </header>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:sticky lg:top-14 lg:bottom-auto lg:z-20 lg:border-t-0 lg:border-b lg:bg-background/95 lg:pb-0">
        <div className="mx-auto flex max-w-5xl items-stretch justify-between px-2 lg:justify-start lg:gap-2 lg:px-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = loc === href || loc.startsWith(`${href}/`) || (href === '/home' && loc === '/preferences');
            return (
              <Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`} aria-current={active ? 'page' : undefined}
                className={cn('relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors lg:min-h-12 lg:flex-none lg:flex-row lg:gap-2 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm', active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                {active && <motion.span layoutId="navpill" className="absolute inset-x-[22%] top-0 h-[2px] rounded-full bg-primary lg:inset-x-3 lg:top-auto lg:bottom-0" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative">
                  <Icon className="h-[22px] w-[22px] lg:h-4 lg:w-4" strokeWidth={active ? 2 : 1.6} />
                  {href === '/dates' && inbox > 0 && <span data-testid="badge-nav-inbox" aria-label={`${inbox} waiting for you`} className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-card bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tnum">{inbox}</span>}
                </span>
                <span className="max-w-full break-words px-0.5 text-center lg:whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="pb-nav mx-auto max-w-3xl px-5 pt-6 lg:pb-10"><ReminderInbox />{children}</main>
    </div>
  );
}
