/**
 * Activity Log Service
 * Mencatat semua aktivitas admin untuk audit trail
 */

import { supabase } from "./supabase.js";

// Tipe aksi yang dicatat
export type ActivityAction = 
    | "login"
    | "product_create"
    | "product_update"
    | "product_delete"
    | "stock_add"
    | "stock_delete"
    | "stock_bulk_add"
    | "order_view"
    | "order_update"
    | "credential_delete"
    | "voucher_create"
    | "voucher_update"
    | "voucher_delete"
    | "user_view"
    | "settings_update"
    | "bulk_action"
    | "export_data"
    | "import_data";

export type EntityType = 
    | "product"
    | "credential"
    | "order"
    | "voucher"
    | "user"
    | "settings";

interface ActivityLogEntry {
    id: string;
    admin_id: number;
    admin_username: string | null;
    action: ActivityAction;
    entity_type: EntityType | null;
    entity_id: string | null;
    details: Record<string, any> | null;
    created_at: string;
}

/**
 * Catat aktivitas admin
 */
export async function logActivity(
    adminId: number,
    adminUsername: string | undefined,
    action: ActivityAction,
    entityType?: EntityType,
    entityId?: string,
    details?: Record<string, any>
): Promise<void> {
    try {
        await supabase.from("activity_logs").insert({
            admin_id: adminId,
            admin_username: adminUsername || null,
            action,
            entity_type: entityType || null,
            entity_id: entityId || null,
            details: details || null,
        });
        
        console.log(`[ACTIVITY] ${adminUsername || adminId}: ${action} ${entityType || ""} ${entityId || ""}`);
    } catch (error) {
        console.error("[ACTIVITY] Error logging activity:", error);
        // Tidak throw error agar tidak mengganggu operasi utama
    }
}

/**
 * Ambil activity logs dengan pagination
 */
export async function getActivityLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
        adminId?: number;
        action?: ActivityAction;
        entityType?: EntityType;
        dateFrom?: string;
        dateTo?: string;
    }
): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    try {
        let query = supabase
            .from("activity_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters?.adminId) {
            query = query.eq("admin_id", filters.adminId);
        }
        if (filters?.action) {
            query = query.eq("action", filters.action);
        }
        if (filters?.entityType) {
            query = query.eq("entity_type", filters.entityType);
        }
        if (filters?.dateFrom) {
            query = query.gte("created_at", filters.dateFrom);
        }
        if (filters?.dateTo) {
            query = query.lte("created_at", filters.dateTo);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return {
            logs: data || [],
            total: count || 0,
        };
    } catch (error) {
        console.error("[ACTIVITY] Error getting activity logs:", error);
        return { logs: [], total: 0 };
    }
}

/**
 * Ambil activity logs untuk entity tertentu
 */
export async function getEntityActivityLogs(
    entityType: EntityType,
    entityId: string,
    limit: number = 20
): Promise<ActivityLogEntry[]> {
    try {
        const { data, error } = await supabase
            .from("activity_logs")
            .select("*")
            .eq("entity_type", entityType)
            .eq("entity_id", entityId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("[ACTIVITY] Error getting entity activity logs:", error);
        return [];
    }
}

/**
 * Hapus activity logs yang sudah lama (untuk maintenance)
 */
export async function cleanupOldActivityLogs(daysOld: number = 90): Promise<number> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const { data, error } = await supabase
            .from("activity_logs")
            .delete()
            .lt("created_at", cutoffDate.toISOString())
            .select("id");

        if (error) throw error;
        
        const deletedCount = data?.length || 0;
        console.log(`[ACTIVITY] Cleaned up ${deletedCount} old activity logs`);
        return deletedCount;
    } catch (error) {
        console.error("[ACTIVITY] Error cleaning up activity logs:", error);
        return 0;
    }
}

/**
 * Format action untuk display
 */
export function formatAction(action: ActivityAction): string {
    const actionLabels: Record<ActivityAction, string> = {
        login: "Login",
        product_create: "Tambah Produk",
        product_update: "Update Produk",
        product_delete: "Hapus Produk",
        stock_add: "Tambah Stok",
        stock_delete: "Hapus Stok",
        stock_bulk_add: "Bulk Tambah Stok",
        order_view: "Lihat Order",
        order_update: "Update Order",
        credential_delete: "Hapus Credential",
        voucher_create: "Tambah Voucher",
        voucher_update: "Update Voucher",
        voucher_delete: "Hapus Voucher",
        user_view: "Lihat User",
        settings_update: "Update Settings",
        bulk_action: "Bulk Action",
        export_data: "Export Data",
        import_data: "Import Data",
    };

    return actionLabels[action] || action;
}
