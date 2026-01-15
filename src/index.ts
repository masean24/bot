import { Bot } from "grammy";
import { BOT_TOKEN, validateConfig } from "./config.js";
import { startWebServer } from "./web/server.js";
import { cleanupExpiredOrders } from "./services/supabase.js";
import {
    handleStart,
    handleMainMenu,
    handleHelp,
    handleHelpMenu,
    handleListProdukButton,
    handleCekSaldoButton,
    handleRiwayatOrderButton,
    handleReferralCommand,
    handleSaldo,
    handleTopup,
    handleRiwayat,
} from "./bot/commands/start.js";
import {
    handleProductsMenu,
    handleProductSelect,
    handleBuyProduct,
    handleQuantitySelect,
    handleConfirmOrder,
    handleCancelOrder,
    handleCancelQris,
    handleAddQuantity,
    handleSubQuantity,
    handleRefreshOrder,
    handlePayQris,
    handlePaySaldo,
    handleInputVoucher,
    handleVoucherTextInput,
    setBotInstance,
} from "./bot/handlers/order.js";
import {
    handleAdminCommand,
    handleAdminStats,
    handleAdminProducts,
    handleAdminOrders,
    handleAddProductStart,
    handleAddStockStart,
    handleAdminTextInput,
    handleAdminProductDetail,
    handleEditProductStart,
    handleEditFieldSelect,
    handleSetStatus,
    handleDeleteProduct,
    handleConfirmDeleteProduct,
    handleViewStock,
    handleAddStockForProduct,
    handleAdminBack,
    handleViewDetailedStock,
    handleExportStock,
    handleBroadcastCommand,
    handleUsersCommand,
    handleVoucherCommand,
    handleStatsDetailedCommand,
    handleExportCommand,
    handleMaintenanceCommand,
    isAdmin,
} from "./bot/handlers/admin.js";
import {
    handleStartChat,
    handleEndChat,
    handleUserChatMessage,
    handleCloseChat,
    handleAdminChats,
    handleViewChat,
    handleReplyChat,
    handleStopReply,
    handleAdminChatMessage,
    handleAdminCloseChat,
    handleAdminChatsCallback,
    setChatBotInstance,
} from "./bot/handlers/chat.js";

// Validate configuration
validateConfig();

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Set bot instance for handlers
setBotInstance(bot);

// Set bot instance for webhook (for topup notifications)
import { setBotInstanceForWebhook } from "./web/routes/webhook.js";
setBotInstanceForWebhook(bot);

// Set bot instance for chat handlers
setChatBotInstance(bot);

// ============ COMMANDS ============

bot.command("start", handleStart);
bot.command("help", handleHelp);
bot.command("admin", handleAdminCommand);

bot.command("broadcast", handleBroadcastCommand);
bot.command("users", handleUsersCommand);
bot.command("voucher", handleVoucherCommand);
bot.command("stats", handleStatsDetailedCommand);
bot.command("export", handleExportCommand);
bot.command("mt", handleMaintenanceCommand);
bot.command("referral", handleReferralCommand);
bot.command("produk", handleListProdukButton);
bot.command("bantuan", handleHelp);

// Deposit commands
bot.command("saldo", handleSaldo);
bot.command("topup", handleTopup);
bot.command("riwayat", handleRiwayat);

// Chat commands
bot.command("chat", handleStartChat);
bot.command("endchat", handleEndChat);
bot.command("chats", handleAdminChats);

