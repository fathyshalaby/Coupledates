import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getGetCoupleQueryKey, useGetCouple } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageLoading } from '@/components/page-loader';
import { AppShell } from '@/components/shell';
import { ErrorState, TwoRings } from '@/components/bits';
import { CoupleContext } from '@/lib/couple-context';
import { updateRouteMetadata } from '@/lib/route-metadata';
import { clearIncomingSocialInspiration, hasIncomingSocialInspiration } from '@/lib/social-inspiration';
import ShareTargetPage from '@/pages/share-target';
import {
  NotFound, Landing, HowItWorksPage, LongDistancePage, PricingPage, CouplesJournalPage, AtHomeDateIdeasPage, Onboarding, HomePage, MemoriesPage, DatesPage,
  StreaksPage, RecapPage, SettingsPage, DateDetailPage, PreferencesPage,
  AssistantPage, CalendarPage, BillingPage, AccountRecoveryPage,
} from '@/lib/lazy-pages';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(12 76% 52%)',
    colorForeground: 'hsl(330 32% 15%)',
    colorMutedForeground: 'hsl(330 10% 38%)',
    colorDanger: 'hsl(352 70% 45%)',
    colorBackground: 'hsl(38 60% 98%)',
    colorInput: 'hsl(36 45% 95%)',
    colorInputForeground: 'hsl(330 32% 15%)',
    colorNeutral: 'hsl(330 20% 30%)',
    fontFamily: "'Outfit', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(38_60%_98%)] rounded-[32px] w-[420px] max-w-full overflow-hidden shadow-[0_30px_60px_-30px_hsl(330_40%_15%/.45)] border border-[hsl(30_24%_86%)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: "!font-['Fraunces'] !text-3xl !font-medium text-[hsl(330_32%_15%)]",
    headerSubtitle: 'text-[hsl(330_10%_38%)]',
    socialButtonsBlockButtonText: 'text-[hsl(330_32%_15%)] font-medium',
    formFieldLabel: 'text-[hsl(330_32%_15%)] font-medium',
    footerActionLink: 'text-[hsl(12_76%_46%)] font-semibold',
    footerActionText: 'text-[hsl(330_10%_38%)]',
    dividerText: 'text-[hsl(330_10%_38%)]',
    identityPreviewEditButton: 'text-[hsl(12_76%_46%)]',
    formFieldSuccessText: 'text-[hsl(170_40%_25%)]',
    alertText: 'text-[hsl(330_32%_15%)]',
    logoBox: 'justify-center',
    logoImage: 'h-12 w-12',
    socialButtonsBlockButton: 'rounded-full border-[hsl(30_24%_80%)] bg-[hsl(36_45%_95%)]',
    formButtonPrimary: 'rounded-full bg-[hsl(12_76%_52%)] text-[hsl(38_60%_98%)] h-11 shadow-none',
    formFieldInput: 'rounded-2xl h-11 bg-[hsl(36_45%_95%)] border-[hsl(30_24%_80%)]',
    footerAction: 'justify-center',
    dividerLine: 'bg-[hsl(30_24%_84%)]',
    alert: 'rounded-2xl bg-[hsl(352_70%_45%/.08)] border-0',
    otpCodeFieldInput: 'rounded-xl border-[hsl(30_24%_80%)]',
    formFieldRow: 'gap-3',
    main: 'gap-5',
  },
};

function AuthFrame({ children, line }: { children: ReactNode; line: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" data-testid="link-auth-home" className="flex flex-col items-center gap-2 text-center">
        <TwoRings size={64} />
        <p className="font-display text-2xl italic">{line}</p>
      </Link>
      {children}
    </div>
  );
}

function SignInPage() {
  return (
    <AuthFrame line="Welcome back to the two of you.">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthFrame>
  );
}

function SignUpPage() {
  return (
    <AuthFrame line="A quiet place for your everyday.">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthFrame>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
        if (prevUserIdRef.current) clearIncomingSocialInspiration();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  const destination = hasIncomingSocialInspiration() ? '/assistant' : '/home';
  return (
    <>
      <Show when="signed-in"><Redirect to={destination} /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function AccountRecoveryRoute() {
  return <>
    <Show when="signed-in"><AccountRecoveryPage /></Show>
    <Show when="signed-out"><Redirect to="/sign-in" /></Show>
  </>;
}

function CoupleGate({ page: Page }: { page: ComponentType }) {
  const { isSignedIn } = useAuth();
  const q = useGetCouple({ query: { queryKey: getGetCoupleQueryKey(), enabled: !!isSignedIn, refetchInterval: 30_000, refetchIntervalInBackground: false } });
  if (q.isLoading || (!q.data && !q.isError)) return <PageLoading />;
  if (q.isError) return <div className="mx-auto max-w-md px-5 pt-24"><ErrorState error={q.error} onRetry={() => q.refetch()} label="Your space" /></div>;
  const couple = q.data?.couple ?? null;
  if (!couple) return <Onboarding />;
  return (
    <CoupleContext.Provider value={couple}>
      <AppShell><Page /></AppShell>
    </CoupleContext.Provider>
  );
}

function protectedRoute(Page: ComponentType) {
  return function Protected() {
    return (
      <>
        <Show when="signed-in"><CoupleGate page={Page} /></Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </>
    );
  };
}

const HomeR = protectedRoute(HomePage);
const MemoriesR = protectedRoute(MemoriesPage);
const DatesR = protectedRoute(DatesPage);
const StreaksR = protectedRoute(StreaksPage);
const RecapR = protectedRoute(RecapPage);
const SettingsR = protectedRoute(SettingsPage);
const DateDetailR = protectedRoute(DateDetailPage);
const PreferencesR = protectedRoute(PreferencesPage);
const AssistantR = protectedRoute(AssistantPage);
const CalendarR = protectedRoute(CalendarPage);
const BillingR = protectedRoute(BillingPage);

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    updateRouteMetadata(location, basePath);
  }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Sign in', subtitle: 'Pick up where you two left off' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Then start a space, or join your partner' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/how-it-works" component={HowItWorksPage} />
              <Route path="/long-distance" component={LongDistancePage} />
              <Route path="/couples-journal" component={CouplesJournalPage} />
              <Route path="/at-home-date-ideas" component={AtHomeDateIdeasPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/share" component={ShareTargetPage} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/recover-space" component={AccountRecoveryRoute} />
              <Route path="/home" component={HomeR} />
              <Route path="/memories" component={MemoriesR} />
              <Route path="/dates" component={DatesR} />
              <Route path="/dates/:id" component={DateDetailR} />
              <Route path="/preferences" component={PreferencesR} />
              <Route path="/assistant" component={AssistantR} />
              <Route path="/calendar" component={CalendarR} />
              <Route path="/streaks" component={StreaksR} />
              <Route path="/recap" component={RecapR} />
              <Route path="/settings" component={SettingsR} />
              <Route path="/billing" component={BillingR} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
