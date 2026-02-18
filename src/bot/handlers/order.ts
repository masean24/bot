import type { Context } from "grammy";
import { InputFile, InlineKeyboard } from "grammy";
import {
    getActiveProducts,
    getProductById,
    getProductStock,
    getAvailableCredentials,
    createOrder,
    updateOrder,
    getOrderById,
    markCredentialsAsSold,
    getCredentialsByOrderId,
} from "../../services/supabase.js";
import {
    createTransaction,
    generateQRImage,
} from "../../services/qris.js";
import {
    formatRupiah,
    productsKeyboard,
    productDetailKeyboard,
    quantityKeyboard,
    confirmOrderKeyboard,
    backToMainKeyboard,
    formatCredential,
    generateOrderNumber,
} from "../utils.js";
import { TESTIMONY_CHANNEL_ID, LOG_CHANNEL_ID, NOTES_CHANNEL_ID } from "../../config.js";
import { supabase } from "../../services/supabase.js";

// State for notes input (similar to voucher)
const notesInputState = new Map<number, { productId: string; quantity: number; voucherCode?: string }>();
const userNotes = new Map<number, string>();
import type { Bot } from "grammy";

// Store bot instance for sending messages from webhook
let botInstance: Bot | null = null;

export function setBotInstance(bot: Bot): void {
    botInstance = bot;
}

export function getBotInstance(): Bot | null {
    return botInstance;
}

/**
 * Handle category detail - show category info with products list
 */
export async function handleCategoryDetail(ctx: Context, categoryId: string): Promise<void> {
    const { getProductById, getProductsByCategory, getProductStock, getParentSoldCount } = await import("../../services/supabase.js");

    const category = await getProductById(categoryId);
    if (!category) {
        await ctx.reply("❌ Kategori tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    const products = await getProductsByCategory(categoryId);
    const soldCount = await getParentSoldCount(categoryId);

    // Get current time for refresh timestamp
    const now = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
    });

    // Build message with category info
    let message = `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    message += `┊・ Kategori: ${category.name}\n`;
    message += `┊・ Stok Terjual: ${soldCount}\n`;
    message += `┊・ Desk: ${category.description || "-"}\n`;
    message += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n\n`;

    // Build keyboard with product buttons
    const keyboard = new InlineKeyboard();

    if (products.length === 0) {
        // Category has no products yet
        message += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
        message += `┊ Belum ada produk di kategori ini.\n`;
        message += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;
    } else {
        // Add products list
        message += `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
        message += `┊ Produk, Harga & Stok:\n`;

        for (const p of products) {
            const stock = await getProductStock(p.id);
            message += `┊・ ${p.name}: ${formatRupiah(p.price)} - Stok: ${stock}\n`;
        }

        message += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n`;

        // Add product buttons (2 per row max)
        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            const stock = await getProductStock(p.id);
            const label = stock > 0 ? p.name : `${p.name} (Habis)`;
            keyboard.text(label, `product:${p.id}`);

            if ((i + 1) % 2 === 0 && i < products.length - 1) {
                keyboard.row();
            }
        }
    }

    message += `╰➤ Refresh at ${now} WIB`;

    // Add refresh and back buttons
    keyboard.row();
    keyboard.text("🔄 Refresh", `category:${categoryId}`);
    keyboard.text("🔙 Kembali", "back:products");

    await ctx.reply(message, {
        reply_markup: keyboard,
    });
}

/**
 * Handle category selection callback (from inline button)
 */
export async function handleCategorySelect(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parentId = data.replace("category:", "");

    // Delete previous message and show category detail
    try {
        await ctx.deleteMessage();
    } catch (e) {
        // Message might already be deleted
    }

    await handleCategoryDetail(ctx, parentId);
}

/**
 * Handle product selection by number (from reply keyboard)
 */
export async function handleProductSelectByNumber(ctx: Context, productId: string): Promise<void> {
    const product = await getProductById(productId);

    if (!product) {
        await ctx.reply("❌ Produk tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    const stock = await getProductStock(productId);
    const hasStock = stock > 0;

    // Get current time for refresh timestamp
    const now = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
    });

    const detailMessage = `╭ - - - - - - - - - - - - - - - - - - - - - ╮
┊・ Produk: ${product.name}
┊・ Stok Tersedia: ${stock}
┊・ Desk: ${product.description || "-"}
╰ - - - - - - - - - - - - - - - - - - - - - ╯

╭ - - - - - - - - - - - - - - - - - - - - - ╮
┊ Harga & Stok:
┊ ・ ${product.name} : ${formatRupiah(product.price)} - Stok ${stock}
╰ - - - - - - - - - - - - - - - - - - - - - ╯
╰➤ Refresh at ${now} WIB`;

    // Build keyboard with refresh and buy buttons
    const keyboard = new InlineKeyboard();

    if (hasStock) {
        keyboard.text("🛒 Beli Sekarang", `buy:${productId}`).row();
    } else {
        keyboard.text("❌ Stok Habis", "noop").row();
    }

    keyboard
        .text("🔄 Refresh", `product:${productId}`)
        .text("🔙 Kembali", "back:products");

    await ctx.reply(detailMessage, {
        reply_markup: keyboard,
    });
}

