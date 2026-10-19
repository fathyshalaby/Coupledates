import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useUser } from '@clerk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Lock, Pencil, Plus, Sparkles, UserPlus, X } from 'lucide-react';
import {
  useSavePreferences,
  type PartnerPreferences, type PreferencesInput, type PreferencesInputCurrency, type PreferencesInputRelationshipMode,
} from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState, PageHeader } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { useCouple } from '@/lib/couple-context';
import { errMsg, useInvalidate, usePreferencesQ } from '@/lib/data';
import { cn } from '@/lib/utils';

const INTERESTS = ['Cooking together', 'Live music', 'Hiking', 'Board games', 'Museums', 'Street food', 'Movies at home', 'Coffee walks', 'Dancing', 'Bookshops', 'Wine or tea tasting', 'Picnics', 'Cycling', 'Comedy', 'Thrifting', 'Stargazing', 'Pottery & crafts', 'Swimming', 'Video games', 'Day trips'];
const AVAIL = ['Weekday mornings', 'Weekday lunch', 'Weekday evenings', 'Friday nights', 'Saturday daytime', 'Saturday nights', 'Sunday daytime', 'Sunday evenings', 'Late nights'];
const CURRENCIES: PreferencesInputCurrency[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'Other'];
const STEPS = ['You', 'Loves', 'Limits', 'Time'] as const;
const lbl = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';

export default function PreferencesPage() {
  const { user } = useUser();
  const q = usePreferencesQ();
  const couple = useCouple();
  const [editing, setEditing] = useState<boolean | null>(null);
  const mine = q.data?.find((p) => p.isYou);
  const partner = q.data?.find((p) => !p.isYou);
  const isEditing = editing ?? (q.isSuccess && !mine);

  return (
    <div>
      <PageHeader kicker="For the date concierge" title={<>What we <em className="text-primary">like</em></>} />
      <p className="rise -mt-3 mb-5 flex items-start gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Both profiles are visible to the two of you and shared with the AI assistant to tailor ideas. Use a city, never an exact address.</p>
      {q.isLoading ? <div className="space-y-3"><Skeleton className="h-40 rounded-[28px]" /><Skeleton className="h-28 rounded-[28px]" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} label="Preferences" />
        : (
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div key="wizard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Wizard initial={mine} fallbackName={user?.firstName ?? ''} fallbackTz={Intl.DateTimeFormat().resolvedOptions().timeZone || couple.timezone} onDone={() => setEditing(false)} onCancel={mine ? () => setEditing(false) : undefined} />
              </motion.div>
            ) : (
              <motion.div key="view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {mine && <ProfileCard p={mine} label="You" action={<button data-testid="button-edit-preferences" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full bg-foreground/[0.07] px-3 py-1.5 text-xs"><Pencil className="h-3 w-3" /> Edit</button>} />}
                {partner ? <ProfileCard p={partner} label={partner.displayName} /> : (
                  <div data-testid="card-partner-missing" className="rounded-[28px] border-2 border-dashed border-foreground/15 p-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your partner</p>
                    <p className="font-display mt-1 text-xl">{couple.memberCount < 2 ? 'Hasn’t joined yet.' : 'Hasn’t filled theirs in yet.'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{couple.memberCount < 2 ? 'Ideas will be based on your profile alone until they join and answer.' : 'Until they do, ideas are shaped by your answers only. Nudge them — it takes two minutes.'}</p>
                    {couple.memberCount < 2 && <Link href="/settings" data-testid="link-invite-from-prefs" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs text-background"><UserPlus className="h-3.5 w-3.5" /> Invite them</Link>}
                  </div>
                )}
                <Link href="/assistant" data-testid="link-prefs-to-assistant" className="flex items-center justify-between rounded-[28px] bg-primary p-5 text-primary-foreground transition active:scale-[.99]">
                  <span><span className="font-display block text-xl">Ask for ideas</span><span className="text-sm opacity-80">Built from what you both like.</span></span><Sparkles className="h-6 w-6" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        )}
    </div>
  );
}

