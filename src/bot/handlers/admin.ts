import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { ADMIN_IDS } from "../../config.js";
import {
    adminMenuKeyboard,
    formatRupiah,
    backToMainKeyboard,
} from "../utils.js";
import {
    getActiveProducts,
    getProductById,
    getProductStock,
    createProduct,
    updateProduct,
    addCredentials,
    getRecentOrders,
    getOrderStats,
    supabase,
} from "../../services/supabase.js";

// Temporary storage for admin conversation state
const adminState = new Map<number, { step: string; data: any }>();

/**
 * Check if user is admin
 */
export function isAdmin(userId: number | undefined): boolean {
    if (!userId) return false;
    return ADMIN_IDS.includes(userId);
}

/**
 * Admin middleware
 */
export function adminOnly(handler: (ctx: Context) => Promise<void>) {
    return async (ctx: Context) => {
        if (!isAdmin(ctx.from?.id)) {
            await ctx.reply("❌ Akses ditolak. Kamu bukan admin.");
            return;
        }
        await handler(ctx);
    };
}

/**
 * Handle /admin command
 * Menampilkan menu admin dengan WebApp button untuk Mini App
 * Button Mini App HANYA muncul untuk admin (berdasarkan Telegram User ID)
 */
export async function handleAdminCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        // Non-admin tidak melihat apapun - langsung tolak
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    // Get WEBAPP_URL from environment or construct from WEBHOOK_URL
    const { WEBHOOK_URL } = await import("../../config.js");
    const webappUrl = process.env.MINIAPP_URL || `${WEBHOOK_URL}/miniapp`;

    const adminHelp = `🔐 *Panel Admin*

📋 *Commands Admin:*
├ /admin \\- Menu admin
├ /stats \\- Statistik lengkap
├ /export \\- Export order ke CSV
├ /voucher \\- Kelola voucher
├ /broadcast \\[msg\\] \\- Kirim ke semua user
└ /users \\- Daftar customer

🚀 *Mini App Admin:*
Buka Mini App untuk dashboard lengkap dengan analytics, grafik, dan fitur advanced\\.

Pilih menu di bawah:`;

    // Buat keyboard dengan WebApp button di atas
    const keyboard = new InlineKeyboard()
        .webApp("🚀 Buka Mini App", webappUrl)
        .row()
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

    await ctx.reply(adminHelp, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
    });
}

/**
 * Handle admin stats
 */
export async function handleAdminStats(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const stats = await getOrderStats();
    const products = await getActiveProducts();

    let totalStock = 0;
    for (const product of products) {
        totalStock += await getProductStock(product.id);
    }

    const message = `
📊 *Statistik*

📦 Total Produk: ${products.length}
📋 Total Stok: ${totalStock}

🛒 Total Order: ${stats.totalOrders}
✅ Order Sukses: ${stats.paidOrders}
💰 Total Revenue: ${formatRupiah(stats.totalRevenue)}
`;

    await ctx.editMessageText(message.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"), {
        parse_mode: "MarkdownV2",
        reply_markup: adminMenuKeyboard(),
    });
}

/**
 * Handle admin products list with action buttons
 */
export async function handleAdminProducts(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const products = await getActiveProducts();

    if (products.length === 0) {
        await ctx.editMessageText("📦 Belum ada produk.", {
            reply_markup: adminMenuKeyboard(),
        });
        return;
    }

    // Build keyboard with products and actions
    const keyboard = new InlineKeyboard();

    for (const product of products) {
        const stock = await getProductStock(product.id);
        keyboard
            .text(`📦 ${product.name} (${stock})`, `admin:product:${product.id}`)
            .row();
    }

    keyboard.text("🔙 Kembali", "admin:back");

    await ctx.editMessageText("📦 *Daftar Produk*\\n\\nPilih produk untuk kelola:", {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
    });
}

/**
 * Handle single product detail with CRUD actions
 */
export async function handleAdminProductDetail(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:product:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.editMessageText("❌ Produk tidak ditemukan.", {
            reply_markup: adminMenuKeyboard(),
        });
        return;
    }

    const stock = await getProductStock(productId);

    const message = `📦 *${product.name}*

📝 ${product.description || "-"}
💰 Harga: ${formatRupiah(product.price)}
📊 Stok: ${stock}
📌 Status: ${product.is_active ? "Aktif" : "Nonaktif"}`;

    const keyboard = new InlineKeyboard()
        .text("✏️ Edit", `admin:edit:${productId}`)
        .text("📤 Tambah Stok", `admin:stock:${productId}`)
        .row()
        .text("👁️ Lihat Akun", `admin:detailstock:${productId}`)
        .text("📥 Tarik Akun", `admin:withdraw:${productId}`)
        .row()
        .text("🗑️ Hapus", `admin:delete:${productId}`)
        .text("🔙 Kembali", "admin:products");

    await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
    });
}

/**
 * Handle edit product - start
 */
export async function handleEditProductStart(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:edit:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.answerCallbackQuery({ text: "Produk tidak ditemukan", show_alert: true });
        return;
    }

    adminState.set(ctx.from!.id, {
        step: "edit_product_field",
        data: { productId, product },
    });

    const keyboard = new InlineKeyboard()
        .text("📝 Nama", `admin:editfield:name`)
        .text("📄 Deskripsi", `admin:editfield:description`)
        .row()
        .text("💰 Harga", `admin:editfield:price`)
        .text("📌 Status", `admin:editfield:status`)
        .row()
        .text("🔙 Batal", `admin:product:${productId}`);

    await ctx.editMessageText(
        `✏️ *Edit Produk: ${product.name}*\n\nPilih field yang mau diedit:`.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"),
        { parse_mode: "MarkdownV2", reply_markup: keyboard }
    );
}

/**
 * Handle edit field selection
 */
