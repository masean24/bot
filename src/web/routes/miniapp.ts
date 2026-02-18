/**
 * Mini App API Routes
 * Endpoints khusus untuk Telegram Mini App admin panel
 */

import { Router } from "express";
import { telegramAuthMiddleware, type TelegramUser } from "../../services/telegram-auth.js";
import { logActivity } from "../../services/activity-log.js";
import {
    getAnalyticsSummary,
    getDailySales,
    getTopProducts,
    getTopBuyers,
    getUserStats,
    getStockSummary,
    getHourlySalesDistribution,
} from "../../services/analytics.js";
import {
    getActiveProducts,
    getProductById,
    getProductStock,
    createProduct,
    updateProduct,
    getCategories,
    getProductsByCategory,
    supabase,
} from "../../services/supabase.js";
import { ADMIN_IDS } from "../../config.js";

const router = Router();

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            telegramUser?: TelegramUser;
            authDate?: number;
        }
    }
}

// Apply Telegram auth middleware to all routes
router.use(telegramAuthMiddleware);

// ============ AUTH ============

/**
 * Verify admin status dan get user info
 */
router.get("/auth/verify", async (req, res) => {
    const user = req.telegramUser!;

    await logActivity(user.id, user.username, "login");

    res.json({
        success: true,
        user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            photo_url: user.photo_url,
        },
        isAdmin: true,
        adminIndex: ADMIN_IDS.indexOf(user.id) + 1,
    });
});

// ============ DASHBOARD ============

/**
 * Get dashboard stats
 */
