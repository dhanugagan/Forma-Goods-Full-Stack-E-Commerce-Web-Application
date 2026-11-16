export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  dimensions: string;
  materials: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
  badge: string | null;
  featured: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: number;
  quantity: number;
  name: string;
  sku: string;
  category: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
}

export type OrderStatus = 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  productSku: string;
  productImage: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  paymentMethod: 'card' | 'cod';
  status: OrderStatus;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  trackingCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
