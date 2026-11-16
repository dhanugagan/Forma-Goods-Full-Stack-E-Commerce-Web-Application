import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { requireAdmin, requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
} from './src/db/products.ts';
import {
  clearUserCart,
  getUserCart,
  mergeGuestCart,
  upsertCartItem,
} from './src/db/cart.ts';
import {
  ORDER_STATUSES,
  cancelOrderForUser,
  createOrder,
  getAllOrders,
  getOrdersForUser,
  lookupOrderByNumberAndEmail,
  updateOrderStatus,
} from './src/db/orders.ts';
import type { OrderStatus } from './src/db/orders.ts';
import { getAllUsers, updateUserRole } from './src/db/users.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Current authenticated user + DB role
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  // Public catalog routes
  app.get('/api/products', async (req, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const items = await listProducts({ category, search, includeInactive: false });
      res.json({ products: items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch products.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid product ID.' });
        return;
      }
      const product = await getProductById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      res.json({ product });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load product.';
      res.status(500).json({ error: message });
    }
  });

  // Admin product management routes
  app.get('/api/admin/products', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const items = await listProducts({ includeInactive: true });
      res.json({ products: items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch inventory.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/products', requireAuth, requireAdmin, async (req, res) => {
    try {
      const {
        sku,
        name,
        slug,
        category,
        description,
        dimensions,
        materials,
        priceCents,
        stock,
        imageUrl,
        badge,
        featured,
        active,
      } = req.body ?? {};

      if (!sku || !name || !category || !description || !imageUrl) {
        res.status(400).json({ error: 'Missing required product fields.' });
        return;
      }
      if (!Number.isInteger(Number(priceCents)) || Number(priceCents) < 0) {
        res.status(400).json({ error: 'Price must be a non-negative integer in cents.' });
        return;
      }
      if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
        res.status(400).json({ error: 'Stock must be a non-negative integer.' });
        return;
      }

      const computedSlug =
        typeof slug === 'string' && slug.trim()
          ? slug.trim().toLowerCase()
          : String(name)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');

      const created = await createProduct({
        sku: String(sku),
        name: String(name),
        slug: computedSlug,
        category: String(category),
        description: String(description),
        dimensions: dimensions ? String(dimensions) : '',
        materials: materials ? String(materials) : '',
        priceCents: Number(priceCents),
        stock: Number(stock),
        imageUrl: String(imageUrl),
        badge: badge ? String(badge) : null,
        featured: Boolean(featured),
        active: active !== undefined ? Boolean(active) : true,
      });

      res.status(201).json({ product: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create product.';
      res.status(400).json({ error: message });
    }
  });

  app.patch('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid product ID.' });
        return;
      }
      const updated = await updateProduct(id, req.body ?? {});
      if (!updated) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      res.json({ product: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update product.';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid product ID.' });
        return;
      }
      const removed = await deleteProduct(id);
      if (!removed) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      res.json({ deleted: removed });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete product.';
      res.status(500).json({ error: message });
    }
  });

  // Cart routes (persisted for signed-in users)
  app.get('/api/cart', requireAuth, async (req: AuthRequest, res) => {
    try {
      const items = await getUserCart(req.dbUser!.id);
      res.json({ items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load cart.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/cart', requireAuth, async (req: AuthRequest, res) => {
    try {
      const productId = Number(req.body?.productId);
      const quantity = Number(req.body?.quantity);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity)) {
        res.status(400).json({ error: 'Invalid cart item payload.' });
        return;
      }
      const items = await upsertCartItem(req.dbUser!.id, productId, quantity);
      res.json({ items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update cart.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/cart/merge', requireAuth, async (req: AuthRequest, res) => {
    try {
      const guestItems = Array.isArray(req.body?.items) ? req.body.items : [];
      const items = await mergeGuestCart(req.dbUser!.id, guestItems);
      res.json({ items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to merge cart.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/cart', requireAuth, async (req: AuthRequest, res) => {
    try {
      await clearUserCart(req.dbUser!.id);
      res.json({ items: [] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to clear cart.';
      res.status(500).json({ error: message });
    }
  });

  // Order routes
  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        shippingCity,
        shippingPostalCode,
        paymentMethod,
        notes,
        items,
      } = req.body ?? {};

      if (
        !customerName ||
        !customerEmail ||
        !shippingAddress ||
        !shippingCity ||
        !shippingPostalCode
      ) {
        res.status(400).json({ error: 'Please complete all required shipping fields.' });
        return;
      }
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Your bag is empty.' });
        return;
      }

      const order = await createOrder({
        userId: req.dbUser!.id,
        customerName: String(customerName),
        customerEmail: String(customerEmail),
        customerPhone: customerPhone ? String(customerPhone) : '',
        shippingAddress: String(shippingAddress),
        shippingCity: String(shippingCity),
        shippingPostalCode: String(shippingPostalCode),
        paymentMethod: paymentMethod === 'cod' ? 'cod' : 'card',
        notes: notes ? String(notes) : undefined,
        items: items.map((item: { productId: unknown; quantity: unknown }) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
        })),
      });

      res.status(201).json({ order });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create order.';
      const status =
        message.includes('Insufficient stock') ||
        message.includes('empty') ||
        message.includes('available')
          ? 400
          : 500;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/orders/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userOrders = await getOrdersForUser(req.dbUser!.id);
      res.json({ orders: userOrders });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load orders.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order ID.' });
        return;
      }
      const cancelled = await cancelOrderForUser(id, req.dbUser!.id);
      if (!cancelled) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      res.json({ order: cancelled });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel order.';
      const status = message.includes('Only newly confirmed') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/orders/lookup', async (req, res) => {
    try {
      const orderNumber = typeof req.body?.orderNumber === 'string' ? req.body.orderNumber : '';
      const email = typeof req.body?.email === 'string' ? req.body.email : '';
      if (!orderNumber.trim() || !email.trim()) {
        res.status(400).json({ error: 'Please enter both order number and email address.' });
        return;
      }
      const order = await lookupOrderByNumberAndEmail(orderNumber, email);
      if (!order) {
        res.status(404).json({ error: 'No matching order found for that order number and email.' });
        return;
      }
      res.json({ order });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to look up order.';
      res.status(500).json({ error: message });
    }
  });

  // Admin order & user management routes
  app.get('/api/admin/orders', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allOrders = await getAllOrders();
      res.json({ orders: allOrders });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load all orders.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const status = req.body?.status;
      const trackingCode = typeof req.body?.trackingCode === 'string' ? req.body.trackingCode : undefined;

      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order ID.' });
        return;
      }
      if (!ORDER_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Invalid order status.' });
        return;
      }

      const updated = await updateOrderStatus(id, status as OrderStatus, trackingCode);
      if (!updated) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      res.json({ order: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update order status.';
      const status = message.includes('Insufficient stock') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allUsers = await getAllUsers();
      res.json({ users: allUsers });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load users.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      const role = req.body?.role;
      if (!Number.isInteger(targetId) || targetId <= 0) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }
      if (role !== 'admin' && role !== 'user') {
        res.status(400).json({ error: 'Role must be either admin or user.' });
        return;
      }
      if (req.dbUser!.id === targetId && role !== 'admin') {
        res.status(400).json({ error: 'You cannot demote your own active admin account.' });
        return;
      }

      const updated = await updateUserRole(targetId, role);
      if (!updated) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.json({ user: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update user role.';
      res.status(500).json({ error: message });
    }
  });

  // Frontend Vite middleware or static bundle
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
