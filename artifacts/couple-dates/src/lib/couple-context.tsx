import { createContext, useContext } from 'react';
import type { Couple } from '@workspace/api-client-react';

export const CoupleContext = createContext<Couple | null>(null);

export function useCouple(): Couple {
  const c = useContext(CoupleContext);
  if (!c) throw new Error('useCouple must be used inside a couple space');
  return c;
}