export async function handleEditFieldSelect(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const state = adminState.get(userId);
    if (!state || state.step !== "edit_product_field") return;

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const field = data.replace("admin:editfield:", "");
    state.data.editField = field;
    state.step = "edit_product_value";
    adminState.set(userId, state);

    if (field === "status") {
        const keyboard = new InlineKeyboard()
            .text("✅ Aktif", "admin:setstatus:true")
            .text("❌ Nonaktif", "admin:setstatus:false");

        await ctx.editMessageText("Pilih status produk:", { reply_markup: keyboard });
    } else {
        const fieldLabels: Record<string, string> = {
            name: "nama produk",
            description: "deskripsi",
            price: "harga (angka saja)",
        };
        await ctx.editMessageText(`Kirim ${fieldLabels[field]} baru:`);
    }
}

/**
 * Handle status toggle
 */
export async function handleSetStatus(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const state = adminState.get(userId);
    if (!state) return;

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const isActive = data === "admin:setstatus:true";

    try {
        await updateProduct(state.data.productId, { is_active: isActive });
        adminState.delete(userId);
        await ctx.editMessageText(
            `✅ Status produk diubah ke: ${isActive ? "Aktif" : "Nonaktif"}`,
            { reply_markup: adminMenuKeyboard() }
        );
    } catch (e) {
        await ctx.editMessageText("❌ Gagal mengubah status.", {
            reply_markup: adminMenuKeyboard(),
        });
    }
}

/**
 * Handle delete product
 */
export async function handleDeleteProduct(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:delete:", "");

    // Confirm deletion
    const keyboard = new InlineKeyboard()
        .text("✅ Ya, Hapus", `admin:confirmdelete:${productId}`)
        .text("❌ Batal", `admin:product:${productId}`);

    await ctx.editMessageText("⚠️ Yakin mau hapus produk ini?", {
        reply_markup: keyboard,
    });
}

/**
 * Handle confirm delete product
 */
export async function handleConfirmDeleteProduct(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:confirmdelete:", "");

    try {
        await updateProduct(productId, { is_active: false });
        await ctx.editMessageText("✅ Produk berhasil dihapus (dinonaktifkan).", {
            reply_markup: adminMenuKeyboard(),
        });
    } catch (e) {
        await ctx.editMessageText("❌ Gagal menghapus produk.", {
            reply_markup: adminMenuKeyboard(),
        });
    }
}

/**
 * Handle view stock/credentials
 */
export async function handleViewStock(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:viewstock:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.answerCallbackQuery({ text: "Produk tidak ditemukan", show_alert: true });
        return;
    }

    const { data: credentials, error } = await supabase
        .from("credentials")
        .select("*")
        .eq("product_id", productId)
        .eq("is_sold", false)
        .limit(20);

    if (error || !credentials || credentials.length === 0) {
        await ctx.editMessageText("📋 Tidak ada stok tersedia.", {
            reply_markup: new InlineKeyboard().text("🔙 Kembali", `admin:product:${productId}`),
        });
        return;
    }

    let message = `📋 *Stok ${product.name}* (${credentials.length} tersedia)\n\n`;

    credentials.slice(0, 10).forEach((c, i) => {
        message += `${i + 1}. ${c.email}\n`;
    });

    if (credentials.length > 10) {
        message += `\n... dan ${credentials.length - 10} lainnya`;
    }

    await ctx.editMessageText(message.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"), {
        parse_mode: "MarkdownV2",
        reply_markup: new InlineKeyboard().text("🔙 Kembali", `admin:product:${productId}`),
    });
}

/**
 * Handle add stock for specific product
 */
export async function handleAddStockForProduct(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:stock:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.answerCallbackQuery({ text: "Produk tidak ditemukan", show_alert: true });
        return;
    }

    adminState.set(ctx.from!.id, {
        step: "add_stock_credentials",
        data: { selectedProduct: product },
    });

    await ctx.editMessageText(
        `📤 *Tambah Stok: ${product.name}*\n\nKirim credentials dengan format:\nemail|password|pin|info\n\nContoh:\nuser@email.com|pass123|1234|Link: https://...\nuser2@email.com|pass456|-|-\n\n(Gunakan - untuk field kosong)`.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"),
        { parse_mode: "MarkdownV2" }
    );
}

/**
 * Handle back to admin menu
 */
export async function handleAdminBack(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("🔐 *Panel Admin*\n\nPilih menu:".replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"), {
        parse_mode: "MarkdownV2",
        reply_markup: adminMenuKeyboard(),
    });
}

/**
 * Handle admin recent orders
 */
export async function handleAdminOrders(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const orders = await getRecentOrders(10);

    if (orders.length === 0) {
        await ctx.editMessageText("📋 Belum ada order.", {
            reply_markup: adminMenuKeyboard(),
        });
        return;
    }

    let message = "📋 *Order Terbaru*\n\n";

    for (const order of orders) {
        const statusEmoji =
            order.payment_status === "paid"
                ? "✅"
                : order.payment_status === "pending"
                    ? "⏳"
                    : order.payment_status === "expired"
                        ? "⌛"
                        : "❌";

        message += `${statusEmoji} \`${order.pakasir_order_id}\`\n`;
        message += `   💰 ${formatRupiah(order.total_price)} | @${order.telegram_username || "anon"}\n\n`;
    }

    await ctx.editMessageText(message.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"), {
        parse_mode: "MarkdownV2",
        reply_markup: adminMenuKeyboard(),
    });
}

/**
 * Handle add category - start (create parent product)
 */
export async function handleAddCategoryStart(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    adminState.set(ctx.from!.id, {
        step: "add_category_name",
        data: {},
    });

    await ctx.editMessageText(
        `➕ *Tambah Kategori Baru*\n\nKategori adalah grup produk \\(misal: ChatGpt, Canva, dll\\)\\.\n\nKirim nama kategori:`,
        { parse_mode: "MarkdownV2" }
    );
}

/**
 * Handle add product - start (requires selecting category first)
 */