function ProfileCard({ p, label, action }: { p: PartnerPreferences; label: string; action?: ReactNode }) {
  return (
    <article data-testid={`card-profile-${p.isYou ? 'you' : 'partner'}`} className="rise rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-mono text-[10px] uppercase tracking-widest text-primary">{label}</p><h2 className="font-display text-2xl">{p.displayName}</h2>
          <p className="text-sm text-muted-foreground">{[p.city, p.relationshipMode === 'long_distance' ? 'Long distance' : 'Together', p.timezone].filter(Boolean).join(' · ')}</p></div>
        {action}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{p.interests.map((t) => <span key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{t}</span>)}</div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className={lbl}>Per-person budget</dt><dd className="font-display text-xl">{p.budget} <span className="text-sm">{p.currency}</span></dd></div>
        <div><dt className={lbl}>Free</dt><dd>{p.availability.length ? p.availability.join(', ') : 'Flexible'}</dd></div>
        {p.avoid && <div className="col-span-2"><dt className={lbl}>Rather not</dt><dd>{p.avoid}</dd></div>}
        {p.notes && <div className="col-span-2"><dt className={lbl}>Notes</dt><dd className="whitespace-pre-line">{p.notes}</dd></div>}
      </dl>
    </article>
  );
}

function Chip({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: ReactNode; testid: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} data-testid={testid} onClick={onClick} className={cn('flex items-center gap-1 rounded-full px-3.5 py-2 text-sm transition active:scale-95', on ? 'bg-foreground text-background' : 'bg-card shadow-[0_1px_0_hsl(var(--border))]')}>
      {on && <Check className="h-3.5 w-3.5" />}{children}
    </button>
  );
}

