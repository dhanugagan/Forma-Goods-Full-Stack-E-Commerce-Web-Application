import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '../types.ts';
import { formatPrice } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const maxQty = Math.max(1, product.stock);

  const handleAdd = () => {
    if (product.stock <= 0) return;
    onAddToCart(product, quantity);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E4E4E0] rounded-lg max-w-4xl w-full overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Product Frame */}
        <div className="bg-[#ECECE8] aspect-[4/3] md:aspect-auto md:min-h-[440px]">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#71717A]">
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.sku}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close product details"
                className="p-1.5 text-[#52525B] hover:text-[#141414] rounded-md hover:bg-[#F4F4F1] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h2 id="pdp-title" className="font-serif text-2xl font-medium text-[#141414]">
                {product.name}
              </h2>
              <p className="mt-2 text-lg font-mono font-medium tabular-nums text-[#141414]">
                {formatPrice(product.priceCents)}
              </p>
            </div>

            <p className="text-sm text-[#52525B] leading-relaxed">{product.description}</p>

            {(product.dimensions || product.materials) && (
              <dl className="pt-4 border-t border-[#E4E4E0] space-y-2 text-xs">
                {product.dimensions && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71717A]">Dimensions</dt>
                    <dd className="text-[#141414] font-mono text-right">{product.dimensions}</dd>
                  </div>
                )}
                {product.materials && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71717A]">Materials</dt>
                    <dd className="text-[#141414] text-right">{product.materials}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-[#71717A]">Availability</dt>
                  <dd
                    className={`font-medium ${
                      product.stock <= 0
                        ? 'text-[#DC2626]'
                        : product.stock <= 5
                          ? 'text-[#B45309]'
                          : 'text-[#15803D]'
                    }`}
                  >
                    {product.stock <= 0 ? 'Out of stock' : `${product.stock} units available`}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Purchase Controls */}
          <div className="pt-4 border-t border-[#E4E4E0] flex items-center gap-4">
            <div className="inline-flex items-center border border-[#D4D4D0] rounded-lg">
              <button
                type="button"
                disabled={quantity <= 1 || product.stock <= 0}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="p-2.5 text-[#141414] disabled:text-[#A1A1AA] hover:bg-[#F7F7F5] cursor-pointer disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-mono text-sm tabular-nums text-[#141414]">
                {product.stock <= 0 ? 0 : quantity}
              </span>
              <button
                type="button"
                disabled={quantity >= maxQty || product.stock <= 0}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                aria-label="Increase quantity"
                className="p-2.5 text-[#141414] disabled:text-[#A1A1AA] hover:bg-[#F7F7F5] cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={handleAdd}
              className="flex-1 py-3 px-6 text-sm font-medium rounded-lg bg-[#141414] text-white hover:bg-[#27272A] disabled:bg-[#E4E4E0] disabled:text-[#71717A] transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              {product.stock <= 0
                ? 'Currently Out of Stock'
                : `Add to Bag · ${formatPrice(product.priceCents * quantity)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
