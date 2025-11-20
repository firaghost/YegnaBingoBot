/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

// Global security headers for all routes
const securityHeaders = [
  // Enforce HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Prevent clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
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
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
