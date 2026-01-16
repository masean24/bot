import axios from "axios";
import QRCode from "qrcode";
import sharp from "sharp";
import path from "path";
import { QRIS_API_KEY } from "../config.js";
import type { QrisCreateResponse, QrisTransactionDetail } from "../types/index.js";

const QRIS_BASE_URL = "https://qris.hubify.store/api";

// Template settings - use process.cwd() for compatibility
// Template is 1024x1024 px, white box is ~560x560 px centered
const TEMPLATE_PATH = path.join(process.cwd(), "assets", "qris-template.jpg");
const QR_SIZE = 550; // QR code size in pixels (fits the white box)
const QR_POSITION_X = 237; // X position for QR overlay (centered in white box)
const QR_POSITION_Y = 237; // Y position for QR overlay (moved down)

/**
 * Create a new QRIS transaction via eanss.tech API
 */
export async function createTransaction(
    orderId: string,
    amount: number,
    customerId?: string
): Promise<QrisCreateResponse> {
    try {
        const response = await axios.post(
            `${QRIS_BASE_URL}/create-transaction`,
            {
                amount: amount,
                order_id: orderId,
                customer_id: customerId || undefined,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${QRIS_API_KEY}`,
                },
            }
        );

        return {
            success: true,
            data: {
                transaction_id: response.data.transaction_id,
                amount: amount,
                amount_total: response.data.amount_total,
                qris_content: response.data.qris_content,
                qris_image_url: response.data.qris_image_url,
                expired_at: response.data.expires_at, 
            },
        };
    } catch (error: any) {
        console.error("QRIS create transaction error:", error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.message || "Failed to create transaction",
        };
    }
}

/**
 * Get transaction status from QRIS API
 */
export async function getTransactionStatus(
    transactionId: string
): Promise<QrisTransactionDetail | null> {
    try {
        const response = await axios.get(
            `${QRIS_BASE_URL}/check-status/${transactionId}`,
            {
                headers: {
                    "Authorization": `Bearer ${QRIS_API_KEY}`,
                },
            }
        );

        return {
            transaction_id: response.data.transaction_id,
            amount: response.data.amount,
            amount_total: response.data.amount_total,
            status: response.data.status,
            paid_at: response.data.paid_at || null,
        };
    } catch (error: any) {
        console.error("QRIS get transaction error:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Generate QR code image buffer with custom template overlay
 */
export async function generateQRImage(qrString: string): Promise<Buffer> {
    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(qrString, {
        type: "png",
        width: QR_SIZE,
        margin: 1,
        color: {
            dark: "#000000",
            light: "#FFFFFF",
        },
    });

    try {
        // Load template and overlay QR code
        const result = await sharp(TEMPLATE_PATH)
            .composite([
                {
                    input: qrBuffer,
                    left: QR_POSITION_X,
                    top: QR_POSITION_Y,
                },
            ])
            .png()
            .toBuffer();

        return result;
    } catch (error) {
        console.error("Error overlaying QR on template:", error);
        // Fallback to plain QR if template fails
        return qrBuffer;
    }
}

/**
 * Verify webhook notification message (match payment by amount)
 * The webhook receives notification like: "Pembayaran Rp 50.127 dari JOHN DOE berhasil"
 */
export function parseWebhookMessage(message: string): { amount: number; sender: string } | null {
    // Pattern: "Pembayaran Rp XX.XXX dari NAME berhasil"
    const regex = /Pembayaran Rp ([\d.,]+) dari (.+) berhasil/i;
    const match = message.match(regex);

    if (!match) return null;

    // Parse amount: "50.127" -> 50127
    const amountStr = match[1].replace(/\./g, "").replace(/,/g, "");
    const amount = parseInt(amountStr);
    const sender = match[2].trim();

    return { amount, sender };
}

/**
 * Send webhook notification to QRIS API (for MacroDroid integration)
 */
export async function sendWebhookNotification(
    message: string,
    source?: string
): Promise<boolean> {
    try {
        await axios.post(
            `${QRIS_BASE_URL}/webhook/notification`,
            {
                message,
                source: source || "telegram_bot",
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${QRIS_API_KEY}`,
                },
            }
        );
        return true;
    } catch (error: any) {
        console.error("QRIS webhook notification error:", error.response?.data || error.message);
        return false;
    }
}

/**
 * List transactions with optional filters
 */
export async function listTransactions(
    status?: "pending" | "paid" | "expired",
    limit: number = 10,
    offset: number = 0
): Promise<QrisTransactionDetail[]> {
    try {
        const params: any = { limit, offset };
        if (status) params.status = status;

        const response = await axios.get(`${QRIS_BASE_URL}/transactions`, {
            params,
            headers: {
                "Authorization": `Bearer ${QRIS_API_KEY}`,
            },
        });

        return response.data.data || [];
    } catch (error: any) {
        console.error("QRIS list transactions error:", error.response?.data || error.message);
        return [];
    }
}
