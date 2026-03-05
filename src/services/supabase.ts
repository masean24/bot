import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "../config.js";
import type { Product, Category, Credential, Order } from "../types/index.js";

// Use service key for full access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============ CATEGORIES ============

// Get all categories from the categories table (shared with web)
export async function getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

    if (error) throw error;
    return data || [];
}

// Get category by ID
export async function getCategoryById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

    if (error) return null;
    return data;
}

// Alias for admin flow
export async function getParentProducts(): Promise<Category[]> {
    return getCategories();
}

// ============ PRODUCTS ============

export async function getActiveProducts(): Promise<Product[]> {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("is_category", false)
        .order("name");

    if (error) throw error;
    return data || [];
}

// Get products under a category (category_id = categoryId)
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("category_id", categoryId)
        .eq("is_category", false)
        .order("name");

    if (error) throw error;
    return data || [];
}

// Get variations for a parent product (legacy compatibility)
export async function getVariationsByParent(parentId: string): Promise<Product[]> {
    return getProductsByCategory(parentId);
}

// Get total sold count for a category (sum of all products)
export async function getParentSoldCount(categoryId: string): Promise<number> {
    const variations = await getProductsByCategory(categoryId);
    if (variations.length === 0) return 0;

    const variationIds = variations.map(v => v.id);

    const { count, error } = await supabase
        .from("credentials")
        .select("*", { count: "exact", head: true })
        .in("product_id", variationIds)
        .eq("is_sold", true);

    if (error) return 0;
    return count || 0;
}

export async function getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

    if (error) return null;
    return data;
}

export async function createProduct(
    product: Omit<Product, "id" | "created_at">
): Promise<Product> {
    const { data, error } = await supabase
        .from("products")
        .insert(product)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateProduct(
    id: string,
    updates: Partial<Product>
): Promise<Product> {
    const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getProductStock(productId: string): Promise<number> {
    const { count, error } = await supabase
        .from("credentials")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId)
        .eq("is_sold", false);

    if (error) throw error;
    return count || 0;
}

// ============ CREDENTIALS ============

export async function addCredentials(
    credentials: Omit<Credential, "id" | "is_sold" | "sold_at" | "order_id">[]
): Promise<Credential[]> {
    const toInsert = credentials.map((c) => ({
        ...c,
        is_sold: false,
        sold_at: null,
        order_id: null,
    }));

    const { data, error } = await supabase
        .from("credentials")
        .insert(toInsert)
        .select();

    if (error) throw error;
    return data || [];
}

export async function getAvailableCredentials(
    productId: string,
    quantity: number
): Promise<Credential[]> {
    const { data, error } = await supabase
        .from("credentials")
        .select("*")
        .eq("product_id", productId)
        .eq("is_sold", false)
        .limit(quantity);

    if (error) throw error;
    return data || [];
}

export async function markCredentialsAsSold(
    credentialIds: string[],
    orderId: string
): Promise<void> {
    const { error } = await supabase
        .from("credentials")
        .update({
            is_sold: true,
            sold_at: new Date().toISOString(),
            order_id: orderId,
        })
        .in("id", credentialIds);

    if (error) throw error;
}

/**
 * Atomically claim credentials for an order using FOR UPDATE SKIP LOCKED.
 * Prevents double-sell when multiple users pay for the same product concurrently.
 */
export async function claimCredentials(
    productId: string,
    orderId: string,
    quantity: number
): Promise<Credential[]> {
    const claimed: Credential[] = [];

    for (let i = 0; i < quantity; i++) {
        const { data, error } = await supabase.rpc("claim_available_account", {
            p_product_id: productId,
            p_order_id: orderId,
        });

        if (error) {
            console.error(`[CLAIM] RPC error on claim ${i + 1}/${quantity}:`, error);
            break;
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) break;

        // Fetch full credential details for the claimed account
        const { data: cred } = await supabase
            .from("credentials")
            .select("*")
            .eq("id", row.account_id)
            .single();

        if (cred) claimed.push(cred);
    }

    return claimed;
}

export async function getCredentialsByOrderId(
    orderId: string
): Promise<Credential[]> {
    const { data, error } = await supabase
        .from("credentials")
        .select("*")
        .eq("order_id", orderId);

    if (error) throw error;
    return data || [];
}

// ============ ORDERS ============

export async function createOrder(
    order: Omit<Order, "id" | "created_at" | "paid_at">
): Promise<Order> {
    const { data, error } = await supabase
        .from("orders")
        .insert({
            ...order,
            paid_at: null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getOrderById(id: string): Promise<Order | null> {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

    if (error) return null;
    return data;
}

export async function getOrderByPakasirId(
    pakasirOrderId: string
): Promise<Order | null> {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("pakasir_order_id", pakasirOrderId)
        .single();

    if (error) return null;
    return data;
}

export async function updateOrder(
    id: string,
    updates: Partial<Order>
): Promise<Order> {
    const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateOrderStatus(
    id: string,
    status: Order["payment_status"]
): Promise<void> {
    const updates: Partial<Order> = { payment_status: status };
    if (status === "paid") {
        updates.paid_at = new Date().toISOString();
    }

    const { error } = await supabase.from("orders").update(updates).eq("id", id);

    if (error) throw error;
}

export async function getRecentOrders(limit = 10): Promise<Order[]> {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

export async function getPendingOrders(): Promise<Order[]> {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function getOrderStats(): Promise<{
    totalOrders: number;
    paidOrders: number;
    totalRevenue: number;
}> {
    const { data: orders, error } = await supabase
        .from("orders")
        .select("payment_status, total_price");

    if (error) throw error;

    const totalOrders = orders?.length || 0;
    const paidOrders = orders?.filter((o) => o.payment_status === "paid").length || 0;
    const totalRevenue =
        orders
            ?.filter((o) => o.payment_status === "paid")
            .reduce((sum, o) => sum + o.total_price, 0) || 0;

    return { totalOrders, paidOrders, totalRevenue };
}

// ============ ORDER CLEANUP ============

export async function cleanupExpiredOrders(
    minutesOld: number = 15
): Promise<{ expired: Order[] }> {
    const cutoffTime = new Date(Date.now() - minutesOld * 60 * 1000).toISOString();

    // Get expired pending orders with full data
    const { data: expiredOrders, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("payment_status", "pending")
        .lt("created_at", cutoffTime);

    if (fetchError) throw fetchError;

    if (!expiredOrders || expiredOrders.length === 0) {
        return { expired: [] };
    }

    const orderIds = expiredOrders.map((o) => o.id);

    // Update status to expired
    const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_status: "expired" })
        .in("id", orderIds);

    if (updateError) throw updateError;

    console.log(`🧹 Cleaned up ${orderIds.length} expired pending orders`);
    return { expired: expiredOrders as Order[] };
}

// ============ ADMINS ============

export async function isAdmin(telegramUserId: number): Promise<boolean> {
    const { data, error } = await supabase
        .from("admins")
        .select("id")
        .eq("telegram_user_id", telegramUserId)
        .eq("is_active", true)
        .single();

    if (error) return false;
    return !!data;
}

export async function addAdmin(
    telegramUserId: number,
    username: string
): Promise<void> {
    const { error } = await supabase.from("admins").upsert({
        telegram_user_id: telegramUserId,
        username,
        is_active: true,
    });

    if (error) throw error;
}

export { supabase };
