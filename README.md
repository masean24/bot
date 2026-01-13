# Telegram Auto Order Bot

Bot Telegram untuk auto order produk digital dengan pembayaran QRIS.

## Fitur
- 🛒 Katalog produk digital
- 💳 Pembayaran QRIS otomatis
- 💰 Sistem deposit/saldo
- 🎟️ Voucher diskon
- 💬 Live chat dengan admin
- 📊 Dashboard admin

---

## 🚀 Deploy ke Coolify (via GitHub)

### Step 1: Push ke GitHub

```bash
# Inisialisasi Git (jika belum)
git init

# Tambahkan semua file
git add .

# Commit
git commit -m "Initial commit"

# Buat repo baru di GitHub, lalu:
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git branch -M main
git push -u origin main
```

### Step 2: Connect GitHub ke Coolify

1. Buka **Coolify Dashboard**
2. Pergi ke **Sources** → **Add New** → **GitHub**
3. Klik **Connect** → Login GitHub → Authorize Coolify
4. Pilih repository yang baru dibuat

### Step 3: Deploy Application

1. Klik **New Resource** → **Application**
2. Pilih **GitHub** → pilih repository
3. Settings:
   - **Build Pack**: Dockerfile
   - **Port**: 3000
4. Tambahkan **Environment Variables**:

| Variable | Value |
|----------|-------|
| `BOT_TOKEN` | Token dari @BotFather |
| `SUPABASE_URL` | URL Supabase project |
| `SUPABASE_SERVICE_KEY` | Service role key Supabase |
| `QRIS_API_KEY` | API key QRIS |
| `ADMIN_IDS` | Telegram user ID admin (pisah koma) |
| `BOT_NAME` | Nama bot |
| `WELCOME_BANNER_URL` | URL gambar banner (opsional) |
| `TESTIMONY_CHANNEL_ID` | Channel ID testimoni (opsional) |
| `LOG_CHANNEL_ID` | Channel ID log (opsional) |
| `PORT` | 3000 |

5. Klik **Deploy**!

### Step 4: Setup Database

Jalankan SQL berikut di **Supabase SQL Editor**:
1. `supabase/schema.sql`
2. `supabase/schema_deposit.sql`
3. `supabase/schema_chat.sql`

---

## 🔧 Development Lokal

```bash
# Install dependencies
npm install

# Copy environment
cp .env.example .env
# Edit .env dengan kredensial kamu

# Build
npm run build

# Run
npm run dev
```

---

## 📁 Struktur Project

```
├── src/
│   ├── bot/           # Telegram bot handlers
│   ├── services/      # Business logic (QRIS, deposit, chat)
│   ├── web/           # Express server untuk webhook
│   └── index.ts       # Entry point
├── supabase/          # Database schemas
├── Dockerfile         # Docker config untuk Coolify
└── package.json
```
