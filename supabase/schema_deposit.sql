-- ============================================
-- DEPOSIT SYSTEM - Database Schema Update
-- Run this in Supabase SQL Editor
-- ============================================

-- User balances table
CREATE TABLE IF NOT EXISTS user_balances (
  user_id BIGINT PRIMARY KEY,
  username TEXT,
  balance INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Topup requests (pending QRIS payments)
CREATE TABLE IF NOT EXISTS topup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT NOT NULL,
  username TEXT,
  amount INTEGER NOT NULL,
  amount_total INTEGER NOT NULL,
  transaction_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  qr_message_id INTEGER,
  chat_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Balance transaction history
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup', 'payment', 'refund')),
  description TEXT,
  order_id UUID REFERENCES orders(id),
  topup_id UUID REFERENCES topup_requests(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add low stock threshold to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_requests_user_id ON topup_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_requests_amount_total ON topup_requests(amount_total);
CREATE INDEX IF NOT EXISTS idx_topup_requests_status ON topup_requests(status);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_id ON balance_transactions(user_id);

-- Enable RLS
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE topup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role has full access to user_balances"
  ON user_balances FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to topup_requests"
  ON topup_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to balance_transactions"
  ON balance_transactions FOR ALL
  USING (auth.role() = 'service_role');
