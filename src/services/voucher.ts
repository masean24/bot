import { supabase } from "./supabase.js";

export interface Voucher {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    min_purchase: number;
    max_uses: number | null;
    used_count: number;
    is_active: boolean;
    valid_until: string | null;
    created_at: string;
}

/**
 * Get voucher by code
 */
export async function getVoucherByCode(code: string): Promise<Voucher | null> {
    const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single();

    if (error || !data) return null;
    return data as Voucher;
}

/**
 * Validate voucher for order
 */
export async function validateVoucher(
    code: string,
    orderAmount: number
): Promise<{ valid: boolean; voucher?: Voucher; message?: string }> {
    const voucher = await getVoucherByCode(code);

    if (!voucher) {
        return { valid: false, message: "Kode voucher tidak ditemukan" };
    }

    if (!voucher.is_active) {
        return { valid: false, message: "Voucher sudah tidak aktif" };
    }

    if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
        return { valid: false, message: "Voucher sudah expired" };
    }

    if (voucher.max_uses && voucher.used_count >= voucher.max_uses) {
        return { valid: false, message: "Voucher sudah habis digunakan" };
    }

    if (orderAmount < voucher.min_purchase) {
        return {
            valid: false,
            message: `Minimal order Rp ${voucher.min_purchase.toLocaleString("id-ID")}`,
        };
    }

    return { valid: true, voucher };
}

/**
 * Calculate discount from voucher
 */
export function calculateDiscount(voucher: Voucher, orderAmount: number): number {
    if (voucher.discount_type === "percentage") {
        return Math.floor((orderAmount * voucher.discount_value) / 100);
    }
    return Math.min(voucher.discount_value, orderAmount);
}

/**
 * Use voucher (increment used_count)
 */
export async function useVoucher(voucherId: string): Promise<void> {
    await supabase.rpc("increment_voucher_usage", { voucher_id: voucherId });
}

/**
 * Create new voucher (admin)
 */
export async function createVoucher(data: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    min_purchase?: number;
    max_uses?: number;
    valid_until?: string;
}): Promise<Voucher> {
    const { data: voucher, error } = await supabase
        .from("vouchers")
        .insert({
            code: data.code.toUpperCase(),
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            min_purchase: data.min_purchase || 0,
            max_uses: data.max_uses || null,
            valid_until: data.valid_until || null,
        })
        .select()
        .single();

    if (error) throw new Error("Failed to create voucher");
    return voucher as Voucher;
}

/**
 * Get all vouchers (admin)
 */
export async function getAllVouchers(): Promise<Voucher[]> {
    const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return [];
    return data as Voucher[];
}

/**
 * Delete/deactivate voucher
 */
export async function deactivateVoucher(voucherId: string): Promise<void> {
    await supabase
        .from("vouchers")
        .update({ is_active: false })
        .eq("id", voucherId);
}
