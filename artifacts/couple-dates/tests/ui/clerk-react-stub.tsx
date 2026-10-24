import type { ReactNode } from 'react';

export function ClerkProvider({ children }: { children?: ReactNode }) {
  return children;
}

export function Show({ when, children }: { when: string; children?: ReactNode }) {
  return when === 'signed-out' ? children : null;
}

export function SignIn() {
  return null;
}

export function SignUp() {
  return null;
}

export function useAuth() {
  return { isLoaded: true, isSignedIn: false, userId: null };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: false, user: null };
}

export function useClerk() {
  return {
    addListener: () => () => undefined,
    signOut: async () => undefined,
  };
}
