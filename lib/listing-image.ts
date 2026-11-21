/** Remote product photos may only come from known Shopee CDNs. Redirects are disabled by the caller. */
export function isListingImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['down-th.img.susercontent.com', 'down-sg.img.susercontent.com', 'cf.shopee.co.th'].includes(url.hostname)
  } catch { return false }
}
