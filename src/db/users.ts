import { desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

const OWNER_EMAIL = 'dhanugagan2006@gmail.com';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const current = existing[0];
      const nextName = name && name.trim() ? name.trim() : current.name;
      const shouldBeAdmin = email.toLowerCase() === OWNER_EMAIL.toLowerCase() ? 'admin' : current.role;

      if (current.email !== email || current.name !== nextName || current.role !== shouldBeAdmin) {
        const updated = await db
          .update(users)
          .set({
            email,
            name: nextName,
            role: shouldBeAdmin,
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    // Check if there are any users yet; first user or owner email becomes admin
    const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const totalUsers = countRows[0]?.count ?? 0;
    const initialRole =
      totalUsers === 0 || email.toLowerCase() === OWNER_EMAIL.toLowerCase() ? 'admin' : 'user';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name && name.trim() ? name.trim() : email.split('@')[0] || 'Customer',
        role: initialRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllUsers:', error);
    throw new Error('Failed to fetch users.', { cause: error });
  }
}

export async function updateUserRole(userId: number, role: 'admin' | 'user') {
  try {
    const updated = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateUserRole:', error);
    throw new Error('Failed to update user role.', { cause: error });
  }
}
