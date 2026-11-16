import { Download, Edit3, Plus, Search, Shield, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppUser, Order, OrderStatus, Product } from '../types.ts';
import { STUDIO_IMAGE_PRESETS, formatDate, formatPrice } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface AdminConsoleViewProps {
  currentUser: AppUser;
  getIdToken: () => Promise<string | null>;
  onCatalogChanged: () => void;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

const CATEGORIES = ['Lighting', 'Ceramics', 'Desk Objects', 'Textiles'];

interface ProductFormState {
  id?: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  dimensions: string;
  materials: string;
  priceDollars: string;
  stock: string;
  imageUrl: string;
  badge: string;
  featured: boolean;
  active: boolean;
}

const EMPTY_FORM: ProductFormState = {
  sku: '',
  name: '',
  category: 'Desk Objects',
  description: '',
  dimensions: '',
  materials: '',
  priceDollars: '95.00',
  stock: '15',
  imageUrl: STUDIO_IMAGE_PRESETS[0].url,
  badge: '',
  featured: false,
  active: true,
};

export function AdminConsoleView({
  currentUser,
  getIdToken,
  onCatalogChanged,
}: AdminConsoleViewProps) {
  const [tab, setTab] = useState<'products' | 'orders' | 'users'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Product modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [savingProduct, setSavingProduct] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Order inline tracking drafts
  const [trackingDrafts, setTrackingDrafts] = useState<Record<number, string>>({});
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired.');
      const headers = { Authorization: `Bearer ${token}` };

      const [prodRes, ordRes, usrRes] = await Promise.all([
        fetch('/api/admin/products', { headers }),
        fetch('/api/admin/orders', { headers }),
        fetch('/api/admin/users', { headers }),
      ]);

      if (!prodRes.ok || !ordRes.ok || !usrRes.ok) {
        const failed = await [prodRes, ordRes, usrRes].find((r) => !r.ok)?.json().catch(() => ({}));
        throw new Error(failed?.error || 'Failed to load admin console data.');
      }

      const [prodData, ordData, usrData] = await Promise.all([
        prodRes.json(),
        ordRes.json(),
        usrRes.json(),
      ]);

      setProducts(prodData.products ?? []);
      setOrders(ordData.orders ?? []);
      setUsers(usrData.users ?? []);

      const drafts: Record<number, string> = {};
      for (const o of ordData.orders ?? []) {
        drafts[o.id] = o.trackingCode ?? '';
      }
      setTrackingDrafts(drafts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen]);

  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    const revenueCents = validOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const activeOrders = orders.filter(
      (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
    ).length;
    const lowStock = products.filter((p) => p.active && p.stock <= 5).length;
    return {
      revenueCents,
      activeOrders,
      totalSkus: products.length,
      lowStock,
    };
  }, [orders, products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (product: Product) => {
    setForm({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      description: product.description,
      dimensions: product.dimensions,
      materials: product.materials,
      priceDollars: (product.priceCents / 100).toFixed(2),
      stock: String(product.stock),
      imageUrl: product.imageUrl,
      badge: product.badge ?? '',
      featured: product.featured,
      active: product.active,
    });
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedPrice = Math.round(Number(form.priceDollars) * 100);
    const parsedStock = Number.parseInt(form.stock, 10);

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Enter a valid price in USD.');
      return;
    }
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      setFormError('Enter a valid non-negative stock quantity.');
      return;
    }

    setSavingProduct(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired.');

      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category,
        description: form.description,
        dimensions: form.dimensions,
        materials: form.materials,
        priceCents: parsedPrice,
        stock: parsedStock,
        imageUrl: form.imageUrl,
        badge: form.badge || null,
        featured: form.featured,
        active: form.active,
      };

      const isEdit = Boolean(form.id);
      const res = await fetch(isEdit ? `/api/products/${form.id}` : '/api/products', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product.');
      }

      setEditorOpen(false);
      await loadAdminData();
      onCatalogChanged();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await loadAdminData();
        onCatalogChanged();
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const handleUpdateOrder = async (orderId: number, status: OrderStatus) => {
    setSavingOrderId(orderId);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          trackingCode: trackingDrafts[orderId],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order status.');
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      await loadAdminData();
      onCatalogChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update order status.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleExportOrdersCsv = () => {
    const header = [
      'Order Number',
      'Date',
      'Customer Name',
      'Customer Email',
      'Payment Method',
      'Status',
      'Tracking Code',
      'Total USD',
    ];
    const rows = orders.map((o) => [
      o.orderNumber,
      formatDate(o.createdAt),
      `"${o.customerName.replace(/"/g, '""')}"`,
      o.customerEmail,
      o.paymentMethod.toUpperCase(),
      o.status,
      o.trackingCode ?? '',
      (o.totalCents / 100).toFixed(2),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forma-goods-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleUserRole = async (targetUser: AppUser) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? data.user : u)));
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  return (
    <section className="max-w-[1280px] mx-auto px-6 py-10 space-y-8">
      {/* Top Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E4E0] pb-5">
        <div>
          <p className="text-xs text-[#71717A] mb-1">
            Forma Goods <span aria-hidden="true">/</span> Admin Console
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#141414]">
            Store Operations & Inventory
          </h1>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Product</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* 4-column Summary KPI Strip (single-elevation flat bordered cells) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E4E0] rounded-lg p-5 space-y-1">
          <p className="text-xs text-[#71717A]">Total Revenue</p>
          <p className="text-2xl font-mono font-semibold tabular-nums text-[#141414]">
            {formatPrice(metrics.revenueCents)}
          </p>
        </div>
        <div className="bg-white border border-[#E4E4E0] rounded-lg p-5 space-y-1">
          <p className="text-xs text-[#71717A]">Active Orders</p>
          <p className="text-2xl font-mono font-semibold tabular-nums text-[#141414]">
            {metrics.activeOrders}
          </p>
        </div>
        <div className="bg-white border border-[#E4E4E0] rounded-lg p-5 space-y-1">
          <p className="text-xs text-[#71717A]">Catalog SKUs</p>
          <p className="text-2xl font-mono font-semibold tabular-nums text-[#141414]">
            {metrics.totalSkus}
          </p>
        </div>
        <div className="bg-white border border-[#E4E4E0] rounded-lg p-5 space-y-1">
          <p className="text-xs text-[#71717A]">Low Stock Alerts</p>
          <p
            className={`text-2xl font-mono font-semibold tabular-nums ${
              metrics.lowStock > 0 ? 'text-[#D97706]' : 'text-[#15803D]'
            }`}
          >
            {metrics.lowStock}
          </p>
        </div>
      </div>

      {/* Workspace Segmented Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#ECECE8] rounded-lg">
          <button
            type="button"
            onClick={() => setTab('products')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'products'
                ? 'bg-white text-[#141414] shadow-sm'
                : 'text-[#52525B] hover:text-[#141414]'
            }`}
          >
            Products ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'orders'
                ? 'bg-white text-[#141414] shadow-sm'
                : 'text-[#52525B] hover:text-[#141414]'
            }`}
          >
            Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'users'
                ? 'bg-white text-[#141414] shadow-sm'
                : 'text-[#52525B] hover:text-[#141414]'
            }`}
          >
            Users & Roles ({users.length})
          </button>
        </div>

        {tab === 'products' && (
          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter products or SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
            />
          </div>
        )}

        {tab === 'orders' && orders.length > 0 && (
          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-[#D4D4D0] text-[#141414] rounded-lg hover:bg-[#F7F7F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download CSV</span>
          </button>
        )}
      </div>

      {/* Main Content Table */}
      {loading ? (
        <div className="bg-white border border-[#E4E4E0] rounded-lg p-6 space-y-3">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 bg-[#F7F7F5] rounded animate-pulse" />
          ))}
        </div>
      ) : tab === 'products' ? (
        <div className="bg-white border border-[#E4E4E0] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E0] text-xs font-medium text-[#71717A]">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4">Visibility</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EC] text-sm">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-[#FAF9F7] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[#ECECE8] overflow-hidden shrink-0">
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-medium text-[#141414]">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#52525B]">{product.sku}</td>
                  <td className="py-3 px-4 text-xs text-[#52525B]">{product.category}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#141414]">
                    {formatPrice(product.priceCents)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    <span
                      className={
                        product.stock <= 0
                          ? 'text-[#DC2626] font-medium'
                          : product.stock <= 5
                            ? 'text-[#D97706] font-medium'
                            : 'text-[#141414]'
                      }
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className={product.active ? 'text-[#15803D] font-medium' : 'text-[#71717A]'}>
                      {product.active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        aria-label={`Edit ${product.name}`}
                        className="p-1.5 text-[#52525B] hover:text-[#141414] hover:bg-[#F4F4F1] rounded cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        aria-label={`Delete ${product.name}`}
                        className="p-1.5 text-[#52525B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#71717A]">
                    No products match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'orders' ? (
        <div className="bg-white border border-[#E4E4E0] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E0] text-xs font-medium text-[#71717A]">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Tracking Code</th>
                <th className="py-3 px-4">Fulfillment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EC] text-sm">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-[#FAF9F7] transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[#141414]">
                    {order.orderNumber}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#52525B]">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs font-medium text-[#141414]">{order.customerName}</p>
                    <p className="text-[11px] text-[#71717A]">{order.customerEmail}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#52525B]">
                    {order.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#141414]">
                    {formatPrice(order.totalCents)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={trackingDrafts[order.id] ?? ''}
                        onChange={(e) =>
                          setTrackingDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        className="w-32 px-2 py-1 text-xs font-mono border border-[#D4D4D0] rounded focus:outline-none focus:border-[#141414]"
                      />
                      <button
                        type="button"
                        disabled={savingOrderId === order.id}
                        onClick={() => handleUpdateOrder(order.id, order.status)}
                        className="px-2.5 py-1 text-xs font-medium bg-[#F4F4F1] hover:bg-[#E4E4E0] text-[#141414] rounded cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={order.status}
                      disabled={savingOrderId === order.id}
                      onChange={(e) =>
                        handleUpdateOrder(order.id, e.target.value as OrderStatus)
                      }
                      aria-label={`Status for order ${order.orderNumber}`}
                      className="px-2.5 py-1.5 text-xs font-medium border border-[#D4D4D0] rounded bg-white text-[#141414] focus:outline-none focus:border-[#141414] cursor-pointer"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#71717A]">
                    No customer orders yet. Orders placed via checkout will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E4E0] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E0] text-xs font-medium text-[#71717A]">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EC] text-sm">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="py-3 px-4 font-medium text-[#141414]">{u.name}</td>
                    <td className="py-3 px-4 text-xs text-[#52525B]">{u.email}</td>
                    <td className="py-3 px-4 text-xs text-[#52525B]">{formatDate(u.createdAt)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          u.role === 'admin' ? 'text-[#1D4ED8]' : 'text-[#52525B]'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{u.role === 'admin' ? 'Admin' : 'User'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-[#71717A]">Current Session</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleUserRole(u)}
                          className="px-3 py-1.5 text-xs font-medium border border-[#D4D4D0] rounded-md hover:bg-[#F7F7F5] text-[#141414] cursor-pointer"
                        >
                          {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Create/Edit Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={form.id ? 'Edit product' : 'Create new product'}
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="bg-white border border-[#E4E4E0] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E4E4E0] pb-4">
              <h2 className="font-serif text-xl font-medium text-[#141414]">
                {form.id ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 text-[#52525B] hover:text-[#141414] rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Kanso Desk Lamp"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="FG-DSK-07"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg bg-white focus:outline-none focus:border-[#141414]"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Price (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.priceDollars}
                    onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Stock Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={form.dimensions}
                    onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                    placeholder="24 × 16 × 10 cm"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Materials
                  </label>
                  <input
                    type="text"
                    value={form.materials}
                    onChange={(e) => setForm({ ...form, materials: e.target.value })}
                    placeholder="Anodized Aluminum, Walnut"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Studio Image Preset
                  </label>
                  <select
                    value={
                      STUDIO_IMAGE_PRESETS.some((p) => p.url === form.imageUrl)
                        ? form.imageUrl
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setForm({ ...form, imageUrl: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg bg-white focus:outline-none focus:border-[#141414]"
                  >
                    {STUDIO_IMAGE_PRESETS.map((preset) => (
                      <option key={preset.url} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                    <option value="custom">Custom Image Path / URL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Highlight Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="New, Limited Run, Best Seller"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-[#141414] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    className="rounded border-[#D4D4D0]"
                  />
                  <span>Featured in storefront</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-[#141414] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded border-[#D4D4D0]"
                  />
                  <span>Active in catalog</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#E4E4E0]">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-[#D4D4D0] rounded-lg hover:bg-[#F7F7F5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 text-sm font-medium bg-[#141414] text-white rounded-lg hover:bg-[#27272A] cursor-pointer"
                >
                  {savingProduct ? 'Saving...' : form.id ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
