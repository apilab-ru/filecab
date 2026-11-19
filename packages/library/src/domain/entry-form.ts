const SOURCE_PROTOCOLS = new Set(['http:', 'https:']);

/** Splits the viewing-link text into trimmed, nonblank lines. */
export function sourceLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Accepts only absolute HTTP and HTTPS viewing links. */
export function isViewingUrl(value: string) {
  try {
    return SOURCE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
