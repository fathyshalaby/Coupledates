import { useState, type FormEvent } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { Check, Copy, LogOut, Share2 } from 'lucide-react';
import { useSaveCouple } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { useCouple } from '@/lib/couple-context';
import { errMsg, useInvalidate } from '@/lib/data';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SettingsPage() {
  const couple = useCouple();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const [yourName, setYourName] = useState(couple.yourName);
  const [partnerName, setPartnerName] = useState(couple.partnerName);
  const [anniversary, setAnniversary] = useState(couple.anniversary.slice(0, 10));
  const [copied, setCopied] = useState(false);
  const save = useSaveCouple({ mutation: {
    onSuccess: () => { invalidate(['couple', 'summary', 'recap']); toast({ title: 'Saved' }); },
  } });
  const dirty = yourName !== couple.yourName || partnerName !== couple.partnerName || anniversary !== couple.anniversary.slice(0, 10);
  const full = couple.memberCount >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ data: { yourName: yourName.trim(), partnerName: partnerName.trim(), anniversary, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || couple.timezone } });
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(couple.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast({ title: 'Copy failed', description: 'Select the code and copy it manually.', variant: 'destructive' }); }
  };
  const share = async () => {
    const text = `Join our space on Couple Dates. Sign in at ${window.location.origin}${basePath}/sign-up and enter this code: ${couple.inviteCode}`;
    if (navigator.share) { try { await navigator.share({ title: 'Couple Dates invite', text }); } catch { /* cancelled */ } }
    else copy();
  };

  return (
    <div>
      <PageHeader kicker="Settings" title={<>Our <em className="text-primary">space</em></>} />

      <section className="rise overflow-hidden rounded-[28px] bg-foreground text-background">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Members</p>
            <span data-testid="text-member-count" className="font-mono text-xs">{couple.memberCount} of 2</span>
          </div>
          <div className="mt-3 flex gap-2">
            {[0, 1].map((i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < couple.memberCount ? 'bg-primary' : 'bg-background/20'}`} />)}
          </div>
          <p className="mt-4 text-sm opacity-80">{full ? 'Both of you are here. This space is complete, so the code no longer lets anyone else in.' : 'Your partner joins by signing up and entering this code.'}</p>
        </div>
        {!full && (
          <div className="stub mx-3 mb-3 rounded-[22px] bg-accent p-4 text-accent-foreground">
            <p className="font-mono text-[10px] uppercase tracking-widest">Invite code</p>
            <p data-testid="text-invite-code" className="mt-1 select-all break-all font-mono text-lg">{couple.inviteCode}</p>
            <div className="mt-3 flex gap-2">
              <button data-testid="button-copy-code" onClick={copy} className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs text-background active:scale-95 transition-transform">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
              <button data-testid="button-share-code" onClick={share} className="flex items-center gap-1.5 rounded-full border border-foreground/20 px-4 py-2 text-xs active:scale-95 transition-transform"><Share2 className="h-3.5 w-3.5" /> Share</button>
            </div>
          </div>
        )}
      </section>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
        <h2 className="font-display text-2xl">Couple profile</h2>
        <div className="space-y-1.5"><Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Your name</Label><Input data-testid="input-settings-your-name" required maxLength={60} value={yourName} onChange={(e) => setYourName(e.target.value)} className="h-12 rounded-2xl" /></div>
        <div className="space-y-1.5"><Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Partner's name</Label><Input data-testid="input-settings-partner-name" required maxLength={60} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className="h-12 rounded-2xl" /></div>
        <div className="space-y-1.5"><Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Anniversary</Label><Input data-testid="input-settings-anniversary" required type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} className="h-12 rounded-2xl" /></div>
        <p className="font-mono text-[11px] text-muted-foreground">Time zone: {couple.timezone}</p>
        {save.isError && <p data-testid="text-settings-error" className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{errMsg(save.error)}</p>}
        <button data-testid="button-save-settings" disabled={!dirty || save.isPending} className="w-full rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-40">{save.isPending ? 'Saving...' : 'Save changes'}</button>
      </form>

      <section className="mt-6 flex items-center justify-between rounded-[28px] border border-foreground/10 p-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</p>
          <p data-testid="text-user-email" className="truncate">{user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? 'You'}</p>
        </div>
        <button data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-4 py-2 text-sm active:scale-95 transition-transform"><LogOut className="h-4 w-4" /> Sign out</button>
      </section>
    </div>
  );
}
