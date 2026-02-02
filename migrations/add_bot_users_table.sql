-- ============================================
-- BOT USERS TABLE - Track semua user yang pernah /start
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Tabel untuk menyimpan semua user yang pernah interaksi dengan bot
CREATE TABLE IF NOT EXISTS bot_users (
  user_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_bot_users_username ON bot_users(username);
CREATE INDEX IF NOT EXISTS idx_bot_users_is_blocked ON bot_users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_bot_users_last_seen ON bot_users(last_seen_at);

-- Enable RLS
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Service role has full access to bot_users"
  ON bot_users FOR ALL
  USING (auth.role() = 'service_role');

-- Komentar tabel
COMMENT ON TABLE bot_users IS 'Menyimpan semua user Telegram yang pernah /start bot';
COMMENT ON COLUMN bot_users.is_blocked IS 'True jika bot diblokir oleh user (gagal kirim pesan)';
