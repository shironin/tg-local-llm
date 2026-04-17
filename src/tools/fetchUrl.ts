const MAX_CHARS = 3000;

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
    if (!contentType.includes('text')) return `Error: unsupported content type "${contentType}"`;

    const html = await response.text();
    const text = htmlToText(html);
    return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '… [truncated]' : text;
  },
};