export async function handleAddProductStart(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    // Get parent products (categories)
    const { getParentProducts } = await import("../../services/supabase.js");
    const parents = await getParentProducts();

    if (parents.length === 0) {
        await ctx.editMessageText(
            `❌ *Belum ada kategori\\!*\n\nBuat kategori dulu sebelum menambah produk\\.\n\nKlik "➕ Tambah Kategori" di menu admin\\.`,
            {
                parse_mode: "MarkdownV2",
                reply_markup: adminMenuKeyboard()
            }
        );
        return;
    }

    // Build category selection keyboard
    const keyboard = new InlineKeyboard();
    parents.forEach((p, i) => {
        keyboard.text(`📁 ${p.name}`, `admin:selectparent:${p.id}`);
        if ((i + 1) % 2 === 0) keyboard.row();
    });
    keyboard.row().text("🔙 Kembali", "admin:back");

    await ctx.editMessageText(
        `➕ *Tambah Produk Baru*\n\nPilih kategori untuk produk ini:`,
        {
            parse_mode: "Markdown",
            reply_markup: keyboard
        }
    );
}

/**
 * Handle parent category selection for new product
 */
export async function handleSelectParentForProduct(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parentId = data.replace("admin:selectparent:", "");
    const { getProductById } = await import("../../services/supabase.js");
    const parent = await getProductById(parentId);

    if (!parent) {
        await ctx.answerCallbackQuery({ text: "Kategori tidak ditemukan", show_alert: true });
        return;
    }

    adminState.set(ctx.from!.id, {
        step: "add_product_name",
        data: { parentId, parentName: parent.name },
    });

    await ctx.editMessageText(
        `➕ *Tambah Produk di ${parent.name}*\n\nKirim nama produk/variasi:`,
        { parse_mode: "Markdown" }
    );
}

/**
 * Handle add stock - start
 */
export async function handleAddStockStart(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const products = await getActiveProducts();

    if (products.length === 0) {
        await ctx.editMessageText("❌ Belum ada produk. Tambah produk dulu.", {
            reply_markup: adminMenuKeyboard(),
        });
        return;
    }

    adminState.set(ctx.from!.id, {
        step: "add_stock_select",
        data: { products },
    });

    let message = "📤 *Tambah Stok*\n\nPilih produk (kirim nomor):\n\n";
    products.forEach((p, i) => {
        message += `${i + 1}. ${p.name}\n`;
    });

    await ctx.editMessageText(message, { parse_mode: "Markdown" });
}

/**
 * Handle admin text input (for multi-step operations)
 */
export async function handleAdminTextInput(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !isAdmin(userId)) return;

    const state = adminState.get(userId);
    if (!state) return;

    const text = ctx.message?.text;
    if (!text) return;

    switch (state.step) {
        case "add_category_name":
            state.data.name = text;
            state.step = "add_category_description";
            adminState.set(userId, state);
            await ctx.reply("✅ Nama kategori: " + text + "\n\nSekarang kirim deskripsi kategori:");
            break;

        case "add_category_description":
            state.data.description = text;

            try {
                const product = await createProduct({
                    name: state.data.name,
                    description: state.data.description,
                    price: 1, // Dummy price (categories aren't sold directly)
                    is_active: true,
                    parent_id: null,
                    is_category: true,
                });

                // Also create in the store's categories table for web storefront
                try {
                    const slug = state.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const colors = ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4", "#FF5722"];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    await supabase.from("categories").insert({
                        name: state.data.name,
                        slug: slug,
                        color: randomColor,
                    });
                } catch (catErr: any) {
                    console.warn("[ADMIN] Failed to sync category to store:", catErr?.message);
                }

                adminState.delete(userId);
                await ctx.reply(
                    `✅ Kategori berhasil dibuat!\n\n📁 ${product.name}\n📝 ${product.description}\n\nSekarang tambah produk di kategori ini via menu admin.`,
                    { reply_markup: adminMenuKeyboard() }
                );
            } catch (e: any) {
                console.error("[ADMIN] Failed to create category:", e?.message || e);
                await ctx.reply(`❌ Gagal membuat kategori: ${e?.message || "Unknown error"}`);
                adminState.delete(userId);
            }
            break;

        case "add_product_name":
            state.data.name = text;
            state.step = "add_product_description";
            adminState.set(userId, state);
            await ctx.reply("✅ Nama: " + text + "\n\nSekarang kirim deskripsi produk:");
            break;

        case "add_product_description":
            state.data.description = text;
            state.step = "add_product_price";
            adminState.set(userId, state);
            await ctx.reply("✅ Deskripsi disimpan.\n\nSekarang kirim harga (angka saja, misal: 50000):");
            break;

        case "add_product_price":
            const price = parseInt(text.replace(/\D/g, ""));
            if (isNaN(price) || price <= 0) {
                await ctx.reply("❌ Harga tidak valid. Kirim angka saja:");
                return;
            }

            try {
                const product = await createProduct({
                    name: state.data.name,
                    description: state.data.description,
                    price: price,
                    is_active: true,
                    parent_id: state.data.parentId || null, // Use parent from state
                    is_category: false, // This is a product, not category
                });

                // Link product to store's categories table via category_id
                if (state.data.parentName) {
                    try {
                        const { data: storeCat } = await supabase
                            .from("categories")
                            .select("id")
                            .eq("name", state.data.parentName)
                            .maybeSingle();
                        if (storeCat) {
                            await supabase
                                .from("products")
                                .update({ category_id: storeCat.id })
                                .eq("id", product.id);
                        }
                    } catch (catErr: any) {
                        console.warn("[ADMIN] Failed to link product to store category:", catErr?.message);
                    }
                }

                const parentInfo = state.data.parentName ? `\n📁 Kategori: ${state.data.parentName}` : "";
                adminState.delete(userId);
                await ctx.reply(
                    `✅ Produk berhasil ditambahkan!\n\n📦 ${product.name}${parentInfo}\n💰 ${formatRupiah(product.price)}\n\nSekarang tambahkan stok via menu admin.`,
                    { reply_markup: adminMenuKeyboard() }
                );
            } catch (e) {
                await ctx.reply("❌ Gagal menambahkan produk. Coba lagi.");
                adminState.delete(userId);
            }
            break;

        case "add_stock_select":
            const productIndex = parseInt(text) - 1;
            const products = state.data.products;

            if (isNaN(productIndex) || productIndex < 0 || productIndex >= products.length) {
                await ctx.reply("❌ Pilihan tidak valid. Kirim nomor produk:");
                return;
            }

            state.data.selectedProduct = products[productIndex];
            state.step = "add_stock_credentials";
            adminState.set(userId, state);

            await ctx.reply(
                `✅ Produk: ${products[productIndex].name}\n\nKirim credentials dengan format:\nemail|password|pin|info_tambahan\n\nContoh:\nuser@email.com|pass123|1234|Link: https://...\nuser2@email.com|pass456|-|-\n\n(Gunakan - untuk field kosong)`
            );
            break;

        case "add_stock_credentials":
            const lines = text.split("\n").filter((l) => l.trim());
            const credentials = [];

            for (const line of lines) {
                const parts = line.split("|").map((p) => p.trim());
                if (parts.length < 2) continue;

                credentials.push({
                    product_id: state.data.selectedProduct.id,
                    email: parts[0],
                    password: parts[1],
                    pin: parts[2] || null,
                    extra_info: parts[3] || null,
                });
            }

            if (credentials.length === 0) {
                await ctx.reply("❌ Format tidak valid. Gunakan format: email|password|pin|info");
                return;
            }

            try {
                await addCredentials(credentials);
                adminState.delete(userId);
                await ctx.reply(
                    `✅ Berhasil menambahkan ${credentials.length} credentials ke ${state.data.selectedProduct.name}!`,
                    { reply_markup: adminMenuKeyboard() }
                );
            } catch (e) {
                await ctx.reply("❌ Gagal menambahkan credentials. Coba lagi.");
            }
            break;

        case "edit_product_value":
            const field = state.data.editField;
            const productId = state.data.productId;
            let updateValue: any = text;

            if (field === "price") {
                updateValue = parseInt(text.replace(/\D/g, ""));
                if (isNaN(updateValue) || updateValue <= 0) {
                    await ctx.reply("❌ Harga tidak valid. Kirim angka saja:");
                    return;
                }
            }

            try {
                await updateProduct(productId, { [field]: updateValue });
                adminState.delete(userId);
                await ctx.reply(
                    `✅ ${field === "name" ? "Nama" : field === "description" ? "Deskripsi" : "Harga"} produk berhasil diupdate!`,
                    { reply_markup: adminMenuKeyboard() }
                );
            } catch (e) {
                await ctx.reply("❌ Gagal mengupdate produk. Coba lagi.");
                adminState.delete(userId);
            }
            break;

        case "withdraw_custom_qty":
            await processWithdrawCustomQty(ctx, state);
            break;

        default:
            adminState.delete(userId);
    }
}

