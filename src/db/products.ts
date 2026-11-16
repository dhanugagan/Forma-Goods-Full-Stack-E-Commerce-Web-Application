import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { products } from './schema.ts';

export interface ProductInput {
  sku: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  dimensions?: string;
  materials?: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
  badge?: string | null;
  featured?: boolean;
  active?: boolean;
}

const SEED_PRODUCTS: ProductInput[] = [
  {
    sku: 'FG-LMP-01',
    name: 'Kanso Articulated Task Lamp',
    slug: 'kanso-articulated-task-lamp',
    category: 'Lighting',
    description:
      'Precision-machined matte black anodized aluminum task lamp featuring solid brass friction joints, balanced cantilever arm, and warm 2700K glare-free LED optics.',
    dimensions: '48 × 16 × 52 cm',
    materials: 'Anodized Aluminum, Solid Brass, Braided Linen Cord',
    priceCents: 28500,
    stock: 14,
    imageUrl: '/src/assets/images/product_task_lamp_1794845502286.jpg',
    badge: 'Featured',
    featured: true,
    active: true,
  },
  {
    sku: 'FG-CER-02',
    name: 'Kuro Stoneware Pour-Over Set',
    slug: 'kuro-stoneware-pour-over-set',
    category: 'Ceramics',
    description:
      'Wheel-thrown high-fire stoneware carafe and ribbed cone dripper finished in a mineral matte charcoal glaze. Engineered for thermal retention and clean extraction.',
    dimensions: '13 × 13 × 21 cm · 600 ml',
    materials: 'Iron-rich Stoneware Clay, Mineral Ash Glaze',
    priceCents: 11800,
    stock: 22,
    imageUrl: '/src/assets/images/product_ceramic_carafe_1794845503488.jpg',
    badge: 'Small Batch',
    featured: true,
    active: true,
  },
  {
    sku: 'FG-DSK-03',
    name: 'Atelier Walnut Valet Tray',
    slug: 'atelier-walnut-valet-tray',
    category: 'Desk Objects',
    description:
      'CNC-milled from kiln-dried American black walnut and inlaid with hand-fitted brushed brass channels. Sized for mobile dock, fountain pens, keys, and daily essentials.',
    dimensions: '31 × 21 × 2.4 cm',
    materials: 'American Black Walnut, Brushed Brass, Natural Tung Oil',
    priceCents: 16400,
    stock: 18,
    imageUrl: '/src/assets/images/product_walnut_tray_1794845503628.jpg',
    badge: null,
    featured: true,
    active: true,
  },
  {
    sku: 'FG-DSK-04',
    name: 'Monolith Machined Brass Pen',
    slug: 'monolith-machined-brass-pen',
    category: 'Desk Objects',
    description:
      'Turned from solid C36000 free-machining brass bar stock with diamond-knurled grip section and German Schmidt iridium fine nib. Develops an honest patina over years of writing.',
    dimensions: '13.8 × 1.2 cm · 54 g',
    materials: 'Solid C36000 Brass, Steel Fine Nib',
    priceCents: 9500,
    stock: 31,
    imageUrl: '/src/assets/images/product_brass_pen_1794845503338.jpg',
    badge: 'Best Seller',
    featured: false,
    active: true,
  },
  {
    sku: 'FG-TXT-05',
    name: 'Flanders Heavy Linen Throw',
    slug: 'flanders-heavy-linen-throw',
    category: 'Textiles',
    description:
      'Loom-woven in Belgium from long-staple flax yarn in a deep slate-indigo basketweave. Pre-washed with river stone enzymes for immediate drape and breathable warmth.',
    dimensions: '145 × 200 cm',
    materials: '100% Belgian Long-Staple Linen (420 GSM)',
    priceCents: 21000,
    stock: 9,
    imageUrl: '/src/assets/images/product_linen_throw_1794845503751.jpg',
    badge: 'Limited Run',
    featured: false,
    active: true,
  },
  {
    sku: 'FG-DSK-06',
    name: 'Dieter Brushed Steel Desk Clock',
    slug: 'dieter-brushed-steel-desk-clock',
    category: 'Desk Objects',
    description:
      'Cylindrical 316L stainless steel case housing a silent high-torque sweep quartz movement, matte alabaster dial, and cobalt-lacquered second hand.',
    dimensions: '11 × 11 × 5.5 cm',
    materials: '316L Brushed Stainless Steel, Mineral Glass',
    priceCents: 14800,
    stock: 16,
    imageUrl: '/src/assets/images/product_desk_clock_1794845505217.jpg',
    badge: 'New',
    featured: true,
    active: true,
  },
];

