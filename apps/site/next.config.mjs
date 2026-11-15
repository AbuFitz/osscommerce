/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@oss-commerce/ui', '@oss-commerce/contracts'], poweredByHeader: false, images: { unoptimized: true }, serverExternalPackages: ['pg'],
  async redirects() { return [{ source: '/storefronts', destination: '/features/online-store', permanent: true }, { source: '/payments', destination: '/features/payments', permanent: true }, { source: '/integrations', destination: '/platform', permanent: true }]; },
};
