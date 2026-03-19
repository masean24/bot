import { InlineKeyboard } from "grammy";
import type { Product } from "../types/index.js";

/**
 * Format price to Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format date to Indonesian locale
 */
export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

/**
 * Generate main menu keyboard
 */
export function mainMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("🛍️ Lihat Produk", "menu:list_produk")
        .text("📦 Pesanan Saya", "menu:my_orders")
        .row()
        .text("💰 Saldo", "menu:saldo")
        .text("💳 Topup", "menu:topup")
        .row()
        .text("💬 Chat Admin", "menu:chat")
        .text("❓ Bantuan", "menu:help");
}

/**
 * Generate products list keyboard
 */
export function productsKeyboard(
    products: Product[],
    stockMap: Map<string, number>
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    products.forEach((product, index) => {
        const stock = stockMap.get(product.id) || 0;
        const stockLabel = stock > 0 ? `(${stock})` : "(Habis)";
        keyboard.text(
            `${product.name} ${stockLabel}`,
            `product:${product.id}`
        );
        if ((index + 1) % 2 === 0) keyboard.row();
    });

    keyboard.row().text("🔙 Kembali", "menu:main");

    return keyboard;
}

/**
 * Generate product detail keyboard
 */
export function productDetailKeyboard(
    productId: string,
    hasStock: boolean
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (hasStock) {
        keyboard.text("🛒 Beli Sekarang", `buy:${productId}`);
    } else {
        keyboard.text("❌ Stok Habis", "noop");
    }

    keyboard.row().text("🔙 Kembali", "menu:products");

    return keyboard;
}

/**
 * Generate quantity selection keyboard
 */
export function quantityKeyboard(productId: string, maxQty: number): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const buttons = [1, 2, 3, 5, 10].filter((n) => n <= maxQty);

    buttons.forEach((qty) => {
        keyboard.text(`${qty}`, `qty:${productId}:${qty}`);
    });

    keyboard.row().text("🔙 Batal", "menu:products");

    return keyboard;
}

/**
 * Generate order confirmation keyboard
 */
export function confirmOrderKeyboard(orderId: string): InlineKeyboard {
    return new InlineKeyboard()
        .text("✅ Konfirmasi & Bayar", `confirm:${orderId}`)
        .row()
        .text("❌ Batalkan", `cancel:${orderId}`);
}

/**
 * Generate back to main menu keyboard
 */
export function backToMainKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text("🏠 Menu Utama", "menu:main");
}

/**
 * Generate admin menu keyboard
 */
export function adminMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("📦 Produk", "admin:products")
        .text("📊 Statistik", "admin:stats")
        .row()
        .text("📋 Order Terbaru", "admin:orders")
        .text("🎟️ Voucher", "admin:vouchers")
        .row()
        .text("➕ Tambah Kategori", "admin:add_category")
        .text("➕ Tambah Produk", "admin:add_product")
        .row()
        .text("📤 Tambah Stok", "admin:add_stock")
        .text("👥 Users", "admin:users");
}

/**
 * Escape markdown special characters for Telegram
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

/**
 * Parse account_data string into individual fields.
 * Format: email|password or email|password|pin or email|password|pin|extra_info
 */
export function parseAccountData(accountData: string | null | undefined): {
    email: string;
    password: string;
    pin: string | null;
    extra_info: string | null;
} {
    if (!accountData) return { email: "", password: "", pin: null, extra_info: null };
    const parts = accountData.split("|");
    return {
        email: parts[0] || "",
        password: parts[1] || "",
        pin: parts[2] || null,
        extra_info: parts[3] || null,
    };
}

/**
 * Generate credential display text
 */
export function formatCredential(credential: {
    email?: string | null;
    password?: string | null;
    pin?: string | null;
    extra_info?: string | null;
    account_data?: string | null;
}, index: number): string {
    // If email/password are null, parse from account_data (web admin only fills account_data)
    let email = credential.email;
    let password = credential.password;
    let pin = credential.pin;
    let extra_info = credential.extra_info;

    if (!email && credential.account_data) {
        const parsed = parseAccountData(credential.account_data);
        email = parsed.email;
        password = parsed.password;
        pin = pin || parsed.pin;
        extra_info = extra_info || parsed.extra_info;
    }

    // Build credential string with pipe separators: email|password|pin|extra_info
    let parts: string[] = [email || "", password || ""];

    if (pin && pin !== "-") {
        parts.push(pin);
    }

    if (extra_info && extra_info !== "-") {
        parts.push(extra_info);
    }

    // Join with pipes and escape for MarkdownV2
    const credentialLine = parts.join("|");
    const escapedLine = escapeMarkdown(credentialLine);

    return `┊ ${escapedLine}`;
}

/**
 * Generate order number from ID
 */
export function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}${random}`;
}
