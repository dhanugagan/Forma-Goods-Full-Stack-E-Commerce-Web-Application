import { ArrowRight, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminConsoleView } from './components/AdminConsoleView.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { Navbar } from './components/Navbar.tsx';
import type { ActiveView } from './components/Navbar.tsx';
import { OrderTrackingView } from './components/OrderTrackingView.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { ProductImage } from './components/ProductImage.tsx';
import { useAuth } from './context/AuthContext.tsx';
import type { CartItem, Order, Product } from './types.ts';

const GUEST_CART_KEY = 'forma_goods_guest_cart';
const CATEGORIES = ['All', 'Lighting', 'Ceramics', 'Desk Objects', 'Textiles'];
const HERO_IMAGE = '/src/assets/images/hero_forma_atelier_1794845502376.jpg';

function loadGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const { dbUser, loading: authLoading, authError, signInWithGoogle, logout, getIdToken } =
    useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('storefront');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadGuestCart());
  const [lookupSeed, setLookupSeed] = useState<{ orderNumber: string; email: string } | null>(
    null
  );

  const hasMergedCartRef = useRef<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load catalog.');
      }
      setProducts(data.products ?? []);
    } catch (err: unknown) {
      setCatalogError(err instanceof Error ? err.message : 'Unable to reach product catalog.');
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Sync guest cart with PostgreSQL when user authenticates
  useEffect(() => {
    let cancelled = false;
    async function syncCartOnSignIn() {
      if (!dbUser) {
        hasMergedCartRef.current = null;
        return;
      }
      if (hasMergedCartRef.current === dbUser.uid) return;
      hasMergedCartRef.current = dbUser.uid;

      try {
        const token = await getIdToken();
        if (!token || cancelled) return;

        const guestItems = loadGuestCart();
        if (guestItems.length > 0) {
          const res = await fetch('/api/cart/merge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              items: guestItems.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
              })),
            }),
          });
          if (res.ok && !cancelled) {
            const data = await res.json();
            setCartItems(data.items ?? []);
            localStorage.removeItem(GUEST_CART_KEY);
          }
        } else {
          const res = await fetch('/api/cart', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok && !cancelled) {
            const data = await res.json();
            setCartItems(data.items ?? []);
          }
        }
      } catch (err) {
        console.error('Cart sync error:', err);
      }
    }
    syncCartOnSignIn();
    return () => {
      cancelled = true;
    };
  }, [dbUser, getIdToken]);

  // Persist guest cart to localStorage when unauthenticated
  useEffect(() => {
    if (!dbUser) {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems));
    }
  }, [cartItems, dbUser]);

  const handleAddToCart = async (product: Product, quantityToAdd = 1) => {
    if (product.stock <= 0) return;

    const existing = cartItems.find((i) => i.productId === product.id);
    const nextQuantity = Math.min(product.stock, (existing?.quantity ?? 0) + quantityToAdd);

    setCartItems((prev) => {
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: nextQuantity } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          quantity: nextQuantity,
          name: product.name,
          sku: product.sku,
          category: product.category,
          priceCents: product.priceCents,
          stock: product.stock,
          imageUrl: product.imageUrl,
        },
      ];
    });

    if (dbUser) {
      const token = await getIdToken();
      if (token) {
        await fetch('/api/cart', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId: product.id, quantity: nextQuantity }),
        }).catch(() => {});
      }
    }
  };

  const handleUpdateCartQuantity = async (productId: number, quantity: number) => {
    if (quantity <= 0) {
      return handleRemoveCartItem(productId);
    }

    setCartItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(i.stock, quantity) } : i
      )
    );

    if (dbUser) {
      const token = await getIdToken();
      if (token) {
        await fetch('/api/cart', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId, quantity }),
        }).catch(() => {});
      }
    }
  };

  const handleRemoveCartItem = async (productId: number) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));

    if (dbUser) {
      const token = await getIdToken();
      if (token) {
        await fetch('/api/cart', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId, quantity: 0 }),
        }).catch(() => {});
      }
    }
  };

  const handleOrderCreated = (_order: Order) => {
    setCartItems([]);
    localStorage.removeItem(GUEST_CART_KEY);
    fetchProducts(); // Refresh live stock counts
  };

  const handleSignOut = async () => {
    await logout();
    setCartItems([]);
    localStorage.removeItem(GUEST_CART_KEY);
    if (activeView === 'admin') {
      setActiveView('storefront');
    }
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    if (sortBy === 'price-asc') {
      return [...filtered].sort((a, b) => a.priceCents - b.priceCents);
    }
    if (sortBy === 'price-desc') {
      return [...filtered].sort((a, b) => b.priceCents - a.priceCents);
    }
    return filtered;
  }, [products, selectedCategory, searchQuery, sortBy]);

  const totalBagCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] text-[#141414]">
      <Navbar
        activeView={activeView}
        onNavigate={setActiveView}
        onScrollToSection={scrollToSection}
        cartCount={totalBagCount}
        onOpenCart={() => setCartOpen(true)}
        user={dbUser}
        authLoading={authLoading}
        onSignIn={signInWithGoogle}
        onSignOut={handleSignOut}
      />

      {authError && (
        <div className="max-w-[1280px] mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg">
            {authError}
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeView === 'admin' && dbUser?.role === 'admin' ? (
          <AdminConsoleView
            currentUser={dbUser}
            getIdToken={getIdToken}
            onCatalogChanged={fetchProducts}
          />
        ) : activeView === 'orders' ? (
          <OrderTrackingView
            user={dbUser}
            getIdToken={getIdToken}
            onSignIn={signInWithGoogle}
            onCatalogChanged={fetchProducts}
            initialLookup={lookupSeed}
          />
        ) : (
          <>
            {/* Section 1: Storefront Hero Split */}
            <section className="border-b border-[#E4E4E0] bg-white">
              <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-5 px-6 py-14 lg:py-20 flex flex-col justify-center space-y-6">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#71717A] font-medium">
                    Autumn Studio Release · Edition 04
                  </p>
                  <h1 className="font-serif text-[clamp(2.25rem,3.6vw,3.4rem)] leading-[1.08] font-medium text-[#141414]">
                    Architectural objects built for quiet daily ritual.
                  </h1>
                  <p className="text-[15px] text-[#52525B] leading-relaxed max-w-md">
                    Precision-machined lighting, high-fire stoneware, and solid walnut desk tools
                    crafted in small batches with complimentary shipping over $200.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => scrollToSection('catalog')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#141414] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Explore Collection</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('orders')}
                      className="px-4 py-3 text-sm font-medium text-[#141414] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Track an Order
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-[#ECECE8] min-h-[320px] lg:min-h-[480px]">
                  <ProductImage
                    src={HERO_IMAGE}
                    alt="Forma Goods walnut desk and articulated studio lamp interior"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </section>

            {/* Section 2: Product Catalog */}
            <section id="catalog" className="max-w-[1280px] mx-auto px-6 py-16 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E4E4E0] pb-6">
                <div className="space-y-1.5">
                  <h2 className="font-serif text-3xl font-medium text-[#141414]">
                    Studio Catalog
                  </h2>
                  <p className="text-sm text-[#52525B]">
                    Live inventory across lighting, stoneware ceramics, textiles, and desk hardware.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Interactive category filter buttons */}
                  <div
                    className="flex items-center gap-1 p-1 bg-[#ECECE8] rounded-lg overflow-x-auto"
                    role="tablist"
                    aria-label="Filter catalog by category"
                  >
                    {CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={selectedCategory === category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedCategory === category
                            ? 'bg-white text-[#141414] shadow-sm'
                            : 'text-[#52525B] hover:text-[#141414]'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative sm:w-52">
                    <Search
                      className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search objects..."
                      aria-label="Search catalog"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D4D4D0] rounded-lg focus:outline-none focus:border-[#141414]"
                    />
                  </div>

                  {/* Sort selector */}
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'featured' | 'price-asc' | 'price-desc')
                    }
                    aria-label="Sort catalog"
                    className="px-3 py-2 text-xs font-medium bg-white border border-[#D4D4D0] rounded-lg text-[#141414] focus:outline-none focus:border-[#141414] cursor-pointer"
                  >
                    <option value="featured">Sort: Featured</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {catalogError && (
                <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-lg flex items-center justify-between">
                  <span>{catalogError}</span>
                  <button
                    type="button"
                    onClick={fetchProducts}
                    className="text-xs font-medium underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {loadingCatalog ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-[#E4E4E0] rounded-lg h-[380px] animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-white border border-[#E4E4E0] rounded-lg p-12 text-center space-y-3">
                  <p className="font-serif text-lg text-[#141414]">
                    No objects match your current filter
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-xs font-medium bg-[#141414] text-white rounded-lg cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={setSelectedProduct}
                      onAddToCart={(p) => handleAddToCart(p, 1)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Craftsmanship & Materials */}
            <section id="craft" className="border-t border-[#E4E4E0] bg-white">
              <div className="max-w-[1280px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-2">
                  <p className="text-xs font-mono text-[#71717A]">01. Material Integrity</p>
                  <h3 className="text-base font-semibold text-[#141414]">
                    Unlacquered Metals & Kiln-Dried Timber
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    Every lamp, pen, and desk tray is machined from solid brass, 316L stainless
                    steel, or FSC-certified American black walnut designed to age naturally.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-mono text-[#71717A]">02. Transparent Fulfillment</p>
                  <h3 className="text-base font-semibold text-[#141414]">
                    Real-Time Inventory & Order Tracking
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    Stock counts update atomically on every checkout. Track your parcel from
                    workshop confirmation through dispatch using your order number.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-mono text-[#71717A]">03. Insured Delivery</p>
                  <h3 className="text-base font-semibold text-[#141414]">
                    Complimentary Shipping Over $200
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    All orders ship within 48 hours in recyclable molded pulp packaging, with
                    card and Cash on Delivery (COD) checkout options available.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4E4E0] bg-[#F7F7F5]">
        <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <p>© {new Date().getFullYear()} Forma Goods Studio. Architectural Home & Studio Objects.</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveView('storefront')}
              className="hover:text-[#141414] cursor-pointer"
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className="hover:text-[#141414] cursor-pointer"
            >
              Order Tracking
            </button>
            {dbUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveView('admin')}
                className="hover:text-[#141414] cursor-pointer"
              >
                Admin Console
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        user={dbUser}
        onSignIn={signInWithGoogle}
        getIdToken={getIdToken}
        onOrderCreated={handleOrderCreated}
        onTrackOrder={(orderNumber, email) => {
          setLookupSeed({ orderNumber, email });
          setActiveView('orders');
        }}
      />
    </div>
  );
}
