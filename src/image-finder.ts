const CUSTOM_SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';

export async function callCustomSearch(
  query: string,
  apiKey: string,
  engineId: string
): Promise<{ link: string; title: string } | null> {
  // Add delay to be nice
  await new Promise((r) => setTimeout(r, 1000));

  const params = new URLSearchParams({
    key: apiKey,
    cx: engineId,
    q: query,
    searchType: 'image',
    num: '1',
    safe: 'off',
  });

  const response = await fetch(`${CUSTOM_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    // Fallback or ignore
    console.warn('Search API Error', response.statusText);
    return null;
  }
  const data = await response.json();
  if (data.items && data.items.length > 0) {
    return {
      link: data.items[0].link,
      title: data.items[0].title,
    };
  }
  return null;
}