/**
 * Clear admin state
 */
export function clearAdminState(userId: number): void {
    adminState.delete(userId);
}



/**
 * Handle viewing detailed stock/credentials for a product
 */
export async function handleViewDetailedStock(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:detailstock:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.answerCallbackQuery({ text: "Produk tidak ditemukan", show_alert: true });
        return;
    }

    const { data: credentials, error } = await supabase
        .from("credentials")
        .select("*")
        .eq("product_id", productId)
        .eq("is_sold", false)
        .limit(20);

    console.log(`[DEBUG] handleViewDetailedStock - productId: ${productId}, error: ${error?.message}, credentials count: ${credentials?.length}`);

    if (error) {
        console.error("[DEBUG] Credentials query error:", error);
        const escapedError = (error.message || "Unknown error").replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
        await ctx.editMessageText(`📋 Stok ${product.name}\n\n❌ Error: ${escapedError}`, {
            reply_markup: new InlineKeyboard().text("🔙 Kembali", `admin:product:${productId}`),
        });
        return;
    }

    if (!credentials || credentials.length === 0) {
        await ctx.editMessageText(`📋 *Stok ${product.name}*\n\nTidak ada kredensial tersedia.\n\n(Product ID: ${productId.substring(0, 8)}...)`, {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard().text("🔙 Kembali", `admin:product:${productId}`),
        });
        return;
    }

    let message = `📋 *Detail Stok: ${product.name}*\n\n`;

    message += `✅ Tersedia: ${credentials.length}\n\n`;
    message += `━━━ Kredensial Tersedia ━━━\n\n`;

    credentials.slice(0, 5).forEach((c, idx) => {
        message += `${idx + 1}. ${c.email}\n`;
        message += `   🔑 ${c.password}\n`;
        if (c.pin && c.pin !== "-") message += `   🔢 ${c.pin}\n`;
        message += "\n";
    });

    if (credentials.length > 5) {
        message += `... dan ${credentials.length - 5} lainnya\n`;
    }

    await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard()
            .text("📥 Export All", `admin:exportstock:${productId}`)
            .row()
            .text("🔙 Kembali", `admin:product:${productId}`),
    });
}

/**
 * Handle exporting all stock to text
 */
export async function handleExportStock(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:exportstock:", "");
    const product = await getProductById(productId);

    if (!product) return;

    const { data: credentials } = await supabase
        .from("credentials")
        .select("*")
        .eq("product_id", productId)
        .eq("is_sold", false);

    if (!credentials || credentials.length === 0) {
        await ctx.answerCallbackQuery({ text: "Tidak ada stok", show_alert: true });
        return;
    }

    let exportText = `📦 Export Stok: ${product.name}\n`;
    exportText += `📅 ${new Date().toLocaleString("id-ID")}\n`;
    exportText += `📊 Total: ${credentials.length}\n\n`;

    credentials.forEach((c, idx) => {
        exportText += `${idx + 1}. ${c.email}|${c.password}|${c.pin || "-"}|${c.extra_info || "-"}\n`;
    });

    await ctx.reply(exportText);
}

/**
 * Handle /broadcast command - send message to ALL users yang pernah /start
 * Format: /broadcast message
 */
