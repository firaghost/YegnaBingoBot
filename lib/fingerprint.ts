// Lightweight device fingerprint (free, no external services)
// Produces a stable hash from available browser signals. Data is hashed client-side; only hash is sent to server.

export async function getDeviceHash(): Promise<string> {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any)
    const scr = typeof screen !== 'undefined' ? screen : ({} as any)

    const parts: string[] = []
    // Basic signals
    parts.push(String(nav.userAgent || ''))
    parts.push(String(nav.language || ''))
    parts.push(String((nav as any).languages?.join(',') || ''))
    parts.push(String(scr.colorDepth || ''))
    parts.push(String(scr.width || ''))
    parts.push(String(scr.height || ''))
    parts.push(String((scr as any).availWidth || ''))
    parts.push(String((scr as any).availHeight || ''))
    parts.push(String(Intl.DateTimeFormat().resolvedOptions().timeZone || ''))
    parts.push(String((nav as any).hardwareConcurrency || ''))
    parts.push(String((nav as any).deviceMemory || ''))

    // Canvas fingerprint (best-effort)
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillStyle = '#f60'
        ctx.fillRect(0, 0, 100, 30)
        ctx.fillStyle = '#069'
        ctx.fillText('BingoX FP', 2, 2)
        const data = canvas.toDataURL()
        parts.push(data)
      }
    } catch {}

    // WebGL vendor/renderer (best-effort)
    try {
      const canvas = document.createElement('canvas')
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
      if (gl) {
        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info') as any
        if (dbgInfo) {
          const vendor = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL)
          const renderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)
          parts.push(String(vendor || ''))
          parts.push(String(renderer || ''))
        }
      }
    } catch {}

    const raw = parts.join('|||')

    // Hash via Web Crypto
    const enc = new TextEncoder()
    const data = enc.encode(raw)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const bytes = Array.from(new Uint8Array(digest))
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('')
    return hex
  } catch {
    // Fallback random-ish
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
  }
}
