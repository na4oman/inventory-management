'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/lib/hooks/useProducts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Loader2, History } from 'lucide-react';
import type { PriceResult } from '@/app/api/price-check/route';

interface ProductResult {
  partNumber: string;
  model: string;
  results: PriceResult[];
  error?: string;
  loading: boolean;
}

interface HistoryEntry {
  id: string;
  part_number: string;
  searched_at: string;
  results: PriceResult[];
}

function parsePrice(priceStr: string | null): number | null {
  if (!priceStr) return null;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

export default function PriceCheckPage() {
  const [manualPartNumber, setManualPartNumber] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [priceResults, setPriceResults] = useState<ProductResult[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');

  const { data: productsData } = useProducts({ search: productSearch, pageSize: 20 });

  const loadHistory = async () => {
    const res = await fetch('/api/price-check/history');
    const data = await res.json();
    if (data.success) setHistory(data.data);
  };

  useEffect(() => { loadHistory(); }, []);

  const checkPrice = async (partNumber: string, model: string) => {
    setPriceResults(prev => {
      const existing = prev.find(r => r.partNumber === partNumber);
      if (existing) {
        return prev.map(r => r.partNumber === partNumber ? { ...r, loading: true, error: undefined } : r);
      }
      return [{ partNumber, model, results: [], loading: true }, ...prev];
    });

    try {
      const res = await fetch(`/api/price-check?partNumber=${encodeURIComponent(partNumber)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch prices');
      setPriceResults(prev =>
        prev.map(r => r.partNumber === partNumber ? { ...r, results: data.data, loading: false } : r)
      );
      // Refresh history after search
      loadHistory();
    } catch (err) {
      setPriceResults(prev =>
        prev.map(r => r.partNumber === partNumber
          ? { ...r, loading: false, error: err instanceof Error ? err.message : 'Failed' }
          : r
        )
      );
    }
  };

  const handleManualSearch = () => {
    if (!manualPartNumber.trim()) return;
    checkPrice(manualPartNumber.trim(), '');
    setManualPartNumber('');
  };

  // Group history by part number for trend analysis
  const historyByPart = history.reduce((acc, entry) => {
    if (!acc[entry.part_number]) acc[entry.part_number] = [];
    acc[entry.part_number].push(entry);
    return acc;
  }, {} as Record<string, HistoryEntry[]>);

  const filteredHistory = historyFilter
    ? history.filter(h => h.part_number.toLowerCase().includes(historyFilter.toLowerCase()))
    : history;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Price Check</h1>
          <p className="text-gray-600 mt-1 text-sm">Search current market prices for your parts</p>
        </div>
        <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="gap-2">
          <History className="h-4 w-4" />
          {showHistory ? 'Hide History' : 'Show History'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Search by Part Number</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. GH82-33783A"
              value={manualPartNumber}
              onChange={e => setManualPartNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
            />
            <Button onClick={handleManualSearch} disabled={!manualPartNumber.trim()}>
              <Search className="h-4 w-4 mr-1" /> Check
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Search from Inventory</p>
          <Input
            placeholder="Search products..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            className="mb-3"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {productsData?.data.map(product => (
              <div key={product.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50">
                <div className="text-sm">
                  <span className="font-medium">{product.part_number}</span>
                  <span className="text-gray-500 ml-2">{product.model}</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7"
                  onClick={() => checkPrice(product.part_number, product.model)}>
                  <Search className="h-3 w-3 mr-1" /> Check Price
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Current Results */}
      {priceResults.length > 0 && (
        <div className="space-y-4">
          {priceResults.map(item => (
            <Card key={item.partNumber} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-lg">{item.partNumber}</span>
                  {item.model && <span className="text-gray-500 ml-2 text-sm">{item.model}</span>}
                </div>
                <Button size="sm" variant="outline" onClick={() => checkPrice(item.partNumber, item.model)}
                  disabled={item.loading} className="text-xs">
                  {item.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : '↻ Refresh'}
                </Button>
              </div>
              {item.loading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching market prices...
                </div>
              ) : item.error ? (
                <div className="text-sm text-red-600 py-2">{item.error}</div>
              ) : item.results.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No results found.</div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-2">Prices are from Google&apos;s index and may differ slightly from current site prices. Click source to verify.</p>
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Source</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Title</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.results.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-xs font-medium">
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                            {r.source}<ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="py-2 px-2 max-w-xs truncate text-sm" title={r.title}>{r.title}</td>
                        <td className="py-2 px-2 text-right font-semibold text-green-700">
                          {r.price ?? <span className="text-gray-400 text-xs font-normal">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Search History</h2>
            <Input
              placeholder="Filter by part number..."
              value={historyFilter}
              onChange={e => setHistoryFilter(e.target.value)}
              className="w-64"
            />
          </div>
          {filteredHistory.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">No history yet</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredHistory.map(entry => {
                // Get previous entry for same part to show trend
                const partHistory = historyByPart[entry.part_number] || [];
                const entryIndex = partHistory.findIndex(h => h.id === entry.id);
                const prevEntry = partHistory[entryIndex + 1];

                // Get lowest price from this entry
                const prices = entry.results.map(r => parsePrice(r.price)).filter(p => p !== null) as number[];
                const minPrice = prices.length > 0 ? Math.min(...prices) : null;

                // Get lowest price from previous entry
                const prevPrices = prevEntry?.results.map(r => parsePrice(r.price)).filter(p => p !== null) as number[] || [];
                const prevMinPrice = prevPrices.length > 0 ? Math.min(...prevPrices) : null;

                const trend = minPrice && prevMinPrice
                  ? minPrice > prevMinPrice ? '↑' : minPrice < prevMinPrice ? '↓' : '='
                  : null;
                const trendColor = trend === '↑' ? 'text-red-500' : trend === '↓' ? 'text-green-500' : 'text-gray-400';

                return (
                  <div key={entry.id} className="border border-gray-100 rounded-md p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{entry.part_number}</span>
                        {trend && <span className={`font-bold text-lg ${trendColor}`}>{trend}</span>}
                        {minPrice && <span className="text-sm text-gray-700">from ${minPrice.toFixed(2)}</span>}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(entry.searched_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.results.filter(r => r.price).map((r, i) => (
                        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center gap-1">
                          <span className="text-gray-600">{r.source}</span>
                          <span className="font-semibold text-green-700">{r.price}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
