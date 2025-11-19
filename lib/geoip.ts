export interface GeoLocation {
  city?: string | null
  region?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

// Best-effort IP geolocation without asking user permission
// Uses ipapi.co (HTTPS, free tier) – do not include API keys
export async function lookupIp(ip?: string | null): Promise<GeoLocation | null> {
  try {
    const target = (ip && ip.trim() !== '') ? encodeURIComponent(ip.trim()) : ''
    const url = target ? `https://ipapi.co/${target}/json/` : `https://ipapi.co/json/`
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    return {
      city: data?.city || null,
      region: data?.region || null,
      country: data?.country_name || data?.country || null,
      latitude: typeof data?.latitude === 'number' ? data.latitude : Number(data?.latitude) || null,
      longitude: typeof data?.longitude === 'number' ? data.longitude : Number(data?.longitude) || null,
    }
  } catch (e) {
    return null
  }
}
