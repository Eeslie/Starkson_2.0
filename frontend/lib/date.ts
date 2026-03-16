/**
 * Philippine time (Pinoy time) - Asia/Manila (UTC+8)
 * All user-facing dates/times use this timezone.
 */

const TIMEZONE = 'Asia/Manila'
const LOCALE = 'en-PH'

/** Format an ISO date string for display in Philippine time */
export function formatPinoyDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(LOCALE, {
      timeZone: TIMEZONE,
      dateStyle: 'short',
      timeStyle: 'medium',
    })
  } catch {
    return iso
  }
}

/** Format date only (no time) in Philippine time */
export function formatPinoyDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(LOCALE, { timeZone: TIMEZONE })
  } catch {
    return iso
  }
}

/** Get today's date string (YYYY-MM-DD) in Philippine time, for date inputs and filters */
export function todayPinoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/** Get the start of a given date (YYYY-MM-DD) in Philippine time as ISO UTC */
export function startOfDayPinoy(dateYmd: string): string {
  const d = new Date(dateYmd + 'T00:00:00+08:00')
  return d.toISOString()
}

/** Get the end of a given date (YYYY-MM-DD) in Philippine time as ISO UTC */
export function endOfDayPinoy(dateYmd: string): string {
  const d = new Date(dateYmd + 'T23:59:59.999+08:00')
  return d.toISOString()
}
