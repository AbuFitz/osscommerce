/** @type {import('next').NextConfig} */
export default { transpilePackages: ['@oss-commerce/automation', '@oss-commerce/contracts', '@oss-commerce/ui', '@oss-commerce/emails', '@oss-commerce/integrations'], poweredByHeader: false, experimental: { serverActions: { bodySizeLimit: '32mb' } } };