// Status/Health command (admin only)
const botStartTime = Date.now();
bot.command("status", async (ctx) => {
    if (!isAdmin(ctx.from?.id || 0)) {
        return ctx.reply("❌ Command ini hanya untuk admin.");
    }

    const uptime = Date.now() - botStartTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let uptimeStr = "";
    if (days > 0) uptimeStr = `${days}d ${hours % 24}h ${minutes % 60}m`;
    else if (hours > 0) uptimeStr = `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    else if (minutes > 0) uptimeStr = `${minutes}m ${seconds % 60}s`;
    else uptimeStr = `${seconds}s`;

    const memoryUsage = process.memoryUsage();
    const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    const statusMessage = `
🤖 *BOT STATUS*

✅ Status: Online
⏱ Uptime: ${uptimeStr}
🕐 Started: ${new Date(botStartTime).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}

💾 Memory: ${usedMB}MB / ${totalMB}MB
📦 Node: ${process.version}
🖥 Platform: ${process.platform}

📅 Current: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

    await ctx.reply(statusMessage, { parse_mode: "Markdown" });
});
bot.command("stopreply", handleStopReply);

// ============ CALLBACK QUERIES ============

// Main menu
bot.callbackQuery("menu:main", handleMainMenu);
bot.callbackQuery("menu:list_produk", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    await handleListProdukButton(ctx);
});
bot.callbackQuery("menu:products", handleProductsMenu);
bot.callbackQuery("menu:my_orders", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    await handleRiwayatOrderButton(ctx);
});
bot.callbackQuery("menu:referral", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleReferralCommand(ctx);
});
bot.callbackQuery("menu:saldo", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleSaldo(ctx);
});
bot.callbackQuery("menu:topup", async (ctx) => {
    await ctx.answerCallbackQuery();
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
});
bot.callbackQuery("menu:help", handleHelpMenu);
bot.callbackQuery("menu:chat", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleStartChat(ctx);
});

// Product selection
bot.callbackQuery(/^product:/, handleProductSelect);
bot.callbackQuery(/^buy:/, handleBuyProduct);
bot.callbackQuery(/^qty:/, handleQuantitySelect);
bot.callbackQuery(/^confirm:/, handleConfirmOrder);
bot.callbackQuery(/^cancel:/, handleCancelOrder);
bot.callbackQuery(/^addqty:/, handleAddQuantity);
bot.callbackQuery(/^subqty:/, handleSubQuantity);
bot.callbackQuery(/^refreshorder:/, handleRefreshOrder);
bot.callbackQuery(/^payqris:/, handlePayQris);
bot.callbackQuery(/^paysaldo:/, handlePaySaldo);
bot.callbackQuery(/^inputvoucher:/, handleInputVoucher);
bot.callbackQuery(/^cancelqris:/, handleCancelQris);

// Back to products - redirects to product list
bot.callbackQuery("back:products", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    await handleListProdukButton(ctx);
});

// No-op for disabled buttons
bot.callbackQuery("noop", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Stok habis!", show_alert: true });
});

// Admin callbacks - basic
bot.callbackQuery("admin:stats", handleAdminStats);
bot.callbackQuery("admin:products", handleAdminProducts);
bot.callbackQuery("admin:orders", handleAdminOrders);
bot.callbackQuery("admin:add_product", handleAddProductStart);
bot.callbackQuery("admin:add_stock", handleAddStockStart);
bot.callbackQuery("admin:back", handleAdminBack);

// Admin callbacks - product CRUD
bot.callbackQuery(/^admin:product:/, handleAdminProductDetail);
bot.callbackQuery(/^admin:edit:/, handleEditProductStart);
bot.callbackQuery(/^admin:editfield:/, handleEditFieldSelect);
bot.callbackQuery(/^admin:setstatus:/, handleSetStatus);
bot.callbackQuery(/^admin:delete:/, handleDeleteProduct);
bot.callbackQuery(/^admin:confirmdelete:/, handleConfirmDeleteProduct);
bot.callbackQuery(/^admin:viewstock:/, handleViewStock);
bot.callbackQuery(/^admin:stock:/, handleAddStockForProduct);
bot.callbackQuery(/^admin:detailstock:/, handleViewDetailedStock);
bot.callbackQuery(/^admin:exportstock:/, handleExportStock);

// Chat callbacks
bot.callbackQuery(/^closechat:/, handleCloseChat);
bot.callbackQuery(/^viewchat:/, handleViewChat);
bot.callbackQuery(/^replychat:/, handleReplyChat);
bot.callbackQuery(/^adminclosechat:/, handleAdminCloseChat);
bot.callbackQuery("admin:chats", handleAdminChatsCallback);

