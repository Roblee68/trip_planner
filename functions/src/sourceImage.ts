const MAX_HTML_BYTES = 300_000;

function publicHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) return null;
    return url.href.slice(0, 2000);
  } catch { return null; }
}

export function sourcePreviewImage(html: string, sourceUrl: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const property = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (property !== 'og:image' && property !== 'twitter:image') continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&');
    if (!content) continue;
    try {
      const image = publicHttpsUrl(new URL(content, sourceUrl).href);
      if (image) return image;
    } catch { /* Keep checking other image tags. */ }
  }
  return '';
}

export async function sourcePreviewImageUrl(sourceUrl: string): Promise<string> {
  if (!publicHttpsUrl(sourceUrl)) return '';
  try {
    const response = await fetch(sourceUrl, {
      redirect: 'error', signal: AbortSignal.timeout(4500),
      headers: { Accept: 'text/html', 'User-Agent': 'PB&B event preview' },
    });
    if (!response.ok || !(response.headers.get('content-type') ?? '').toLowerCase().includes('text/html') || !response.body) return '';
    if (Number(response.headers.get('content-length') ?? 0) > MAX_HTML_BYTES * 4) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.slice(0, MAX_HTML_BYTES - size);
      chunks.push(chunk);
      size += chunk.length;
      if (chunk.length < value.length) break;
    }
    await reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    return sourcePreviewImage(html, sourceUrl);
  } catch { return ''; }
}
