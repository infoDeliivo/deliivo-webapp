// Ride times arrive as 24-hour "HH:mm" strings; show them as 12-hour with AM/PM.
export function formatRideTime(time: string, locale?: string) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return new Date(Date.UTC(1970, 0, 1, hours, minutes)).toLocaleTimeString(locale, {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
  });
}
