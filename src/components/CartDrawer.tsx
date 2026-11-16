import { ArrowLeft, CheckCircle2, Minus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppUser, CartItem, Order } from '../types.ts';
import { formatPrice } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  user: AppUser | null;
  onSignIn: () => Promise<AppUser | null>;
  getIdToken: () => Promise<string | null>;
  onOrderCreated: (order: Order) => void;
  onTrackOrder: (orderNumber: string, email: string) => void;
}

const FREE_SHIPPING_THRESHOLD = 20000;
const SHIPPING_FEE = 1500;

export function CartDrawer({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  user,
  onSignIn,
  getIdToken,
  onOrderCreated,
  onTrackOrder,
}: CartDrawerProps) {
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.name);
      setCustomerEmail((prev) => prev || user.email);
    }
  }, [user]);

  useEffect(() => {
    if (!open) {
      setError(null);
      if (step === 'confirmed') {
        setStep('bag');
        setConfirmedOrder(null);
      }
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, step, onClose]);

  if (!open) return null;

  const subtotalCents = items.reduce((acc, item) => acc + item.priceCents * item.quantity, 0);
  const qualifiesFreeShipping = subtotalCents >= FREE_SHIPPING_THRESHOLD || subtotalCents === 0;
  const shippingCents = qualifiesFreeShipping ? 0 : SHIPPING_FEE;
  const totalCents = subtotalCents + shippingCents;
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalCents);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in with Google before placing an order.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication expired. Please sign in again.');
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress,
          shippingCity,
          shippingPostalCode,
          paymentMethod,
          notes,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not place order.');
      }

      setConfirmedOrder(data.order);
      setStep('confirmed');
      onOrderCreated(data.order);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag and checkout"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full flex flex-col border-l border-[#E4E4E0] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E4E0] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('bag');
                }}
                aria-label="Back to bag"
                className="p-1.5 rounded-md hover:bg-[#F4F4F1] text-[#52525B] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-serif text-xl font-medium text-[#141414]">
              {step === 'bag' && 'Shopping Bag'}
              {step === 'checkout' && 'Checkout'}
              {step === 'confirmed' && 'Order Confirmed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-md text-[#52525B] hover:text-[#141414] hover:bg-[#F4F4F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-6">
              <div className="p-5 bg-[#F7F7F5] border border-[#E4E4E0] rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-[#15803D] text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Order {confirmedOrder.orderNumber} Confirmed — Preparing Shipment</span>
                </div>
                <p className="text-xs text-[#52525B]">
                  Tracking Code:{' '}
                  <span className="font-mono text-[#141414] font-medium">
                    {confirmedOrder.trackingCode}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141414]">Receipt Summary</h3>
                <div className="divide-y divide-[#E4E4E0] border-t border-b border-[#E4E4E0]">
                  {confirmedOrder.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-[#141414]">{item.productName}</p>
                        <p className="text-xs text-[#71717A] font-mono">
                          Qty {item.quantity} · {formatPrice(item.unitPriceCents)}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-[#141414]">
                        {formatPrice(item.unitPriceCents * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 text-sm pt-2">
                  <div className="flex justify-between text-[#52525B]">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatPrice(confirmedOrder.subtotalCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#52525B]">
                    <span>Shipping</span>
                    <span className="font-mono tabular-nums">
                      {confirmedOrder.shippingCents === 0
                        ? 'Complimentary'
                        : formatPrice(confirmedOrder.shippingCents)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-[#141414] pt-2 border-t border-[#E4E4E0]">
                    <span>
                      Total ({confirmedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid'})
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatPrice(confirmedOrder.totalCents)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onTrackOrder(confirmedOrder.orderNumber, confirmedOrder.customerEmail);
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] transition-colors cursor-pointer"
                >
                  View Order Status & Tracking
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 border border-[#D4D4D0] text-[#141414] text-sm font-medium rounded-lg hover:bg-[#F7F7F5] transition-colors cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 space-y-3">
              <p className="font-serif text-lg text-[#141414]">Your bag is empty</p>
              <p className="text-sm text-[#71717A] max-w-xs">
                Browse our catalog of lighting, stoneware, and architectural desk objects to add items.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-5 py-2.5 bg-[#141414] text-white text-xs font-medium rounded-lg hover:bg-[#27272A] cursor-pointer"
              >
                Explore Catalog
              </button>
            </div>
          ) : step === 'bag' ? (
            <div className="space-y-6">
              {/* Free shipping notice */}
              <div className="p-3.5 bg-[#F7F7F5] border border-[#E4E4E0] rounded-lg text-xs text-[#52525B]">
                {qualifiesFreeShipping ? (
                  <span className="text-[#15803D] font-medium">
                    Your order qualifies for complimentary insured shipping.
                  </span>
                ) : (
                  <span>
                    Add <strong className="font-mono text-[#141414]">{formatPrice(remainingForFree)}</strong> more for complimentary shipping (standard rate {formatPrice(SHIPPING_FEE)}).
                  </span>
                )}
              </div>

              {/* Line items */}
              <div className="divide-y divide-[#E4E4E0]">
                {items.map((item) => (
                  <div key={item.productId} className="py-4 flex gap-4">
                    <div className="w-20 h-20 rounded-md bg-[#ECECE8] overflow-hidden shrink-0">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#141414] truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-[#71717A] font-mono">
                            {item.sku} · {formatPrice(item.priceCents)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          aria-label={`Remove ${item.name}`}
                          className="p-1 text-[#71717A] hover:text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="inline-flex items-center border border-[#D4D4D0] rounded-md">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="p-1.5 text-[#141414] hover:bg-[#F7F7F5] cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono text-xs tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.stock}
                            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="p-1.5 text-[#141414] disabled:text-[#A1A1AA] hover:bg-[#F7F7F5] cursor-pointer disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="font-mono text-sm font-medium tabular-nums text-[#141414]">
                          {formatPrice(item.priceCents * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Checkout Form */
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-5">
              {!user && (
                <div className="p-4 bg-[#F7F7F5] border border-[#E4E4E0] rounded-lg space-y-3">
                  <p className="text-sm font-medium text-[#141414]">
                    Sign in to place and track your order
                  </p>
                  <p className="text-xs text-[#52525B]">
                    Your shopping bag will be preserved automatically when you sign in with Google.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSignIn()}
                    className="w-full py-2.5 px-4 bg-[#141414] text-white text-xs font-medium rounded-lg hover:bg-[#27272A] transition-colors cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#141414]">Recipient & Delivery</h3>

                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#52525B] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#52525B] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="410 Mercer Street, Apt 4B"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#52525B] mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="New York"
                      className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#52525B] mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingPostalCode}
                      onChange={(e) => setShippingPostalCode(e.target.value)}
                      placeholder="10013"
                      className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#E4E4E0]">
                <h3 className="text-sm font-semibold text-[#141414]">Payment Method</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 text-left border rounded-lg transition-colors cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#141414] bg-[#F7F7F5]'
                        : 'border-[#E4E4E0] hover:border-[#D4D4D0]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#141414]">Card Payment</p>
                    <p className="text-[11px] text-[#71717A] mt-0.5">Instant confirmation</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 text-left border rounded-lg transition-colors cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'border-[#141414] bg-[#F7F7F5]'
                        : 'border-[#E4E4E0] hover:border-[#D4D4D0]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#141414]">Cash on Delivery</p>
                    <p className="text-[11px] text-[#71717A] mt-0.5">
                      Pay {formatPrice(totalCents)} upon arrival
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">
                  Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Leave with concierge or ring bell 4B"
                  className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer Totals & CTA */}
        {items.length > 0 && step !== 'confirmed' && (
          <div className="p-6 border-t border-[#E4E4E0] bg-[#F7F7F5] space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#52525B]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-[#52525B]">
                <span>Shipping</span>
                <span className="font-mono tabular-nums">
                  {shippingCents === 0 ? 'Complimentary' : formatPrice(shippingCents)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-[#141414] pt-2 border-t border-[#E4E4E0]">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatPrice(totalCents)}</span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3 px-6 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                Proceed to Checkout
              </button>
            ) : (
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting || !user}
                className="w-full py-3 px-6 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] disabled:bg-[#D4D4D0] disabled:text-[#71717A] transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Placing Order...'
                  : `Place Order · ${formatPrice(totalCents)}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