/**
 * Handle products menu
 */
export async function handleProductsMenu(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const products = await getActiveProducts();

    if (products.length === 0) {
        await ctx.editMessageText("😔 Belum ada produk tersedia saat ini.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    // Get stock for each product
    const stockMap = new Map<string, number>();
    for (const product of products) {
        const stock = await getProductStock(product.id);
        stockMap.set(product.id, stock);
    }

    await ctx.editMessageText("🛒 *Daftar Produk*\n\nPilih produk yang ingin dibeli:", {
        parse_mode: "MarkdownV2",
        reply_markup: productsKeyboard(products, stockMap),
    });
}

/**
 * Handle product selection
 */
export async function handleProductSelect(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("product:", "");
    const product = await getProductById(productId);

    if (!product) {
        try {
            await ctx.editMessageText("❌ Produk tidak ditemukan.", {
                reply_markup: backToMainKeyboard(),
            });
        } catch {
            await ctx.reply("❌ Produk tidak ditemukan.", {
                reply_markup: backToMainKeyboard(),
            });
        }
        return;
    }

    const stock = await getProductStock(productId);
    const hasStock = stock > 0;

    // Get current time for refresh timestamp
    const now = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
    });

    const detailMessage = `╭ - - - - - - - - - - - - - - - - - - - - - ╮
┊・ Produk: ${product.name}
┊・ Stok Tersedia: ${stock}
┊・ Desk: ${product.description || "-"}
╰ - - - - - - - - - - - - - - - - - - - - - ╯

╭ - - - - - - - - - - - - - - - - - - - - - ╮
┊ Harga & Stok:
┊ ・ ${product.name} : ${formatRupiah(product.price)} - Stok ${stock}
╰ - - - - - - - - - - - - - - - - - - - - - ╯
╰➤ Refresh at ${now} WIB`;

    // Build keyboard with refresh and buy buttons
    const keyboard = new InlineKeyboard();

    if (hasStock) {
        keyboard.text("🛒 Beli Sekarang", `buy:${productId}`).row();
    } else {
        keyboard.text("❌ Stok Habis", "noop").row();
    }

    keyboard
        .text("🔄 Refresh", `product:${productId}`)
        .text("🔙 Kembali", "back:products");

    // Try to edit message, if fails (e.g., previous message was image), send new message
    try {
        await ctx.editMessageText(detailMessage, {
            reply_markup: keyboard,
        });
    } catch {
        await ctx.reply(detailMessage, {
            reply_markup: keyboard,
        });
    }
}

/**
 * Handle buy button click - show order confirmation UI
 */
export async function handleBuyProduct(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("buy:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.editMessageText("❌ Produk tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    const stock = await getProductStock(productId);

    if (stock === 0) {
        await ctx.answerCallbackQuery({ text: "Maaf, stok habis!", show_alert: true });
        return;
    }

    // Default quantity = 1
    await showOrderConfirmation(ctx, productId, 1);
}

/**
 * Show order confirmation with quantity adjustment and voucher support
 */
async function showOrderConfirmation(
    ctx: Context,
    productId: string,
    quantity: number,
    voucherCode?: string,
    notes?: string
): Promise<void> {
    const product = await getProductById(productId);
    if (!product) return;

    const stock = await getProductStock(productId);
    const now = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
    });

    // Ensure quantity is valid
    quantity = Math.max(1, Math.min(quantity, stock));
    let totalPrice = product.price * quantity;
    let discountAmount = 0;
    let voucherInfo = "";

    // Apply voucher if provided
    if (voucherCode) {
        const { validateVoucher, calculateDiscount } = await import("../../services/voucher.js");
        const result = await validateVoucher(voucherCode, totalPrice);

        if (result.valid && result.voucher) {
            discountAmount = calculateDiscount(result.voucher, totalPrice);
            const discountText = result.voucher.discount_type === "percentage"
                ? `${result.voucher.discount_value}%`
                : formatRupiah(result.voucher.discount_value);
            voucherInfo = `🎟 Voucher: ${voucherCode} (-${discountText})
▸ Diskon: -${formatRupiah(discountAmount)}`;
        } else {
            voucherInfo = `❌ Voucher: ${result.message}`;
            voucherCode = undefined; // Reset invalid voucher
        }
    }

    const finalPrice = totalPrice - discountAmount;

    // Store/retrieve notes in state
    const userId = ctx.from?.id;
    if (notes && userId) {
        userNotes.set(userId, notes);
    }
    const currentNotes = userId ? userNotes.get(userId) : undefined;
    const notesDisplay = currentNotes && currentNotes !== "-" ? `\n📝 Catatan: ${currentNotes}` : "";

    const message = `🛒 *KONFIRMASI PESANAN*

▸ Produk: ${product.name}
▸ Harga: ${formatRupiah(product.price)}
▸ Stok: ${stock}

▸ Jumlah: x${quantity}
▸ Subtotal: ${formatRupiah(totalPrice)}
${voucherInfo ? voucherInfo + "\n" : ""}▸ Total Bayar: ${formatRupiah(finalPrice)}${notesDisplay}

⏱ ${now} WIB`;

    // Build keyboard with +/- buttons
    const voucherParam = voucherCode ? `:${voucherCode}` : "";
    const keyboard = new InlineKeyboard()
        .text("+ 1", `addqty:${productId}:${quantity}:1${voucherParam}`)
        .text("+ 10", `addqty:${productId}:${quantity}:10${voucherParam}`)
        .text("+ 100", `addqty:${productId}:${quantity}:100${voucherParam}`)
        .row()
        .text("- 1", `subqty:${productId}:${quantity}:1${voucherParam}`)
        .text("- 10", `subqty:${productId}:${quantity}:10${voucherParam}`)
        .text("- 100", `subqty:${productId}:${quantity}:100${voucherParam}`)
        .row()
        .text("🔄 Refresh", `refreshorder:${productId}:${quantity}${voucherParam}`)
        .text("🎟️ Voucher", `inputvoucher:${productId}:${quantity}`)
        .text("📝 Notes", `inputnotes:${productId}:${quantity}${voucherParam}`)
        .row()
        .text("💳 BAYAR QRIS", `payqris:${productId}:${quantity}${voucherParam}`)
        .text("💰 BAYAR SALDO", `paysaldo:${productId}:${quantity}${voucherParam}`)
        .row()
        .text("✖ BATAL", `cancel:${productId}`);

    try {
        await ctx.editMessageText(message, { reply_markup: keyboard });
    } catch (e) {
        // If can't edit, send new message
        await ctx.reply(message, { reply_markup: keyboard });
    }
}

