/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@oss-commerce/ui', '@oss-commerce/contracts'], poweredByHeader: false, images: { unoptimized: true }, serverExternalPackages: ['pg'],
  async redirects() { return [{ source: '/stores', destination: '/', permanent: false }, { source: '/storefronts', destination: '/', permanent: false }, { source: '/features/:slug', destination: '/platform', permanent: true }]; },
};