export async function ensureProductsSeeded() {
  try {
    const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(products);
    const total = countRows[0]?.count ?? 0;
    if (total === 0) {
      await db.insert(products).values(SEED_PRODUCTS).onConflictDoNothing();
    }
  } catch (error) {
    console.error('Database seed check failed:', error);
    throw new Error('Failed to verify product catalog.', { cause: error });
  }
}

export async function listProducts(options?: {
  category?: string;
  search?: string;
  includeInactive?: boolean;
}) {
  try {
    await ensureProductsSeeded();

    const filters = [];
    if (!options?.includeInactive) {
      filters.push(eq(products.active, true));
    }
    if (options?.category && options.category !== 'All') {
      filters.push(eq(products.category, options.category));
    }
    if (options?.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      filters.push(
        or(ilike(products.name, q), ilike(products.description, q), ilike(products.sku, q))
      );
    }

    if (filters.length > 0) {
      return await db
        .select()
        .from(products)
        .where(and(...filters))
        .orderBy(desc(products.featured), desc(products.id));
    }

    return await db.select().from(products).orderBy(desc(products.featured), desc(products.id));
  } catch (error) {
    console.error('Database query failed in listProducts:', error);
    throw new Error('Failed to load product catalog.', { cause: error });
  }
}

export async function getProductById(id: number) {
  try {
    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getProductById:', error);
    throw new Error('Failed to fetch product.', { cause: error });
  }
}

export async function createProduct(input: ProductInput) {
  try {
    const inserted = await db
      .insert(products)
      .values({
        sku: input.sku.trim(),
        name: input.name.trim(),
        slug: input.slug.trim(),
        category: input.category.trim(),
        description: input.description.trim(),
        dimensions: input.dimensions?.trim() ?? '',
        materials: input.materials?.trim() ?? '',
        priceCents: input.priceCents,
        stock: input.stock,
        imageUrl: input.imageUrl.trim(),
        badge: input.badge ? input.badge.trim() : null,
        featured: Boolean(input.featured),
        active: input.active !== undefined ? Boolean(input.active) : true,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createProduct:', error);
    throw new Error('Failed to create product. Ensure SKU and slug are unique.', { cause: error });
  }
}

export async function updateProduct(id: number, input: Partial<ProductInput>) {
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (input.sku !== undefined) updatePayload.sku = input.sku.trim();
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.slug !== undefined) updatePayload.slug = input.slug.trim();
    if (input.category !== undefined) updatePayload.category = input.category.trim();
    if (input.description !== undefined) updatePayload.description = input.description.trim();
    if (input.dimensions !== undefined) updatePayload.dimensions = input.dimensions.trim();
    if (input.materials !== undefined) updatePayload.materials = input.materials.trim();
    if (input.priceCents !== undefined) updatePayload.priceCents = input.priceCents;
    if (input.stock !== undefined) updatePayload.stock = input.stock;
    if (input.imageUrl !== undefined) updatePayload.imageUrl = input.imageUrl.trim();
    if (input.badge !== undefined) updatePayload.badge = input.badge ? input.badge.trim() : null;
    if (input.featured !== undefined) updatePayload.featured = Boolean(input.featured);
    if (input.active !== undefined) updatePayload.active = Boolean(input.active);

    const updated = await db
      .update(products)
      .set(updatePayload)
      .where(eq(products.id, id))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateProduct:', error);
    throw new Error('Failed to update product.', { cause: error });
  }
}

export async function deleteProduct(id: number) {
  try {
    // Soft-archive if product is referenced in historical orders, otherwise hard delete
    const deleted = await db.delete(products).where(eq(products.id, id)).returning();
    return deleted[0] ?? null;
  } catch (error: unknown) {
    // If foreign key constraint prevents deletion, deactivate instead
    try {
      const archived = await db
        .update(products)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      if (archived[0]) {
        return { ...archived[0], archivedInsteadOfDeleted: true };
      }
    } catch (archiveError) {
      console.error('Archive fallback failed:', archiveError);
    }
    console.error('Database query failed in deleteProduct:', error);
    throw new Error('Failed to remove product.', { cause: error });
  }
}