/**
 * Handle add quantity button
 */
export async function handleAddQuantity(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const productId = parts[1];
    const currentQty = parseInt(parts[2]);
    const addAmount = parseInt(parts[3]);
    const voucherCode = parts[4]; // Optional voucher code
    const stock = await getProductStock(productId);

    const newQty = Math.min(currentQty + addAmount, stock);
    await showOrderConfirmation(ctx, productId, newQty, voucherCode);
}

/**
 * Handle subtract quantity button
 */
export async function handleSubQuantity(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const productId = parts[1];
    const currentQty = parseInt(parts[2]);
    const subAmount = parseInt(parts[3]);
    const voucherCode = parts[4]; // Optional voucher code

    const newQty = Math.max(currentQty - subAmount, 1);
    await showOrderConfirmation(ctx, productId, newQty, voucherCode);
}

/**
 * Handle refresh order button
 */
export async function handleRefreshOrder(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: "Stok diperbarui!" });

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const productId = parts[1];
    const qty = parseInt(parts[2]);
    const voucherCode = parts[3]; // Optional voucher code
    await showOrderConfirmation(ctx, productId, qty, voucherCode);
}

/**
 * Handle voucher input button - prompt user for voucher code
 */
export async function handleInputVoucher(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const [, productId, qtyStr] = data.split(":");
    const qty = parseInt(qtyStr);

    // Store in state for text input handling
    const userId = ctx.from?.id;
    if (userId) {
        voucherInputState.set(userId, { productId, quantity: qty });
    }

    await ctx.reply(`🎟️ *Masukkan Kode Voucher*

Ketik kode voucher kamu:
\\(Contoh: DISKON10\\)

Atau ketik "batal" untuk membatalkan\\.`, {
        parse_mode: "MarkdownV2",
    });
}

// State for voucher input
const voucherInputState = new Map<number, { productId: string; quantity: number }>();

/**
 * Handle voucher code text input
 */
export async function handleVoucherTextInput(ctx: Context): Promise<boolean> {
    const userId = ctx.from?.id;
    if (!userId) return false;

    const state = voucherInputState.get(userId);
    if (!state) return false;

    const text = ctx.message?.text?.trim().toUpperCase();
    if (!text) return false;

    // Clear state
    voucherInputState.delete(userId);

    if (text === "BATAL") {
        await showOrderConfirmation(ctx, state.productId, state.quantity);
        return true;
    }

    // Apply voucher and show updated confirmation
    await showOrderConfirmation(ctx, state.productId, state.quantity, text);
    return true;
}

/**
 * Handle notes input button - prompt user for notes
 */
export async function handleInputNotes(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const productId = parts[1];
    const qty = parseInt(parts[2]);
    const voucherCode = parts[3];

    const userId = ctx.from?.id;
    if (userId) {
        notesInputState.set(userId, { productId, quantity: qty, voucherCode });
    }

    await ctx.reply(`📝 *Masukkan Catatan Pesanan*

Ketik catatan untuk pesanan ini:
\(Contoh: email recovery: xxx@gmail\.com\)

Ketik "\-" jika tidak ada catatan
Ketik "batal" untuk membatalkan\.`, {
        parse_mode: "MarkdownV2",
    });
}

