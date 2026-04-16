/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Disk webpack caches under .next/cache/webpack/... can throw ENOENT on missing *.pack.gz
   * if the folder was deleted while `next dev` is running or after a bad refresh.
   * Memory cache in dev avoids broken pack files; production build is unchanged.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      /** Disk cache caused ENOENT on *.pack.gz; memory cache still saw occasional MODULE_NOT_FOUND with workspaces. */
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
