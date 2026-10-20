import type { Couple, DatePlan, Memory, Summary } from '@workspace/api-client-react';

// Deliberately long, entirely synthetic data. No IDs from a running space.
export const longTitle = 'A very long synthetic date title for a leisurely evening of cooking, conversation, and a walk under the stars together';
export const couple: Couple = {
  id: 900001,
  yourName: 'Alexandria-Cassandra Synthetic',
  partnerName: 'Maximilian-Theodore Example-Partner',
  anniversary: '2024-01-01',
  timezone: 'America/Argentina/Buenos_Aires',
  inviteCode: 'NOT-A-REAL-INVITE',
  memberCount: 2,
};
export const plan: DatePlan = {
  id: 900002, version: 1, title: longTitle,
  date: '2099-06-15', time: '18:30', timezone: couple.timezone,
  durationMinutes: 240, location: 'A synthetic venue with a deliberately lengthy name',
  category: 'Food', notes: 'Synthetic date notes', status: 'planned',
  mode: 'in_person', rating: null, isProposer: true, canRespond: false, responseNote: '',
};
export const memory: Memory = {
  id: 900003, title: longTitle, note: 'Original synthetic note',
  date: '2026-06-15', category: 'Food', photoPath: '/synthetic/original.png',
  favorite: false, dateId: plan.id, createdAt: '2026-06-15T20:00:00Z',
};
export const summary: Summary = {
  daysTogether: 1024, memoryCount: 1, completedDates: 12,
  currentStreak: 8, longestStreak: 10, checkedInToday: false, weekDays: [],
};