/**
 * Handle notes text input
 */
export async function handleNotesTextInput(ctx: Context): Promise<boolean> {
    const userId = ctx.from?.id;
    if (!userId) return false;

    const state = notesInputState.get(userId);
    if (!state) return false;

    const text = ctx.message?.text?.trim();
    if (!text) return false;

    // Clear input state
    notesInputState.delete(userId);

    if (text.toLowerCase() === "batal") {
        await showOrderConfirmation(ctx, state.productId, state.quantity, state.voucherCode);
        return true;
    }

    // Store notes (or clear if "-")
    if (text === "-") {
        userNotes.delete(userId);
    } else {
        userNotes.set(userId, text);
    }

    await showOrderConfirmation(ctx, state.productId, state.quantity, state.voucherCode, text === "-" ? undefined : text);
    return true;
}

/**
 * Handle pay QRIS button - create order and show QR
 */
export async function handlePayQris(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: "Memproses pembayaran..." });

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const productId = parts[1];
    const quantity = parseInt(parts[2]);
    const voucherCode = parts[3]; // Optional voucher code

    // Get notes from state
    const orderNotes = ctx.from?.id ? userNotes.get(ctx.from.id) : undefined;

    const product = await getProductById(productId);

    if (!product) {
        await ctx.editMessageText("❌ Produk tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    // Check stock again
    const availableCredentials = await getAvailableCredentials(productId, quantity);

    if (availableCredentials.length < quantity) {
        await ctx.editMessageText(
            "😔 Maaf, stok sudah habis. Silakan coba produk lain.",
            { reply_markup: backToMainKeyboard() }
        );
        return;
    }

    let totalPrice = product.price * quantity;
    let discountAmount = 0;

    // Apply voucher discount if provided
    if (voucherCode) {
        const { validateVoucher, calculateDiscount, useVoucher } = await import("../../services/voucher.js");
        const result = await validateVoucher(voucherCode, totalPrice);

        if (result.valid && result.voucher) {
            discountAmount = calculateDiscount(result.voucher, totalPrice);
            // Mark voucher as used
            await useVoucher(result.voucher.id);
        }
    }

    const finalPrice = totalPrice - discountAmount;

    // Create order in database
    const orderId = generateOrderNumber();
    const order = await createOrder({
        telegram_user_id: ctx.from!.id,
        telegram_username: ctx.from?.username || null,
        product_id: productId,
        product_name: product.name,
        quantity,
        total_price: finalPrice, // Use discounted price
        payment_status: "pending",
        pakasir_order_id: orderId,
        qr_message_id: null,
        chat_id: ctx.chat!.id,
        source: "bot",
        voucher_code: voucherCode || null,
        discount_amount: discountAmount,
        notes: orderNotes || null,
    });

    // Clear notes state
    if (ctx.from?.id) userNotes.delete(ctx.from.id);

    // Create QRIS transaction with final price
    const qrisResult = await createTransaction(orderId, finalPrice, String(ctx.from!.id));

    if (!qrisResult.success || !qrisResult.data?.qris_content) {
        await ctx.editMessageText(
            "❌ Gagal membuat pembayaran. Silakan coba lagi.",
            { reply_markup: backToMainKeyboard() }
        );
        return;
    }

    // Delete the confirmation message
    await ctx.deleteMessage();

    // Generate QR image from QRIS content string
    const qrImageBuffer = await generateQRImage(qrisResult.data.qris_content);

    // Build caption with discount info
    let caption = `
━━━ 「 TRANSAKSI PENDING 」 ━━━
• ID Payment: ${order.pakasir_order_id}
• Produk: ${product.name}
• Jumlah: ${order.quantity}`;

    if (discountAmount > 0) {
        caption += `
• Subtotal: ${formatRupiah(totalPrice)}
• Diskon: -${formatRupiah(discountAmount)}`;
    }

    caption += `
• Total Bayar: ${formatRupiah(qrisResult.data.amount_total)}

⏳ Scan QR di atas untuk bayar
🕐 Berlaku 15 menit

⚠️ PENTING: Bayar TEPAT ${formatRupiah(qrisResult.data.amount_total)}
(Angka unik untuk verifikasi otomatis)

💡 Bisa bayar pakai:
GoPay, OVO, DANA, ShopeePay, LinkAja, dll
`;

    // Build cancel keyboard
    const cancelKeyboard = new InlineKeyboard()
        .text("❌ Batalkan Pembayaran", `cancelqris:${order.id}`);

    // Send QR image with cancel button
    const qrMessage = await ctx.replyWithPhoto(
        new InputFile(qrImageBuffer, "qris.png"),
        { caption, reply_markup: cancelKeyboard }
    );

    // Update order with QR message ID
    await updateOrder(order.id, {
        qr_message_id: qrMessage.message_id,
    });
}

/**
 * Handle pay with saldo button - deduct balance and process order
 */
export async function handlePaySaldo(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: "Memproses pembayaran..." });

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const productId = parts[1];
    const quantity = parseInt(parts[2]);
    const voucherCode = parts[3]; // Optional voucher code
    const userId = ctx.from?.id;

    // Get notes from state
    const orderNotes = userId ? userNotes.get(userId) : undefined;

    if (!userId) {
        await ctx.reply("❌ User tidak ditemukan.");
        return;
    }

    const product = await getProductById(productId);

    if (!product) {
        await ctx.editMessageText("❌ Produk tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    // Check stock again
    const availableCredentials = await getAvailableCredentials(productId, quantity);

    if (availableCredentials.length < quantity) {
        await ctx.editMessageText(
            "😔 Maaf, stok sudah habis. Silakan coba produk lain.",
            { reply_markup: backToMainKeyboard() }
        );
        return;
    }

    let totalPrice = product.price * quantity;
    let discountAmount = 0;

    // Apply voucher discount if provided
    if (voucherCode) {
        const { validateVoucher, calculateDiscount, useVoucher } = await import("../../services/voucher.js");
        const result = await validateVoucher(voucherCode, totalPrice);

        if (result.valid && result.voucher) {
            discountAmount = calculateDiscount(result.voucher, totalPrice);
            // Mark voucher as used
            await useVoucher(result.voucher.id);
        }
    }

    const finalPrice = totalPrice - discountAmount;

    // Check and deduct balance
    const { getBalance, deductBalance } = await import("../../services/deposit.js");
    const balance = await getBalance(userId);

    if (balance < finalPrice) {
        await ctx.answerCallbackQuery({
            text: `Saldo tidak cukup! Saldo: Rp ${balance.toLocaleString("id-ID")}, Dibutuhkan: Rp ${finalPrice.toLocaleString("id-ID")}`,
            show_alert: true,
        });
        return;
    }

    // Create order in database
    const orderId = generateOrderNumber();
    const order = await createOrder({
        telegram_user_id: userId,
        telegram_username: ctx.from?.username || null,
        product_id: productId,
        product_name: product.name,
        quantity,
        total_price: finalPrice,
        payment_status: "paid", // Immediately paid since using balance
        pakasir_order_id: orderId,
        qr_message_id: null,
        chat_id: ctx.chat!.id,
        source: "bot",
        voucher_code: voucherCode || null,
        discount_amount: discountAmount,
        notes: orderNotes || null,
    });

    // Clear notes state
    if (userId) userNotes.delete(userId);

    // Deduct balance
    const deductResult = await deductBalance(userId, finalPrice, order.id, `Pembelian ${product.name} x${quantity}`);

    if (!deductResult.success) {
        await ctx.editMessageText(
            `❌ ${deductResult.error}`,
            { reply_markup: backToMainKeyboard() }
        );
        return;
    }

    // Delete the confirmation message
    await ctx.deleteMessage();

    // Mark credentials as sold and get them
    const credentialIds = availableCredentials.map((c) => c.id);
    await markCredentialsAsSold(credentialIds, order.id);

    // Format credentials as inline list
    let credentialsText = availableCredentials
        .map((cred, idx) => formatCredential(cred, idx))
        .join("\n");

    const invoiceId = order.pakasir_order_id || `ORD${Date.now()}`;

    const successMessage = `
╭━━━━━━━━━━━━━━━
┊ *PEMBAYARAN SUKSES*
┊━━━━━━━━━━━━━━━
┊ Produk : ${product.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}
┊ Jumlah : ${quantity}
┊ Total : ${formatRupiah(finalPrice).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}
┊ Invoice : \`${invoiceId.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}\`
┊━━━━━━━━━━━━━━━
┊ *DETAIL AKUN*
${credentialsText}
╰━━━━━━━━━━━━━━━
_Note : Pastikan aplikasi terkait sudah versi terbaru\\._
_Terima kasih telah berbelanja\\!_ 🙏
`;

    // Create keyboard with Hubungi Admin button
    const successKeyboard = new InlineKeyboard()
        .text("💬 Hubungi Admin", "menu:chat");

    // Send credentials to user
    await ctx.reply(successMessage, {
        parse_mode: "MarkdownV2",
        reply_markup: successKeyboard,
    });

    // Generate and send .txt file with credentials
    let txtContent = `===== DETAIL AKUN =====\n`;
    txtContent += `Produk: ${product.name}\n`;
    txtContent += `Jumlah: ${quantity}\n`;
    txtContent += `Total: ${formatRupiah(finalPrice)}\n`;
    txtContent += `Order ID: ${order.pakasir_order_id}\n`;
    txtContent += `Metode: Saldo\n`;
    txtContent += `Tanggal: ${new Date().toLocaleString("id-ID")}\n`;
    txtContent += `\n===== CREDENTIALS =====\n\n`;

    availableCredentials.forEach((cred, idx) => {
        txtContent += `--- Akun #${idx + 1} ---\n`;
        txtContent += `Email: ${cred.email}\n`;
        txtContent += `Password: ${cred.password}\n`;
        if (cred.pin && cred.pin !== "-") {
            txtContent += `PIN: ${cred.pin}\n`;
        }
        if (cred.extra_info && cred.extra_info !== "-") {
            txtContent += `Info: ${cred.extra_info}\n`;
        }
        txtContent += `\n`;
    });

    txtContent += `===== TERIMA KASIH =====\n`;

    // Send as document
    await ctx.replyWithDocument(new InputFile(Buffer.from(txtContent), `akun_${order.pakasir_order_id}.txt`), {
        caption: "📄 File .txt berisi detail akun kamu",
    });

    // Post to testimony channel
    if (TESTIMONY_CHANNEL_ID && botInstance) {
        const now = new Date().toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const orderId = order.pakasir_order_id || `ORD${Date.now()}`;
        const botUsername = "hubifyid_bot";

        const testimonyMessage = `💰 *ORDER BERHASIL*

ID: \`${orderId}\`
User: @${ctx.from?.username || "Anonymous"}
Total: ${formatRupiah(finalPrice)}
📱 Sumber: Telegram Bot
Metode: Saldo
Date: ${now}

📊 *STATISTIK*
Produk: ${product.name}
Qty: ${quantity} pcs
Status: ✅ Transaksi Sukses`;

        const testimonyKeyboard = new InlineKeyboard()
            .url("🛒 Order", `https://t.me/${botUsername}`);

        try {
            await botInstance.api.sendMessage(TESTIMONY_CHANNEL_ID, testimonyMessage, {
                parse_mode: "Markdown",
                reply_markup: testimonyKeyboard,
            });
        } catch (e) {
            console.error("Failed to send testimony:", e);
        }
    }

    // Save to transaction_proofs (sync with website)
    try {
        await supabase.from("transaction_proofs").insert({
            caption: `✅ ${product.name} x${quantity} — ${formatRupiah(finalPrice)} (via Bot)`,
            image_url: "",
            is_visible: true,
        });
    } catch (e) {
        console.error("Failed to insert transaction_proof:", e);
    }

    // Send notes to notes channel if present
    if (NOTES_CHANNEL_ID && botInstance && order.notes && order.notes !== "-") {
        const notesMsg = `📝 *CATATAN PESANAN*

ID: \`${order.pakasir_order_id || order.id}\`
Produk: ${product.name}
User: @${ctx.from?.username || "Anonymous"}
📱 Sumber: Telegram Bot
Metode: Saldo

Catatan:
${order.notes}`;

        try {
            await botInstance.api.sendMessage(NOTES_CHANNEL_ID, notesMsg, {
                parse_mode: "Markdown",
            });
        } catch (e) {
            console.error("Failed to send notes:", e);
        }
    }
}

/**
 * Handle quantity selection
 */
export async function handleQuantitySelect(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const [, productId, qtyStr] = data.split(":");
    const quantity = parseInt(qtyStr);
    const product = await getProductById(productId);

    if (!product) {
        await ctx.editMessageText("❌ Produk tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    // Check stock
    const stock = await getProductStock(productId);
    if (stock < quantity) {
        await ctx.answerCallbackQuery({
            text: `Stok tidak cukup! Tersedia: ${stock}`,
            show_alert: true,
        });
        return;
    }

    const totalPrice = product.price * quantity;

    // Create order in database
    const orderId = generateOrderNumber();
    const order = await createOrder({
        telegram_user_id: ctx.from!.id,
        telegram_username: ctx.from?.username || null,
        product_id: productId,
        product_name: product.name,
        quantity,
        total_price: totalPrice,
        payment_status: "pending",
        pakasir_order_id: orderId,
        qr_message_id: null,
        chat_id: ctx.chat!.id,
        source: "bot",
    });

    const confirmMessage = `
📝 *Konfirmasi Pesanan*

📦 Produk: *${product.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}*
🔢 Jumlah: *${quantity}*
💰 Total: *${formatRupiah(totalPrice).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}*

Klik tombol di bawah untuk melanjutkan pembayaran:
`;

    await ctx.editMessageText(confirmMessage, {
        parse_mode: "MarkdownV2",
        reply_markup: confirmOrderKeyboard(order.id),
    });
}

/**
 * Handle order confirmation and generate QRIS
 */
export async function handleConfirmOrder(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: "Memproses pembayaran..." });

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const orderId = data.replace("confirm:", "");
    const order = await getOrderById(orderId);

    if (!order) {
        await ctx.editMessageText("❌ Pesanan tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    const product = await getProductById(order.product_id);
    if (!product) {
        await ctx.editMessageText("❌ Produk tidak ditemukan.", {
            reply_markup: backToMainKeyboard(),
        });
        return;
    }

    // Check stock again
    const availableCredentials = await getAvailableCredentials(
        order.product_id,
        order.quantity
    );

    if (availableCredentials.length < order.quantity) {
        await ctx.editMessageText(
            "😔 Maaf, stok sudah habis. Silakan coba produk lain.",
            { reply_markup: backToMainKeyboard() }
        );
        return;
    }

    // Create QRIS transaction
    const qrisResult = await createTransaction(
        order.pakasir_order_id!,
        order.total_price,
        String(ctx.from!.id)
    );

    if (!qrisResult.success || !qrisResult.data?.qris_content) {
        await ctx.editMessageText(
            "❌ Gagal membuat pembayaran. Silakan coba lagi.",
            { reply_markup: backToMainKeyboard() }
        );
        return;
    }

    // Delete the confirmation message
    await ctx.deleteMessage();

    // Generate QR image from QRIS content string
    const qrImageBuffer = await generateQRImage(qrisResult.data.qris_content);

    // Build cancel keyboard
    const cancelKeyboard = new InlineKeyboard()
        .text("❌ Batalkan Pembayaran", `cancelqris:${order.id}`);

    // Send QR image with cancel button
    const qrMessage = await ctx.replyWithPhoto(
        new InputFile(qrImageBuffer, "qris.png"),
        {
            caption: `
━━━ 「 TRANSAKSI PENDING 」 ━━━
• ID Payment: ${order.pakasir_order_id}
• Produk: ${product.name}
• Jumlah: ${order.quantity}
• Total Bayar: ${formatRupiah(qrisResult.data.amount_total)}

⏳ Scan QR di atas untuk bayar
🕐 Berlaku 15 menit

⚠️ PENTING: Bayar TEPAT ${formatRupiah(qrisResult.data.amount_total)}
(Angka unik untuk verifikasi otomatis)

💡 Bisa bayar pakai:
GoPay, OVO, DANA, ShopeePay, LinkAja, dll
`,
            reply_markup: cancelKeyboard,
        }
    );

    // Update order with QR message ID
    await updateOrder(order.id, {
        qr_message_id: qrMessage.message_id,
    });
}

/**
 * Handle order cancellation
 */
export async function handleCancelOrder(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: "Pesanan dibatalkan" });

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const orderId = data.replace("cancel:", "");
    const order = await getOrderById(orderId);

    if (order) {
        await updateOrder(order.id, { payment_status: "cancelled" });
    }

    await ctx.editMessageText("❌ Pesanan dibatalkan.", {
        reply_markup: backToMainKeyboard(),
    });
}

/**
 * Handle QRIS payment cancellation (from QR image message)
 */
export async function handleCancelQris(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: "Pembayaran dibatalkan" });

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const orderId = data.replace("cancelqris:", "");
    const order = await getOrderById(orderId);

    if (order) {
        await updateOrder(order.id, { payment_status: "cancelled" });
    }

    // Delete the QR message
    try {
        await ctx.deleteMessage();
    } catch (e) {
        // Message might already be deleted
    }

    // Send cancellation message with products keyboard
    const products = await getActiveProducts();
    const stockMap = new Map<string, number>();
    for (const product of products) {
        const stock = await getProductStock(product.id);
        stockMap.set(product.id, stock);
    }

    await ctx.reply(
        "❌ *Pembayaran QRIS dibatalkan\\.*\n\nPilih produk lain jika masih ingin membeli:",
        {
            parse_mode: "MarkdownV2",
            reply_markup: productsKeyboard(products, stockMap),
        }
    );
}

