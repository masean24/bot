import type { Context } from "grammy";
import { Keyboard, InlineKeyboard, InputFile } from "grammy";
import { ADMIN_IDS, WELCOME_BANNER_URL, BOT_NAME, TESTIMONY_CHANNEL_USERNAME, MAIN_CHANNEL_USERNAME, ADMIN_CONTACT_USERNAME } from "../../config.js";
import {
    mainMenuKeyboard,
    formatRupiah,
} from "../utils.js";
import {
    getActiveProducts,
    getProductStock,
    getOrderStats,
    supabase,
} from "../../services/supabase.js";

/**
 * Create reply keyboard for main menu with dynamic product buttons
 */
export async function createReplyKeyboard(productCount?: number): Promise<Keyboard> {
    // Get product count if not provided
    let count = productCount;
    if (count === undefined) {
        const products = await getActiveProducts();
        count = products.length;
    }

    const keyboard = new Keyboard()
        .text("List Produk").text("Cek Saldo").row();

    // Add number buttons in rows of 10
    if (count > 0) {
        const buttonsPerRow = 10;
        for (let i = 1; i <= count; i++) {
            keyboard.text(`${i}`);
            if (i % buttonsPerRow === 0 && i < count) {
                keyboard.row();
            }
        }
        keyboard.row();
    }

    keyboard.text("⟳ BANTUAN").resized().persistent();

    return keyboard;
}

/**
 * Handle /start command with referral link support
 */