export async function handleBroadcastCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    const text = ctx.message?.text || "";
    const message = text.replace(/^\/broadcast\s*/, "").trim();

    if (!message) {
        // Show instructions
        await ctx.reply(`📢 *Broadcast ke Semua User*

Format:
\`/broadcast [pesan]\`

Contoh:
\`/broadcast 🔥 PROMO! Diskon 20% untuk semua produk hari ini!\`

Pesan akan dikirim ke semua user yang pernah /start bot.`, { parse_mode: "Markdown" });
        return;
    }

    // Get semua user dari tabel bot_users (yang pernah /start)
    const { data: users, error } = await supabase
        .from("bot_users")
        .select("user_id, username")
        .eq("is_blocked", false);

    if (error || !users || users.length === 0) {
        await ctx.reply("❌ Tidak ada user yang bisa dikirimi broadcast.");
        return;
    }

    await ctx.reply(`📢 Memulai broadcast ke ${users.length} user...`);

    let success = 0;
    let failed = 0;

    // We need bot instance - import from order handler
    const { getBotInstance } = await import("./order.js");
    const bot = getBotInstance();

    if (!bot) {
        await ctx.reply("❌ Bot instance tidak tersedia.");
        return;
    }

    for (const user of users) {
        try {
            await bot.api.sendMessage(user.user_id, `📢 *BROADCAST*\n\n${message}`, {
                parse_mode: "Markdown",
            });
            success++;
        } catch (e: any) {
            failed++;
            // Jika user block bot, tandai di database
            if (e?.error_code === 403) {
                await supabase
                    .from("bot_users")
                    .update({ is_blocked: true })
                    .eq("user_id", user.user_id);
            }
        }
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 50));
    }

    await ctx.reply(`✅ Broadcast selesai!\n\n📤 Terkirim: ${success}\n❌ Gagal: ${failed}`);
}

/**
 * Handle /users command - list all customers
 */
export async function handleUsersCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    // Get unique users with order count
    const { data: orders, error } = await supabase
        .from("orders")
        .select("telegram_user_id, telegram_username, payment_status, total_price");

    if (error || !orders || orders.length === 0) {
        await ctx.reply("❌ Belum ada customer.");
        return;
    }

    // Aggregate user stats
    const userStats = new Map<number, {
        username: string;
        totalOrders: number;
        paidOrders: number;
        totalSpent: number;
    }>();

    orders.forEach(o => {
        if (!o.telegram_user_id) return;

        const existing = userStats.get(o.telegram_user_id) || {
            username: o.telegram_username || "anon",
            totalOrders: 0,
            paidOrders: 0,
            totalSpent: 0,
        };

        existing.totalOrders++;
        if (o.payment_status === "paid") {
            existing.paidOrders++;
            existing.totalSpent += o.total_price || 0;
        }

        userStats.set(o.telegram_user_id, existing);
    });

    const users = Array.from(userStats.entries())
        .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
        .slice(0, 20);

    let message = `👥 *Daftar Customer*\nTotal: ${userStats.size} user\n\n`;

    users.forEach(([userId, stats], idx) => {
        message += `${idx + 1}. @${stats.username}\n`;
        message += `   📋 ${stats.paidOrders}/${stats.totalOrders} order | 💰 ${formatRupiah(stats.totalSpent)}\n\n`;
    });

    if (userStats.size > 20) {
        message += `... dan ${userStats.size - 20} user lainnya`;
    }

    await ctx.reply(message, { parse_mode: "Markdown" });
}

/**
 * Handle /voucher command - manage vouchers
 * Format: /voucher create CODE TYPE VALUE [MIN] [MAX]
 * Example: /voucher create DISKON10 percentage 10
 */
export async function handleVoucherCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    const text = ctx.message?.text || "";
    const parts = text.split(" ").filter(p => p.trim());

    // /voucher without args - show list
    if (parts.length < 2) {
        const { getAllVouchers } = await import("../../services/voucher.js");
        const vouchers = await getAllVouchers();

        if (vouchers.length === 0) {
            await ctx.reply(`🎟️ *Voucher Management*

Belum ada voucher.

Format buat voucher baru:
\`/voucher create CODE TYPE VALUE [MIN] [MAX]\`

Contoh:
• \`/voucher create DISKON10 percentage 10\` (diskon 10%)
• \`/voucher create HEMAT5K fixed 5000 20000\` (diskon Rp5000, min order Rp20000)`, { parse_mode: "Markdown" });
            return;
        }

        let message = "🎟️ *Daftar Voucher*\n\n";
        vouchers.forEach((v, idx) => {
            const discount = v.discount_type === "percentage" ? `${v.discount_value}%` : formatRupiah(v.discount_value);
            const usage = v.max_uses ? `${v.used_count}/${v.max_uses}` : `${v.used_count}/∞`;
            const status = v.is_active ? "✅" : "❌";
            message += `${idx + 1}. ${status} \`${v.code}\` - ${discount}\n`;
            message += `   📊 Used: ${usage}\n\n`;
        });

        message += `\nFormat: \`/voucher create CODE TYPE VALUE\``;

        await ctx.reply(message, { parse_mode: "Markdown" });
        return;
    }

    const action = parts[1].toLowerCase();

    if (action === "create" && parts.length >= 5) {
        const code = parts[2].toUpperCase();
        const discountType = parts[3] as "percentage" | "fixed";
        const discountValue = parseInt(parts[4]);
        const minOrder = parts[5] ? parseInt(parts[5]) : 0;
        const maxUses = parts[6] ? parseInt(parts[6]) : undefined;

        if (!["percentage", "fixed"].includes(discountType)) {
            await ctx.reply("❌ Type harus 'percentage' atau 'fixed'");
            return;
        }

        if (isNaN(discountValue) || discountValue <= 0) {
            await ctx.reply("❌ Value tidak valid");
            return;
        }

        try {
            const { createVoucher } = await import("../../services/voucher.js");
            await createVoucher({
                code,
                discount_type: discountType,
                discount_value: discountValue,
                min_purchase: minOrder,
                max_uses: maxUses,
            });

            const discountText = discountType === "percentage" ? `${discountValue}%` : formatRupiah(discountValue);
            await ctx.reply(`✅ Voucher berhasil dibuat!\n\n🎟️ Kode: \`${code}\`\n💰 Diskon: ${discountText}\n📦 Min Order: ${formatRupiah(minOrder)}`, { parse_mode: "Markdown" });
        } catch (e) {
            await ctx.reply("❌ Gagal membuat voucher. Kode mungkin sudah ada.");
        }
    } else if (action === "delete" && parts[2]) {
        const code = parts[2].toUpperCase();
        const { getVoucherByCode, deactivateVoucher } = await import("../../services/voucher.js");
        const voucher = await getVoucherByCode(code);

        if (!voucher) {
            await ctx.reply("❌ Voucher tidak ditemukan.");
            return;
        }

        await deactivateVoucher(voucher.id);
        await ctx.reply(`✅ Voucher \`${code}\` berhasil dinonaktifkan.`, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`🎟️ *Voucher Commands*

• \`/voucher\` - Lihat semua voucher
• \`/voucher create CODE TYPE VALUE [MIN] [MAX]\`
• \`/voucher delete CODE\`

Type: \`percentage\` atau \`fixed\``, { parse_mode: "Markdown" });
    }
}

