-- ============================================
-- MIGRATION: Mini App Tables
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Activity Logs table untuk audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id BIGINT NOT NULL,
    admin_username TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk query activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id ON activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to activity_logs"
    ON activity_logs FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Quick Replies table untuk template chat
-- ============================================

CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to quick_replies"
    ON quick_replies FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Update Products table - Pricing Tiers
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_tiers JSONB;
-- Format: [{"min_qty": 1, "price": 10000}, {"min_qty": 5, "price": 9000}, {"min_qty": 10, "price": 8000}]

ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- ============================================
-- Update Credentials table - Expiry Date
-- ============================================

ALTER TABLE credentials ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index untuk expired credentials
CREATE INDEX IF NOT EXISTS idx_credentials_expires_at ON credentials(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- Member Pricing - Track user tier
-- ============================================

ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS member_tier TEXT DEFAULT 'regular';
ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS total_purchases INTEGER DEFAULT 0;
ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- Insert sample quick replies
-- ============================================

INSERT INTO quick_replies (title, content) VALUES 
    ('Selamat Datang', 'Halo! Terima kasih sudah menghubungi kami. Ada yang bisa dibantu?'),
    ('Cara Pembayaran', 'Pembayaran dapat dilakukan via QRIS. Setelah scan, pembayaran akan terverifikasi otomatis.'),
    ('Stok Habis', 'Mohon maaf, stok untuk produk ini sedang habis. Silakan cek kembali nanti.'),
    ('Terima Kasih', 'Terima kasih atas pesanannya! Jika ada kendala, silakan hubungi kami.')
ON CONFLICT DO NOTHING;

-- ============================================
-- Done!
-- ============================================