router.get("/dashboard/stats", async (req, res) => {
    try {
        const [analytics, stockSummary, userStats] = await Promise.all([
            getAnalyticsSummary(),
            getStockSummary(),
            getUserStats(),
        ]);

        res.json({
            success: true,
            data: {
                ...analytics,
                stock: stockSummary,
                users: userStats,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get daily sales chart data
 */
router.get("/dashboard/sales", async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const sales = await getDailySales(days);

        res.json({ success: true, data: sales });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get hourly distribution
 */
router.get("/dashboard/hourly", async (req, res) => {
    try {
        const hourly = await getHourlySalesDistribution();
        res.json({ success: true, data: hourly });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PRODUCTS ============

/**
 * Get all products with stock
 */
router.get("/products", async (req, res) => {
    try {
        const includeInactive = req.query.all === "true";

        let query = supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (!includeInactive) {
            query = query.eq("is_active", true);
        }

        const { data: products, error } = await query;
        if (error) throw error;

        // Add stock count
        const productsWithStock = await Promise.all(
            (products || []).map(async (product) => ({
                ...product,
                stock: product.is_category ? 0 : await getProductStock(product.id),
            }))
        );

        res.json({ success: true, data: productsWithStock });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get categories only
 */
router.get("/products/categories", async (req, res) => {
    try {
        const categories = await getCategories();
        res.json({ success: true, data: categories });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get products by category
 */
router.get("/products/category/:categoryId", async (req, res) => {
    try {
        const products = await getProductsByCategory(req.params.categoryId);

        const productsWithStock = await Promise.all(
            products.map(async (product) => ({
                ...product,
                stock: await getProductStock(product.id),
            }))
        );

        res.json({ success: true, data: productsWithStock });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get single product
 */
router.get("/products/:id", async (req, res) => {
    try {
        const product = await getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, error: "Product not found" });
        }

        const stock = await getProductStock(product.id);
        res.json({ success: true, data: { ...product, stock } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create product
 */
router.post("/products", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { name, description, price, is_active, parent_id, is_category, pricing_tiers } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: "Name is required" });
        }

        const product = await createProduct({
            name,
            description: description || "",
            price: parseInt(price) || 0,
            is_active: is_active !== false,
            parent_id: parent_id || null,
            is_category: is_category || false,
        });

        // Update pricing tiers if provided
        if (pricing_tiers) {
            await supabase
                .from("products")
                .update({ pricing_tiers })
                .eq("id", product.id);
        }

        await logActivity(user.id, user.username, "product_create", "product", product.id, { name });

        res.status(201).json({ success: true, data: product });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update product
 */
router.put("/products/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { name, description, price, is_active, parent_id, pricing_tiers } = req.body;

        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (price !== undefined) updates.price = parseInt(price);
        if (is_active !== undefined) updates.is_active = is_active;
        if (parent_id !== undefined) updates.parent_id = parent_id;
        if (pricing_tiers !== undefined) updates.pricing_tiers = pricing_tiers;

        const product = await updateProduct(req.params.id, updates);

        await logActivity(user.id, user.username, "product_update", "product", req.params.id, updates);

        res.json({ success: true, data: product });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete product (soft delete)
 */
router.delete("/products/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;

        await updateProduct(req.params.id, { is_active: false });
        await logActivity(user.id, user.username, "product_delete", "product", req.params.id);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CREDENTIALS/STOCK ============

/**
 * Get credentials for product
 */
router.get("/products/:id/credentials", async (req, res) => {
    try {
        const showSold = req.query.sold === "true";

        let query = supabase
            .from("credentials")
            .select("*")
            .eq("product_id", req.params.id)
            .order("is_sold", { ascending: true })
            .order("created_at", { ascending: false });

        if (!showSold) {
            query = query.eq("is_sold", false);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add credentials to product
 */
router.post("/products/:id/credentials", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { credentials } = req.body;

        if (!credentials || !Array.isArray(credentials)) {
            return res.status(400).json({ success: false, error: "Credentials array required" });
        }

        // Check for duplicates
        const emails = credentials.map((c: any) => c.email);
        const { data: existing } = await supabase
            .from("credentials")
            .select("email")
            .eq("product_id", req.params.id)
            .in("email", emails);

        const existingEmails = new Set((existing || []).map((e) => e.email));
        const newCredentials = credentials.filter((c: any) => !existingEmails.has(c.email));

        if (newCredentials.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Semua credentials sudah ada (duplicate)",
                duplicates: emails.length,
            });
        }

        const toInsert = newCredentials.map((c: any) => ({
            product_id: req.params.id,
            email: c.email,
            password: c.password,
            pin: c.pin || null,
            extra_info: c.extra_info || null,
            expires_at: c.expires_at || null,
            is_sold: false,
        }));

        const { data, error } = await supabase
            .from("credentials")
            .insert(toInsert)
            .select();

        if (error) throw error;

        await logActivity(user.id, user.username, "stock_add", "product", req.params.id, {
            count: data?.length || 0,
            duplicatesSkipped: credentials.length - newCredentials.length,
        });

        res.status(201).json({
            success: true,
            data: data || [],
            added: data?.length || 0,
            duplicatesSkipped: credentials.length - newCredentials.length,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Bulk add credentials from text
 */
router.post("/products/:id/credentials/bulk", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { text, delimiter } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: "Text required" });
        }

        const delim = delimiter || "|";
        const lines = text.split("\n").filter((l: string) => l.trim());

        const credentials = lines.map((line: string) => {
            const parts = line.split(delim).map((s: string) => s.trim());
            return {
                email: parts[0] || "",
                password: parts[1] || "",
                pin: parts[2] && parts[2] !== "-" ? parts[2] : null,
                extra_info: parts[3] && parts[3] !== "-" ? parts[3] : null,
            };
        }).filter((c: any) => c.email && c.password);

        if (credentials.length === 0) {
            return res.status(400).json({ success: false, error: "No valid credentials found" });
        }

        // Check for duplicates
        const emails = credentials.map((c: any) => c.email);
        const { data: existing } = await supabase
            .from("credentials")
            .select("email")
            .eq("product_id", req.params.id)
            .in("email", emails);

        const existingEmails = new Set((existing || []).map((e) => e.email));
        const newCredentials = credentials.filter((c: any) => !existingEmails.has(c.email));

        if (newCredentials.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Semua credentials sudah ada (duplicate)",
            });
        }

        const toInsert = newCredentials.map((c: any) => ({
            product_id: req.params.id,
            ...c,
            is_sold: false,
        }));

        const { data, error } = await supabase
            .from("credentials")
            .insert(toInsert)
            .select();

        if (error) throw error;

        await logActivity(user.id, user.username, "stock_bulk_add", "product", req.params.id, {
            count: data?.length || 0,
        });

        res.status(201).json({
            success: true,
            added: data?.length || 0,
            duplicatesSkipped: credentials.length - newCredentials.length,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete credential
 */
router.delete("/credentials/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;

        const { error } = await supabase
            .from("credentials")
            .delete()
            .eq("id", req.params.id)
            .eq("is_sold", false);

        if (error) throw error;

        await logActivity(user.id, user.username, "credential_delete", "credential", req.params.id);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Bulk delete credentials
 */
router.post("/credentials/bulk-delete", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, error: "IDs array required" });
        }

        const { error } = await supabase
            .from("credentials")
            .delete()
            .in("id", ids)
            .eq("is_sold", false);

        if (error) throw error;

        await logActivity(user.id, user.username, "bulk_action", "credential", undefined, {
            action: "delete",
            count: ids.length,
        });

        res.json({ success: true, deleted: ids.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ORDERS ============

/**
 * Get orders with filters
 */
router.get("/orders", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const status = req.query.status as string;
        const userId = req.query.user_id as string;
        const dateFrom = req.query.date_from as string;
        const dateTo = req.query.date_to as string;
        const search = req.query.search as string;

        let query = supabase
            .from("orders")
            .select("*, products(name)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq("payment_status", status);
        if (userId) query = query.eq("telegram_user_id", parseInt(userId));
        if (dateFrom) query = query.gte("created_at", dateFrom);
        if (dateTo) query = query.lte("created_at", dateTo);
        if (search) {
            query = query.or(`telegram_username.ilike.%${search}%,pakasir_order_id.ilike.%${search}%`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            success: true,
            data: data || [],
            total: count || 0,
            limit,
            offset,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get order detail with credentials
 */
router.get("/orders/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;

        const { data: order, error } = await supabase
            .from("orders")
            .select("*, products(name)")
            .eq("id", req.params.id)
            .single();

        if (error) throw error;

        const { data: credentials } = await supabase
            .from("credentials")
            .select("*")
            .eq("order_id", req.params.id);

        await logActivity(user.id, user.username, "order_view", "order", req.params.id);

        res.json({
            success: true,
            data: { ...order, credentials: credentials || [] },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ USERS ============

/**
 * Get users list
 */
router.get("/users", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const search = req.query.search as string;

        // Get unique users from orders with aggregated stats
        const { data: orders, error } = await supabase
            .from("orders")
            .select("telegram_user_id, telegram_username, total_price, payment_status, created_at");

        if (error) throw error;

        // Aggregate by user
        const userMap = new Map<number, {
            user_id: number;
            username: string | null;
            total_orders: number;
            paid_orders: number;
            total_spent: number;
            first_order: string;
            last_order: string;
        }>();

        for (const order of orders || []) {
            const existing = userMap.get(order.telegram_user_id);

            if (!existing) {
                userMap.set(order.telegram_user_id, {
                    user_id: order.telegram_user_id,
                    username: order.telegram_username,
                    total_orders: 1,
                    paid_orders: order.payment_status === "paid" ? 1 : 0,
                    total_spent: order.payment_status === "paid" ? order.total_price : 0,
                    first_order: order.created_at,
                    last_order: order.created_at,
                });
            } else {
                existing.total_orders++;
                if (order.payment_status === "paid") {
                    existing.paid_orders++;
                    existing.total_spent += order.total_price;
                }
                if (order.telegram_username) existing.username = order.telegram_username;
                if (order.created_at < existing.first_order) existing.first_order = order.created_at;
                if (order.created_at > existing.last_order) existing.last_order = order.created_at;
            }
        }

        let users = Array.from(userMap.values());

        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(u =>
                u.username?.toLowerCase().includes(searchLower) ||
                u.user_id.toString().includes(search)
            );
        }

        // Sort by total spent desc
        users.sort((a, b) => b.total_spent - a.total_spent);

        // Paginate
        const total = users.length;
        const paginatedUsers = users.slice(offset, offset + limit);

        res.json({
            success: true,
            data: paginatedUsers,
            total,
            limit,
            offset,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get user detail
 */
router.get("/users/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const userId = parseInt(req.params.id);

        // Get user's orders
        const { data: orders, error } = await supabase
            .from("orders")
            .select("*, products(name)")
            .eq("telegram_user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Get user's balance
        const { data: balance } = await supabase
            .from("user_balances")
            .select("balance")
            .eq("user_id", userId)
            .single();

        // Calculate stats
        const paidOrders = (orders || []).filter(o => o.payment_status === "paid");
        const stats = {
            total_orders: orders?.length || 0,
            paid_orders: paidOrders.length,
            total_spent: paidOrders.reduce((sum, o) => sum + o.total_price, 0),
            balance: balance?.balance || 0,
        };

        await logActivity(user.id, user.username, "user_view", "user", req.params.id);

        res.json({
            success: true,
            data: {
                user_id: userId,
                username: orders?.[0]?.telegram_username || null,
                stats,
                orders: orders || [],
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ANALYTICS ============

/**
 * Get top products
 */
router.get("/analytics/top-products", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const topProducts = await getTopProducts(limit);

        res.json({ success: true, data: topProducts });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get top buyers
 */
router.get("/analytics/top-buyers", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const topBuyers = await getTopBuyers(limit);

        res.json({ success: true, data: topBuyers });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ACTIVITY LOGS ============

/**
 * Get activity logs
 */
router.get("/activity-logs", async (req, res) => {
    try {
        const { getActivityLogs } = await import("../../services/activity-log.js");

        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await getActivityLogs(limit, offset);

        res.json({
            success: true,
            data: result.logs,
            total: result.total,
            limit,
            offset,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ VOUCHERS ============

/**
 * Get vouchers
 */
router.get("/vouchers", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("vouchers")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create voucher
 */
router.post("/vouchers", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { code, discount_type, discount_value, min_order, max_uses, expires_at } = req.body;

        if (!code || !discount_type || !discount_value) {
            return res.status(400).json({
                success: false,
                error: "Code, discount_type, and discount_value required"
            });
        }

        const { data, error } = await supabase
            .from("vouchers")
            .insert({
                code: code.toUpperCase(),
                discount_type,
                discount_value: parseInt(discount_value),
                min_purchase: parseInt(min_order) || 0,
                max_uses: max_uses ? parseInt(max_uses) : null,
                valid_until: expires_at || null,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;

        await logActivity(user.id, user.username, "voucher_create", "voucher", data.id, { code });

        res.status(201).json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update voucher
 */
router.put("/vouchers/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const { is_active, max_uses, expires_at } = req.body;

        const updates: any = {};
        if (is_active !== undefined) updates.is_active = is_active;
        if (max_uses !== undefined) updates.max_uses = max_uses;
        if (expires_at !== undefined) updates.expires_at = expires_at;

        const { data, error } = await supabase
            .from("vouchers")
            .update(updates)
            .eq("id", req.params.id)
            .select()
            .single();

        if (error) throw error;

        await logActivity(user.id, user.username, "voucher_update", "voucher", req.params.id, updates);

        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete voucher
 */
router.delete("/vouchers/:id", async (req, res) => {
    try {
        const user = req.telegramUser!;

        const { error } = await supabase
            .from("vouchers")
            .delete()
            .eq("id", req.params.id);

        if (error) throw error;

        await logActivity(user.id, user.username, "voucher_delete", "voucher", req.params.id);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ QUICK REPLIES ============

/**
 * Get quick replies
 */
router.get("/quick-replies", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("quick_replies")
            .select("*")
            .eq("is_active", true)
            .order("title");

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create quick reply
 */
router.post("/quick-replies", async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, error: "Title and content required" });
        }

        const { data, error } = await supabase
            .from("quick_replies")
            .insert({ title, content, is_active: true })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete quick reply
 */
router.delete("/quick-replies/:id", async (req, res) => {
    try {
        const { error } = await supabase
            .from("quick_replies")
            .delete()
            .eq("id", req.params.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ EXPORT ============

/**
 * Export credentials as text
 */
router.get("/export/credentials/:productId", async (req, res) => {
    try {
        const user = req.telegramUser!;
        const showSold = req.query.sold === "true";

        let query = supabase
            .from("credentials")
            .select("email, password, pin, extra_info")
            .eq("product_id", req.params.productId);

        if (!showSold) {
            query = query.eq("is_sold", false);
        }

        const { data, error } = await query;
        if (error) throw error;

        const lines = (data || []).map(c => {
            const parts = [c.email, c.password];
            if (c.pin) parts.push(c.pin);
            if (c.extra_info) parts.push(c.extra_info);
            return parts.join("|");
        });

        await logActivity(user.id, user.username, "export_data", "product", req.params.productId);

        res.json({
            success: true,
            data: lines.join("\n"),
            count: lines.length,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
