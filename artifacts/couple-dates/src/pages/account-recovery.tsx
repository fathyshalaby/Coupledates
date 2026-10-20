import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import {
  useCheckAccountRecovery,
  useConfirmAccountRecovery,
  useGetAccountRecovery,
  useIssueAccountRecovery,
  useSelectAccountSpace,
} from '@workspace/api-client-react';
import { Label } from '@/components/ui/label';
import { TwoRings } from '@/components/bits';
import { errMsg } from '@/lib/data';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const card = 'mt-6 space-y-4 rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]';
const primaryBtn = 'flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-40';
const errBox = 'rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive';

function useLeave() {
  const qc = useQueryClient();
  return () => { qc.clear(); window.location.replace(`${basePath}/home`); };
}

export default function AccountRecoveryPage() {
  const status = useGetAccountRecovery();
  const s = status.data;

  return (
    <div className="min-h-[100dvh] px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <TwoRings size={44} />
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/settings" data-testid="link-recovery-settings" className="underline underline-offset-4">Settings</Link>
            <Link href="/home" data-testid="link-recovery-home" className="underline underline-offset-4">Home</Link>
          </div>
        </div>
        <p className="eyebrow mt-8">Account help</p>
        <h1 className="font-display mt-1 text-[2rem] leading-[1.05] font-medium">Recover an existing space</h1>
        <p className="mt-3 text-muted-foreground">If you made a space before and signing in now shows an empty one, you can prove you own the original with the same Google account. Nothing is deleted or merged, and your partner's seat is not changed.</p>

        {status.isLoading && (
          <div className={card} aria-busy="true" aria-label="Loading recovery status">
            <div className="h-5 w-1/2 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-4 w-full animate-pulse rounded-full bg-foreground/10" />
            <div className="h-12 w-full animate-pulse rounded-full bg-foreground/10" />
          </div>
        )}
        {status.isError && (
          <div className={card} role="alert">
            <p className={errBox} data-testid="text-recovery-load-error">{errMsg(status.error)}</p>
            <button data-testid="button-recovery-retry" onClick={() => status.refetch()} className={primaryBtn}>Try again</button>
          </div>
        )}
        {s && s.environment === 'preview' && <PreviewProof />}
        {s && s.environment === 'production' && (s.linked
          ? <LinkedChoice usingRecovered={s.usingRecovered} recovered={s.recoveredSpaceName} current={s.currentSpaceName} />
          : <ProductionClaim />)}
      </div>
    </div>
  );
}

