import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export interface PriceResult {
  source: string;
  title: string;
  price: string | null;
  url: string;
  snippet: string;
}

const PRICE_REGEX = /(?:€|EUR|USD|\$|BGN|лв\.?|GBP|£)\s*[\d\s,.]+|[\d\s,.]+\s*(?:€|EUR|USD|\$|BGN|лв\.?|GBP|£)/gi;

function extractPrice(text: string): string | null {
  const matches = text.match(PRICE_REGEX);
  if (!matches) return null;
  return matches.find(m => /\d/.test(m))?.trim() || null;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

export async function GET(request: NextRequest) {
  const partNumber = request.nextUrl.searchParams.get('partNumber');
  if (!partNumber) {
    return NextResponse.json(createErrorResponse('partNumber is required'), { status: 400 });
  }

  const serpApiKey = process.env.SERPAPI_KEY;

  if (serpApiKey) {
    try {
      // Search across specific Samsung parts suppliers using site: operators
      const siteQuery = `${partNumber} (site:rounded.com OR site:samsungparts.com OR site:parts4gsm.com OR site:alphamobile.eu OR site:stels.bg OR site:shop.maxservice.bg OR site:componentidigitali.com OR site:icell.bg)`;
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(siteQuery)}&api_key=${serpApiKey}&engine=google&num=10`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error('SerpApi error:', data.error);
      } else {
        const items = data.organic_results || [];
        console.log(`Organic search: ${items.length} results for ${partNumber}`);

        const results: PriceResult[] = items
          .map((item: any) => {
            // Extract price from rich_snippet.bottom.detected_extensions
            const ext = item.rich_snippet?.bottom?.detected_extensions;
            let price: string | null = null;
            if (ext?.price && ext?.currency) {
              const symbol = ext.currency === 'EUR' ? '€' : ext.currency === 'USD' ? '$' : ext.currency;
              price = `${symbol}${parseFloat(ext.price).toFixed(2)}`;
            } else if (ext?.price) {
              price = String(ext.price);
            } else {
              // Fallback: check rich_snippet extensions array for formatted price
              const extensions = item.rich_snippet?.bottom?.extensions || [];
              const priceExt = extensions.find((e: string) => /[€$£]\d/.test(e));
              price = priceExt || extractPrice(`${item.title} ${item.snippet || ''}`);
            }
            return {
              source: getDomain(item.link),
              title: item.title,
              price,
              url: item.link,
              snippet: item.snippet || '',
            };
          })
          .filter((r: PriceResult) => r.price !== null)
          .reduce((acc: PriceResult[], r: PriceResult) => {
            // Keep only one result per source
            if (!acc.find(existing => existing.source === r.source)) acc.push(r);
            return acc;
          }, [])
          .slice(0, 5);

        // If prices found, return them
        if (results.length > 0) {
          await supabase.from('price_check_history').insert({ part_number: partNumber, results });
          return NextResponse.json(createSuccessResponse(results));
        }

        // Return top results even without prices (at least they're relevant)
        const topResults: PriceResult[] = items.slice(0, 5).map((item: any) => ({
          source: getDomain(item.link),
          title: item.title,
          price: null,
          url: item.link,
          snippet: item.snippet || '',
        }));

        if (topResults.length > 0) {
          await supabase.from('price_check_history').insert({ part_number: partNumber, results: topResults });
          return NextResponse.json(createSuccessResponse(topResults));
        }
      }
    } catch (err) {
      console.error('SerpApi failed:', err);
    }
  }

  // Fallback: direct supplier links
  const query = encodeURIComponent(partNumber);
  return NextResponse.json(createSuccessResponse([
    { source: 'parts4gsm.com', title: `Search Parts4GSM for ${partNumber}`, price: null, url: `https://www.parts4gsm.com/search?q=${query}`, snippet: '' },
    { source: 'samsungparts.com', title: `Search SamsungParts for ${partNumber}`, price: null, url: `https://www.samsungparts.com/search?q=${query}`, snippet: '' },
    { source: 'alphamobile.eu', title: `Search AlphaMobile for ${partNumber}`, price: null, url: `https://www.alphamobile.eu/search?q=${query}`, snippet: '' },
    { source: 'rounded.com', title: `Search Rounded for ${partNumber}`, price: null, url: `https://rounded.com/search?q=${query}`, snippet: '' },
    { source: 'shop.maxservice.bg', title: `Search MaxService for ${partNumber}`, price: null, url: `https://shop.maxservice.bg/search?q=${query}`, snippet: '' },
    { source: 'stels.bg', title: `Search Stels for ${partNumber}`, price: null, url: `https://stels.bg/search?q=${query}`, snippet: '' },
  ]));
}
