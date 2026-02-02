/**
 * Telegram Mini App Authentication Service
 * Validasi initData dari Telegram WebApp
 */

import crypto from "crypto";
import { BOT_TOKEN, ADMIN_IDS } from "../config.js";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
}

interface ParsedInitData {
    user: TelegramUser;
    auth_date: number;
    hash: string;
    query_id?: string;
    chat_instance?: string;
    chat_type?: string;
    start_param?: string;
}

/**
 * Validasi initData dari Telegram WebApp
 * Menggunakan HMAC-SHA256 untuk verifikasi signature
 */
export function validateInitData(initData: string): ParsedInitData | null {
    try {
        // Parse initData string menjadi URLSearchParams
        const params = new URLSearchParams(initData);
        const hash = params.get("hash");
        
        if (!hash) {
            console.error("[TELEGRAM-AUTH] Hash tidak ditemukan dalam initData");
            return null;
        }

        // Hapus hash dari params untuk validasi
        params.delete("hash");

        // Sort params alphabetically dan buat data-check-string
        const dataCheckArray: string[] = [];
        const sortedKeys = Array.from(params.keys()).sort();
        
        for (const key of sortedKeys) {
            const value = params.get(key);
            if (value) {
                dataCheckArray.push(`${key}=${value}`);
            }
        }
        
        const dataCheckString = dataCheckArray.join("\n");

        // Buat secret key menggunakan HMAC-SHA256
        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(BOT_TOKEN)
            .digest();

        // Hitung hash yang diharapkan
        const expectedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");

        // Bandingkan hash
        if (hash !== expectedHash) {
            console.error("[TELEGRAM-AUTH] Hash tidak valid");
            return null;
        }

        // Parse user data
        const userStr = params.get("user");
        if (!userStr) {
            console.error("[TELEGRAM-AUTH] User data tidak ditemukan");
            return null;
        }

        const user: TelegramUser = JSON.parse(decodeURIComponent(userStr));
        const authDate = parseInt(params.get("auth_date") || "0");

        // Cek apakah auth_date tidak terlalu lama (max 1 jam)
        const now = Math.floor(Date.now() / 1000);
        const maxAge = 3600; // 1 jam dalam detik
        
        if (now - authDate > maxAge) {
            console.error("[TELEGRAM-AUTH] Auth date sudah expired");
            return null;
        }

        return {
            user,
            auth_date: authDate,
            hash,
            query_id: params.get("query_id") || undefined,
            chat_instance: params.get("chat_instance") || undefined,
            chat_type: params.get("chat_type") || undefined,
            start_param: params.get("start_param") || undefined,
        };
    } catch (error) {
        console.error("[TELEGRAM-AUTH] Error validating initData:", error);
        return null;
    }
}

/**
 * Cek apakah user adalah admin berdasarkan Telegram User ID
 */
export function isAdminUser(userId: number): boolean {
    return ADMIN_IDS.includes(userId);
}

/**
 * Middleware untuk Express - Validasi Telegram Mini App request
 */
export function telegramAuthMiddleware(req: any, res: any, next: any) {
    const initData = req.headers["x-telegram-init-data"] as string;

    if (!initData) {
        return res.status(401).json({ 
            error: "Unauthorized", 
            message: "Telegram initData tidak ditemukan" 
        });
    }

    const parsed = validateInitData(initData);
    
    if (!parsed) {
        return res.status(401).json({ 
            error: "Unauthorized", 
            message: "Telegram initData tidak valid" 
        });
    }

    // Cek apakah user adalah admin
    if (!isAdminUser(parsed.user.id)) {
        return res.status(403).json({ 
            error: "Forbidden", 
            message: "Anda bukan admin" 
        });
    }

    // Attach user data ke request
    req.telegramUser = parsed.user;
    req.authDate = parsed.auth_date;
    
    next();
}

/**
 * Get admin info dari user ID
 */
export function getAdminInfo(userId: number): { isAdmin: boolean; index: number } {
    const index = ADMIN_IDS.indexOf(userId);
    return {
        isAdmin: index !== -1,
        index: index + 1, // 1-indexed untuk display
    };
}

export type { TelegramUser, ParsedInitData };
