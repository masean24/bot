import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { ADMIN_IDS } from "../../config.js";
import {
    getActiveSession,
    createSession,
    closeSession,
    sendMessage,
    getSessionMessages,
    getOpenSessions,
    getSessionById,
    getLastMessage,
    assignAdmin,
} from "../../services/chat.js";
import type { Bot } from "grammy";

// Store bot instance for sending messages
let botInstance: Bot | null = null;

export function setChatBotInstance(bot: Bot): void {
    botInstance = bot;
}

// Track which admin is replying to which session
const adminReplyState = new Map<number, string>();

/**
 * Handle /chat command - start chat with admin
 */
export async function handleStartChat(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    if (!userId) {
        await ctx.reply("❌ User tidak ditemukan.");
        return;
    }

    // Check if user already has active session
    const existingSession = await getActiveSession(userId);
    if (existingSession) {
        await ctx.reply(
            `💬 Kamu sudah punya sesi chat aktif.\n\n` +
            `Langsung ketik pesanmu dan admin akan membalas.\n\n` +
            `Ketik /endchat untuk mengakhiri chat.`
        );
        return;
    }

    // Create new session
    const session = await createSession(userId, username);

    // Notify user
    const keyboard = new InlineKeyboard()
        .text("❌ Tutup Chat", `closechat:${session.id}`);

    await ctx.reply(
        `💬 *Chat dengan Admin*\n\n` +
        `Sesi chat dimulai\\!\n` +
        `Langsung ketik pesanmu dan admin akan membalas\\.\n\n` +
        `⏳ Admin akan merespons secepatnya\\.`,
        { parse_mode: "MarkdownV2", reply_markup: keyboard }
    );

    // Notify all admins
    if (botInstance) {
        for (const adminId of ADMIN_IDS) {
            try {
                const adminKeyboard = new InlineKeyboard()
                    .text("💬 Balas", `replychat:${session.id}`);

                await botInstance.api.sendMessage(
                    adminId,
                    `📨 *Chat Baru\\!*\n\n` +
                    `👤 User: @${username || "anonymous"}\n` +
                    `🆔 User ID: \`${userId}\`\n\n` +
                    `Klik tombol di bawah untuk membalas\\.`,
                    { parse_mode: "MarkdownV2", reply_markup: adminKeyboard }
                );
            } catch (e) {
                console.error(`Failed to notify admin ${adminId}:`, e);
            }
        }
    }
}

/**
 * Handle /endchat command - end chat session
 */
export async function handleEndChat(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = await getActiveSession(userId);
    if (!session) {
        await ctx.reply("💬 Tidak ada sesi chat aktif.");
        return;
    }

    await closeSession(session.id);
    await ctx.reply("✅ Sesi chat telah ditutup. Terima kasih!");

    // Notify admin if assigned
    if (session.admin_id && botInstance) {
        try {
            await botInstance.api.sendMessage(
                session.admin_id,
                `📭 Chat dengan @${session.username || "user"} telah ditutup oleh user.`
            );
        } catch (e) {
            // Admin might have blocked bot
        }
    }
}

/**
 * Handle user chat message (when session is active)
 */
export async function handleUserChatMessage(ctx: Context): Promise<boolean> {
    const userId = ctx.from?.id;
    const text = ctx.message?.text;

    if (!userId || !text) return false;

    // Skip commands
    if (text.startsWith("/")) return false;

    // Check if user has active session
    const session = await getActiveSession(userId);
    if (!session) return false;

    // Save message
    await sendMessage(session.id, userId, "user", text);

    // Send to assigned admin or all admins
    if (botInstance) {
        const targetAdmins = session.admin_id ? [session.admin_id] : ADMIN_IDS;

        for (const adminId of targetAdmins) {
            try {
                const keyboard = new InlineKeyboard()
                    .text("💬 Balas", `replychat:${session.id}`);

                await botInstance.api.sendMessage(
                    adminId,
                    `💬 *Pesan dari @${session.username || "user"}:*\n\n${text}`,
                    { parse_mode: "Markdown", reply_markup: keyboard }
                );
            } catch (e) {
                console.error(`Failed to forward message to admin ${adminId}:`, e);
            }
        }
    }

    // Confirm to user
    await ctx.reply("✅ Pesan terkirim ke admin.");
    return true;
}

/**
 * Handle close chat button (user side)
 */
export async function handleCloseChat(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const sessionId = data.replace("closechat:", "");
    const session = await getSessionById(sessionId);

    if (!session) {
        await ctx.editMessageText("❌ Sesi tidak ditemukan.");
        return;
    }

    await closeSession(sessionId);
    await ctx.editMessageText("✅ Sesi chat telah ditutup. Terima kasih!");

    // Notify admin
    if (session.admin_id && botInstance) {
        try {
            await botInstance.api.sendMessage(
                session.admin_id,
                `📭 Chat dengan @${session.username || "user"} telah ditutup.`
            );
        } catch (e) {
            // Ignore
        }
    }
}

// ============ ADMIN HANDLERS ============

/**
 * Handle /chats command - list open chats (admin only)
 */