function PreviewProof() {
  const issue = useIssueAccountRecovery({ mutation: { gcTime: 0 } });
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const proof = issue.data;
  const copy = async () => {
    if (!proof) return;
    try { await navigator.clipboard.writeText(proof.code); setCopied(true); setCopyFailed(false); setTimeout(() => setCopied(false), 1800); }
    catch { setCopyFailed(true); }
  };
  const expires = proof ? new Date(proof.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <section className={card}>
      <h2 className="font-display text-2xl">Step 1: create a recovery code</h2>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>Make sure you are signed in here with your <strong className="text-foreground">original Google account</strong>.</li>
        <li>Create a private code. It works once and expires in 15 minutes.</li>
        <li>Open the published app in another tab and sign in with the same Google account.</li>
        <li>Go to Settings, then Recover existing space, and paste the code.</li>
      </ol>
      <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">Keep this code private. Do not paste it into chat, email or messages. Anyone with it could claim this space.</p>
      {issue.isError && <p role="alert" data-testid="text-proof-error" className={errBox}>{errMsg(issue.error)} Recovery needs your Google sign-in; there is no email-based alternative.</p>}
      {!proof ? (
        <button data-testid="button-create-recovery-code" disabled={issue.isPending} onClick={() => issue.mutate()} className={primaryBtn}>
          <KeyRound className="h-4 w-4" />{issue.isPending ? 'Creating...' : 'Create private recovery code'}
        </button>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="recovery-code-out" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Your recovery code</Label>
          <textarea id="recovery-code-out" data-testid="text-recovery-code" readOnly rows={4} value={proof.code} onFocus={(e) => e.currentTarget.select()} className="w-full resize-none rounded-2xl border border-input bg-background p-3 font-mono text-xs break-all" />
          <p data-testid="text-recovery-expiry" className="font-mono text-[11px] text-muted-foreground">Expires at {expires}</p>
          {copyFailed && <p role="alert" className={errBox}>Copy failed. Tap the code box, select all, and copy it manually.</p>}
          <div className="flex gap-2">
            <button data-testid="button-copy-recovery-code" onClick={copy} className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs text-background active:scale-95 transition-transform">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
            <button data-testid="button-new-recovery-code" disabled={issue.isPending} onClick={() => { setCopied(false); setCopyFailed(false); issue.mutate(); }} className="rounded-full border border-foreground/20 px-4 py-2 text-xs disabled:opacity-40">Create a new code</button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductionClaim() {
  const [code, setCode] = useState('');
  const [checkedCode, setCheckedCode] = useState<string | null>(null);
  const check = useCheckAccountRecovery({ mutation: { gcTime: 0, onSuccess: (_d, v) => setCheckedCode(v.data.code) } });
  const leave = useLeave();
  const confirm = useConfirmAccountRecovery({ mutation: { gcTime: 0, onSuccess: leave } });
  const trimmed = code.trim();
  const preview = check.data && checkedCode === trimmed ? check.data : null;

  const onChange = (v: string) => { setCode(v); setCheckedCode(null); check.reset(); confirm.reset(); };
  const submit = (e: FormEvent) => { e.preventDefault(); if (trimmed.length >= 20) check.mutate({ data: { code: trimmed } }); };

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="font-display text-2xl">Step 2: paste your code</h2>
      <p className="text-sm text-muted-foreground">Create the code in the preview app while signed in with your original Google account, then paste it here.</p>
      <div className="space-y-1.5">
        <Label htmlFor="recovery-code-in" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Private recovery code</Label>
        <textarea id="recovery-code-in" data-testid="input-recovery-code" required rows={4} maxLength={4000} autoComplete="off" spellCheck={false} value={code} onChange={(e) => onChange(e.target.value)} className="w-full resize-none rounded-2xl border border-input bg-background p-3 font-mono text-xs break-all" />
      </div>
      {check.isError && <p role="alert" data-testid="text-check-error" className={errBox}>{errMsg(check.error)}</p>}
      {!preview && (
        <button data-testid="button-check-ownership" disabled={trimmed.length < 20 || check.isPending} className={primaryBtn}>
          <ShieldCheck className="h-4 w-4" />{check.isPending ? 'Checking...' : 'Check ownership'}
        </button>
      )}
      {preview && (
        <div className="space-y-3 rounded-2xl bg-accent p-4 text-accent-foreground" role="status">
          <p className="font-mono text-[10px] uppercase tracking-widest">Original space found</p>
          <p data-testid="text-recovered-space-name" className="font-display text-xl">{preview.spaceName}</p>
          {preview.alreadyLinked && <p className="text-sm">This space is already linked to your account.</p>}
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>This original space becomes your active space.</li>
            <li>Your newer space and all its records stay intact. You can switch back later.</li>
            <li>No partner seats are changed.</li>
            <li>Google Calendar will need to be connected again.</li>
          </ul>
          {confirm.isError && <p role="alert" data-testid="text-confirm-error" className={errBox}>{errMsg(confirm.error)}</p>}
          <button type="button" data-testid="button-confirm-recovery" disabled={confirm.isPending} onClick={() => confirm.mutate({ data: { code: trimmed } })} className={primaryBtn}>
            {confirm.isPending ? 'Recovering...' : `Use ${preview.spaceName}`}
          </button>
        </div>
      )}
    </form>
  );
}

function LinkedChoice({ usingRecovered, recovered, current }: { usingRecovered: boolean; recovered: string | null; current: string | null }) {
  const leave = useLeave();
  const select = useSelectAccountSpace({ mutation: { onSuccess: leave } });
  const activeName = usingRecovered ? recovered ?? 'Recovered original space' : current ?? 'Newer space';
  const canSwitch = usingRecovered ? current !== null : true;
  const target = usingRecovered ? `newer space${current ? ` (${current})` : ''}` : `recovered original${recovered ? ` (${recovered})` : ''}`;

  return (
    <section className={card}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Active space</p>
      <p data-testid="text-active-space" className="font-display text-2xl">{activeName}</p>
      <p className="text-sm text-muted-foreground">{usingRecovered ? 'You are using your recovered original space.' : 'You are using your newer space.'} Both spaces are kept. Switching does not delete, merge or change partner seats.</p>
      {select.isError && <p role="alert" data-testid="text-select-error" className={errBox}>{errMsg(select.error)}</p>}
      {canSwitch ? (
        <button data-testid="button-switch-space" disabled={select.isPending} onClick={() => select.mutate({ data: { useRecovered: !usingRecovered } })} className="w-full rounded-full border border-foreground/20 py-3.5 font-medium transition active:scale-[.98] disabled:opacity-40">
          {select.isPending ? 'Switching...' : `Switch to ${target}`}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">There is no newer space to switch to.</p>
      )}
    </section>
  );
}