/**
 * Handle /stats command - detailed statistics
 */
export async function handleStatsDetailedCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all paid orders
    const { data: orders } = await supabase
        .from("orders")
        .select("total_price, created_at, product_id")
        .eq("payment_status", "paid");

    if (!orders || orders.length === 0) {
        await ctx.reply("📊 Belum ada transaksi.");
        return;
    }

    // Calculate stats
    let todayRevenue = 0, weekRevenue = 0, monthRevenue = 0, totalRevenue = 0;
    let todayOrders = 0, weekOrders = 0, monthOrders = 0;
    const productCounts = new Map<string, number>();

    orders.forEach(o => {
        const orderDate = new Date(o.created_at);
        totalRevenue += o.total_price;

        if (orderDate >= today) {
            todayRevenue += o.total_price;
            todayOrders++;
        }
        if (orderDate >= weekAgo) {
            weekRevenue += o.total_price;
            weekOrders++;
        }
        if (orderDate >= monthAgo) {
            monthRevenue += o.total_price;
            monthOrders++;
        }

        productCounts.set(o.product_id, (productCounts.get(o.product_id) || 0) + 1);
    });

    // Get top products
    const topProductIds = Array.from(productCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    let topProductsText = "";
    for (const [productId, count] of topProductIds) {
        const product = await getProductById(productId);
        if (product) {
            topProductsText += `   • ${product.name}: ${count} order\n`;
        }
    }

    const message = `📊 *STATISTIK LENGKAP*

━━━ Revenue ━━━
📅 Hari ini: ${formatRupiah(todayRevenue)} (${todayOrders} order)
📆 7 hari: ${formatRupiah(weekRevenue)} (${weekOrders} order)
📆 30 hari: ${formatRupiah(monthRevenue)} (${monthOrders} order)
💰 Total: ${formatRupiah(totalRevenue)} (${orders.length} order)

━━━ Top Produk ━━━
${topProductsText || "   Tidak ada data"}

━━━ Overview ━━━
📦 Total Order: ${orders.length}
💵 Rata-rata Order: ${formatRupiah(Math.floor(totalRevenue / orders.length))}`;

    await ctx.reply(message, { parse_mode: "Markdown" });
}

/**
 * Handle /export command - export orders to CSV
 */
export async function handleExportCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    await ctx.reply("⏳ Mengexport data order...");

    const { data: orders } = await supabase
        .from("orders")
        .select(`
            id,
            pakasir_order_id,
            telegram_username,
            quantity,
            total_price,
            status,
            created_at,
            paid_at,
            products (name)
        `)
        .order("created_at", { ascending: false });

    if (!orders || orders.length === 0) {
        await ctx.reply("❌ Tidak ada order untuk diexport.");
        return;
    }

    // Generate CSV
    let csv = "Order ID,Username,Product,Qty,Total,Status,Created At,Paid At\n";

    orders.forEach((o: any) => {
        const productName = o.products?.name || "Unknown";
        csv += `${o.pakasir_order_id || o.id},`;
        csv += `@${o.telegram_username || "anon"},`;
        csv += `"${productName}",`;
        csv += `${o.quantity},`;
        csv += `${o.total_price},`;
        csv += `${o.status},`;
        csv += `${o.created_at},`;
        csv += `${o.paid_at || "-"}\n`;
    });

    const { InputFile } = await import("grammy");
    const filename = `orders_${new Date().toISOString().split("T")[0]}.csv`;

    await ctx.replyWithDocument(
        new InputFile(Buffer.from(csv), filename),
        { caption: `📄 Export ${orders.length} order berhasil!` }
    );
}

/**
 * Notify admin when stock is low
 */
export async function notifyLowStock(
    productId: string,
    productName: string,
    currentStock: number
): Promise<void> {
    const LOW_STOCK_THRESHOLD = 5;

    if (currentStock > LOW_STOCK_THRESHOLD) return;
    if (currentStock < 0) return;

    // Get bot instance
    const { getBotInstance } = await import("./order.js");
    const bot = getBotInstance();
    if (!bot) return;

    const message = `⚠️ *STOK MENIPIS!*

📦 Produk: ${productName}
📊 Stok tersisa: ${currentStock}

Segera tambah stok!`;

    for (const adminId of ADMIN_IDS) {
        try {
            await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
        } catch (e) {
            // Admin might have blocked the bot
        }
    }
}

// Maintenance mode state
let maintenanceMode = {
    active: false,
    reason: "",
    startedAt: null as Date | null,
};

/**
 * Check if maintenance mode is active
 */
export function isMaintenanceActive(): boolean {
    return maintenanceMode.active;
}

/**
 * Get maintenance info
 */
export function getMaintenanceInfo(): { active: boolean; reason: string; startedAt: Date | null } {
    return { ...maintenanceMode };
}

/**
 * Handle /mt command - maintenance mode on/off
 * Format: /mt on [reason] or /mt off
 */
