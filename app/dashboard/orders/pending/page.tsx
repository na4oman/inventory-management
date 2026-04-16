'use client';

import { useState, useMemo } from 'react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useClients } from '@/lib/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export default function PendingOrdersPage() {
  const queryClient = useQueryClient();
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'forwarded' | 'wh' | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: number }>({});
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    return {
      order_number: isDesktop,
      client: true,
      model: isDesktop,
      model_code: isDesktop,
      qty: isDesktop,
      ordered: isDesktop,
      wh: true,
      sold: isDesktop,
      pending: true,
      received: isDesktop,
      not_ordered: isDesktop,
      unit_price: true,
      total_amount: isDesktop,
    };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sortBy, setSortBy] = useState<'part_number' | 'client' | 'qty' | 'pending' | 'not_ordered' | 'model' | 'model_code' | 'order_number'>('part_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: ordersData } = useOrders({ status: 'pending', pageSize: 1000 });

  const filteredOrders = useMemo(() => {
    if (!ordersData?.data) return [];
    if (clientFilter === 'all') return ordersData.data;
    if (clientFilter === 'forecast') return ordersData.data.filter(o => o.order_type === 'forecast');
    return ordersData.data.filter(o => o.client_id === clientFilter);
  }, [ordersData?.data, clientFilter]);

  const allItems = useMemo(() => {
    return filteredOrders.flatMap(order =>
      (order.items || [])
        .map(item => ({
          ...item,
          order_number: order.order_number,
          order_id: order.id,
          client_name: order.order_type === 'forecast' ? 'Forecast' : (order.client?.name || 'Unknown'),
        }))
        .filter(item => {
          const pending = item.ordered_qty - ((item as any).sold_qty || (item as any).shipped_qty || 0);
          return pending > 0;
        })
    );
  }, [filteredOrders]);

  const processedItems = useMemo(() => {
    let items = [...allItems];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      items = items.filter(item =>
        item.product?.part_number?.toLowerCase().includes(s) ||
        item.product?.model?.toLowerCase().includes(s) ||
        item.product?.model_code?.toLowerCase().includes(s) ||
        item.order_number?.toLowerCase().includes(s) ||
        item.client_name?.toLowerCase().includes(s)
      );
    }
    if (productFilter) items = items.filter(i => i.product?.part_number === productFilter);

    items.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'part_number': aVal = a.product?.part_number || ''; bVal = b.product?.part_number || ''; break;
        case 'model': aVal = a.product?.model || ''; bVal = b.product?.model || ''; break;
        case 'model_code': aVal = a.product?.model_code || ''; bVal = b.product?.model_code || ''; break;
        case 'order_number': aVal = a.order_number || ''; bVal = b.order_number || ''; break;
        case 'client': aVal = a.client_name || ''; bVal = b.client_name || ''; break;
        case 'qty': aVal = a.ordered_qty; bVal = b.ordered_qty; break;
        case 'pending': aVal = a.ordered_qty - ((a as any).sold_qty || 0); bVal = b.ordered_qty - ((b as any).sold_qty || 0); break;
        case 'not_ordered': aVal = a.ordered_qty - (a.received_qty || 0); bVal = b.ordered_qty - (b.received_qty || 0); break;
        default: aVal = a.product?.part_number || ''; bVal = b.product?.part_number || '';
      }
      if (typeof aVal === 'string') return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return items;
  }, [allItems, searchTerm, productFilter, sortBy, sortOrder]);

  const uniqueProducts = useMemo(() => {
    const map = new Map();
    allItems.forEach(item => {
      if (item.product?.part_number && !map.has(item.product.part_number))
        map.set(item.product.part_number, item.product);
    });
    return Array.from(map.values()).sort((a, b) => a.part_number.localeCompare(b.part_number));
  }, [allItems]);

  const handleSaveForwardedQty = async (itemId: string) => {
    setIsUpdating(itemId);
    try {
      const res = await fetch(`/api/order-items/${itemId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forwarded_qty: editValues[itemId] }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await queryClient.refetchQueries({ queryKey: ['orders'] });
      setEditingId(null); setEditValues({});
    } catch (err) { console.error(err); } finally { setIsUpdating(null); }
  };

  const handleSaveWhQty = async (itemId: string) => {
    setIsUpdating(itemId);
    try {
      const res = await fetch(`/api/order-items/${itemId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wh_qty: editValues[itemId] }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await queryClient.refetchQueries({ queryKey: ['orders'] });
      setEditingId(null); setEditValues({});
    } catch (err) { console.error(err); } finally { setIsUpdating(null); }
  };

  const handleExportToExcel = () => {
    const exportData = processedItems.map(item => {
      const ordered_qty = item.ordered_qty;
      const forwarded_qty = (item as any).forwarded_qty ?? (item.received_qty || 0);
      const wh_qty = (item as any).wh_qty || 0;
      const sold_qty = (item as any).sold_qty || (item as any).shipped_qty || 0;
      const received_qty = sold_qty + wh_qty;
      const pending_qty = ordered_qty - sold_qty;
      const not_ordered_qty = ordered_qty - forwarded_qty - received_qty;
      return {
        'Order #': item.order_number, 'Customer': item.client_name,
        'Part Number': item.product?.part_number, 'Model': item.product?.model,
        'Model Code': item.product?.model_code, 'QTY': ordered_qty,
        'Ordered': forwarded_qty, 'WH': wh_qty, 'Sold': sold_qty,
        'Pending': pending_qty, 'Received': received_qty, 'Not ordered': not_ordered_qty,
        'Unit Price': `€${item.unit_price.toFixed(2)}`,
        'Total Amount': `€${(item.unit_price * ordered_qty).toFixed(2)}`,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Orders');
    ws['!cols'] = [12,15,15,15,15,8,10,8,8,10,10,12,12,12].map(wch => ({ wch }));
    XLSX.writeFile(wb, `pending-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!ordersData) return <LoadingSpinner />;

  const columnDefs: [keyof typeof visibleColumns, string][] = [
    ['order_number','Order #'],['client','Customer'],['model','Model'],['model_code','Model Code'],
    ['qty','QTY'],['ordered','Ordered'],['wh','WH'],['sold','Sold'],['pending','Pending'],
    ['received','Received'],['not_ordered','Not ordered'],['unit_price','Unit Price'],['total_amount','Total Amount'],
  ];

  const hasActiveFilters = clientFilter !== 'all' || !!productFilter;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pending Orders</h1>
        <div className="text-xs text-gray-500">{allItems.length} items / {filteredOrders.length} orders</div>
      </div>

      {/* Controls */}
      <Card className="p-3">
        {/* Always-visible bar: search + excel + toggle */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search part number, model, order #, client..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <Button onClick={handleExportToExcel} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 shrink-0">
            📥 Excel
          </Button>
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`shrink-0 flex items-center gap-1 text-xs px-3 py-2 rounded-md border transition-colors ${
              filtersOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {filtersOpen ? '▲' : '▼'} Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">!</span>
            )}
          </button>
        </div>

        {/* Collapsible filters */}
        {filtersOpen && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Filter by Client:</label>
                <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
                  <option value="all">All Clients</option>
                  <option value="forecast">Forecast</option>
                  {clientsData?.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Filter by Product:</label>
                <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
                  <option value="">All Products</option>
                  {uniqueProducts.map(p => <option key={p.id} value={p.part_number}>{p.part_number} - {p.model}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Sort by:</label>
                <div className="flex gap-1">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none">
                    <option value="part_number">Part Number</option>
                    <option value="model">Model</option>
                    <option value="model_code">Model Code</option>
                    <option value="order_number">Order Number</option>
                    <option value="client">Customer</option>
                    <option value="qty">QTY</option>
                    <option value="pending">Pending</option>
                    <option value="not_ordered">Not Ordered</option>
                  </select>
                  <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-1.5 rounded-md border border-gray-300 bg-white text-sm">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
            {(searchTerm || hasActiveFilters) && (
              <button onClick={() => { setSearchTerm(''); setClientFilter('all'); setProductFilter(''); }}
                className="text-xs text-blue-600 hover:text-blue-800">Clear all filters</button>
            )}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-3 overflow-x-auto">
        {/* Column toggle */}
        <div className="mb-2">
          <button onClick={() => setShowColumnToggle(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 mb-2">
            {showColumnToggle ? '▲' : '▼'} Columns
          </button>
          {showColumnToggle && (
            <div className="flex flex-wrap gap-1 pb-3 border-b border-gray-200">
              {columnDefs.map(([key, label]) => (
                <button key={key}
                  onClick={() => setVisibleColumns(v => ({ ...v, [key]: !v[key] }))}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${visibleColumns[key] ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {allItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">No pending items found</div>
        ) : processedItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">No items match your filters</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <th className="text-left py-2 px-1 font-semibold sticky left-0 bg-gray-50 z-10">Part #</th>
                {visibleColumns.order_number && <th className="text-left py-2 px-1 font-semibold">Order #</th>}
                {visibleColumns.client && <th className="text-left py-2 px-1 font-semibold">Customer</th>}
                {visibleColumns.model && <th className="text-left py-2 px-1 font-semibold">Model</th>}
                {visibleColumns.model_code && <th className="text-left py-2 px-1 font-semibold">Code</th>}
                {visibleColumns.qty && <th className="text-right py-2 px-1 font-semibold">QTY</th>}
                {visibleColumns.ordered && <th className="text-right py-2 px-1 font-semibold">Ord</th>}
                {visibleColumns.wh && <th className="text-right py-2 px-1 font-semibold">WH</th>}
                {visibleColumns.sold && <th className="text-right py-2 px-1 font-semibold">Sold</th>}
                {visibleColumns.pending && <th className="text-right py-2 px-1 font-semibold">Pend</th>}
                {visibleColumns.received && <th className="text-right py-2 px-1 font-semibold">Recv</th>}
                {visibleColumns.not_ordered && <th className="text-right py-2 px-1 font-semibold">Not Ord</th>}
                {visibleColumns.unit_price && <th className="text-right py-2 px-1 font-semibold">Price</th>}
                {visibleColumns.total_amount && <th className="text-right py-2 px-1 font-semibold">Total</th>}
                <th className="text-center py-2 px-1 font-semibold">Act</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map(item => {
                const ordered_qty = item.ordered_qty;
                const forwarded_qty = (item as any).forwarded_qty ?? (item.received_qty || 0);
                const wh_qty = (item as any).wh_qty || 0;
                const sold_qty = (item as any).sold_qty || (item as any).shipped_qty || 0;
                const received_qty = sold_qty + wh_qty;
                const pending_qty = ordered_qty - sold_qty;
                const not_ordered_qty = ordered_qty - forwarded_qty - received_qty;
                const isEditing = editingId === item.id;

                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-1.5 px-1 font-medium whitespace-nowrap sticky left-0 bg-white">{item.product?.part_number}</td>
                    {visibleColumns.order_number && <td className="py-1.5 px-1 text-blue-600 whitespace-nowrap">{item.order_number}</td>}
                    {visibleColumns.client && <td className="py-1.5 px-1 whitespace-nowrap">{item.client_name}</td>}
                    {visibleColumns.model && <td className="py-1.5 px-1 whitespace-nowrap">{item.product?.model}</td>}
                    {visibleColumns.model_code && <td className="py-1.5 px-1 whitespace-nowrap">{item.product?.model_code}</td>}
                    {visibleColumns.qty && <td className="py-1.5 px-1 text-right font-semibold">{ordered_qty}</td>}
                    {visibleColumns.ordered && (
                      <td className="py-1.5 px-1 text-right">
                        {isEditing && editField === 'forwarded' ? (
                          <input type="number" value={editValues[item.id] ?? forwarded_qty}
                            onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10); setEditValues(ev => ({ ...ev, [item.id]: isNaN(v) ? 0 : v })); }}
                            className="w-14 text-right rounded border border-gray-300 px-1 py-0.5" autoFocus min="0" />
                        ) : <span>{forwarded_qty}</span>}
                      </td>
                    )}
                    {visibleColumns.wh && (
                      <td className="py-1.5 px-1 text-right">
                        {isEditing && editField === 'wh' ? (
                          <input type="number" value={editValues[item.id] ?? wh_qty}
                            onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10); setEditValues(ev => ({ ...ev, [item.id]: isNaN(v) ? 0 : v })); }}
                            className="w-14 text-right rounded border border-gray-300 px-1 py-0.5" autoFocus min="0" />
                        ) : <span className="text-blue-600 font-medium">{wh_qty}</span>}
                      </td>
                    )}
                    {visibleColumns.sold && <td className="py-1.5 px-1 text-right text-green-600 font-medium">{sold_qty}</td>}
                    {visibleColumns.pending && (
                      <td className="py-1.5 px-1 text-right">
                        <span className="font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{pending_qty}</span>
                      </td>
                    )}
                    {visibleColumns.received && <td className="py-1.5 px-1 text-right">{received_qty}</td>}
                    {visibleColumns.not_ordered && <td className="py-1.5 px-1 text-right text-orange-600">{not_ordered_qty}</td>}
                    {visibleColumns.unit_price && <td className="py-1.5 px-1 text-right whitespace-nowrap">€{item.unit_price.toFixed(2)}</td>}
                    {visibleColumns.total_amount && <td className="py-1.5 px-1 text-right whitespace-nowrap font-semibold">€{(item.unit_price * ordered_qty).toFixed(2)}</td>}
                    <td className="py-1.5 px-1 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" className="text-xs h-6 px-2"
                            onClick={() => editField === 'forwarded' ? handleSaveForwardedQty(item.id) : handleSaveWhQty(item.id)}
                            disabled={isUpdating === item.id}>Save</Button>
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2"
                            onClick={() => { setEditingId(null); setEditField(null); setEditValues({}); }}
                            disabled={isUpdating === item.id}>✕</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2"
                            onClick={() => { setEditingId(item.id); setEditField('forwarded'); setEditValues({ [item.id]: forwarded_qty }); }}
                            disabled={isUpdating === item.id} title="Edit Ordered">Ord</Button>
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2"
                            onClick={() => { setEditingId(item.id); setEditField('wh'); setEditValues({ [item.id]: wh_qty }); }}
                            disabled={isUpdating === item.id} title="Edit WH">WH</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Summary */}
      {allItems.length > 0 && (
        <Card className="p-3 bg-blue-50">
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3 text-xs">
            {[
              ['Total QTY', allItems.reduce((s, i) => s + i.ordered_qty, 0), ''],
              ['Total WH', allItems.reduce((s, i) => s + ((i as any).wh_qty || 0), 0), 'text-blue-600'],
              ['Total Sold', allItems.reduce((s, i) => s + ((i as any).sold_qty || (i as any).shipped_qty || 0), 0), 'text-green-600'],
              ['Total Pending', allItems.reduce((s, i) => s + (i.ordered_qty - ((i as any).sold_qty || (i as any).shipped_qty || 0)), 0), 'text-red-600'],
              ['Total Ordered', allItems.reduce((s, i) => s + ((i as any).forwarded_qty || i.received_qty || 0), 0), ''],
              ['Total Received', allItems.reduce((s, i) => s + (i.received_qty || 0), 0), ''],
              ['Not Ordered', allItems.reduce((s, i) => s + (i.ordered_qty - ((i as any).forwarded_qty || i.received_qty || 0)), 0), 'text-orange-600'],
            ].map(([label, value, color]) => (
              <div key={label as string}>
                <div className="text-gray-500">{label}</div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
