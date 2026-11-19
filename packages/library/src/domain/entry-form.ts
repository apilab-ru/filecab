const SOURCE_PROTOCOLS = new Set(['http:', 'https:']);

/** Accepts only absolute HTTP and HTTPS viewing links. */
export function isViewingUrl(value: string) {
  try {
    return SOURCE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
