/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@oss-commerce/ui', '@oss-commerce/contracts'], poweredByHeader: false, images: { unoptimized: true }, serverExternalPackages: ['pg'],
  async redirects() { return [{ source: '/storefronts', destination: '/stores', permanent: true }, { source: '/features/:slug', destination: '/platform', permanent: true }]; },
};
