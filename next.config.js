/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

// Base security headers shared by all routes (no frame restrictions here)
const baseSecurityHeaders = [
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
]

const nextConfig = {
  reactStrictMode: true,
  // Remove console.* in production builds (keep errors only)
  compiler: {
    removeConsole: isProd ? { exclude: ['error'] } : false,
  },
  async headers() {
    return [
      // Admin / management portal: DO NOT allow embedding
      {
        source: '/mgmt-portal-x7k9p2/:path*',
        headers: [
          ...baseSecurityHeaders,
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
      // All other routes (mini app, APIs, etc.) – no frame restriction so Telegram can embed the mini app
      {
        source: '/(.*)',
        headers: baseSecurityHeaders,
      },
    ]
  },
}

export default nextConfig