/**
 * Process successful payment (called from webhook)
 */
export async function processSuccessfulPayment(
    order: Awaited<ReturnType<typeof getOrderById>>
): Promise<void> {
    if (!order || !botInstance) return;

    const product = await getProductById(order.product_id);
    if (!product) return;

    // Get and mark credentials as sold
    const credentials = await getAvailableCredentials(
        order.product_id,
        order.quantity
    );
    const credentialIds = credentials.map((c) => c.id);
    await markCredentialsAsSold(credentialIds, order.id);

    // Check and notify if stock is low
    const remainingStock = await getProductStock(order.product_id);
    const { notifyLowStock } = await import("./admin.js");
    await notifyLowStock(order.product_id, product.name, remainingStock);

    // Delete QR message if exists
    if (order.qr_message_id && order.chat_id) {
        try {
            await botInstance.api.deleteMessage(order.chat_id, order.qr_message_id);
        } catch (e) {
            console.error("Failed to delete QR message:", e);
        }
    }

    // Format credentials message
    let credentialsText = credentials
        .map((cred, idx) => formatCredential(cred, idx))
        .join("\n");

    const invoiceId = order.pakasir_order_id || `ORD${Date.now()}`;

    const successMessage = `
╭━━━━━━━━━━━━━━━
┊ *PEMBAYARAN SUKSES*
┊━━━━━━━━━━━━━━━
┊ Produk : ${product.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}
┊ Jumlah : ${order.quantity}
┊ Total : ${formatRupiah(order.total_price).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}
┊ Invoice : \`${invoiceId.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}\`
┊━━━━━━━━━━━━━━━
┊ *DETAIL AKUN*
${credentialsText}
╰━━━━━━━━━━━━━━━
_Note : Pastikan aplikasi terkait sudah versi terbaru\\._
_Terima kasih telah berbelanja\\!_ 🙏
`;

    // Create keyboard with Hubungi Admin button
    const successKeyboard = new InlineKeyboard()
        .text("💬 Hubungi Admin", "menu:chat");

    // Send credentials to user
    if (order.chat_id) {
        await botInstance.api.sendMessage(order.chat_id, successMessage, {
            parse_mode: "MarkdownV2",
            reply_markup: successKeyboard,
        });

        // Generate and send .txt file with credentials
        let txtContent = `===== DETAIL AKUN =====\n`;
        txtContent += `Produk: ${product.name}\n`;
        txtContent += `Jumlah: ${order.quantity}\n`;
        txtContent += `Total: ${formatRupiah(order.total_price)}\n`;
        txtContent += `Order ID: ${order.pakasir_order_id}\n`;
        txtContent += `Tanggal: ${new Date().toLocaleString("id-ID")}\n`;
        txtContent += `\n===== CREDENTIALS =====\n\n`;

        credentials.forEach((cred, idx) => {
            txtContent += `--- Akun #${idx + 1} ---\n`;
            txtContent += `Email: ${cred.email}\n`;
            txtContent += `Password: ${cred.password}\n`;
            if (cred.pin && cred.pin !== "-") {
                txtContent += `PIN: ${cred.pin}\n`;
            }
            if (cred.extra_info && cred.extra_info !== "-") {
                txtContent += `Info: ${cred.extra_info}\n`;
            }
            txtContent += `\n`;
        });

        txtContent += `===== TERIMA KASIH =====\n`;

        // Send as document
        await botInstance.api.sendDocument(order.chat_id, new InputFile(Buffer.from(txtContent), `akun_${order.pakasir_order_id}.txt`), {
            caption: "📄 File .txt berisi detail akun kamu",
        });
    }

    // Post to testimony channel
    if (TESTIMONY_CHANNEL_ID) {
        const now = new Date().toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const orderId = order.pakasir_order_id || `ORD${Date.now()}`;
        const botUsername = "hubifyid_bot";

        const testimonyMessage = `💰 *ORDER BERHASIL*

ID: \`${orderId}\`
User: @${order.telegram_username || "Anonymous"}
Total: ${formatRupiah(order.total_price)}
📱 Sumber: Telegram Bot
Metode: QRIS
Date: ${now}

📊 *STATISTIK*
Produk: ${product.name}
Qty: ${order.quantity} pcs
Status: ✅ Transaksi Sukses`;

        const testimonyKeyboard = new InlineKeyboard()
            .url("🛒 Order", `https://t.me/${botUsername}`);

        try {
            await botInstance.api.sendMessage(TESTIMONY_CHANNEL_ID, testimonyMessage, {
                parse_mode: "Markdown",
                reply_markup: testimonyKeyboard,
            });
        } catch (e) {
            console.error("Failed to send testimony:", e);
        }
    }

    // Save to transaction_proofs (sync with website)
    try {
        await supabase.from("transaction_proofs").insert({
            caption: `✅ ${product.name} x${order.quantity} — ${formatRupiah(order.total_price)} (via Bot)`,
            image_url: "",
            is_visible: true,
        });
    } catch (e) {
        console.error("Failed to insert transaction_proof:", e);
    }

    // Send notes to notes channel if present
    if (NOTES_CHANNEL_ID && botInstance && order.notes && order.notes !== "-") {
        const notesMsg = `📝 *CATATAN PESANAN*

ID: \`${order.pakasir_order_id || order.id}\`
Produk: ${product.name}
User: @${order.telegram_username || "Anonymous"}
📱 Sumber: Telegram Bot
Metode: QRIS

Catatan:
${order.notes}`;

        try {
            await botInstance.api.sendMessage(NOTES_CHANNEL_ID, notesMsg, {
                parse_mode: "Markdown",
            });
        } catch (e) {
            console.error("Failed to send notes:", e);
        }
    }

    // Post to private log channel (admin documentation)
    if (LOG_CHANNEL_ID) {
        // Format credentials for log
        let credentialsLog = credentials.map((cred, idx) => {
            let log = `├ Email: ${cred.email}\n├ Password: ${cred.password}`;
            if (cred.pin && cred.pin !== "-") {
                log += `\n├ PIN: ${cred.pin}`;
            }
            if (cred.extra_info && cred.extra_info !== "-") {
                log += `\n├ Info: ${cred.extra_info}`;
            }
            return `Akun #${idx + 1}:\n${log}`;
        }).join("\n\n");

        const logMessage = `📋 ORDER LOG #${order.pakasir_order_id}

👤 Buyer: @${order.telegram_username || "Anonymous"}
📦 Produk: ${product.name}
🔢 Jumlah: ${order.quantity}
💰 Total: ${formatRupiah(order.total_price)}
📅 Waktu: ${new Date().toLocaleString("id-ID")}

🔐 Detail Akun:
${credentialsLog}

━━━━━━━━━━━━━━━━━━━━━`;

        try {
            await botInstance.api.sendMessage(LOG_CHANNEL_ID, logMessage);
        } catch (e) {
            console.error("Failed to send to log channel:", e);
        }
    }
}
