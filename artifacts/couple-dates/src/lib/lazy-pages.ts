import { lazyPage } from '@/components/page-loader';

// Explicit imports let Vite emit independently loadable, base-path-aware chunks.
export const NotFound = lazyPage(() => import('@/pages/not-found'));
export const Landing = lazyPage(() => import('@/pages/landing'));
export const Onboarding = lazyPage(() => import('@/pages/onboarding'));
export const HomePage = lazyPage(() => import('@/pages/home'));
export const MemoriesPage = lazyPage(() => import('@/pages/memories'));
export const DatesPage = lazyPage(() => import('@/pages/dates'));
export const StreaksPage = lazyPage(() => import('@/pages/streaks'));
export const RecapPage = lazyPage(() => import('@/pages/recap'));
export const SettingsPage = lazyPage(() => import('@/pages/settings'));
export const DateDetailPage = lazyPage(() => import('@/pages/date-detail'));
export const PreferencesPage = lazyPage(() => import('@/pages/preferences'));
export const AssistantPage = lazyPage(() => import('@/pages/assistant'));
export const CalendarPage = lazyPage(() => import('@/pages/calendar'));
export const BillingPage = lazyPage(() => import('@/pages/billing'));
