-- Telegram Auto Order Bot - Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credentials table (stock for digital products)
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  pin TEXT,
  extra_info TEXT,
  is_sold BOOLEAN NOT NULL DEFAULT false,
  sold_at TIMESTAMP WITH TIME ZONE,
  order_id UUID
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  pakasir_order_id TEXT,
  qr_message_id INTEGER,
  chat_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for order_id in credentials
ALTER TABLE credentials 
  ADD CONSTRAINT fk_credentials_order 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credentials_product_id ON credentials(product_id);
CREATE INDEX IF NOT EXISTS idx_credentials_is_sold ON credentials(is_sold);
CREATE INDEX IF NOT EXISTS idx_orders_telegram_user_id ON orders(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_pakasir_order_id ON orders(pakasir_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- RLS Policies (Row Level Security)
-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role has full access to products"
  ON products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to credentials"
  ON credentials FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to orders"
  ON orders FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to admins"
  ON admins FOR ALL
  USING (auth.role() = 'service_role');

-- Allow anon to read active products (for public display if needed)
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  USING (is_active = true);

-- ============================================
-- VOUCHERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_order INTEGER DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for vouchers
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to vouchers"
  ON vouchers FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- REFERRALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  referred_count INTEGER DEFAULT 0,
  total_bonus INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id BIGINT NOT NULL,
  referred_user_id BIGINT NOT NULL,
  order_id UUID REFERENCES orders(id),
  bonus_amount INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Enable RLS for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to referrals"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to referral_logs"
  ON referral_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Add voucher_code and referrer_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referrer_id BIGINT;
