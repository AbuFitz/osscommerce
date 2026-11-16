import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DefaultAssetNamingStrategy, type RequestContext, type VendureConfig } from '@vendure/core';
import { AssetServerPlugin, configureS3AssetStorage } from '@vendure/asset-server-plugin';

/**
 * Media lives in S3-compatible object storage (Cloudflare R2 in production). The database only holds the asset record.
 * One shared bucket; every object key starts with the owning store, and carries a random segment so keys cannot be guessed or enumerated:
 *   store-<channelId>/source/<random>/<file>     store-<channelId>/preview/<random>/<file>__preview.<ext>
 */
export class StoreScopedNaming extends DefaultAssetNamingStrategy {
  generateSourceFileName(ctx: RequestContext, originalFileName: string, conflictFileName?: string): string {
    const name = super.generateSourceFileName(ctx, path.posix.basename(originalFileName), conflictFileName && path.posix.basename(conflictFileName));
    return path.posix.join(`store-${ctx.channelId}`, 'source', randomBytes(6).toString('hex'), name);
  }
  generatePreviewFileName(ctx: RequestContext, sourceFileName: string, conflictFileName?: string): string {
    const dir = path.posix.dirname(sourceFileName).replace('/source/', '/preview/');
    return path.posix.join(dir, super.generatePreviewFileName(ctx, path.posix.basename(sourceFileName), conflictFileName && path.posix.basename(conflictFileName)));
  }
}
/** Which store an object key belongs to, or null if the key is not store-scoped. Used by cleanup and by tests. */
export const storeOfKey = (key: string) => /^store-([^/]+)\//.exec(key)?.[1] ?? null;

export interface AssetEnv { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region?: string; publicUrl?: string }
export function readAssetEnv(e: Record<string, string | undefined>): AssetEnv | null {
  const { ASSET_S3_ENDPOINT: endpoint, ASSET_S3_BUCKET: bucket, ASSET_S3_ACCESS_KEY_ID: accessKeyId, ASSET_S3_SECRET_ACCESS_KEY: secretAccessKey } = e;
  const given = [endpoint, bucket, accessKeyId, secretAccessKey].filter(Boolean).length; if (given === 0) return null;
  if (given < 4) throw new Error('Asset storage is half-configured: set ASSET_S3_ENDPOINT, ASSET_S3_BUCKET, ASSET_S3_ACCESS_KEY_ID and ASSET_S3_SECRET_ACCESS_KEY together.');
  return { endpoint: endpoint!, bucket: bucket!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, region: e.ASSET_S3_REGION, publicUrl: e.ASSET_PUBLIC_URL };
}
/** Only images, and not large ones. The engine checks type and size before anything reaches storage. */
export const ASSET_LIMITS: NonNullable<VendureConfig['assetOptions']> = { permittedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'], uploadMaxFileSize: 10 * 1024 * 1024 };

export function assetPlugin(a: AssetEnv) {
  return AssetServerPlugin.init({
    route: 'assets', assetUploadDir: '/tmp/osc-assets', namingStrategy: new StoreScopedNaming(),
    // Storefronts load images from the public bucket URL (or a CDN in front of it) when one is set; otherwise through the engine's /assets route, which resizes and caches.
    ...(a.publicUrl ? { assetUrlPrefix: a.publicUrl.replace(/\/?$/, '/') } : {}),
    storageStrategyFactory: configureS3AssetStorage({ bucket: a.bucket, credentials: { accessKeyId: a.accessKeyId, secretAccessKey: a.secretAccessKey }, nativeS3Configuration: { endpoint: a.endpoint, region: a.region ?? 'auto', forcePathStyle: true } }),
  });
}
