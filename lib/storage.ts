import 'server-only'
// Server only. Neon Object Storage through the AWS S3 client.
// Endpoint, region and credentials come from the AWS_* env vars pulled by `neon deploy`
// (AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
// Bucket "assets" is private (declared in neon.ts): serve files with presigned URLs, never public links.
import {DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'

export const ASSETS_BUCKET = 'assets'

let client: S3Client | undefined
const s3 = () => (client ??= new S3Client({forcePathStyle: true})) // Neon requires path-style addressing

const Bucket = ASSETS_BUCKET
const files = {
  async upload(Key: string, Body: string | Uint8Array, {contentType}: {contentType: string}) {
    await s3().send(new PutObjectCommand({Bucket, Key, Body, ContentType: contentType}))
  },
  async exists(Key: string) {
    try { await s3().send(new HeadObjectCommand({Bucket, Key})); return true } catch (e) {
      if ((e as {$metadata?: {httpStatusCode?: number}}).$metadata?.httpStatusCode === 404) return false
      throw e
    }
  },
  async download(Key: string) {
    const res = await s3().send(new GetObjectCommand({Bucket, Key}))
    return {text: () => res.Body!.transformToString(), bytes: () => res.Body!.transformToByteArray()}
  },
  url: (Key: string, {expiresIn = 3600}: {expiresIn?: number} = {}) => getSignedUrl(s3(), new GetObjectCommand({Bucket, Key}), {expiresIn}),
  async delete(Key: string) { await s3().send(new DeleteObjectCommand({Bucket, Key})) },
}
export const storage = () => files

/** Object key for a design image; matches the path CHECK in db/schema.sql (designs.before_path / after_path). */
export const designImageKey = (designId: string, side: 'before' | 'after', ext: 'jpg' | 'webp' | 'png') => {
  if (!/^[0-9a-f-]{36}$/.test(designId)) throw new Error('bad design id')
  if (side === 'before' && ext === 'png') throw new Error('before must be jpg or webp')
  return `designs/${designId}/${side}.${ext}`
}

/** Compatibility helpers for callers using the original upload API. */
export async function uploadObject(key: string, body: Uint8Array | string, contentType = 'application/octet-stream') {
  await files.upload(key, body, {contentType})
  return {key}
}

export async function getObjectUrl(key: string, expiresIn = 3600) {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 604800) {
    throw new Error('expiresIn must be an integer from 1 to 604800 seconds')
  }
  return files.url(key, {expiresIn})
}
