// Country helpers for the IP-derived `detectedCountry` the backend stores on a user.
//
// It is derived from the IP the user connects from, so it is where the connection appears to
// come from rather than where the person is — a VPN or a roaming carrier moves it.
//
// The stored value carries city and country together, "New Delhi, IN", and falls back to a bare
// "IN" wherever the lookup table names no city. The country is always the last segment, so it is
// read from the end rather than by assuming a shape.

/** English name for an ISO-2 code, "Estonia (EE)"; the bare code when Intl has no region data. */
export function countryName(code: string) {
  const upper = code.toUpperCase()
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(upper)
    if (name && name !== upper) return `${name} (${upper})`
  } catch {
    // Intl without region data: the code on its own is still the honest answer.
  }
  return upper
}

/** "New Delhi, India (IN)" for a stored detectedCountry; "Not detected" when there is none. */
export function countryLabel(value: string | null | undefined) {
  if (!value) return 'Not detected'

  const segments = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (segments.length === 0) return 'Not detected'

  const code = segments[segments.length - 1]
  const city = segments.slice(0, -1).join(', ')
  const country = countryName(code)

  return city ? `${city}, ${country}` : country
}
