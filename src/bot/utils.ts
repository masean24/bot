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
        .text("➕ Tambah Produk", "admin:add_product")
        .row()
        .text("📤 Tambah Stok", "admin:add_stock");
}

/**
 * Escape markdown special characters for Telegram
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

/**
 * Generate credential display text
 */
export function formatCredential(credential: {
    email: string;
    password: string;
    pin: string | null;
    extra_info: string | null;
}, index: number): string {
    // Build credential string with pipe separators: email|password|pin|extra_info
    let parts: string[] = [credential.email, credential.password];

    if (credential.pin && credential.pin !== "-") {
        parts.push(credential.pin);
    }

    if (credential.extra_info && credential.extra_info !== "-") {
        parts.push(credential.extra_info);
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
