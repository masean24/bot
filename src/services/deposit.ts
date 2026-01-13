import { supabase } from "./supabase.js";

// ============ TYPES ============

interface UserBalance {
    user_id: number;
    username: string | null;
    balance: number;
    updated_at: string;
}

interface TopupRequest {
    id: string;
    user_id: number;
    username: string | null;
    amount: number;
    amount_total: number;
    transaction_id: string;
    status: "pending" | "paid" | "expired";
    qr_message_id: number | null;
    chat_id: number | null;
    created_at: string;
    paid_at: string | null;
}

interface BalanceTransaction {
    id: string;
    user_id: number;
    amount: number;
    type: "topup" | "payment" | "refund";
    description: string | null;
    order_id: string | null;
    topup_id: string | null;
    created_at: string;
}

// ============ USER BALANCE ============

/**
 * Get user balance, create if not exists
 */
export async function getBalance(userId: number): Promise<number> {
    const { data, error } = await supabase
        .from("user_balances")
        .select("balance")
        .eq("user_id", userId)
        .single();

    if (error || !data) {
        return 0;
    }
    return data.balance;
}

/**
 * Get or create user balance record
 */
export async function getOrCreateBalance(
    userId: number,
    username?: string
): Promise<UserBalance> {
    const { data: existing } = await supabase
        .from("user_balances")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (existing) {
        return existing;
    }

    // Create new balance record
    const { data, error } = await supabase
        .from("user_balances")
        .insert({
            user_id: userId,
            username: username || null,
            balance: 0,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Add balance to user (for topup)
 */
export async function addBalance(
    userId: number,
    amount: number,
    topupId?: string,
    description?: string
): Promise<number> {
    // Get current balance
    const current = await getBalance(userId);
    const newBalance = current + amount;

    // Update balance
    const { error: updateError } = await supabase
        .from("user_balances")
        .upsert({
            user_id: userId,
            balance: newBalance,
            updated_at: new Date().toISOString(),
        });

    if (updateError) throw updateError;

    // Log transaction
    await supabase.from("balance_transactions").insert({
        user_id: userId,
        amount: amount,
        type: "topup",
        description: description || `Topup saldo Rp ${amount.toLocaleString("id-ID")}`,
        topup_id: topupId || null,
    });

    console.log(`[DEPOSIT] Added ${amount} to user ${userId}. New balance: ${newBalance}`);
    return newBalance;
}

/**
 * Deduct balance from user (for payment)
 */
export async function deductBalance(
    userId: number,
    amount: number,
    orderId: string,
    description?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const current = await getBalance(userId);

    if (current < amount) {
        return {
            success: false,
            newBalance: current,
            error: `Saldo tidak cukup. Saldo: Rp ${current.toLocaleString("id-ID")}, Dibutuhkan: Rp ${amount.toLocaleString("id-ID")}`,
        };
    }

    const newBalance = current - amount;

    // Update balance
    const { error: updateError } = await supabase
        .from("user_balances")
        .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

    if (updateError) throw updateError;

    // Log transaction
    await supabase.from("balance_transactions").insert({
        user_id: userId,
        amount: -amount,
        type: "payment",
        description: description || `Pembayaran order`,
        order_id: orderId,
    });

    console.log(`[DEPOSIT] Deducted ${amount} from user ${userId}. New balance: ${newBalance}`);
    return { success: true, newBalance };
}

/**
 * Refund balance to user
 */
export async function refundBalance(
    userId: number,
    amount: number,
    orderId: string,
    description?: string
): Promise<number> {
    const current = await getBalance(userId);
    const newBalance = current + amount;

    // Update balance
    await supabase
        .from("user_balances")
        .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

    // Log transaction
    await supabase.from("balance_transactions").insert({
        user_id: userId,
        amount: amount,
        type: "refund",
        description: description || `Refund order`,
        order_id: orderId,
    });

    console.log(`[DEPOSIT] Refunded ${amount} to user ${userId}. New balance: ${newBalance}`);
    return newBalance;
}

// ============ TOPUP REQUESTS ============

/**
 * Create a topup request
 */
export async function createTopupRequest(
    userId: number,
    username: string | undefined,
    amount: number,
    amountTotal: number,
    transactionId: string,
    chatId: number
): Promise<TopupRequest> {
    const { data, error } = await supabase
        .from("topup_requests")
        .insert({
            user_id: userId,
            username: username,
            amount: amount,
            amount_total: amountTotal,
            transaction_id: transactionId,
            status: "pending",
            chat_id: chatId,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update topup request QR message ID
 */
export async function updateTopupQrMessageId(
    topupId: string,
    qrMessageId: number
): Promise<void> {
    await supabase
        .from("topup_requests")
        .update({ qr_message_id: qrMessageId })
        .eq("id", topupId);
}

/**
 * Find pending topup by amount_total
 */
export async function findPendingTopupByAmount(
    amountTotal: number
): Promise<TopupRequest | null> {
    const { data, error } = await supabase
        .from("topup_requests")
        .select("*")
        .eq("amount_total", amountTotal)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return data;
}

/**
 * Complete a topup (mark as paid and add balance)
 */
export async function completeTopup(
    topupId: string
): Promise<{ success: boolean; topup?: TopupRequest; newBalance?: number }> {
    // Get topup request
    const { data: topup, error: fetchError } = await supabase
        .from("topup_requests")
        .select("*")
        .eq("id", topupId)
        .single();

    if (fetchError || !topup) {
        return { success: false };
    }

    if (topup.status === "paid") {
        return { success: false }; // Already processed
    }

    // Mark as paid
    const { error: updateError } = await supabase
        .from("topup_requests")
        .update({
            status: "paid",
            paid_at: new Date().toISOString(),
        })
        .eq("id", topupId);

    if (updateError) throw updateError;

    // Add balance (use original amount, not amount_total)
    const newBalance = await addBalance(
        topup.user_id,
        topup.amount,
        topupId,
        `Topup via QRIS`
    );

    return { success: true, topup, newBalance };
}

/**
 * Get transaction history for user
 */
export async function getTransactionHistory(
    userId: number,
    limit: number = 10
): Promise<BalanceTransaction[]> {
    const { data, error } = await supabase
        .from("balance_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

/**
 * Cleanup expired topup requests (older than 15 minutes)
 */
export async function cleanupExpiredTopups(
    minutesOld: number = 15
): Promise<{ expired: TopupRequest[] }> {
    const cutoffTime = new Date(Date.now() - minutesOld * 60 * 1000).toISOString();

    // Get expired pending topups
    const { data: expiredTopups, error: fetchError } = await supabase
        .from("topup_requests")
        .select("*")
        .eq("status", "pending")
        .lt("created_at", cutoffTime);

    if (fetchError) throw fetchError;

    if (!expiredTopups || expiredTopups.length === 0) {
        return { expired: [] };
    }

    const topupIds = expiredTopups.map((t) => t.id);

    // Update status to expired
    await supabase
        .from("topup_requests")
        .update({ status: "expired" })
        .in("id", topupIds);

    console.log(`🧹 Cleaned up ${topupIds.length} expired topup requests`);
    return { expired: expiredTopups };
}
