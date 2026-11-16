# Forma Goods — Full-Stack E-Commerce Web Application

**Forma Goods** is a full-stack online store for architectural homeware, lighting, ceramics, and studio objects featuring real-time PostgreSQL inventory management, transactional checkout, live order tracking, and role-based access control (Admin / User).

---

## Key Features

- **Product Catalog & Discovery**
  - Responsive 3-column storefront grid with category filtering (`All`, `Lighting`, `Ceramics`, `Desk Objects`, `Textiles`), live search by name/description/SKU, and price/stock sorting.
  - Product Detail modal with specifications (dimensions, materials, SKU), live stock count, and quantity selector.
- **Persistent Shopping Bag & Transactional Checkout**
  - Slide-over bag drawer supporting both guest sessions (`localStorage`) and authenticated accounts (PostgreSQL `cart_items`), automatically merging guest items upon sign-in.
  - Automatic complimentary shipping calculation ($200+ threshold) and support for both **Card Payment** and **Cash on Delivery (COD)**.
  - Atomic PostgreSQL checkout transactions that validate availability and decrement `products.stock` to prevent overselling.
- **Order Tracking & Self-Service Cancellation**
  - Public order lookup by **Order Number** (e.g., `FG-1042`) and **Email Address**.
  - Authenticated **Your Order History** with a 4-stage fulfillment tracker (`Confirmed` → `Processing` → `Shipped` → `Delivered`), tracking codes, itemized receipts, and self-service cancellation for newly confirmed orders (which transactionally restores stock).
- **Authentication & Role-Based Access Control (Admin / User)**
  - Google Sign-In via Firebase Authentication with server-side ID token verification (`firebase-admin`).
  - Automatic synchronization of authenticated users into PostgreSQL (`users` table) with `admin` / `user` roles enforced via Express middleware (`requireAuth`, `requireAdmin`).
- **Admin Operations Console**
  - Real-time KPI strip (Total Revenue, Active Orders, Catalog SKUs, Low Stock Alerts).
  - Full Product CRUD (create, edit, pricing, stock levels, visibility archiving).
  - Order Fulfillment table with inline status updates, tracking code assignment, transactional stock restoration on cancellation, and one-click CSV export.
  - User & Role management to promote or demote accounts between `user` and `admin`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express 4, TSX
- **Database & ORM**: Cloud SQL for PostgreSQL, Drizzle ORM (`drizzle-orm/node-postgres`), `pg` connection pool
- **Authentication**: Firebase Auth (Google Sign-In) + Firebase Admin SDK

---

## Database Schema

Defined in `src/db/schema.ts` and managed with Drizzle Kit (`src/db/drizzle.config.ts`):

- `users`: `id`, `uid` (Firebase UID), `email`, `name`, `role` (`'admin' | 'user'`), `created_at`
- `products`: `id`, `sku`, `name`, `slug`, `category`, `description`, `dimensions`, `materials`, `price_cents`, `stock`, `image_url`, `badge`, `featured`, `active`, `created_at`, `updated_at`
- `cart_items`: `id`, `user_id`, `product_id`, `quantity`, `updated_at`
- `orders`: `id`, `order_number`, `user_id`, `customer_name`, `customer_email`, `customer_phone`, `shipping_address`, `shipping_city`, `shipping_postal_code`, `payment_method`, `status`, `subtotal_cents`, `shipping_cents`, `total_cents`, `tracking_code`, `notes`, `created_at`, `updated_at`
- `order_items`: `id`, `order_id`, `product_id`, `product_name`, `product_sku`, `product_image`, `unit_price_cents`, `quantity`

---

## API Endpoints

### Public
- `GET /api/health` — Server health check
- `GET /api/products` — Active product catalog (supports `?category=` and `?search=`)
- `GET /api/products/:id` — Single product detail
- `POST /api/orders/lookup` — Look up an order by `orderNumber` and `email`

### Authenticated (`Authorization: Bearer <firebase_id_token>`)
- `GET /api/auth/me` — Sync and return current user profile & role
- `GET /api/cart` — Fetch persisted user cart
- `PUT /api/cart` — Upsert item quantity in user cart
- `POST /api/cart/merge` — Merge guest cart items into user cart on sign-in
- `DELETE /api/cart` — Clear user cart
- `POST /api/orders` — Create order and decrement inventory inside a PostgreSQL transaction
- `GET /api/orders/my` — Fetch authenticated user's order history
- `POST /api/orders/:id/cancel` — Cancel a `Confirmed` order and restore product stock

### Admin Only (`requireAuth` + `requireAdmin`)
- `GET /api/admin/products` — List all products including archived items
- `POST /api/products` — Create a new product
- `PATCH /api/products/:id` — Update product details, pricing, or stock
- `DELETE /api/products/:id` — Delete product (or archive if referenced by past orders)
- `GET /api/admin/orders` — List all customer orders
- `PATCH /api/admin/orders/:id/status` — Update fulfillment status and tracking code (with automatic stock restoration/re-allocation on cancellation changes)
- `GET /api/admin/users` — List registered users
- `PATCH /api/admin/users/:id/role` — Update user role (`admin` / `user`)

---

## Local Development & Scripts

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Ensure Cloud SQL runtime variables (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) and `firebase-applet-config.json` are present.

3. **Run development server (Express API + Vite middleware on port 3000)**
   ```bash
   npm run dev
   ```

4. **Type-check & build for production**
   ```bash
   npm run lint
   npm run build
   npm start
   ```