export async function handleMaintenanceCommand(ctx: Context): Promise<void> {
    if (!isAdmin(ctx.from?.id)) {
        await ctx.reply("❌ Akses ditolak.");
        return;
    }

    const text = ctx.message?.text || "";
    const args = text.replace(/^\/mt\s*/, "").trim().split(/\s+/);
    const action = args[0]?.toLowerCase();

    // Show current status if no args
    if (!action) {
        const status = maintenanceMode.active ? "🔴 AKTIF" : "🟢 TIDAK AKTIF";
        let message = `🔧 *Mode Maintenance*

Status: ${status}`;

        if (maintenanceMode.active) {
            const startTime = maintenanceMode.startedAt?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) || "-";
            message += `
📝 Alasan: ${maintenanceMode.reason}
🕐 Mulai: ${startTime}`;
        }

        message += `

*Commands:*
• \`/mt on [alasan]\` - Aktifkan maintenance
• \`/mt off\` - Matikan maintenance`;

        await ctx.reply(message, { parse_mode: "Markdown" });
        return;
    }

    // Get bot instance
    const { getBotInstance } = await import("./order.js");
    const bot = getBotInstance();

    if (!bot) {
        await ctx.reply("❌ Bot instance tidak tersedia.");
        return;
    }

    if (action === "on") {
        const reason = args.slice(1).join(" ") || "Sedang dalam maintenance";

        if (maintenanceMode.active) {
            await ctx.reply("⚠️ Mode maintenance sudah aktif!");
            return;
        }

        // Enable maintenance
        maintenanceMode = {
            active: true,
            reason: reason,
            startedAt: new Date(),
        };

        const currentTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        // Get unique users to broadcast
        const { data: orders } = await supabase
            .from("orders")
            .select("telegram_user_id")
            .not("telegram_user_id", "is", null);

        const uniqueUsers = new Set<number>();
        orders?.forEach(o => {
            if (o.telegram_user_id) uniqueUsers.add(o.telegram_user_id);
        });

        const maintenanceMessage = `🔧 *MAINTENANCE MODE*

━━━━━━━━━━━━━━━━━━

⚠️ *Pemberitahuan*:
${reason}

Bot sedang dalam mode maintenance.
Pemesanan akan ditutup sementara.

━━━━━━━━━━━━━━━━━━

🕐 Waktu: ${currentTime}

Mohon maaf atas ketidaknyamanannya.
Terima kasih atas pengertiannya 🙏`;

        let success = 0, failed = 0;

        await ctx.reply(`🔧 Mengaktifkan mode maintenance dan broadcast ke ${uniqueUsers.size} user...`);

        for (const userId of uniqueUsers) {
            try {
                await bot.api.sendMessage(userId, maintenanceMessage, { parse_mode: "Markdown" });
                success++;
            } catch (e) {
                failed++;
            }
            await new Promise(r => setTimeout(r, 50));
        }

        await ctx.reply(`✅ Mode maintenance AKTIF!

🔴 Status: MAINTENANCE
📝 Alasan: ${reason}

📤 Broadcast terkirim: ${success}
❌ Gagal: ${failed}

Gunakan \`/mt off\` untuk menonaktifkan.`, { parse_mode: "Markdown" });

    } else if (action === "off") {
        if (!maintenanceMode.active) {
            await ctx.reply("⚠️ Mode maintenance tidak aktif!");
            return;
        }

        // Disable maintenance
        maintenanceMode = {
            active: false,
            reason: "",
            startedAt: null,
        };

        const currentTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        // Get unique users to broadcast
        const { data: orders } = await supabase
            .from("orders")
            .select("telegram_user_id")
            .not("telegram_user_id", "is", null);

        const uniqueUsers = new Set<number>();
        orders?.forEach(o => {
            if (o.telegram_user_id) uniqueUsers.add(o.telegram_user_id);
        });

        const resumeMessage = `✅ *LAYANAN KEMBALI NORMAL*

━━━━━━━━━━━━━━━━━━

🎉 Maintenance telah selesai!

Bot sudah kembali bisa digunakan untuk pemesanan.

━━━━━━━━━━━━━━━━━━

🕐 Waktu: ${currentTime}

Terima kasih atas kesabarannya! 🙏`;

        let success = 0, failed = 0;

        await ctx.reply(`🔧 Menonaktifkan mode maintenance dan broadcast ke ${uniqueUsers.size} user...`);

        for (const userId of uniqueUsers) {
            try {
                await bot.api.sendMessage(userId, resumeMessage, { parse_mode: "Markdown" });
                success++;
            } catch (e) {
                failed++;
            }
            await new Promise(r => setTimeout(r, 50));
        }

        await ctx.reply(`✅ Mode maintenance NONAKTIF!

🟢 Status: NORMAL
Bot sudah bisa digunakan kembali.

📤 Broadcast terkirim: ${success}
❌ Gagal: ${failed}`);

    } else {
        await ctx.reply(`❌ Command tidak valid.

*Commands:*
• \`/mt\` - Cek status
• \`/mt on [alasan]\` - Aktifkan maintenance
• \`/mt off\` - Matikan maintenance`, { parse_mode: "Markdown" });
    }
}

/**
 * Handle withdraw account - start
 */
export async function handleWithdrawStart(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:withdraw:", "");
    const product = await getProductById(productId);

    if (!product) {
        await ctx.answerCallbackQuery({ text: "Produk tidak ditemukan", show_alert: true });
        return;
    }

    const stock = await getProductStock(productId);

    if (stock === 0) {
        await ctx.answerCallbackQuery({ text: "Tidak ada stok tersedia", show_alert: true });
        return;
    }

    const keyboard = new InlineKeyboard();

    // Add quick quantity buttons
    if (stock >= 1) keyboard.text("1", `admin:withdrawqty:${productId}:1`);
    if (stock >= 5) keyboard.text("5", `admin:withdrawqty:${productId}:5`);
    if (stock >= 10) keyboard.text("10", `admin:withdrawqty:${productId}:10`);
    if (stock >= 25) keyboard.text("25", `admin:withdrawqty:${productId}:25`);
    keyboard.row();

    if (stock >= 50) keyboard.text("50", `admin:withdrawqty:${productId}:50`);
    if (stock >= 100) keyboard.text("100", `admin:withdrawqty:${productId}:100`);
    keyboard.text("📥 Semua", `admin:withdrawqty:${productId}:all`);
    keyboard.row();

    keyboard.text("✏️ Custom", `admin:withdrawcustom:${productId}`);
    keyboard.text("🔙 Batal", `admin:product:${productId}`);

    await ctx.editMessageText(`📥 *Tarik Akun: ${product.name}*

📊 Stok tersedia: ${stock}

Pilih jumlah akun yang ingin ditarik:`.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&"), {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
    });
}

