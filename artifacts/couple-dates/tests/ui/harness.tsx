import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation } from 'wouter';
import { CoupleContext } from '@/lib/couple-context';
import { AppShell } from '@/components/shell';
import { HomePage, DatesPage, MemoriesPage, RecapPage, AssistantPage, StreaksPage } from '@/lib/lazy-pages';
import { couple } from './records';
import AtHomeDateIdeasPage from '@/pages/at-home-date-ideas';
import CouplesJournalPage from '@/pages/couples-journal';
import { updateRouteMetadata } from '@/lib/route-metadata';
import './harness.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function UIHarness() {
  const [location] = useLocation();
  useEffect(() => {
    updateRouteMetadata(location, import.meta.env.BASE_URL);
  }, [location]);

  if (location === '/at-home-date-ideas') return <AtHomeDateIdeasPage />;
  if (location === '/couples-journal') return <CouplesJournalPage />;

  return (
    <CoupleContext.Provider value={couple}>
      <AppShell>
        <Switch>
          <Route path="/dates" component={DatesPage} />
          <Route path="/memories" component={MemoriesPage} />
          <Route path="/recap" component={RecapPage} />
          <Route path="/assistant" component={AssistantPage} />
          <Route path="/streaks" component={StreaksPage} />
          <Route component={HomePage} />
        </Switch>
      </AppShell>
    </CoupleContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <UIHarness />
  </QueryClientProvider>,
);
