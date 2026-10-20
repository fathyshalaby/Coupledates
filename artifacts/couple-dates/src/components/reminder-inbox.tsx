import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useListReminders, useDismissReminder, getListRemindersQueryKey } from '@workspace/api-client-react';
import { REFRESH, errMsg } from '@/lib/data';

export function ReminderInbox() {
  const q = useListReminders({ query: { queryKey: getListRemindersQueryKey(), ...REFRESH } });
  const qc = useQueryClient();
  const dismiss = useDismissReminder({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListRemindersQueryKey() }) } });
  // Keep the shared space focused when there is nothing to act on.
  // Preferences remain available in Settings; due reminders and failures stay visible.
  if (!q.isError && !q.data?.length) return null;
  return <aside aria-label="Your reminder inbox" data-testid="reminder-inbox" className="surface mb-6 p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium">Reminders{q.data?.length ? ` · ${q.data.length}` : ''}</p>
      <button data-testid="button-refresh-reminders" disabled={q.isFetching} onClick={() => q.refetch()} className="min-h-11 px-2 text-xs text-primary disabled:opacity-50">Refresh</button>
    </div>
    {q.isError && <p role="alert" className="mt-2 text-xs text-destructive">{errMsg(q.error)}</p>}
    {q.data?.map(r => <div key={r.id} className="mt-3 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
      <Link href={r.href} data-testid={`link-reminder-${r.id}`} className="min-w-0 text-sm">
        <span className="block font-medium">{r.kind === 'photo' ? 'Save photos from your date' : 'Your agreed date is coming up'}</span>
        <span className="block truncate text-primary">{r.title}{r.kind === 'photo' ? ' · Open private album' : ''}</span>
        <span className="text-xs text-muted-foreground">Due {new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short', timeZone: r.timezone }).format(new Date(r.dueAt))} · {r.timezone}</span>
      </Link>
      <button data-testid={`button-dismiss-reminder-${r.id}`} disabled={dismiss.isPending} onClick={() => dismiss.mutate({ id: r.id })} className="shrink-0 rounded-full bg-foreground/5 px-3 py-2 text-xs disabled:opacity-50">Dismiss</button>
    </div>)}
    {dismiss.isError && <p role="alert" className="mt-2 text-xs text-destructive">{errMsg(dismiss.error)}</p>}
  </aside>;
}