export async function handleAdminChats(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !ADMIN_IDS.includes(userId)) {
        await ctx.reply("❌ Perintah ini hanya untuk admin.");
        return;
    }

    const sessions = await getOpenSessions();

    if (sessions.length === 0) {
        await ctx.reply("📭 Tidak ada chat aktif saat ini.");
        return;
    }

    let message = `📨 *Chat Aktif (${sessions.length})*\n\n`;
    const keyboard = new InlineKeyboard();

    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const lastMsg = await getLastMessage(session.id);
        const preview = lastMsg ? lastMsg.message.substring(0, 30) + "..." : "(belum ada pesan)";
        const ago = getTimeAgo(new Date(session.created_at));

        message += `${i + 1}. @${session.username || "anonymous"}\n`;
        message += `   └ "${preview}" (${ago})\n\n`;

        keyboard.text(`💬 ${session.username || "User " + (i + 1)}`, `viewchat:${session.id}`);
        if ((i + 1) % 2 === 0) keyboard.row();
    }

    await ctx.reply(message, { parse_mode: "Markdown", reply_markup: keyboard });
}

/**
 * Handle view chat detail (admin)
 */
export async function handleViewChat(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const sessionId = data.replace("viewchat:", "");
    const session = await getSessionById(sessionId);

    if (!session) {
        await ctx.editMessageText("❌ Sesi tidak ditemukan.");
        return;
    }

    const messages = await getSessionMessages(sessionId, 10);

    let chatHistory = `💬 *Chat dengan @${session.username || "anonymous"}*\n\n`;

    if (messages.length === 0) {
        chatHistory += "(Belum ada pesan)\n";
    } else {
        for (const msg of messages) {
            const sender = msg.sender_type === "user" ? "👤" : "🛡️";
            const time = new Date(msg.created_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
            });
            chatHistory += `${sender} [${time}] ${msg.message}\n`;
        }
    }

    const keyboard = new InlineKeyboard()
        .text("💬 Balas", `replychat:${sessionId}`)
        .text("❌ Tutup", `adminclosechat:${sessionId}`)
        .row()
        .text("🔙 Kembali", "admin:chats");

    await ctx.editMessageText(chatHistory, { parse_mode: "Markdown", reply_markup: keyboard });
}

/**
 * Handle reply chat button (admin) - sets admin in reply mode
 */
export async function handleReplyChat(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const adminId = ctx.from?.id;
    const data = ctx.callbackQuery?.data;
    if (!adminId || !data) return;

    const sessionId = data.replace("replychat:", "");
    const session = await getSessionById(sessionId);

    if (!session || session.status === "closed") {
        await ctx.reply("❌ Sesi chat sudah ditutup.");
        return;
    }

    // Assign admin to this session
    await assignAdmin(sessionId, adminId);

    // Set admin in reply mode
    adminReplyState.set(adminId, sessionId);

    await ctx.reply(
        `💬 *Mode Reply Aktif*\n\n` +
        `Kamu sedang membalas ke @${session.username || "user"}\\.\n` +
        `Langsung ketik pesanmu\\.\n\n` +
        `Ketik /stopreply untuk berhenti\\.`,
        { parse_mode: "MarkdownV2" }
    );
}

/**
 * Handle /stopreply command - stop reply mode
 */
export async function handleStopReply(ctx: Context): Promise<void> {
    const adminId = ctx.from?.id;
    if (!adminId) return;

    if (adminReplyState.has(adminId)) {
        adminReplyState.delete(adminId);
        await ctx.reply("✅ Mode reply dinonaktifkan.");
    } else {
        await ctx.reply("❌ Kamu tidak sedang dalam mode reply.");
    }
}

/**
 * Handle admin text message (when in reply mode)
 */
export async function handleAdminChatMessage(ctx: Context): Promise<boolean> {
    const adminId = ctx.from?.id;
    const text = ctx.message?.text;

    if (!adminId || !text) return false;

    // Skip commands
    if (text.startsWith("/")) return false;

    // Check if admin is in reply mode
    const sessionId = adminReplyState.get(adminId);
    if (!sessionId) return false;

    const session = await getSessionById(sessionId);
    if (!session || session.status === "closed") {
        adminReplyState.delete(adminId);
        await ctx.reply("❌ Sesi chat sudah ditutup.");
        return true;
    }

    // Save message
    await sendMessage(sessionId, adminId, "admin", text);

    // Send to user
    if (botInstance) {
        try {
            await botInstance.api.sendMessage(
                session.user_id,
                `🛡️ *Balasan Admin:*\n\n${text}`,
                { parse_mode: "Markdown" }
            );
        } catch (e) {
            await ctx.reply("❌ Gagal mengirim pesan ke user.");
            return true;
        }
    }

    await ctx.reply("✅ Pesan terkirim.");
    return true;
}

/**
 * Handle admin close chat
 */
export async function handleAdminCloseChat(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const sessionId = data.replace("adminclosechat:", "");
    const session = await getSessionById(sessionId);

    if (!session) {
        await ctx.editMessageText("❌ Sesi tidak ditemukan.");
        return;
    }

    await closeSession(sessionId);

    await ctx.editMessageText("✅ Sesi chat telah ditutup.");

    // Notify user
    if (botInstance) {
        try {
            await botInstance.api.sendMessage(
                session.user_id,
                `📭 Sesi chat telah ditutup oleh admin. Terima kasih!`
            );
        } catch (e) {
            // User might have blocked bot
        }
    }
}

/**
 * Handle admin:chats callback (back button)
 */
export async function handleAdminChatsCallback(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    await handleAdminChats(ctx);
}

// Helper function
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
}
