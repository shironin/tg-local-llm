import { config } from '../config';

const MAX_RESULTS = 5;

interface SearxngResult {
  title: string;
  url: string;
  content?: string;
}

interface SearxngResponse {
  results: SearxngResult[];
}

export const webSearchTool = {
  name: 'web_search',
  description: 'Web search. Returns title+url+snippet list.',
  args: { query: 'search query' },
  async execute(args: Record<string, string> | string): Promise<string> {
    const query = (typeof args === 'string' ? args : (args['query'] ?? '')).trim();
    if (!query) return 'Error: query is required';

    const url = `${config.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&language=en`;
    console.log(`[webSearch] GET ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
    } catch (e) {
      console.error('[webSearch] fetch threw:', e);
      return `Error: network request failed — ${e instanceof Error ? e.message : String(e)}`;
    }

    console.log(`[webSearch] HTTP ${response.status} ${response.statusText}`);

    if (response.status === 403) {
      return 'Error: SearXNG returned 403 Forbidden. The service may be misconfigured.';
    }
    if (!response.ok) {
      return `Error: SearXNG returned HTTP ${response.status} ${response.statusText}.`;
    }

    let data: SearxngResponse;
    try {
      data = (await response.json()) as SearxngResponse;
    } catch (e) {
      return `Error: failed to parse SearXNG response — ${e instanceof Error ? e.message : String(e)}`;
    }

    const results = (data.results ?? []).slice(0, MAX_RESULTS).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ?? '',
    }));

    if (results.length === 0) {
      return 'No results found. Try a broader search query.';
    }

    return JSON.stringify(results);
  },
};
