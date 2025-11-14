/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const nextConfig = {
  reactStrictMode: true,
  // Remove console.* in production builds (keep errors only)
  compiler: {
    removeConsole: isProd ? { exclude: ['error'] } : false,
  },
}

export default nextConfig
