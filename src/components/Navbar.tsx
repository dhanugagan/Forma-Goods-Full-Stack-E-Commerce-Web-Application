import { ShoppingBag } from 'lucide-react';
import type { AppUser } from '../types.ts';

export type ActiveView = 'storefront' | 'orders' | 'admin';

interface NavbarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onScrollToSection: (sectionId: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  user: AppUser | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Navbar({
  activeView,
  onNavigate,
  onScrollToSection,
  cartCount,
  onOpenCart,
  user,
  authLoading,
  onSignIn,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#F7F7F5]/95 backdrop-blur-sm border-b border-[#E4E4E0]">
      <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('storefront')}
          className="font-serif text-xl font-semibold tracking-tight text-[#141414] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#141414]"
        >
          Forma Goods
        </button>

        {/* Zone 2: 4–5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#52525B]">
          <button
            type="button"
            onClick={() => {
              onNavigate('storefront');
              setTimeout(() => onScrollToSection('catalog'), 50);
            }}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
              activeView === 'storefront'
                ? 'text-[#141414] border-[#141414]'
                : 'border-transparent hover:text-[#141414] hover:border-[#D4D4D0]'
            }`}
          >
            Catalog
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate('storefront');
              setTimeout(() => onScrollToSection('craft'), 50);
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-[#141414] hover:border-[#D4D4D0] transition-colors cursor-pointer"
          >
            Materials
          </button>

          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
              activeView === 'orders'
                ? 'text-[#141414] border-[#141414]'
                : 'border-transparent hover:text-[#141414] hover:border-[#D4D4D0]'
            }`}
          >
            Track Order
          </button>

          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
                activeView === 'admin'
                  ? 'text-[#1D4ED8] border-[#1D4ED8]'
                  : 'border-transparent hover:text-[#141414] hover:border-[#D4D4D0]'
              }`}
            >
              Admin Console
            </button>
          )}

          {!authLoading && (
            user ? (
              <button
                type="button"
                onClick={onSignOut}
                title={`Signed in as ${user.email} (${user.role})`}
                className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-[#141414] hover:border-[#D4D4D0] transition-colors cursor-pointer truncate max-w-[180px]"
              >
                Sign Out · {user.name.split(' ')[0]}
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-[#141414] hover:border-[#D4D4D0] transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#141414] text-white rounded-lg hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Bag</span>
            <span className="font-mono tabular-nums text-xs opacity-90">({cartCount})</span>
          </button>
        </div>
      </div>

      {/* Mobile compact navigation row (kept well within 15% height cap) */}
      <div className="md:hidden border-t border-[#E4E4E0] px-4 py-2 flex items-center justify-between gap-4 overflow-x-auto text-xs font-medium text-[#52525B]">
        <button
          type="button"
          onClick={() => onNavigate('storefront')}
          className={`whitespace-nowrap shrink-0 ${activeView === 'storefront' ? 'text-[#141414] font-semibold' : ''}`}
        >
          Catalog
        </button>
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className={`whitespace-nowrap shrink-0 ${activeView === 'orders' ? 'text-[#141414] font-semibold' : ''}`}
        >
          Track Order
        </button>
        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className={`whitespace-nowrap shrink-0 ${activeView === 'admin' ? 'text-[#1D4ED8] font-semibold' : ''}`}
          >
            Admin
          </button>
        )}
        {!authLoading && (
          user ? (
            <button type="button" onClick={onSignOut} className="whitespace-nowrap shrink-0">
              Sign Out
            </button>
          ) : (
            <button type="button" onClick={onSignIn} className="whitespace-nowrap shrink-0">
              Sign In
            </button>
          )
        )}
      </div>
    </header>
  );
}
