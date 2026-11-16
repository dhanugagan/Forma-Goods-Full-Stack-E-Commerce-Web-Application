import { and, eq, inArray } from 'drizzle-orm';
import { db } from './index.ts';
import { cartItems, products } from './schema.ts';

export async function getUserCart(userId: number) {
  try {
    const rows = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        name: products.name,
        sku: products.sku,
        category: products.category,
        priceCents: products.priceCents,
        stock: products.stock,
        imageUrl: products.imageUrl,
        active: products.active,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId));
    return rows;
  } catch (error) {
    console.error('Database query failed in getUserCart:', error);
    throw new Error('Failed to load shopping cart.', { cause: error });
  }
}

export async function upsertCartItem(userId: number, productId: number, quantity: number) {
  try {
    if (quantity <= 0) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
      return getUserCart(userId);
    }

    const existing = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(cartItems.id, existing[0].id));
    } else {
      await db.insert(cartItems).values({
        userId,
        productId,
        quantity,
      });
    }

    return getUserCart(userId);
  } catch (error) {
    console.error('Database query failed in upsertCartItem:', error);
    throw new Error('Failed to update shopping cart.', { cause: error });
  }
}

export async function mergeGuestCart(
  userId: number,
  guestItems: Array<{ productId: number; quantity: number }>
) {
  try {
    if (!guestItems.length) {
      return getUserCart(userId);
    }

    const productIds = guestItems.map((i) => i.productId);
    const validProducts = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.active, true)));

    const validMap = new Map(validProducts.map((p) => [p.id, p]));

    for (const item of guestItems) {
      const product = validMap.get(item.productId);
      if (!product || item.quantity <= 0) continue;

      const existing = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, item.productId)))
        .limit(1);

      const nextQty = Math.min(
        product.stock,
        (existing[0]?.quantity ?? 0) + item.quantity
      );
      if (nextQty <= 0) continue;

      if (existing[0]) {
        await db
          .update(cartItems)
          .set({ quantity: nextQty, updatedAt: new Date() })
          .where(eq(cartItems.id, existing[0].id));
      } else {
        await db.insert(cartItems).values({
          userId,
          productId: item.productId,
          quantity: nextQty,
        });
      }
    }

    return getUserCart(userId);
  } catch (error) {
    console.error('Database query failed in mergeGuestCart:', error);
    throw new Error('Failed to synchronize shopping cart.', { cause: error });
  }
}

export async function clearUserCart(userId: number) {
  try {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  } catch (error) {
    console.error('Database query failed in clearUserCart:', error);
    throw new Error('Failed to clear shopping cart.', { cause: error });
  }
}
