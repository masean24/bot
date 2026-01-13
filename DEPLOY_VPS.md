# 🚀 Deploy Bot ke VPS

Panduan lengkap setup VPS dari 0 sampai bot bisa diakses via domain.

## 1. Persiapan

**Yang dibutuhkan:**
- VPS (Ubuntu 20.04/22.04 recommended)
- Domain yang sudah diarahkan ke IP VPS (A record)
- SSH access ke VPS

**Arahkan domain ke VPS:**
```
tele.eanss.tech → A record → IP-VPS-KAMU
```

---

## 2. SSH ke VPS

```bash
ssh root@IP-VPS-KAMU
# atau
ssh username@IP-VPS-KAMU
```

---

## 3. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v

# Install Git
sudo apt install git -y

# Install PM2 (process manager)
npm install -g pm2
```

---

## 4. Clone & Setup Project

```bash
# Clone repo (atau upload via scp/sftp)
cd /home
git clone YOUR-REPO-URL bot-auto-order
cd bot-auto-order

# Install dependencies
npm install

# Build
npm run build
```

---

## 5. Setup Environment

```bash
# Copy dan edit .env
cp .env.example .env
nano .env
```

**Isi `.env`:**
```env
BOT_TOKEN=your_bot_token
ADMIN_IDS=1234567890

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

QRIS_API_KEY=your_qris_api_key
WEBHOOK_URL=https://tele.eanss.tech

BOT_NAME=🛒 AUTO ORDER STORE
WELCOME_BANNER_URL=

ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=random_32_char_string

TESTIMONY_CHANNEL_ID=-100xxx
LOG_CHANNEL_ID=-100xxx
```

---

## 6. Run dengan PM2

```bash
# Start bot
pm2 start dist/index.js --name "auto-order-bot"

# Lihat status
pm2 status

# Lihat logs
pm2 logs auto-order-bot

# Auto-start on reboot
pm2 save
pm2 startup
# Copy & run command yang muncul
```

**PM2 Commands:**
```bash
pm2 restart auto-order-bot  # Restart
pm2 stop auto-order-bot     # Stop
pm2 delete auto-order-bot   # Remove
pm2 logs auto-order-bot     # View logs
```

---

## 7. Setup Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install nginx -y

# Create config
sudo nano /etc/nginx/sites-available/tele.eanss.tech
```

**Isi config:**
```nginx
server {
    listen 80;
    server_name tele.eanss.tech;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tele.eanss.tech /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 8. Install SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d tele.eanss.tech

# Auto-renewal (already set by default)
sudo certbot renew --dry-run
```

---

## 9. Update Webhook URL

Update webhook URL di QRIS API settings:
```
https://tele.eanss.tech/webhook/qris
```

---

## 10. Test

1. Buka `https://tele.eanss.tech/webhook/health` - harus tampil `{"status":"ok"}`
2. Buka `https://tele.eanss.tech/admin` - harus tampil login page
3. Chat bot di Telegram - `/start`

---

## Troubleshooting

**Bot tidak respond:**
```bash
pm2 logs auto-order-bot
```

**Nginx error:**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

**Port 3000 in use:**
```bash
sudo lsof -i :3000
sudo kill -9 PID
```

**Update bot:**
```bash
cd /home/bot-auto-order
git pull
npm install
npm run build
pm2 restart auto-order-bot
```

---

## Quick Commands

```bash
# Status
pm2 status

# Restart bot
pm2 restart auto-order-bot

# View logs (real-time)
pm2 logs auto-order-bot --lines 100

# Restart Nginx
sudo systemctl restart nginx
```
