import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Couple } from '@workspace/api-client-react';
import { CoupleContext } from '@/lib/couple-context';
import { AppShell } from '@/components/shell';
import { HomePage, DatesPage, MemoriesPage, RecapPage } from '@/lib/lazy-pages';
import './harness.css';

const demoCouple: Couple = {
  id: 730001,
  yourName: 'Noor',
  partnerName: 'Teo',
  anniversary: '2025-02-17',
  timezone: 'Europe/Vienna',
  inviteCode: 'EXAMPLE-ONLY',
  memberCount: 2,
};

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const pages = {
  home: HomePage,
  dates: DatesPage,
  memories: MemoriesPage,
  recap: RecapPage,
} as const;
const screen = new URLSearchParams(window.location.search).get('screen') as keyof typeof pages | null;
const Page = screen && pages[screen] ? pages[screen] : HomePage;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <CoupleContext.Provider value={demoCouple}>
      <AppShell>
        <Page />
      </AppShell>
    </CoupleContext.Provider>
  </QueryClientProvider>,
);
