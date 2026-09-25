/** Calendar dates follow Amsterdam time, independent of the visitor's time zone. */
export function amsterdamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function nextMeetingWorkdays(today: string, count = 8) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  const dates: string[] = [];
  const cursor = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || cursor.toISOString().slice(0, 10) !== today) return [];
  while (dates.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export function formatMeetingDay(isoDate: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function isAvailableMeetingDay(value: string, now = new Date()) {
  return nextMeetingWorkdays(amsterdamToday(now)).includes(value);
}