// ============ TEXT MESSAGES ============

// Reply keyboard button handlers (updated names without emoji)
bot.hears("List Produk", handleListProdukButton);
bot.hears("🛒 List Produk", handleListProdukButton); // Legacy support
bot.hears("Cek Saldo", handleCekSaldoButton);
bot.hears("💰 Cek Saldo", handleCekSaldoButton); // Legacy support
bot.hears("📋 Riwayat Order", handleRiwayatOrderButton);
bot.hears("❓ Bantuan", handleHelp);
bot.hears("⟳ BANTUAN", handleHelp);

// Number button handlers for quick product selection
bot.hears(/^(\d{1,2})$/, async (ctx) => {
    const num = parseInt(ctx.match[1]);
    if (num < 1 || num > 50) return; // Safety limit

    // Import needed function
    const { getActiveProducts } = await import("./services/supabase.js");
    const products = await getActiveProducts();

    // Check if number is valid for products
    if (num > products.length) {
        await ctx.reply(`❌ Produk nomor ${num} tidak tersedia. Maksimal: ${products.length}`);
        return;
    }

    // Get the product by index (num - 1)
    const product = products[num - 1];
    if (!product) return;

    // Trigger product selection
    const { handleProductSelectByNumber } = await import("./bot/handlers/order.js");
    await handleProductSelectByNumber(ctx, product.id);
});

// Handle text input for voucher codes, chat, and admin multi-step operations
bot.on("message:text", async (ctx, next) => {
    // Check for voucher input first
    const handledVoucher = await handleVoucherTextInput(ctx);
    if (handledVoucher) return;

    // Check for admin chat reply
    if (isAdmin(ctx.from?.id)) {
        const handledAdminChat = await handleAdminChatMessage(ctx);
        if (handledAdminChat) return;
    }

    // Check for user chat message
    const handledUserChat = await handleUserChatMessage(ctx);
    if (handledUserChat) return;

    // Then admin input
    if (isAdmin(ctx.from?.id)) {
        await handleAdminTextInput(ctx);
    }
    await next();
});

// ============ ERROR HANDLING ============

bot.catch((err) => {
    console.error("Bot error:", err);
});

// ============ ORDER CLEANUP SCHEDULER ============

async function startOrderCleanupScheduler() {
    // Run cleanup every 1 minute
    const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
    const ORDER_EXPIRY_MINUTES = 15;

    console.log(`⏰ Order cleanup scheduler started (checking every 1 minute for orders > ${ORDER_EXPIRY_MINUTES} min old)`);

    setInterval(async () => {
        try {
            const result = await cleanupExpiredOrders(ORDER_EXPIRY_MINUTES);

            if (result.expired.length > 0) {
                console.log(`🧹 Expired ${result.expired.length} pending orders`);

                // Delete QR messages and notify users
                for (const order of result.expired) {
                    try {
                        // Delete QR message if exists
                        if (order.qr_message_id && order.chat_id) {
                            try {
                                await bot.api.deleteMessage(order.chat_id, order.qr_message_id);
                            } catch (e) {
                                // Message might already be deleted
                            }

                            // Send expiry notification with product list
                            const { getActiveProducts, getProductStock } = await import("./services/supabase.js");
                            const { productsKeyboard, formatRupiah } = await import("./bot/utils.js");

                            const products = await getActiveProducts();
                            const stockMap = new Map<string, number>();
                            for (const product of products) {
                                const stock = await getProductStock(product.id);
                                stockMap.set(product.id, stock);
                            }

                            await bot.api.sendMessage(
                                order.chat_id,
                                `⏰ *Waktu pembayaran habis\\!*\n\nPesanan kamu telah expired karena tidak dibayar dalam 15 menit\\.\n\nSilakan pilih produk lagi jika masih ingin membeli:`,
                                {
                                    parse_mode: "MarkdownV2",
                                    reply_markup: productsKeyboard(products, stockMap),
                                }
                            );
                        }
                    } catch (e) {
                        console.error("Error notifying user about expired order:", e);
                    }
                }
            }
        } catch (error) {
            console.error("Order cleanup error:", error);
        }
    }, CLEANUP_INTERVAL_MS);
}

