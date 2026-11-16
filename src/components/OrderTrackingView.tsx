import { CheckCircle2, PackageCheck, Search, Truck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AppUser, Order, OrderStatus } from '../types.ts';
import { formatDate, formatPrice } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface OrderTrackingViewProps {
  user: AppUser | null;
  getIdToken: () => Promise<string | null>;
  onSignIn: () => Promise<AppUser | null>;
  onCatalogChanged?: () => void;
  initialLookup?: { orderNumber: string; email: string } | null;
}

const STEPS: OrderStatus[] = ['Confirmed', 'Processing', 'Shipped', 'Delivered'];

function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'Cancelled') {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs font-medium text-[#B91C1C]">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>Order Cancelled — Contact support if you need assistance</span>
      </div>
    );
  }

  const activeIdx = Math.max(0, STEPS.indexOf(status));

  return (
    <div className="grid grid-cols-4 gap-2 pt-2">
      {STEPS.map((step, idx) => {
        const completed = idx <= activeIdx;
        return (
          <div key={step} className="space-y-1.5">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                completed ? 'bg-[#141414]' : 'bg-[#E4E4E0]'
              }`}
            />
            <div className="flex items-center gap-1 text-xs">
              {idx === 0 && <CheckCircle2 className={`w-3.5 h-3.5 ${completed ? 'text-[#141414]' : 'text-[#A1A1AA]'}`} />}
              {idx === 1 && <PackageCheck className={`w-3.5 h-3.5 ${completed ? 'text-[#141414]' : 'text-[#A1A1AA]'}`} />}
              {idx === 2 && <Truck className={`w-3.5 h-3.5 ${completed ? 'text-[#141414]' : 'text-[#A1A1AA]'}`} />}
              {idx === 3 && <CheckCircle2 className={`w-3.5 h-3.5 ${completed ? 'text-[#15803D]' : 'text-[#A1A1AA]'}`} />}
              <span className={completed ? 'font-medium text-[#141414]' : 'text-[#71717A]'}>
                {step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  onCancel,
  cancelling,
}: {
  order: Order;
  onCancel?: (orderId: number) => void;
  cancelling?: boolean;
}) {
  return (
    <article className="bg-white border border-[#E4E4E0] rounded-lg p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E4E4E0]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#71717A]">
            <span className="font-mono font-semibold text-[#141414]">{order.orderNumber}</span>
            <span aria-hidden="true">·</span>
            <span>Placed {formatDate(order.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card Payment'}</span>
          </div>
          <p className="text-sm font-medium text-[#141414]">
            Delivering to {order.customerName}, {order.shippingAddress}, {order.shippingCity}{' '}
            {order.shippingPostalCode}
          </p>
        </div>

        <div className="text-right flex flex-col items-end gap-1.5">
          <p className="text-base font-mono font-semibold tabular-nums text-[#141414]">
            {formatPrice(order.totalCents)}
          </p>
          {order.trackingCode && (
            <p className="text-xs text-[#71717A] font-mono">
              Tracking: {order.trackingCode}
            </p>
          )}
          {onCancel && order.status === 'Confirmed' && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => onCancel(order.id)}
              className="mt-1 px-3 py-1 text-xs font-medium text-[#B91C1C] border border-[#FECACA] rounded hover:bg-[#FEF2F2] transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
        </div>
      </div>

      <OrderProgress status={order.status} />

      <div className="divide-y divide-[#F0F0EC] pt-2">
        {order.items.map((item) => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-md bg-[#ECECE8] overflow-hidden shrink-0">
                <ProductImage
                  src={item.productImage}
                  alt={item.productName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#141414] truncate">{item.productName}</p>
                <p className="text-xs text-[#71717A] font-mono">
                  {item.productSku} · Qty {item.quantity} × {formatPrice(item.unitPriceCents)}
                </p>
              </div>
            </div>
            <span className="font-mono text-sm tabular-nums text-[#141414] shrink-0">
              {formatPrice(item.unitPriceCents * item.quantity)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function OrderTrackingView({
  user,
  getIdToken,
  onSignIn,
  onCatalogChanged,
  initialLookup,
}: OrderTrackingViewProps) {
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState(initialLookup?.orderNumber ?? '');
  const [email, setEmail] = useState(initialLookup?.email ?? '');
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const fetchMyOrders = useCallback(async () => {
    if (!user) {
      setMyOrders([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/orders/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data.orders ?? []);
      }
    } finally {
      setLoadingOrders(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  useEffect(() => {
    if (initialLookup?.orderNumber && initialLookup?.email) {
      setOrderNumber(initialLookup.orderNumber);
      setEmail(initialLookup.email);
    }
  }, [initialLookup]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    setSearching(true);
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Order not found.');
      }
      setLookupResult(data.order);
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Unable to find order.');
    } finally {
      setSearching(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    setCancelError(null);
    setCancellingId(orderId);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not cancel order.');
      }
      setMyOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      if (lookupResult?.id === orderId) {
        setLookupResult(data.order);
      }
      onCatalogChanged?.();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Unable to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="max-w-[1040px] mx-auto px-6 py-12 space-y-12">
      <div className="space-y-2 border-b border-[#E4E4E0] pb-6">
        <h1 className="font-serif text-3xl font-medium text-[#141414]">
          Order Tracking & History
        </h1>
        <p className="text-sm text-[#52525B]">
          Track shipment progress using your order reference or view all orders linked to your account.
        </p>
      </div>

      {/* Order Lookup Card */}
      <div className="bg-white border border-[#E4E4E0] rounded-lg p-6 space-y-5">
        <h2 className="text-base font-semibold text-[#141414]">Look Up an Order</h2>
        <form onSubmit={handleLookup} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[#52525B] mb-1">
              Order Number
            </label>
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="FG-1042"
              className="w-full px-3 py-2 text-sm font-mono border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#52525B] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>{searching ? 'Checking...' : 'Track Order'}</span>
          </button>
        </form>

        {lookupError && (
          <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg">
            {lookupError}
          </div>
        )}

        {lookupResult && (
          <div className="pt-2">
            <OrderCard order={lookupResult} />
          </div>
        )}
      </div>

      {/* Signed-in User Order History */}
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#141414]">Your Order History</h2>
          {user && (
            <button
              type="button"
              onClick={fetchMyOrders}
              className="text-xs font-medium text-[#52525B] hover:text-[#141414] underline cursor-pointer"
            >
              Refresh Status
            </button>
          )}
        </div>

        {!user ? (
          <div className="bg-white border border-[#E4E4E0] rounded-lg p-8 text-center space-y-3">
            <p className="text-sm font-medium text-[#141414]">
              Sign in to view all past orders automatically
            </p>
            <p className="text-xs text-[#71717A] max-w-md mx-auto">
              Every purchase placed with your Google account is saved to your order history with live status updates.
            </p>
            <button
              type="button"
              onClick={() => onSignIn()}
              className="mt-2 px-5 py-2.5 bg-[#141414] text-white text-xs font-medium rounded-lg hover:bg-[#27272A] cursor-pointer"
            >
              Sign in with Google
            </button>
          </div>
        ) : loadingOrders ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-44 bg-white border border-[#E4E4E0] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : myOrders.length === 0 ? (
          <div className="bg-white border border-[#E4E4E0] rounded-lg p-8 text-center space-y-2">
            <p className="text-sm font-medium text-[#141414]">No orders placed yet</p>
            <p className="text-xs text-[#71717A]">
              Once you complete checkout, your order receipt and live shipping progress will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cancelError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg">
                {cancelError}
              </div>
            )}
            {myOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={handleCancelOrder}
                cancelling={cancellingId === order.id}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
