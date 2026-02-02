/**
 * Analytics Service
 * Statistik dan insights untuk dashboard admin
 */

import { supabase } from "./supabase.js";

interface DailySales {
    date: string;
    orders: number;
    revenue: number;
}

interface TopProduct {
    product_id: string;
    product_name: string;
    total_sold: number;
    total_revenue: number;
}

interface TopBuyer {
    user_id: number;
    username: string | null;
    total_orders: number;
    total_spent: number;
}

interface AnalyticsSummary {
    today: { orders: number; revenue: number };
    week: { orders: number; revenue: number };
    month: { orders: number; revenue: number };
    allTime: { orders: number; revenue: number };
    growth: {
        ordersGrowth: number; // persentase
        revenueGrowth: number;
    };
}

/**
 * Get penjualan harian untuk periode tertentu
 */
export async function getDailySales(days: number = 30): Promise<DailySales[]> {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from("orders")
            .select("created_at, total_price, status")
            .eq("status", "paid")
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: true });

        if (error) throw error;

        // Group by date
        const salesByDate = new Map<string, { orders: number; revenue: number }>();
        
        // Initialize all dates
        for (let i = 0; i <= days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i));
            const dateStr = date.toISOString().split("T")[0];
            salesByDate.set(dateStr, { orders: 0, revenue: 0 });
        }

        // Aggregate data
        for (const order of data || []) {
            const dateStr = new Date(order.created_at).toISOString().split("T")[0];
            const existing = salesByDate.get(dateStr) || { orders: 0, revenue: 0 };
            salesByDate.set(dateStr, {
                orders: existing.orders + 1,
                revenue: existing.revenue + order.total_price,
            });
        }

        // Convert to array
        return Array.from(salesByDate.entries()).map(([date, data]) => ({
            date,
            ...data,
        }));
    } catch (error) {
        console.error("[ANALYTICS] Error getting daily sales:", error);
        return [];
    }
}

/**
 * Get top selling products
 */
export async function getTopProducts(limit: number = 10): Promise<TopProduct[]> {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("product_id, quantity, total_price, products(name)")
            .eq("status", "paid");

        if (error) throw error;

        // Aggregate by product
        const productStats = new Map<string, { name: string; sold: number; revenue: number }>();
        
        for (const order of data || []) {
            const existing = productStats.get(order.product_id) || { 
                name: (order.products as any)?.name || "Unknown", 
                sold: 0, 
                revenue: 0 
            };
            productStats.set(order.product_id, {
                name: existing.name,
                sold: existing.sold + order.quantity,
                revenue: existing.revenue + order.total_price,
            });
        }

        // Sort and limit
        return Array.from(productStats.entries())
            .map(([id, stats]) => ({
                product_id: id,
                product_name: stats.name,
                total_sold: stats.sold,
                total_revenue: stats.revenue,
            }))
            .sort((a, b) => b.total_sold - a.total_sold)
            .slice(0, limit);
    } catch (error) {
        console.error("[ANALYTICS] Error getting top products:", error);
        return [];
    }
}

/**
 * Get top buyers
 */
export async function getTopBuyers(limit: number = 10): Promise<TopBuyer[]> {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("telegram_user_id, telegram_username, total_price")
            .eq("status", "paid");

        if (error) throw error;

        // Aggregate by user
        const userStats = new Map<number, { username: string | null; orders: number; spent: number }>();
        
        for (const order of data || []) {
            const existing = userStats.get(order.telegram_user_id) || { 
                username: order.telegram_username, 
                orders: 0, 
                spent: 0 
            };
            userStats.set(order.telegram_user_id, {
                username: order.telegram_username || existing.username,
                orders: existing.orders + 1,
                spent: existing.spent + order.total_price,
            });
        }

        // Sort and limit
        return Array.from(userStats.entries())
            .map(([id, stats]) => ({
                user_id: id,
                username: stats.username,
                total_orders: stats.orders,
                total_spent: stats.spent,
            }))
            .sort((a, b) => b.total_spent - a.total_spent)
            .slice(0, limit);
    } catch (error) {
        console.error("[ANALYTICS] Error getting top buyers:", error);
        return [];
    }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        
        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - 1);
        
        const prevMonthStart = new Date(monthStart);
        prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

        // Get all paid orders
        const { data: allOrders, error } = await supabase
            .from("orders")
            .select("created_at, total_price")
            .eq("status", "paid");

        if (error) throw error;

        const orders = allOrders || [];

        // Calculate stats
        const today = { orders: 0, revenue: 0 };
        const week = { orders: 0, revenue: 0 };
        const month = { orders: 0, revenue: 0 };
        const prevMonth = { orders: 0, revenue: 0 };
        const allTime = { orders: 0, revenue: 0 };

        for (const order of orders) {
            const orderDate = new Date(order.created_at);
            allTime.orders++;
            allTime.revenue += order.total_price;

            if (orderDate >= todayStart) {
                today.orders++;
                today.revenue += order.total_price;
            }
            if (orderDate >= weekStart) {
                week.orders++;
                week.revenue += order.total_price;
            }
            if (orderDate >= monthStart) {
                month.orders++;
                month.revenue += order.total_price;
            }
            if (orderDate >= prevMonthStart && orderDate < monthStart) {
                prevMonth.orders++;
                prevMonth.revenue += order.total_price;
            }
        }

        // Calculate growth
        const ordersGrowth = prevMonth.orders > 0 
            ? ((month.orders - prevMonth.orders) / prevMonth.orders) * 100 
            : 0;
        const revenueGrowth = prevMonth.revenue > 0 
            ? ((month.revenue - prevMonth.revenue) / prevMonth.revenue) * 100 
            : 0;

        return {
            today,
            week,
            month,
            allTime,
            growth: {
                ordersGrowth: Math.round(ordersGrowth * 10) / 10,
                revenueGrowth: Math.round(revenueGrowth * 10) / 10,
            },
        };
    } catch (error) {
        console.error("[ANALYTICS] Error getting summary:", error);
        return {
            today: { orders: 0, revenue: 0 },
            week: { orders: 0, revenue: 0 },
            month: { orders: 0, revenue: 0 },
            allTime: { orders: 0, revenue: 0 },
            growth: { ordersGrowth: 0, revenueGrowth: 0 },
        };
    }
}