// ============ START ============

async function main() {
    console.log("🤖 Starting Telegram Auto Order Bot...");

    // Start web server (for webhook)
    startWebServer();

    // Start order cleanup scheduler
    startOrderCleanupScheduler();

    // Start topup cleanup scheduler
    startTopupCleanupScheduler();

    // Start low stock alert scheduler
    startLowStockAlertScheduler();

    // Start bot with long polling
    await bot.start({
        onStart: (botInfo) => {
            console.log(`✅ Bot @${botInfo.username} is running!`);
            console.log(`   Send /start to ${botInfo.username} to begin`);
        },
    });
}

main().catch(console.error);

// ============ TOPUP CLEANUP SCHEDULER ============

async function startTopupCleanupScheduler() {
    const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
    const TOPUP_EXPIRY_MINUTES = 15;

    console.log(`⏰ Topup cleanup scheduler started (checking every 1 minute)`);

    setInterval(async () => {
        try {
            const { cleanupExpiredTopups } = await import("./services/deposit.js");
            const result = await cleanupExpiredTopups(TOPUP_EXPIRY_MINUTES);

            if (result.expired.length > 0) {
                console.log(`🧹 Expired ${result.expired.length} pending topups`);

                // Delete QR messages
                for (const topup of result.expired) {
                    try {
                        if (topup.qr_message_id && topup.chat_id) {
                            await bot.api.deleteMessage(topup.chat_id, topup.qr_message_id);
                            await bot.api.sendMessage(
                                topup.chat_id,
                                `⏰ Topup kamu sudah expired karena tidak dibayar dalam 15 menit.\n\nGunakan /topup <nominal> untuk topup lagi.`
                            );
                        }
                    } catch (e) {
                        // Message might already be deleted
                    }
                }
            }
        } catch (error) {
            console.error("Topup cleanup error:", error);
        }
    }, CLEANUP_INTERVAL_MS);
}

// ============ LOW STOCK ALERT SCHEDULER ============

async function startLowStockAlertScheduler() {
    const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

    console.log(`⏰ Low stock alert scheduler started (checking every 4 hours)`);

    // Also run immediately on startup (after 30 seconds)
    setTimeout(checkAndAlertLowStock, 30 * 1000);

    setInterval(checkAndAlertLowStock, CHECK_INTERVAL_MS);
}

async function checkAndAlertLowStock() {
    try {
        const { getActiveProducts, getProductStock } = await import("./services/supabase.js");
        const { formatRupiah } = await import("./bot/utils.js");
        const { ADMIN_IDS } = await import("./config.js");

        const products = await getActiveProducts();
        const lowStockProducts: { name: string; stock: number; threshold: number }[] = [];

        for (const product of products) {
            const stock = await getProductStock(product.id);
            const threshold = (product as any).low_stock_threshold || 5;

            if (stock <= threshold && stock > 0) {
                lowStockProducts.push({ name: product.name, stock, threshold });
            }
        }

        if (lowStockProducts.length > 0) {
            let message = `⚠️ *Low Stock Alert*\n\n`;
            message += `Produk dengan stok menipis:\n\n`;

            for (const p of lowStockProducts) {
                message += `• *${p.name}*: ${p.stock} pcs\n`;
            }

            message += `\n📦 Segera tambah stok!`;

            // Send to all admins
            for (const adminId of ADMIN_IDS) {
                try {
                    await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
                } catch (e) {
                    console.error(`Failed to send low stock alert to admin ${adminId}:`, e);
                }
            }

            console.log(`📢 Sent low stock alert for ${lowStockProducts.length} products`);
        }
    } catch (error) {
        console.error("Low stock check error:", error);
    }
}
