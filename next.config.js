/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

// Global security headers for all routes
const securityHeaders = [
  // Enforce HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // MIME sniffing protection
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Safer referrer policy
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Lock down powerful browser APIs we do not use
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Allow embedding in Telegram while preventing arbitrary framing elsewhere
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self' https://web.telegram.org https://telegram.org https://*.telegram.org",
  },
]

const nextConfig = {
  reactStrictMode: true,
  // Remove console.* in production builds (keep errors only)
  compiler: {
    removeConsole: isProd ? { exclude: ['error'] } : false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
