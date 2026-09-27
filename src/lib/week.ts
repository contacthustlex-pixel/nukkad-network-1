export function currentWeekBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (utc.getUTCDay() + 6) % 7;
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - mondayOffset);
  const next = new Date(monday);
  next.setUTCDate(monday.getUTCDate() + 7);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {
    start: new Date(`${iso(monday)}T00:00:00+05:30`).toISOString(),
    end: new Date(`${iso(next)}T00:00:00+05:30`).toISOString(),
    label: `${iso(monday)} – ${iso(new Date(next.getTime() - 86400000))}`,
  };
}
