export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export function validateDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) fail(400, "Choose a valid calendar date.");
}
