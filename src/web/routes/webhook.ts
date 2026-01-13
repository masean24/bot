import { Router } from "express";
import {
    getOrderByPakasirId,
    updateOrderStatus,
    getPendingOrders,
} from "../../services/supabase.js";
import { parseWebhookMessage, getTransactionStatus } from "../../services/qris.js";
import { processSuccessfulPayment } from "../../bot/handlers/order.js";
import {
    findPendingTopupByAmount,
    completeTopup,
} from "../../services/deposit.js";
import { formatRupiah } from "../../bot/utils.js";
import type { Bot } from "grammy";

let botInstance: Bot | null = null;

export function setBotInstanceForWebhook(bot: Bot): void {
    botInstance = bot;
}

const router = Router();

/**
 * QRIS webhook handler (eanss.tech)
 * Webhook payload format from eanss.tech:
 * {
 *   "amount": 50000,
 *   "order_id": "ORDER-001",
 *   "customer_id": "telegram_123",
 *   "status": "completed",
 *   "payment_method": "qris",
 *   "completed_at": "2024-01-01T12:05:00.123+07:00"
 * }
 */
router.post("/qris", async (req, res) => {
    try {
        console.log("Received QRIS webhook:", JSON.stringify(req.body));

        const { order_id, status, amount, message, transaction_id } = req.body;

        // Handle eanss.tech standard webhook format
        if (order_id && status) {
            // Check if this is a TOPUP request
            if (order_id.startsWith("TOPUP-")) {
                // Handle topup payment
                const { supabase } = await import("../../services/supabase.js");

                // Find topup by transaction_id (order_id in this context)
                const { data: topup } = await supabase
                    .from("topup_requests")
                    .select("*")
                    .eq("transaction_id", order_id)
                    .single();

                if (!topup) {
                    console.error("Topup not found:", order_id);
                    return res.status(404).json({ error: "Topup not found" });
                }

                if (status === "completed" || status === "COMPLETED" || status === "paid" || status === "PAID") {
                    const result = await completeTopup(topup.id);

                    if (result.success && result.topup && botInstance) {
                        // Delete QR message if exists
                        if (topup.qr_message_id && topup.chat_id) {
                            try {
                                await botInstance.api.deleteMessage(topup.chat_id, topup.qr_message_id);
                            } catch (e) {
                                console.log("Could not delete topup QR message");
                            }
                        }

                        // Send success message
                        await botInstance.api.sendMessage(
                            topup.chat_id,
                            `✅ *Topup Berhasil!*\n\n` +
                            `💰 Nominal: ${formatRupiah(topup.amount)}\n` +
                            `💳 Saldo baru: ${formatRupiah(result.newBalance || 0)}\n\n` +
                            `Terima kasih! Saldo kamu sudah bertambah.`,
                            { parse_mode: "Markdown" }
                        );
                    }
                    console.log("Topup processed successfully:", order_id);
                }

                return res.json({ success: true, type: "topup" });
            }

            // Regular order handling
            const order = await getOrderByPakasirId(order_id);

            if (!order) {
                console.error("Order not found:", order_id);
                return res.status(404).json({ error: "Order not found" });
            }

            // Status from eanss.tech: "completed", "pending", "expired"
            if (status === "completed" || status === "COMPLETED" || status === "paid" || status === "PAID") {
                await updateOrderStatus(order.id, "paid");
                await processSuccessfulPayment(order);
                console.log("Payment processed successfully:", order_id);
            } else if (status === "expired" || status === "EXPIRED") {
                await updateOrderStatus(order.id, "expired");
                console.log("Order expired:", order_id);
            }


            return res.json({ success: true });
        }

        // Handle transaction_id format (alternative)
        if (transaction_id && status) {
            const order = await getOrderByPakasirId(transaction_id);

            if (!order) {
                console.error("Order not found:", transaction_id);
                return res.status(404).json({ error: "Order not found" });
            }

            if (status === "completed" || status === "COMPLETED" || status === "paid" || status === "PAID") {
                await updateOrderStatus(order.id, "paid");
                await processSuccessfulPayment(order);
                console.log("Payment processed successfully:", transaction_id);
            } else if (status === "expired" || status === "EXPIRED") {
                await updateOrderStatus(order.id, "expired");
                console.log("Order expired:", transaction_id);
            }

            return res.json({ success: true });
        }

        // Handle notification message format (from MacroDroid)
        if (message) {
            const parsed = parseWebhookMessage(message);
            if (!parsed) {
                console.log("Could not parse webhook message:", message);
                return res.status(400).json({ error: "Invalid message format" });
            }

            // First, try to find matching ORDER by amount_total
            const pendingOrders = await getPendingOrders();
            const matchingOrder = pendingOrders.find(order =>
                order.total_price === parsed.amount ||
                Math.abs(order.total_price - parsed.amount) <= 999 // Allow for unique digits
            );

            if (matchingOrder) {
                await updateOrderStatus(matchingOrder.id, "paid");
                await processSuccessfulPayment(matchingOrder);
                console.log("Payment processed successfully via message:", matchingOrder.pakasir_order_id);
                return res.json({ success: true, order_id: matchingOrder.pakasir_order_id });
            }

            // Second, try to find matching TOPUP REQUEST by amount_total
            const matchingTopup = await findPendingTopupByAmount(parsed.amount);
            if (matchingTopup) {
                const result = await completeTopup(matchingTopup.id);

                if (result.success && result.topup && botInstance) {
                    // Send confirmation message to user
                    try {
                        // Delete QR message if exists
                        if (matchingTopup.qr_message_id && matchingTopup.chat_id) {
                            try {
                                await botInstance.api.deleteMessage(matchingTopup.chat_id, matchingTopup.qr_message_id);
                            } catch (e) {
                                console.log("Could not delete topup QR message");
                            }
                        }

                        // Send success message
                        await botInstance.api.sendMessage(
                            matchingTopup.chat_id!,
                            `✅ *Topup Berhasil!*\n\n` +
                            `💰 Nominal: ${formatRupiah(matchingTopup.amount)}\n` +
                            `💳 Saldo baru: ${formatRupiah(result.newBalance || 0)}\n\n` +
                            `Terima kasih! Saldo kamu sudah bertambah.`,
                            { parse_mode: "Markdown" }
                        );
                    } catch (e) {
                        console.error("Error sending topup confirmation:", e);
                    }
                }

                console.log("Topup processed successfully:", matchingTopup.id);
                return res.json({ success: true, topup_id: matchingTopup.id });
            }

            console.log("No matching order or topup found for amount:", parsed.amount);
            return res.status(404).json({ error: "No matching order or topup" });
        }

        return res.status(400).json({ error: "Invalid webhook payload" });
    } catch (error) {
        console.error("Webhook error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Legacy Pakasir webhook handler (keep for backward compatibility)
 */
router.post("/pakasir", async (req, res) => {
    try {
        console.log("Received Pakasir webhook (legacy):", JSON.stringify(req.body));

        const { order_id, status, amount } = req.body;

        if (!order_id) {
            return res.status(400).json({ error: "Missing order_id" });
        }

        const order = await getOrderByPakasirId(order_id);

        if (!order) {
            console.error("Order not found:", order_id);
            return res.status(404).json({ error: "Order not found" });
        }

        if (amount && order.total_price !== amount) {
            console.error("Amount mismatch:", { expected: order.total_price, received: amount });
            return res.status(400).json({ error: "Amount mismatch" });
        }

        if (status === "paid" || status === "PAID" || status === "completed" || status === "COMPLETED") {
            await updateOrderStatus(order.id, "paid");
            await processSuccessfulPayment(order);
            console.log("Payment processed successfully:", order_id);
        } else if (status === "expired" || status === "EXPIRED") {
            await updateOrderStatus(order.id, "expired");
            console.log("Order expired:", order_id);
        } else if (status === "cancelled" || status === "CANCELLED") {
            await updateOrderStatus(order.id, "cancelled");
            console.log("Order cancelled:", order_id);
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Webhook error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Health check endpoint
 */
router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
