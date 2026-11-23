export function todayInTashkent(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function startOfTashkentDay(now = new Date()): Date {
  return new Date(`${todayInTashkent(now)}T00:00:00+05:00`);
}
