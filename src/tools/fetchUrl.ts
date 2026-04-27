const MAX_CHARS = 3000;

function getEnvUrls(): Set<string> {
  const origins = new Set<string>();
  for (const value of Object.values(process.env)) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        origins.add(parsed.origin);
      }
    } catch {
      // not a URL, skip
    }
  }
  return origins;
}

function isEnvUrl(url: string): boolean {
  try {
    const requested = new URL(url).origin;
    return getEnvUrls().has(requested);
  } catch {
    return false;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const fetchUrlTool = {
  name: 'fetch_url',
  description: 'Fetch URL, return page text. Use after web_search to read a result.',
  args: { url: 'full URL' },
  async execute(args: Record<string, string>): Promise<string> {
    const url = (args['url'] ?? '').trim();
    if (!url) return 'Error: url is required';

    if (isEnvUrl(url)) {
      console.warn(`[fetchUrl] Blocked request to env URL: ${url}`);
      return 'Error: access to this URL is not allowed';
    }

    console.log(`[fetchUrl] GET ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      return `Error: fetch failed — ${e instanceof Error ? e.message : String(e)}`;
    }

    console.log(`[fetchUrl] HTTP ${response.status}`);

    if (!response.ok) return `Error: HTTP ${response.status} ${response.statusText}`;

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const isText = contentType.includes('text');
    if (!isJson && !isText) return `Error: unsupported content type "${contentType}"`;

    const body = await response.text();
    if (isJson) return body.length > MAX_CHARS ? body.slice(0, MAX_CHARS) + '… [truncated]' : body;
    const text = htmlToText(body);
    return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '… [truncated]' : text;
  },
};
