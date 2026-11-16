import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { cartItems, orderItems, orders, products } from './schema.ts';

export const ORDER_STATUSES = [
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface CreateOrderInput {
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  paymentMethod: 'card' | 'cod';
  notes?: string;
  items: Array<{ productId: number; quantity: number }>;
}

const FREE_SHIPPING_THRESHOLD_CENTS = 20000; // $200.00
const STANDARD_SHIPPING_CENTS = 1500; // $15.00

export async function createOrder(input: CreateOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  try {
    return await db.transaction(async (tx) => {
      const productIds = input.items.map((item) => item.productId);
      const dbProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      let subtotalCents = 0;
      const lineItemsToInsert: Array<{
        productId: number;
        productName: string;
        productSku: string;
        productImage: string;
        unitPriceCents: number;
        quantity: number;
      }> = [];

      for (const reqItem of input.items) {
        const product = productMap.get(reqItem.productId);
        if (!product || !product.active) {
          throw new Error(`Product #${reqItem.productId} is no longer available.`);
        }
        if (reqItem.quantity <= 0) {
          throw new Error(`Invalid quantity for ${product.name}.`);
        }
        if (product.stock < reqItem.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Only ${product.stock} remaining.`
          );
        }

        // Atomic conditional stock decrement to prevent overselling
        const decremented = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${reqItem.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(products.id, product.id), sql`${products.stock} >= ${reqItem.quantity}`)
          )
          .returning();

        if (decremented.length === 0) {
          throw new Error(`Insufficient stock for ${product.name}.`);
        }

        subtotalCents += product.priceCents * reqItem.quantity;
        lineItemsToInsert.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productImage: product.imageUrl,
          unitPriceCents: product.priceCents,
          quantity: reqItem.quantity,
        });
      }

      const shippingCents =
        subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : STANDARD_SHIPPING_CENTS;
      const totalCents = subtotalCents + shippingCents;

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `FG-${randomSuffix}`;
      const trackingCode = `TRK-${Date.now().toString(36).toUpperCase().slice(-6)}${randomSuffix}`;

      const insertedOrders = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: input.userId,
          customerName: input.customerName.trim(),
          customerEmail: input.customerEmail.trim(),
          customerPhone: input.customerPhone.trim(),
          shippingAddress: input.shippingAddress.trim(),
          shippingCity: input.shippingCity.trim(),
          shippingPostalCode: input.shippingPostalCode.trim(),
          paymentMethod: input.paymentMethod,
          status: 'Confirmed',
          subtotalCents,
          shippingCents,
          totalCents,
          trackingCode,
          notes: input.notes?.trim() || null,
        })
        .returning();

      const createdOrder = insertedOrders[0];

      const insertedItems = await tx
        .insert(orderItems)
        .values(
          lineItemsToInsert.map((line) => ({
            orderId: createdOrder.id,
            ...line,
          }))
        )
        .returning();

      // Clear user's persisted cart after checkout
      await tx.delete(cartItems).where(eq(cartItems.userId, input.userId));

      return {
        ...createdOrder,
        items: insertedItems,
      };
    });
  } catch (error: unknown) {
    if (error instanceof Error && (
      error.message.includes('Insufficient stock') ||
      error.message.includes('longer available') ||
      error.message.includes('Invalid quantity') ||
      error.message.includes('empty')
    )) {
      throw error;
    }
    console.error('Database transaction failed in createOrder:', error);
    throw new Error('Failed to process order. Please try again.', { cause: error });
  }
}

export async function getOrdersForUser(userId: number) {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    if (userOrders.length === 0) return [];

    const orderIds = userOrders.map((o) => o.id);
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    return userOrders.map((o) => ({
      ...o,
      items: itemsByOrder.get(o.id) ?? [],
    }));
  } catch (error) {
    console.error('Database query failed in getOrdersForUser:', error);
    throw new Error('Failed to load your orders.', { cause: error });
  }
}

export async function getAllOrders() {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    if (allOrders.length === 0) return [];

    const orderIds = allOrders.map((o) => o.id);
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    return allOrders.map((o) => ({
      ...o,
      items: itemsByOrder.get(o.id) ?? [],
    }));
  } catch (error) {
    console.error('Database query failed in getAllOrders:', error);
    throw new Error('Failed to load orders.', { cause: error });
  }
}

export async function lookupOrderByNumberAndEmail(orderNumber: string, email: string) {
  try {
    const matched = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderNumber, orderNumber.trim().toUpperCase()),
          sql`lower(${orders.customerEmail}) = lower(${email.trim()})`
        )
      )
      .limit(1);

    if (matched.length === 0) return null;

    const order = matched[0];
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    return {
      ...order,
      items,
    };
  } catch (error) {
    console.error('Database query failed in lookupOrderByNumberAndEmail:', error);
    throw new Error('Failed to look up order.', { cause: error });
  }
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  trackingCode?: string
) {
  try {
    return await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      const currentOrder = existingRows[0];
      if (!currentOrder) return null;

      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      if (currentOrder.status !== 'Cancelled' && status === 'Cancelled') {
        for (const item of items) {
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));
        }
      } else if (currentOrder.status === 'Cancelled' && status !== 'Cancelled') {
        for (const item of items) {
          const decremented = await tx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(eq(products.id, item.productId), sql`${products.stock} >= ${item.quantity}`)
            )
            .returning();
          if (decremented.length === 0) {
            throw new Error(`Insufficient stock to reactivate ${item.productName}.`);
          }
        }
      }

      const payload: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };
      if (trackingCode !== undefined && trackingCode.trim()) {
        payload.trackingCode = trackingCode.trim();
      }

      const updated = await tx
        .update(orders)
        .set(payload)
        .where(eq(orders.id, orderId))
        .returning();

      return {
        ...updated[0],
        items,
      };
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Insufficient stock')) {
      throw error;
    }
    console.error('Database query failed in updateOrderStatus:', error);
    throw new Error('Failed to update order status.', { cause: error });
  }
}

export async function cancelOrderForUser(orderId: number, userId: number) {
  try {
    return await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1);

      const order = existingRows[0];
      if (!order) return null;

      if (order.status !== 'Confirmed') {
        throw new Error('Only newly confirmed orders can be cancelled before processing.');
      }

      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      for (const item of items) {
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }

      const updated = await tx
        .update(orders)
        .set({
          status: 'Cancelled',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      return {
        ...updated[0],
        items,
      };
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes('Only newly confirmed orders')
    ) {
      throw error;
    }
    console.error('Database query failed in cancelOrderForUser:', error);
    throw new Error('Failed to cancel order.', { cause: error });
  }
}
