import { useState, type FormEvent, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/react';
import { ArrowRight, KeyRound, Sparkle } from 'lucide-react';
import { useJoinCouple, useSaveCouple } from '@workspace/api-client-react';
import { TwoRings } from '@/components/bits';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errMsg, useInvalidate } from '@/lib/data';
import { cn } from '@/lib/utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Onboarding() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const invalidate = useInvalidate();
  const { signOut } = useClerk();
  const save = useSaveCouple({ mutation: { onSuccess: () => invalidate(['couple', 'summary']) } });
  const join = useJoinCouple({ mutation: { onSuccess: () => invalidate(['couple', 'summary', 'memories', 'dates']) } });
  const [yourName, setYourName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [code, setCode] = useState('');

  const create = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ data: { yourName: yourName.trim(), partnerName: partnerName.trim(), anniversary, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } });
  };
  const doJoin = (e: FormEvent) => {
    e.preventDefault();
    join.mutate({ data: { code: code.trim() } });
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="rise flex items-center justify-between">
          <TwoRings size={52} />
          <button data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="text-sm text-muted-foreground underline underline-offset-4">Sign out</button>
        </div>
        <h1 className="rise font-display mt-8 text-[2.8rem] leading-[0.95]" style={{ animationDelay: '60ms' }}>Let's set up <em className="text-primary">your</em> space.</h1>
        <p className="rise mt-3 text-muted-foreground" style={{ animationDelay: '120ms' }}>Start a new one, or join the space your partner already made.</p>

        <div className="mt-8 grid grid-cols-2 rounded-full bg-foreground/[0.06] p-1">
          {(['create', 'join'] as const).map((m) => (
            <button key={m} data-testid={`tab-${m}`} onClick={() => setMode(m)} className="relative rounded-full py-2.5 text-sm font-medium">
              {mode === m && <motion.span layoutId="obtab" className="absolute inset-0 rounded-full bg-card shadow-sm" />}
              <span className="relative">{m === 'create' ? 'Create a space' : 'I have a code'}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'create' ? (
            <motion.form key="c" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={create} className="mt-6 space-y-4 rounded-[28px] bg-card p-6 shadow-[0_1px_0_hsl(var(--border))]">
              <Field label="Your name"><Input data-testid="input-your-name" required maxLength={60} value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="What they call you" className="h-12 rounded-2xl" /></Field>
              <Field label="Your partner's name"><Input data-testid="input-partner-name" required maxLength={60} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Their name" className="h-12 rounded-2xl" /></Field>
              <Field label="Your anniversary"><Input data-testid="input-anniversary" required type="date" value={anniversary} max="2100-12-31" onChange={(e) => setAnniversary(e.target.value)} className="h-12 rounded-2xl" /></Field>
              {save.isError && <p data-testid="text-create-error" className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{errMsg(save.error)}</p>}
              <Submit pending={save.isPending} testid="button-create-space"><Sparkle className="h-4 w-4" /> Create our space</Submit>
            </motion.form>
          ) : (
            <motion.form key="j" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={doJoin} className="mt-6 space-y-4 rounded-[28px] bg-card p-6 shadow-[0_1px_0_hsl(var(--border))]">
              <Field label="Invite code"><Input data-testid="input-invite-code" required minLength={8} maxLength={100} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code they sent you" className="h-12 rounded-2xl font-mono tracking-wider" /></Field>
              <p className="text-xs text-muted-foreground">Your partner finds this in Settings. A space holds two people, so a full one won't accept a third.</p>
              {join.isError && <p data-testid="text-join-error" className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{errMsg(join.error)}</p>}
              <Submit pending={join.isPending} testid="button-join-space"><KeyRound className="h-4 w-4" /> Join their space</Submit>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>;
}

function Submit({ pending, children, testid }: { pending: boolean; children: ReactNode; testid: string }) {
  return (
    <button data-testid={testid} disabled={pending} className={cn('flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition active:scale-[.98]', pending && 'opacity-60')}>
      {pending ? 'One moment...' : <>{children}<ArrowRight className="h-4 w-4" /></>}
    </button>
  );
}