export async function handleStart(ctx: Context): Promise<void> {
    const user = ctx.from;
    const firstName = user?.first_name || "Kak";
    const username = user?.username || "anonymous";
    const userId = user?.id || 0;

    // Simpan/update user ke tabel bot_users (untuk broadcast)
    try {
        await supabase
            .from("bot_users")
            .upsert({
                user_id: userId,
                username: user?.username || null,
                first_name: user?.first_name || null,
                last_name: user?.last_name || null,
                last_seen_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
    } catch (e) {
        console.error("Failed to save bot user:", e);
    }


    // Debug logging
    console.log(`[DEBUG] User ID: ${userId}, Banner URL: ${WELCOME_BANNER_URL || "(empty)"}`);
    console.log(`[DEBUG] ADMIN_IDS: ${ADMIN_IDS.join(", ") || "(empty)"}`);

    // Get bot stats
    const stats = await getOrderStats();

    // Get user's order count
    const { count: userOrderCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("telegram_user_id", userId)
        .eq("payment_status", "paid");

    // Get total users (unique telegram_user_ids)
    const { data: uniqueUsers } = await supabase
        .from("orders")
        .select("telegram_user_id");
    const totalUsers = new Set(uniqueUsers?.map(u => u.telegram_user_id)).size;

    const currentDate = new Date().toLocaleString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    const botUsername = ctx.me?.username || "bot";

    const welcomeCaption = `Halo ${firstName}! 👋
Selamat datang di ${BOT_NAME}
${currentDate}

📊 User Info :
├ ID : ${userId}
├ Username : @${username}
├ Transaksi : ${userOrderCount || 0}x
└ Status : Member

📈 BOT Stats :
├ Terjual : ${stats.paidOrders} pcs
├ Total Transaksi : ${formatRupiah(stats.totalRevenue)}
└ Total User : ${totalUsers}

📢 Channel :
├ Testimoni : ${TESTIMONY_CHANNEL_USERNAME || "-"}
├ Official  : ${MAIN_CHANNEL_USERNAME || "-"}
└ Admin     : ${ADMIN_CONTACT_USERNAME || "-"}

📌 Shortcuts :
├ /start - Mulai bot
├ /produk - Cek produk
└ /bantuan - Bantuan`;

    // Get products for reply keyboard
    const products = await getActiveProducts();
    const replyKeyboard = await createReplyKeyboard(products.length);

    // Send welcome with banner image and inline menu
    if (WELCOME_BANNER_URL) {
        try {
            await ctx.replyWithPhoto(WELCOME_BANNER_URL, {
                caption: welcomeCaption,
                reply_markup: mainMenuKeyboard(),
            });
        } catch (e) {
            // Fallback to text if image fails
            await ctx.reply(welcomeCaption, {
                reply_markup: mainMenuKeyboard(),
            });
        }
    } else {
        await ctx.reply(welcomeCaption, {
            reply_markup: mainMenuKeyboard(),
        });
    }

    // Send reply keyboard separately (so it appears at bottom)
    await ctx.reply("⌨️ Gunakan keyboard di bawah untuk navigasi cepat:", {
        reply_markup: replyKeyboard,
    });
}


/**
 * Handle "List Produk" reply keyboard button - show categories
 */
export async function handleListProdukButton(ctx: Context, page: number = 1): Promise<void> {
    const { getCategories, getProductsByCategory, getProductStock } = await import("../../services/supabase.js");

    const categories = await getCategories();

    if (categories.length === 0) {
        await ctx.reply("😔 Belum ada kategori tersedia saat ini.");
        return;
    }

    // Pagination settings
    const itemsPerPage = 10;
    const totalPages = Math.ceil(categories.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, categories.length);
    const pageCategories = categories.slice(startIdx, endIdx);

    // Build category list with box format
    let message = `╭ - - - - - - - - - - - - - - - - - - - - - ╮\n`;
    message += `┊  LIST KATEGORI ${BOT_NAME}\n`;
    message += `┊- - - - - - - - - - - - - - - - - - - - - - \n`;

    for (let i = 0; i < pageCategories.length; i++) {
        const cat = pageCategories[i];
        const products = await getProductsByCategory(cat.id);

        // Calculate total stock from all products in category
        let totalStock = 0;
        for (const p of products) {
            totalStock += await getProductStock(p.id);
        }

        const num = startIdx + i + 1;
        message += `┊ [${num}] ${cat.name} (${totalStock})\n`;
    }

    message += `╰ - - - - - - - - - - - - - - - - - - - - - ╯\n\n`;
    message += `➝ Ketik nomor kategori (${startIdx + 1}-${endIdx}) untuk melanjutkan.\n`;
    message += `Halaman ${currentPage} dari ${totalPages}`;

    // Build number button grid (5 per row)
    const keyboard = new InlineKeyboard();
    const buttonsPerRow = 5;

    for (let i = 0; i < pageCategories.length; i++) {
        const num = startIdx + i + 1;
        const cat = pageCategories[i];
        keyboard.text(`${num}`, `category:${cat.id}`);

        if ((i + 1) % buttonsPerRow === 0 && i < pageCategories.length - 1) {
            keyboard.row();
        }
    }

    // Add pagination buttons if needed
    if (totalPages > 1) {
        keyboard.row();
        if (currentPage > 1) {
            keyboard.text("◀ Prev", `catpage:${currentPage - 1}`);
        }
        if (currentPage < totalPages) {
            keyboard.text("Next ▶", `catpage:${currentPage + 1}`);
        }
    }

    // Send with banner if available
    if (WELCOME_BANNER_URL) {
        try {
            await ctx.replyWithPhoto(WELCOME_BANNER_URL, {
                caption: message,
                reply_markup: keyboard,
            });
        } catch (e) {
            // Fallback to text if image fails
            await ctx.reply(message, {
                reply_markup: keyboard,
            });
        }
    } else {
        await ctx.reply(message, {
            reply_markup: keyboard,
        });
    }
}

/**
 * Handle category pagination callback
 */
export async function handleCategoryPage(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const page = parseInt(data.replace("catpage:", ""));
    await handleListProdukButton(ctx, page);
}

/**
 * Handle "Cek Saldo" reply keyboard button
 */
export async function handleCekSaldoButton(ctx: Context): Promise<void> {
    const user = ctx.from;
    const userId = user?.id || 0;

    // Get balance from deposit system
    const { getBalance, getOrCreateBalance } = await import("../../services/deposit.js");
    await getOrCreateBalance(userId, ctx.from?.username);
    const balance = await getBalance(userId);

    const { count: userOrderCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("telegram_user_id", userId)
        .eq("payment_status", "paid");

    const { data: totalSpent } = await supabase
        .from("orders")
        .select("total_price")
        .eq("telegram_user_id", userId)
        .eq("payment_status", "paid");

    const total = totalSpent?.reduce((sum: number, o: { total_price: number }) => sum + o.total_price, 0) || 0;

    await ctx.reply(`💰 *Info Akun Kamu*

┌─────────────────────┐
│ 💳 Saldo: ${formatRupiah(balance)}
└─────────────────────┘

📊 Statistik:
├ Total Transaksi : ${userOrderCount || 0}x
├ Total Belanja : ${formatRupiah(total)}
└ Status : Member

📌 Gunakan /topup <nominal> untuk isi saldo`, {
        parse_mode: "Markdown",
    });
}

/**
 * Handle "Riwayat Order" reply keyboard button
 */
export async function handleRiwayatOrderButton(ctx: Context): Promise<void> {
    const user = ctx.from;
    const userId = user?.id || 0;

    const { data: orders, error } = await supabase
        .from("orders")
        .select("*, products(name)")
        .eq("telegram_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

    if (error || !orders || orders.length === 0) {
        await ctx.reply("📋 Kamu belum punya riwayat order.");
        return;
    }

    let message = "📋 *Riwayat Order Terakhir*\n\n";

    for (const order of orders) {
        const statusEmoji = order.payment_status === "paid" ? "✅" :
            order.payment_status === "pending" ? "⏳" :
                order.payment_status === "expired" ? "⌛" : "❌";
        const date = new Date(order.created_at).toLocaleDateString("id-ID");
        const productName = (order as any).products?.name || "Unknown";

        message += `${statusEmoji} ${productName}\n`;
        message += `   ${formatRupiah(order.total_price)} | ${date}\n\n`;
    }

    await ctx.reply(message, { parse_mode: "Markdown" });
}

/**
 * Handle main menu callback (inline keyboard)
 */
export async function handleMainMenu(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const welcomeMessage = `🏠 *MENU UTAMA*

╭━━━━━━━━━━━━━━━━━━━━━╮
┃  Pilih menu di bawah ini:
╰━━━━━━━━━━━━━━━━━━━━━╯`;

    await ctx.editMessageText(welcomeMessage, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
    });
}

/**
 * Handle /help command
 */
export async function handleHelp(ctx: Context): Promise<void> {
    const helpMessage = `❓ *Bantuan*

*Cara Order:*
1. Klik "🛍️ Lihat Produk"
2. Pilih produk yang diinginkan
3. Tentukan jumlah yang mau dibeli
4. Pilih metode pembayaran:
   • 💳 QRIS - Bayar langsung
   • 💰 Saldo - Potong dari saldo
5. Akun dikirim otomatis setelah bayar!

*Fitur Saldo:*
• /saldo - Cek saldo kamu
• /topup <nominal> - Isi saldo via QRIS
  Contoh: /topup 50000
• /riwayat - Riwayat transaksi

*Pembayaran:*
• Via QRIS (GoPay, OVO, Dana, dll)
• QR berlaku 15 menit
• Akun langsung dikirim setelah bayar

📞 Butuh bantuan?
Hubungi admin jika ada kendala.`;

    await ctx.reply(helpMessage, { parse_mode: "Markdown" });
}

/**
 * Handle help menu callback
 */
export async function handleHelpMenu(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    await handleHelp(ctx);
}

/**
 * Check if user is admin
 */
export function isUserAdmin(userId: number | undefined): boolean {
    if (!userId) return false;
    return ADMIN_IDS.includes(userId);
}

// ============ DEPOSIT COMMANDS ============

/**
 * Handle /saldo command - check user balance
 */
export async function handleSaldo(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) {
        await ctx.reply("❌ User tidak ditemukan.");
        return;
    }

    try {
        const { getBalance, getOrCreateBalance } = await import("../../services/deposit.js");
        await getOrCreateBalance(userId, ctx.from?.username);
        const balance = await getBalance(userId);

        await ctx.reply(
            `💰 *Saldo Kamu*\n\n` +
            `┌─────────────────────┐\n` +
            `│ 💳 ${formatRupiah(balance)}\n` +
            `└─────────────────────┘\n\n` +
            `📌 Gunakan /topup <nominal> untuk isi saldo\n` +
            `Contoh: /topup 50000`,
            { parse_mode: "Markdown" }
        );
    } catch (e) {
        console.error("Error getting balance:", e);
        await ctx.reply("❌ Gagal mengambil saldo.");
    }
}

/**
 * Handle /topup command - request topup via QRIS
 */
export async function handleTopup(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const chatId = ctx.chat?.id;

    if (!userId || !chatId) {
        await ctx.reply("❌ User tidak ditemukan.");
        return;
    }

    // Parse amount from command
    const text = ctx.message?.text || "";
    const parts = text.split(/\s+/);
    const amountStr = parts[1];

    if (!amountStr) {
        await ctx.reply(
            `💳 *Topup Saldo*\n\n` +
            `Cara penggunaan:\n` +
            `/topup <nominal>\n\n` +
            `Contoh:\n` +
            `• /topup 10000\n` +
            `• /topup 50000\n` +
            `• /topup 100000\n\n` +
            `Minimal topup: Rp 10.000`,
            { parse_mode: "Markdown" }
        );
        return;
    }

    const amount = parseInt(amountStr.replace(/\D/g, ""));
    if (isNaN(amount) || amount < 10000) {
        await ctx.reply("❌ Nominal tidak valid. Minimal topup Rp 10.000");
        return;
    }

    if (amount > 10000000) {
        await ctx.reply("❌ Maksimal topup Rp 10.000.000 per transaksi.");
        return;
    }

    try {
        const { createTransaction, generateQRImage } = await import("../../services/qris.js");
        const { createTopupRequest, updateTopupQrMessageId, getOrCreateBalance } = await import("../../services/deposit.js");

        // Ensure user has balance record
        await getOrCreateBalance(userId, username);

        // Create QRIS transaction
        const topupOrderId = `TOPUP-${userId}-${Date.now()}`;
        const qrisResult = await createTransaction(topupOrderId, amount, `telegram_${userId}`);

        if (!qrisResult.success || !qrisResult.data) {
            await ctx.reply("❌ Gagal membuat QRIS. Coba lagi nanti.");
            return;
        }

        // Create topup request in database (store our order_id, not QRIS's transaction_id)
        const topupRequest = await createTopupRequest(
            userId,
            username,
            amount,
            qrisResult.data.amount_total,
            topupOrderId, // Use our order_id so webhook can find it
            chatId
        );

        // Generate QR image
        const qrBuffer = await generateQRImage(qrisResult.data.qris_content);

        // Send QR to user
        const qrMsg = await ctx.replyWithPhoto(
            new InputFile(qrBuffer, "topup-qr.png"),
            {
                caption:
                    `💳 *Topup Saldo*\n\n` +
                    `┌─────────────────────────┐\n` +
                    `│ 📝 Nominal: ${formatRupiah(amount)}\n` +
                    `│ 💵 Bayar: *${formatRupiah(qrisResult.data.amount_total)}*\n` +
                    `│ ⏳ Berlaku: 15 menit\n` +
                    `└─────────────────────────┘\n\n` +
                    `⚠️ *Penting:* Bayar tepat ${formatRupiah(qrisResult.data.amount_total)}\n` +
                    `📲 Scan QR dengan GoPay/OVO/Dana/dll\n\n` +
                    `💡 Saldo akan otomatis masuk setelah bayar!`,
                parse_mode: "Markdown",
            }
        );

        // Save QR message ID
        await updateTopupQrMessageId(topupRequest.id, qrMsg.message_id);

    } catch (e) {
        console.error("Error creating topup:", e);
        await ctx.reply("❌ Gagal membuat topup. Coba lagi nanti.");
    }
}

/**
 * Handle /riwayat command - transaction history
 */
export async function handleRiwayat(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) {
        await ctx.reply("❌ User tidak ditemukan.");
        return;
    }

    try {
        const { getTransactionHistory, getBalance } = await import("../../services/deposit.js");
        const transactions = await getTransactionHistory(userId, 10);
        const balance = await getBalance(userId);

        if (transactions.length === 0) {
            await ctx.reply(
                `📋 *Riwayat Transaksi*\n\n` +
                `💳 Saldo: ${formatRupiah(balance)}\n\n` +
                `Belum ada transaksi.`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        let message = `📋 *Riwayat Transaksi*\n\n`;
        message += `💳 Saldo: ${formatRupiah(balance)}\n`;
        message += `━━━━━━━━━━━━━━━━━━\n\n`;

        for (const tx of transactions) {
            const emoji = tx.type === "topup" ? "💰" :
                tx.type === "payment" ? "🛒" : "↩️";
            const sign = tx.amount >= 0 ? "+" : "";
            const date = new Date(tx.created_at).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
            });
            message += `${emoji} ${sign}${formatRupiah(tx.amount)} | ${date}\n`;
            if (tx.description) {
                message += `   └ ${tx.description}\n`;
            }
        }

        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (e) {
        console.error("Error getting transaction history:", e);
        await ctx.reply("❌ Gagal mengambil riwayat transaksi.");
    }
}
