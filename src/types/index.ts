// Product
export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    is_active: boolean;
    created_at: string;
    parent_id: string | null;
    is_category: boolean;
}

// Credential for digital product
export interface Credential {
    id: string;
    product_id: string;
    email: string;
    password: string;
    pin: string | null;
    extra_info: string | null;
    is_sold: boolean;
    sold_at: string | null;
    order_id: string | null;
}

// Order
export interface Order {
    id: string;
    telegram_user_id: number;
    telegram_username: string | null;
    product_id: string;
    product_name?: string;
    quantity: number;
    total_price: number;
    payment_status: "pending" | "paid" | "expired" | "cancelled";
    pakasir_order_id: string | null;
    qr_message_id: number | null;
    chat_id: number | null;
    source?: "web" | "bot";
    notes?: string | null;
    voucher_code?: string | null;
    discount_amount?: number;
    created_at: string;
    paid_at: string | null;
}

// Order with product info (for display)
export interface OrderWithProduct extends Order {
    product: Product;
}

// Admin
export interface Admin {
    id: string;
    telegram_user_id: number;
    username: string;
    is_active: boolean;
}

// QRIS API Response (eanss.tech)
export interface QrisCreateResponse {
    success: boolean;
    data?: {
        transaction_id: string;
        amount: number;
        amount_total: number; // Amount with unique digits
        qris_content: string; // Raw QRIS data string
        qris_image_url: string; // QR code image URL or base64
        expired_at?: string;
    };
    message?: string;
}

export interface QrisTransactionDetail {
    transaction_id: string;
    amount: number;
    amount_total: number;
    status: "pending" | "paid" | "expired";
    paid_at: string | null;
}

// Session data for conversation
export interface SessionData {
    step?: "select_product" | "input_quantity" | "confirm_order";
    selectedProductId?: string;
    quantity?: number;
}
