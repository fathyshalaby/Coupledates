import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { CoupleContext } from '@/lib/couple-context';
import { AppShell } from '@/components/shell';
import HomePage from '@/pages/home';
import DatesPage from '@/pages/dates';
import MemoriesPage from '@/pages/memories';
import { couple } from './records';
import './harness.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <CoupleContext.Provider value={couple}>
      <AppShell>
        <Switch>
          <Route path="/dates" component={DatesPage} />
          <Route path="/memories" component={MemoriesPage} />
          <Route component={HomePage} />
        </Switch>
      </AppShell>
    </CoupleContext.Provider>
  </QueryClientProvider>,
);
