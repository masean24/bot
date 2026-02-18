import "dotenv/config";

// Telegram Bot
export const BOT_TOKEN = process.env.BOT_TOKEN || "";
export const ADMIN_IDS = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));
export const TESTIMONY_CHANNEL_ID = process.env.TESTIMONY_CHANNEL_ID || "";
export const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";
export const NOTES_CHANNEL_ID = process.env.NOTES_CHANNEL_ID || "";

// Supabase
export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

// QRIS API (eanss.tech)
export const QRIS_API_KEY = process.env.QRIS_API_KEY || "";

// Web Server
export const PORT = parseInt(process.env.PORT || "3000");
export const WEBHOOK_URL = process.env.WEBHOOK_URL || "";

// Bot Customization
export const BOT_NAME = process.env.BOT_NAME || "🛒 AUTO ORDER STORE";
export const WELCOME_BANNER_URL = process.env.WELCOME_BANNER_URL || "";

// Admin Web Authentication
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
export const JWT_SECRET = process.env.JWT_SECRET || "auto-order-bot-secret-key-change-in-production";

// Channel & Contact Info
export const TESTIMONY_CHANNEL_USERNAME = process.env.TESTIMONY_CHANNEL_USERNAME || "";
export const MAIN_CHANNEL_USERNAME = process.env.MAIN_CHANNEL_USERNAME || "";
export const ADMIN_CONTACT_USERNAME = process.env.ADMIN_CONTACT_USERNAME || "";

// Validate required config
export function validateConfig(): void {
    const required = [
        ["BOT_TOKEN", BOT_TOKEN],
        ["SUPABASE_URL", SUPABASE_URL],
        ["SUPABASE_ANON_KEY", SUPABASE_ANON_KEY],
        ["QRIS_API_KEY", QRIS_API_KEY],
        ["ADMIN_PASSWORD", ADMIN_PASSWORD],
    ];

    const missing = required.filter(([, value]) => !value);
    if (missing.length > 0) {
        throw new Error(
            `Missing required config: ${missing.map(([name]) => name).join(", ")}`
        );
    }
}