/**
 * Handle withdraw with specific quantity
 */
export async function handleWithdrawQuantity(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    // Parse: admin:withdrawqty:{productId}:{quantity}
    const parts = data.replace("admin:withdrawqty:", "").split(":");
    const productId = parts[0];
    const quantityStr = parts[1];

    const product = await getProductById(productId);
    if (!product) return;

    const stock = await getProductStock(productId);
    const quantity = quantityStr === "all" ? stock : parseInt(quantityStr);

    if (quantity <= 0 || quantity > stock) {
        await ctx.answerCallbackQuery({ text: `Stok tidak cukup! Tersedia: ${stock}`, show_alert: true });
        return;
    }

    // Get credentials
    const { data: credentials, error } = await supabase
        .from("credentials")
        .select("*")
        .eq("product_id", productId)
        .eq("is_sold", false)
        .limit(quantity);

    if (error || !credentials || credentials.length === 0) {
        await ctx.answerCallbackQuery({ text: "Gagal mengambil akun", show_alert: true });
        return;
    }

    // Delete credentials from database
    const credentialIds = credentials.map(c => c.id);
    const { error: deleteError } = await supabase
        .from("credentials")
        .delete()
        .in("id", credentialIds);

    if (deleteError) {
        console.error("Error deleting credentials:", deleteError);
        await ctx.answerCallbackQuery({ text: "Gagal menghapus akun dari database", show_alert: true });
        return;
    }

    // Format export text
    let exportText = `📥 *TARIK AKUN BERHASIL*\n`;
    exportText += `📦 Produk: ${product.name}\n`;
    exportText += `📅 ${new Date().toLocaleString("id-ID")}\n`;
    exportText += `📊 Jumlah: ${credentials.length}\n\n`;
    exportText += `━━━ AKUN ━━━\n\n`;

    credentials.forEach((c, idx) => {
        exportText += `${idx + 1}. ${c.email}|${c.password}|${c.pin || "-"}|${c.extra_info || "-"}\n`;
    });

    // Send as plain text for easy copy
    await ctx.reply(exportText);

    // Update message
    const newStock = await getProductStock(productId);
    await ctx.editMessageText(`✅ *Berhasil menarik ${credentials.length} akun!*

📦 Produk: ${product.name}
📊 Stok sebelum: ${stock}
📊 Stok sesudah: ${newStock}

Akun sudah dikirim di pesan terpisah.`, {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("🔙 Kembali ke Produk", `admin:product:${productId}`),
    });
}

/**
 * Handle custom quantity input
 */
export async function handleWithdrawCustom(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const productId = data.replace("admin:withdrawcustom:", "");
    const product = await getProductById(productId);

    if (!product) return;

    const stock = await getProductStock(productId);

    adminState.set(ctx.from!.id, {
        step: "withdraw_custom_qty",
        data: { productId, productName: product.name, stock },
    });

    await ctx.editMessageText(`📥 *Tarik Akun: ${product.name}*

📊 Stok tersedia: ${stock}

Kirim jumlah akun yang ingin ditarik (angka 1-${stock}):`, {
        parse_mode: "Markdown",
    });
}

/**
 * Handle custom quantity text input (add to handleAdminTextInput switch)
 */
export async function processWithdrawCustomQty(ctx: Context, state: any): Promise<boolean> {
    const text = ctx.message?.text;
    if (!text) return false;

    const quantity = parseInt(text.trim());

    if (isNaN(quantity) || quantity <= 0) {
        await ctx.reply("❌ Masukkan angka yang valid.");
        return true;
    }

    if (quantity > state.data.stock) {
        await ctx.reply(`❌ Stok tidak cukup! Tersedia: ${state.data.stock}`);
        return true;
    }

    const productId = state.data.productId;
    const product = await getProductById(productId);

    if (!product) {
        await ctx.reply("❌ Produk tidak ditemukan.");
        adminState.delete(ctx.from!.id);
        return true;
    }

    // Get credentials
    const { data: credentials, error } = await supabase
        .from("credentials")
        .select("*")
        .eq("product_id", productId)
        .eq("is_sold", false)
        .limit(quantity);

    if (error || !credentials || credentials.length === 0) {
        await ctx.reply("❌ Gagal mengambil akun.");
        adminState.delete(ctx.from!.id);
        return true;
    }

    // Delete credentials from database
    const credentialIds = credentials.map(c => c.id);
    const { error: deleteError } = await supabase
        .from("credentials")
        .delete()
        .in("id", credentialIds);

    if (deleteError) {
        console.error("Error deleting credentials:", deleteError);
        await ctx.reply("❌ Gagal menghapus akun dari database.");
        adminState.delete(ctx.from!.id);
        return true;
    }

    // Format export text
    let exportText = `📥 *TARIK AKUN BERHASIL*\n`;
    exportText += `📦 Produk: ${product.name}\n`;
    exportText += `📅 ${new Date().toLocaleString("id-ID")}\n`;
    exportText += `📊 Jumlah: ${credentials.length}\n\n`;
    exportText += `━━━ AKUN ━━━\n\n`;

    credentials.forEach((c, idx) => {
        exportText += `${idx + 1}. ${c.email}|${c.password}|${c.pin || "-"}|${c.extra_info || "-"}\n`;
    });

    await ctx.reply(exportText);

    const newStock = await getProductStock(productId);
    await ctx.reply(`✅ Berhasil menarik ${credentials.length} akun!

📊 Stok sebelum: ${state.data.stock}
📊 Stok sesudah: ${newStock}`, {
        reply_markup: adminMenuKeyboard(),
    });

    adminState.delete(ctx.from!.id);
    return true;
}
