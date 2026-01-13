import { supabase } from "./supabase.js";

export interface Referral {
    id: string;
    user_id: number;
    username: string | null;
    referral_code: string;
    referred_count: number;
    total_bonus: number;
    created_at: string;
}

// Default referral bonus percentage
const REFERRAL_BONUS_PERCENT = 5;

/**
 * Generate unique referral code
 */
function generateReferralCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "REF";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Get or create referral for user
 */
export async function getOrCreateReferral(
    userId: number,
    username?: string
): Promise<Referral> {
    // Check if exists
    const { data: existing } = await supabase
        .from("referrals")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (existing) return existing as Referral;

    // Create new
    const { data: newReferral, error } = await supabase
        .from("referrals")
        .insert({
            user_id: userId,
            username: username || null,
            referral_code: generateReferralCode(),
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to create referral:", error.message);
        return null as any; // Table might not exist yet
    }
    return newReferral as Referral;
}

/**
 * Get referral by code
 */
export async function getReferralByCode(code: string): Promise<Referral | null> {
    const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referral_code", code.toUpperCase())
        .single();

    if (error || !data) return null;
    return data as Referral;
}

/**
 * Process referral bonus after successful order
 */
export async function processReferralBonus(
    referrerId: number,
    referredUserId: number,
    orderId: string,
    orderAmount: number
): Promise<number> {
    const bonusAmount = Math.floor((orderAmount * REFERRAL_BONUS_PERCENT) / 100);

    // Log the referral
    await supabase.from("referral_logs").insert({
        referrer_id: referrerId,
        referred_user_id: referredUserId,
        order_id: orderId,
        bonus_amount: bonusAmount,
    });

    // Update referrer stats
    await supabase.rpc("update_referral_stats", {
        p_user_id: referrerId,
        p_bonus: bonusAmount,
    });

    return bonusAmount;
}

/**
 * Get referral stats for user
 */
export async function getReferralStats(userId: number): Promise<Referral | null> {
    const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("user_id", userId)
        .single();

    return data as Referral | null;
}

/**
 * Check if user was referred
 */
export async function checkIfReferred(userId: number): Promise<number | null> {
    const { data } = await supabase
        .from("referral_logs")
        .select("referrer_id")
        .eq("referred_user_id", userId)
        .limit(1)
        .single();

    return data?.referrer_id || null;
}
