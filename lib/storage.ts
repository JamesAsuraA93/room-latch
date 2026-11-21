import 'server-only'
// Server only. Neon Object Storage through the AWS S3 client.
// Endpoint, region and credentials come from the AWS_* env vars pulled by `neon deploy`
// (AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
// Bucket "assets" is private (declared in neon.ts): serve files with presigned URLs, never public links.
import {DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'

let client: S3Client | undefined
const s3 = () => (client ??= new S3Client({forcePathStyle: true})) // Neon requires path-style addressing

const Bucket = 'assets'
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
  /** Presigned GET. `downloadName` makes the browser save the file under that name instead of opening it. */
  url: (Key: string, {expiresIn = 3600, downloadName}: {expiresIn?: number; downloadName?: string} = {}) =>
    getSignedUrl(s3(), new GetObjectCommand({Bucket, Key, ResponseContentDisposition: downloadName && `attachment; filename="${downloadName}"`}), {expiresIn}),
  async delete(Key: string) { await s3().send(new DeleteObjectCommand({Bucket, Key})) },
}
export const storage = () => files