function Wizard({ initial, fallbackName, fallbackTz, onDone, onCancel }: { initial?: PartnerPreferences; fallbackName: string; fallbackTz: string; onDone: () => void; onCancel?: () => void }) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState<PreferencesInput>(() => ({
    displayName: initial?.displayName ?? fallbackName,
    interests: initial?.interests ?? [],
    avoid: initial?.avoid ?? '',
    budget: initial?.budget ?? 40,
    currency: initial?.currency ?? 'USD',
    city: initial?.city ?? '',
    timezone: initial?.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || fallbackTz),
    relationshipMode: initial?.relationshipMode ?? 'together',
    availability: initial?.availability ?? [],
    notes: initial?.notes ?? '',
  }));
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PreferencesInput>(k: K, v: PreferencesInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'interests' | 'availability', v: string, max: number) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((i) => i !== v) : x[k].length >= max ? x[k] : [...x[k], v] }));

  const save = useSavePreferences({ mutation: {
    onSuccess: () => { invalidate(['preferences']); toast({ title: 'Profile saved', description: 'Your partner and the concierge can see it now.' }); onDone(); },
    onError: (e) => setError(errMsg(e)),
  } });

  const valid = [f.displayName.trim().length > 0, f.interests.length > 0, Number.isFinite(f.budget) && f.budget >= 0 && f.budget <= 10000, true][step];
  const go = (d: number) => { setError(null); setDir(d); setStep((s) => s + d); };
  const addCustom = () => {
    const v = custom.trim().slice(0, 60);
    if (v && !f.interests.includes(v) && f.interests.length < 20) set('interests', [...f.interests, v]);
    setCustom('');
  };
  const submit = () => save.mutate({ data: { ...f, displayName: f.displayName.trim(), city: f.city.trim(), avoid: f.avoid.trim(), notes: f.notes.trim(), budget: Number(f.budget) } });

  return (
    <div className="rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
      <div className="flex items-center justify-between">
        <p data-testid="text-step" className="font-mono text-[11px] uppercase tracking-widest text-primary">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
        {onCancel && <button data-testid="button-cancel-wizard" onClick={onCancel} aria-label="Cancel editing" className="rounded-full p-1.5 hover:bg-foreground/5"><X className="h-4 w-4" /></button>}
      </div>
      <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        {STEPS.map((s, i) => <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10"><motion.span className="block h-full bg-primary" initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} style={{ originX: 0 }} /></span>)}
      </div>

      <div className="relative mt-5 min-h-[300px] overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -30 }} transition={{ duration: 0.22 }} className="space-y-4">
            {step === 0 && <>
              <h2 className="font-display text-2xl">First, the basics.</h2>
              <div className="space-y-1.5"><Label htmlFor="p-name" className={lbl}>What should we call you?</Label><Input id="p-name" data-testid="input-pref-name" maxLength={60} value={f.displayName} onChange={(e) => set('displayName', e.target.value)} className="h-12 rounded-2xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="p-city" className={lbl}>City or area</Label><Input id="p-city" data-testid="input-pref-city" maxLength={120} value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Lisbon, Alfama" className="h-12 rounded-2xl" /><p className="text-xs text-muted-foreground">Neighbourhood at most — no street address.</p></div>
              <div className="space-y-1.5"><Label htmlFor="p-tz" className={lbl}>Time zone</Label><Input id="p-tz" data-testid="input-pref-timezone" maxLength={100} value={f.timezone} onChange={(e) => set('timezone', e.target.value)} className="h-12 rounded-2xl font-mono text-sm" /></div>
              <div className="space-y-1.5"><p className={lbl} id="p-mode">Right now you two are</p>
                <div role="radiogroup" aria-labelledby="p-mode" className="grid grid-cols-2 rounded-full bg-foreground/[0.06] p-1">
                  {([['together', 'Same city'], ['long_distance', 'Long distance']] as [PreferencesInputRelationshipMode, string][]).map(([v, l]) => (
                    <button type="button" role="radio" aria-checked={f.relationshipMode === v} key={v} data-testid={`option-mode-${v}`} onClick={() => set('relationshipMode', v)} className={cn('rounded-full py-2.5 text-sm transition', f.relationshipMode === v && 'bg-background shadow-sm')}>{l}</button>
                  ))}
                </div></div>
            </>}
            {step === 1 && <>
              <h2 className="font-display text-2xl">What lights you up?</h2>
              <p className="text-sm text-muted-foreground">Pick as many as feel true ({f.interests.length}/20).</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
                {[...INTERESTS, ...f.interests.filter((i) => !INTERESTS.includes(i))].map((t) => <Chip key={t} testid={`chip-interest-${t.toLowerCase().replace(/\W+/g, '-')}`} on={f.interests.includes(t)} onClick={() => toggle('interests', t, 20)}>{t}</Chip>)}
              </div>
              <div className="flex gap-2"><Label htmlFor="p-custom" className="sr-only">Add your own interest</Label>
                <Input id="p-custom" data-testid="input-custom-interest" maxLength={60} value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder="Add your own" className="h-11 rounded-full" />
                <button type="button" data-testid="button-add-interest" onClick={addCustom} disabled={!custom.trim()} aria-label="Add interest" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"><Plus className="h-4 w-4" /></button></div>
            </>}
            {step === 2 && <>
              <h2 className="font-display text-2xl">Limits, kindly.</h2>
              <div className="space-y-1.5"><Label htmlFor="p-avoid" className={lbl}>Rather avoid</Label><Textarea id="p-avoid" data-testid="input-pref-avoid" maxLength={1000} value={f.avoid} onChange={(e) => set('avoid', e.target.value)} placeholder="Crowds, seafood, heights, very late nights…" className="min-h-24 rounded-2xl" /></div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5"><Label htmlFor="p-budget" className={lbl}>Comfortable spend, per person</Label><Input id="p-budget" data-testid="input-pref-budget" type="number" inputMode="decimal" min={0} max={10000} value={Number.isFinite(f.budget) ? f.budget : ''} onChange={(e) => set('budget', e.target.value === '' ? NaN : Number(e.target.value))} className="h-12 rounded-2xl font-display text-xl" /></div>
                <div className="space-y-1.5"><Label htmlFor="p-cur" className={lbl}>Currency</Label>
                  <select id="p-cur" data-testid="select-pref-currency" value={f.currency} onChange={(e) => set('currency', e.target.value as PreferencesInputCurrency)} className="h-12 rounded-2xl border border-input bg-background px-3 text-sm">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <p className="text-xs text-muted-foreground">0 is fine — free dates are some of the best.</p>
            </>}
            {step === 3 && <>
              <h2 className="font-display text-2xl">When are you free?</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Availability">
                {AVAIL.map((t) => <Chip key={t} testid={`chip-avail-${t.toLowerCase().replace(/\W+/g, '-')}`} on={f.availability.includes(t)} onClick={() => toggle('availability', t, 14)}>{t}</Chip>)}
              </div>
              <div className="space-y-1.5"><Label htmlFor="p-notes" className={lbl}>Anything else the concierge should know?</Label><Textarea id="p-notes" data-testid="input-pref-notes" maxLength={1500} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Vegetarian. Love surprises. Our anniversary is in June." className="min-h-24 rounded-2xl" /></div>
            </>}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && <p role="alert" data-testid="text-pref-error" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex gap-2">
        {step > 0 && <button type="button" data-testid="button-wizard-back" onClick={() => go(-1)} className="flex items-center gap-1 rounded-full px-4 py-3.5 text-sm"><ArrowLeft className="h-4 w-4" /> Back</button>}
        {step < STEPS.length - 1
          ? <button type="button" data-testid="button-wizard-next" disabled={!valid} onClick={() => go(1)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground py-3.5 font-medium text-background transition active:scale-[.98] disabled:opacity-40">{step === 1 && !valid ? 'Pick at least one' : 'Next'} <ArrowRight className="h-4 w-4" /></button>
          : <button type="button" data-testid="button-save-preferences" disabled={save.isPending} onClick={submit} className="flex-1 rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">{save.isPending ? 'Saving...' : 'Save my profile'}</button>}
      </div>
    </div>
  );
}
