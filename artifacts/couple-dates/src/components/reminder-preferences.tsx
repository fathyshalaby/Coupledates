import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetReminderPreferences, useSaveReminderPreferences, getGetReminderPreferencesQueryKey,
  getListRemindersQueryKey, type ReminderPreferences as Preferences,
} from '@workspace/api-client-react';
import { REFRESH, errMsg } from '@/lib/data';
import { Input } from '@/components/ui/input';

export function ReminderPreferences() {
  const q = useGetReminderPreferences({ query: { queryKey: getGetReminderPreferencesQueryKey(), ...REFRESH } });
  return (
    <section data-testid="panel-reminder-preferences" className="mt-5 rounded-[26px] border border-foreground/10 bg-card p-5">
      <h2 className="font-display text-2xl">Your reminders</h2>
      <p className="mt-1 text-xs text-muted-foreground">Opt in for all agreed dates in this space. These settings are just yours — your partner chooses separately. In-app only, refreshed every 30 seconds while open. No push, email, or background location.</p>
      {q.isLoading && <p className="mt-3 text-sm">Loading preferences…</p>}
      {q.isError && <p role="alert" className="mt-3 text-sm text-destructive">{errMsg(q.error)} <button onClick={() => q.refetch()} className="underline">Retry</button></p>}
      {q.data && <PreferencesForm key={JSON.stringify(q.data)} initial={q.data} />}
    </section>
  );
}

function PreferencesForm({ initial }: { initial: Preferences }) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();
  const save = useSaveReminderPreferences({ mutation: {
    onSuccess: data => {
      qc.setQueryData(getGetReminderPreferencesQueryKey(), data);
      qc.invalidateQueries({ queryKey: getListRemindersQueryKey() });
      setSaved(true);
    },
  } });
  const submit = (e: FormEvent) => {
    e.preventDefault(); setSaved(false); save.mutate({ data: draft });
  };
  return <form onSubmit={submit} className="mt-4 space-y-4">
    <label className="flex items-center gap-3 text-sm">
      <input data-testid="checkbox-date-reminders" type="checkbox" checked={draft.dateEnabled} onChange={e => { setSaved(false); setDraft({ ...draft, dateEnabled: e.target.checked }); }} />
      Remind me before agreed dates
    </label>
    <label className="block text-sm">How early?
      <select data-testid="select-reminder-lead" value={draft.leadMinutes} onChange={e => { setSaved(false); setDraft({ ...draft, leadMinutes: Number(e.target.value) as Preferences['leadMinutes'] }); }} className="mt-1 block w-full rounded-2xl border bg-background p-3">
        <option value={15}>15 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option>
      </select>
    </label>
    <label className="flex items-center gap-3 text-sm">
      <input data-testid="checkbox-photo-reminders" type="checkbox" checked={draft.photoEnabled} onChange={e => { setSaved(false); setDraft({ ...draft, photoEnabled: e.target.checked }); }} />
      Remind me to save photos after dates
    </label>
    <label className="block text-sm">Your time zone
      <Input data-testid="input-reminder-timezone" className="mt-1 rounded-2xl" required maxLength={100} value={draft.timezone} onChange={e => { setSaved(false); setDraft({ ...draft, timezone: e.target.value }); }} placeholder="Europe/London" />
    </label>
    <button type="button" className="text-xs text-primary underline" onClick={() => { setSaved(false); setDraft({ ...draft, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }}>Use this device’s time zone</button>
    <p className="text-xs text-muted-foreground">Timed dates keep their agreed time zone. Dates without a time use 9am in your zone. Photo reminders arrive 1 hour after the planned end, or 9am the next day for untimed dates, and stay available for 48 hours. Open the app to see them. For reminders outside the app, export a date and configure alerts in your calendar app.</p>
    {save.isError && <p role="alert" className="text-sm text-destructive">{errMsg(save.error)}</p>}
    {saved && <p role="status" className="text-sm text-primary">Reminder preferences saved.</p>}
    <button data-testid="button-save-reminders" disabled={save.isPending} className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save my reminder preferences'}</button>
  </form>;
}
