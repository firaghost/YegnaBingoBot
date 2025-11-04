/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => {
    // Generate unique build ID to bust cache
    return `build-${Date.now()}`;
  },
}

module.exports = nextConfig