/**
 * Get user activity stats
 */
export async function getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersWeek: number;
}> {
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);

        // Get unique users from orders
        const { data: orders, error } = await supabase
            .from("orders")
            .select("telegram_user_id, created_at, status");

        if (error) throw error;

        const allUsers = new Set<number>();
        const activeUsers = new Set<number>();
        const newUsersToday = new Set<number>();
        const newUsersWeek = new Set<number>();

        // Track first order date per user
        const userFirstOrder = new Map<number, Date>();

        for (const order of orders || []) {
            allUsers.add(order.telegram_user_id);
            
            const orderDate = new Date(order.created_at);
            const existingFirst = userFirstOrder.get(order.telegram_user_id);
            
            if (!existingFirst || orderDate < existingFirst) {
                userFirstOrder.set(order.telegram_user_id, orderDate);
            }

            if (order.status === "paid") {
                activeUsers.add(order.telegram_user_id);
            }
        }

        // Count new users
        for (const [userId, firstOrder] of userFirstOrder.entries()) {
            if (firstOrder >= todayStart) {
                newUsersToday.add(userId);
            }
            if (firstOrder >= weekStart) {
                newUsersWeek.add(userId);
            }
        }

        return {
            totalUsers: allUsers.size,
            activeUsers: activeUsers.size,
            newUsersToday: newUsersToday.size,
            newUsersWeek: newUsersWeek.size,
        };
    } catch (error) {
        console.error("[ANALYTICS] Error getting user stats:", error);
        return {
            totalUsers: 0,
            activeUsers: 0,
            newUsersToday: 0,
            newUsersWeek: 0,
        };
    }
}

/**
 * Get hourly sales distribution (untuk tahu jam sibuk)
 */
export async function getHourlySalesDistribution(): Promise<{ hour: number; orders: number }[]> {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("created_at")
            .eq("status", "paid");

        if (error) throw error;

        // Initialize hours
        const hourlyData = new Array(24).fill(0);

        for (const order of data || []) {
            const hour = new Date(order.created_at).getHours();
            hourlyData[hour]++;
        }

        return hourlyData.map((orders, hour) => ({ hour, orders }));
    } catch (error) {
        console.error("[ANALYTICS] Error getting hourly distribution:", error);
        return [];
    }
}

/**
 * Get stock status summary
 */
export async function getStockSummary(): Promise<{
    totalProducts: number;
    totalStock: number;
    lowStockProducts: number;
    outOfStockProducts: number;
}> {
    try {
        // Get all active products
        const { data: products, error: prodError } = await supabase
            .from("products")
            .select("id, low_stock_threshold")
            .eq("is_active", true)
            .eq("is_category", false);

        if (prodError) throw prodError;

        // Get stock counts
        const { data: credentials, error: credError } = await supabase
            .from("credentials")
            .select("product_id")
            .eq("is_sold", false);

        if (credError) throw credError;

        // Count stock per product
        const stockByProduct = new Map<string, number>();
        for (const cred of credentials || []) {
            const current = stockByProduct.get(cred.product_id) || 0;
            stockByProduct.set(cred.product_id, current + 1);
        }

        let lowStockProducts = 0;
        let outOfStockProducts = 0;
        let totalStock = 0;

        for (const product of products || []) {
            const stock = stockByProduct.get(product.id) || 0;
            totalStock += stock;

            if (stock === 0) {
                outOfStockProducts++;
            } else if (stock <= ((product as any).low_stock_threshold || 5)) {
                lowStockProducts++;
            }
        }

        return {
            totalProducts: products?.length || 0,
            totalStock,
            lowStockProducts,
            outOfStockProducts,
        };
    } catch (error) {
        console.error("[ANALYTICS] Error getting stock summary:", error);
        return {
            totalProducts: 0,
            totalStock: 0,
            lowStockProducts: 0,
            outOfStockProducts: 0,
        };
    }
}
