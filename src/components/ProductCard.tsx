import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../types.ts';
import { formatPrice } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, onSelect, onAddToCart }: ProductCardProps) {
  const [justAdded, setJustAdded] = useState(false);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    onAddToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
  };

  const stockLabel =
    product.stock <= 0
      ? 'Out of stock'
      : product.stock <= 5
        ? `Low stock · ${product.stock} left`
        : 'In stock';

  return (
    <article
      onClick={() => onSelect(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(product);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${product.name}`}
      className="group flex flex-col bg-white border border-[#E4E4E0] rounded-lg overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
    >
      {/* 65-75% height product frame */}
      <div className="relative aspect-[4/3] w-full bg-[#ECECE8] overflow-hidden">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      {/* Consistent card metadata & pricing */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-[#71717A] tracking-wide uppercase">
            <span>{product.category}</span>
            {product.badge && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#141414] font-medium">{product.badge}</span>
              </>
            )}
          </div>

          <h3 className="text-base font-semibold text-[#141414] leading-snug line-clamp-1">
            {product.name}
          </h3>

          <p className="text-sm text-[#52525B] line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="pt-3 border-t border-[#F0F0EC] flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[15px] font-mono font-medium tabular-nums text-[#141414]">
              {formatPrice(product.priceCents)}
            </span>
            <span
              className={`text-xs ${
                product.stock <= 0
                  ? 'text-[#DC2626]'
                  : product.stock <= 5
                    ? 'text-[#B45309]'
                    : 'text-[#71717A]'
              }`}
            >
              {stockLabel}
            </span>
          </div>

          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={handleQuickAdd}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              product.stock <= 0
                ? 'bg-[#F4F4F1] text-[#A1A1AA] cursor-not-allowed'
                : justAdded
                  ? 'bg-[#15803D] text-white'
                  : 'bg-[#141414] text-white hover:bg-[#27272A]'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{product.stock <= 0 ? 'Sold Out' : 'Add to Bag'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
