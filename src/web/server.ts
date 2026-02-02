import express from "express";
import webhookRoutes from "./routes/webhook.js";
import adminRoutes from "./routes/admin.js";
import miniappRoutes from "./routes/miniapp.js";
import { PORT, BOT_NAME } from "../config.js";

const app = express();
const startTime = Date.now();

// Helper function to format uptime
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for admin panel
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-API-Key");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  const uptime = Date.now() - startTime;
  const memoryUsage = process.memoryUsage();

  res.json({
    status: "✅ Online",
    bot_name: BOT_NAME,
    uptime: formatUptime(uptime),
    uptime_ms: uptime,
    started_at: new Date(startTime).toISOString(),
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    },
    node_version: process.version,
    timestamp: new Date().toISOString(),
  });
});

// Simple health check for Docker/Coolify
app.get("/", (req, res) => {
  res.send("OK");
});

// Routes
app.use("/webhook", webhookRoutes);
app.use("/api", adminRoutes);
app.use("/api/miniapp", miniappRoutes);

// Modern Admin Panel HTML
app.get("/admin", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel - ${BOT_NAME || "Auto Order Bot"}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a1a;
      --bg-secondary: #12122a;
      --bg-card: rgba(255,255,255,0.03);
      --bg-glass: rgba(255,255,255,0.05);
      --border-color: rgba(255,255,255,0.08);
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-purple: #8b5cf6;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      background-image: 
        radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%);
      min-height: 100vh;
      color: var(--text-primary);
    }
    
    /* ========== AUTH ========== */
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .auth-card {
      background: var(--bg-glass);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      padding: 48px;
      width: 100%;
      max-width: 420px;
      text-align: center;
    }
    
    .auth-logo {
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    .auth-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .auth-subtitle {
      color: var(--text-secondary);
      margin-bottom: 32px;
    }
    
    .auth-input {
      width: 100%;
      padding: 16px 20px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      color: var(--text-primary);
      font-size: 16px;
      margin-bottom: 16px;
      transition: all 0.2s;
    }
    
    .auth-input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    
    .auth-btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .auth-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
    }
    
    /* ========== MAIN LAYOUT ========== */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding: 20px 0;
      border-bottom: 1px solid var(--border-color);
    }
    
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .header-actions {
      display: flex;
      gap: 12px;
    }
    
    /* ========== STATS GRID ========== */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    
    .stat-card {
      background: var(--bg-glass);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 4px;
      background: linear-gradient(135deg, #fff 0%, #a0a0ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .stat-icon {
      position: absolute;
      top: 20px;
      right: 20px;
      font-size: 32px;
      opacity: 0.3;
    }
    
    /* ========== TABS ========== */
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      background: var(--bg-glass);
      padding: 6px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      width: fit-content;
    }
    
    .tab {
      padding: 12px 24px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .tab:hover { color: var(--text-primary); }
    .tab.active {
      background: var(--accent-blue);
      color: white;
    }
    
    /* ========== CARDS ========== */
    .card {
      background: var(--bg-glass);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      overflow: hidden;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .card-title {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .card-body { padding: 0; }
    
    /* ========== TABLE ========== */
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .table th {
      padding: 14px 24px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(0,0,0,0.2);
    }
    
    .table td {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      font-size: 14px;
    }
    
    .table tr:last-child td { border-bottom: none; }
    .table tr:hover { background: rgba(255,255,255,0.02); }
    
    /* ========== BUTTONS ========== */
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .btn-primary {
      background: var(--accent-blue);
      color: white;
    }
    
    .btn-success {
      background: var(--accent-green);
      color: white;
    }
    
    .btn-warning {
      background: var(--accent-yellow);
      color: black;
    }
    
    .btn-danger {
      background: var(--accent-red);
      color: white;
    }
    
    .btn-ghost {
      background: rgba(255,255,255,0.05);
      color: var(--text-primary);
    }
    
    .btn:hover { transform: translateY(-1px); opacity: 0.9; }
    
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    
    .btn-icon {
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    
    /* ========== BADGES ========== */
    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .badge-success { background: rgba(34, 197, 94, 0.15); color: var(--accent-green); }
    .badge-warning { background: rgba(234, 179, 8, 0.15); color: var(--accent-yellow); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    .badge-info { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    
    /* ========== MODAL ========== */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(5px);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    
    .modal.active { display: flex; }
    
    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      width: 100%;
      max-width: 520px;
      max-height: 85vh;
      overflow-y: auto;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .modal-title { font-size: 20px; font-weight: 600; }
    
    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 24px;
      cursor: pointer;
    }
    
    .modal-body { padding: 24px; }
    
    /* ========== FORM ========== */
    .form-group { margin-bottom: 20px; }
    
    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--text-secondary);
    }
    
    .form-input {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
    }
    
    .form-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    
    textarea.form-input { min-height: 120px; resize: vertical; }
    
    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    /* ========== UTILITIES ========== */
    .hidden { display: none !important; }
    .loading { padding: 40px; text-align: center; color: var(--text-secondary); }
    .empty-state { padding: 60px; text-align: center; color: var(--text-secondary); }
    
    /* ========== TOAST ========== */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
      z-index: 2000;
      animation: slideIn 0.3s ease;
    }
    
    .toast-success { background: var(--accent-green); }
    .toast-error { background: var(--accent-red); }
    
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    /* ========== RESPONSIVE ========== */
    @media (max-width: 768px) {
      .container { padding: 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .table { font-size: 12px; }
      .table th, .table td { padding: 12px 16px; }
      .header { flex-direction: column; gap: 16px; text-align: center; }
    }
  </style>
</head>
<body>
  <!-- Auth Screen -->
  <div id="authScreen" class="auth-wrapper">
    <div class="auth-card">
      <div class="auth-logo">🔐</div>
      <h2 class="auth-title">Admin Login</h2>
      <p class="auth-subtitle">${BOT_NAME || "Auto Order Bot"}</p>
      <input type="text" id="usernameInput" class="auth-input" placeholder="Username" autocomplete="username">
      <input type="password" id="passwordInput" class="auth-input" placeholder="Password" autocomplete="current-password" onkeypress="if(event.key==='Enter')login()">
      <button onclick="login()" class="auth-btn">🚀 Login</button>
    </div>
  </div>

  <!-- Main Content -->
  <div id="mainContent" class="container hidden">
    <div class="header">
      <h1>🤖 ${BOT_NAME || "Auto Order Bot"}</h1>
      <div class="header-actions">
        <button class="btn btn-ghost" onclick="loadAll()">🔄 Refresh</button>
        <button class="btn btn-danger" onclick="logout()">🚪 Logout</button>
      </div>
    </div>
    
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon">📦</span>
        <div class="stat-value" id="statProducts">0</div>
        <div class="stat-label">Produk Aktif</div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🎫</span>
        <div class="stat-value" id="statStock">0</div>
        <div class="stat-label">Total Stok</div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">📋</span>
        <div class="stat-value" id="statOrders">0</div>
        <div class="stat-label">Total Order</div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">✅</span>
        <div class="stat-value" id="statPaid">0</div>
        <div class="stat-label">Order Sukses</div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">💰</span>
        <div class="stat-value" id="statRevenue">Rp 0</div>
        <div class="stat-label">Total Revenue</div>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" onclick="showTab('products', this)">📦 Produk</button>
      <button class="tab" onclick="showTab('orders', this)">📋 Orders</button>
    </div>
    
    <!-- Products Tab -->
    <div id="productsTab" class="card">
      <div class="card-header">
        <h2 class="card-title">📦 Daftar Produk</h2>
        <button class="btn btn-success" onclick="showAddProductModal()">➕ Tambah Produk</button>
      </div>
      <div class="card-body" id="productsTable">
        <div class="loading">Loading...</div>
      </div>
    </div>
    
    <!-- Orders Tab -->
    <div id="ordersTab" class="card hidden">
      <div class="card-header">
        <h2 class="card-title">📋 Daftar Order</h2>
        <select id="orderFilter" onchange="loadOrders()" class="form-input" style="width:auto">
          <option value="">Semua Status</option>
          <option value="paid">✅ Paid</option>
          <option value="pending">⏳ Pending</option>
          <option value="expired">⌛ Expired</option>
        </select>
      </div>
      <div class="card-body" id="ordersTable">
        <div class="loading">Loading...</div>
      </div>
    </div>
  </div>

  <!-- Product Modal -->
  <div id="productModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title" id="productModalTitle">Tambah Produk</h3>
        <button class="modal-close" onclick="closeModal('productModal')">&times;</button>
      </div>
      <div class="modal-body">
        <form id="productForm" onsubmit="saveProduct(event)">
          <input type="hidden" id="productId">
          <div class="form-group">
            <label class="form-label">Nama Produk</label>
            <input type="text" id="productName" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <textarea id="productDescription" class="form-input"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Harga (Rp)</label>
            <input type="number" id="productPrice" class="form-input" required min="1">
          </div>
          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="productActive" checked> Produk Aktif
            </label>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">💾 Simpan</button>
        </form>
      </div>
    </div>
  </div>

  <!-- Stock Modal -->
  <div id="stockModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">📤 Tambah Stok</h3>
        <button class="modal-close" onclick="closeModal('stockModal')">&times;</button>
      </div>
      <div class="modal-body">
        <form id="stockForm" onsubmit="saveStock(event)">
          <input type="hidden" id="stockProductId">
          <p id="stockProductName" style="margin-bottom:20px;color:var(--accent-green);font-weight:600"></p>
          <div class="form-group">
            <label class="form-label">Credentials (satu per baris)</label>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Format: email|password|pin|info</p>
            <textarea id="stockCredentials" class="form-input" rows="10" placeholder="email1@test.com|pass123|1234|Info&#10;email2@test.com|pass456|-|-"></textarea>
          </div>
          <button type="submit" class="btn btn-success" style="width:100%">📤 Tambah Stok</button>
        </form>
      </div>
    </div>
  </div>

  <!-- Credentials Modal -->
  <div id="credentialsModal" class="modal">
    <div class="modal-content" style="max-width:700px">
      <div class="modal-header">
        <h3 class="modal-title">📋 Daftar Akun</h3>
        <button class="modal-close" onclick="closeModal('credentialsModal')">&times;</button>
      </div>
      <div class="modal-body" id="credentialsList">
        <div class="loading">Loading...</div>
      </div>
    </div>
  </div>

  <script>
    let AUTH_TOKEN = localStorage.getItem('admin_token') || '';
    
    async function login() {
      const username = document.getElementById('usernameInput').value;
      const password = document.getElementById('passwordInput').value;
      
      if (!username || !password) {
        return showToast('Masukkan username dan password', 'error');
      }
      
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.token) {
          AUTH_TOKEN = data.token;
          localStorage.setItem('admin_token', AUTH_TOKEN);
          document.getElementById('authScreen').classList.add('hidden');
          document.getElementById('mainContent').classList.remove('hidden');
          loadAll();
          showToast('Login berhasil!', 'success');
        } else {
          showToast(data.error || 'Login gagal', 'error');
        }
      } catch (e) {
        console.error(e);
        showToast('Gagal koneksi ke server', 'error');
      }
    }
    
    function logout() {
      localStorage.removeItem('admin_token');
      AUTH_TOKEN = '';
      document.getElementById('authScreen').classList.remove('hidden');
      document.getElementById('mainContent').classList.add('hidden');
      document.getElementById('usernameInput').value = '';
      document.getElementById('passwordInput').value = '';
    }
    
    async function checkAuth() {
      if (!AUTH_TOKEN) {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('mainContent').classList.add('hidden');
        return;
      }
      
      try {
        const res = await fetch('/api/verify', {
          headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN }
        });
        
        if (res.ok) {
          document.getElementById('authScreen').classList.add('hidden');
          document.getElementById('mainContent').classList.remove('hidden');
          loadAll();
        } else {
          localStorage.removeItem('admin_token');
          AUTH_TOKEN = '';
          document.getElementById('authScreen').classList.remove('hidden');
          document.getElementById('mainContent').classList.add('hidden');
        }
      } catch (e) {
        console.error(e);
        showToast('Gagal koneksi ke server', 'error');
      }
    }
    
    async function api(endpoint, method = 'GET', body = null) {
      const opts = {
        method,
        headers: { 
          'Authorization': 'Bearer ' + AUTH_TOKEN, 
          'Content-Type': 'application/json' 
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch('/api' + endpoint, opts);
      if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error('Session expired. Please login again.');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'API Error');
      }
      return res.json();
    }
    
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
    
    function formatRupiah(n) {
      return 'Rp ' + (n || 0).toLocaleString('id-ID');
    }
    
    async function loadAll() {
      await Promise.all([loadStats(), loadProducts(), loadOrders()]);
    }
    
    async function loadStats() {
      try {
        const stats = await api('/stats');
        document.getElementById('statProducts').textContent = stats.productCount || 0;
        document.getElementById('statStock').textContent = stats.stockCount || 0;
        document.getElementById('statOrders').textContent = stats.totalOrders || 0;
        document.getElementById('statPaid').textContent = stats.paidOrders || 0;
        document.getElementById('statRevenue').textContent = formatRupiah(stats.totalRevenue);
      } catch (e) { 
        console.error('loadStats error:', e);
      }
    }
    
    async function loadProducts() {
      try {
        const products = await api('/products');
        if (!products.length) {
          document.getElementById('productsTable').innerHTML = '<div class="empty-state">📦 Belum ada produk</div>';
          return;
        }
        
        document.getElementById('productsTable').innerHTML = \`
          <table class="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Harga</th>
                <th>Stok</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              \${products.map(p => \`
                <tr>
                  <td><strong>\${p.name}</strong></td>
                  <td>\${formatRupiah(p.price)}</td>
                  <td><span class="badge badge-info">\${p.stock || 0}</span></td>
                  <td><span class="badge \${p.is_active ? 'badge-success' : 'badge-danger'}">\${p.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="editProduct('\${p.id}')" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="showStockModal('\${p.id}', '\${p.name}')" title="Add Stock">📤</button>
                    <button class="btn btn-sm btn-ghost" onclick="viewCredentials('\${p.id}')" title="View">👁️</button>
                    <button class="btn btn-sm btn-ghost" onclick="deleteProduct('\${p.id}')" title="Delete">🗑️</button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
      } catch (e) {
        console.error('loadProducts error:', e);
        document.getElementById('productsTable').innerHTML = '<div class="empty-state">❌ Gagal memuat produk</div>';
      }
    }
    
    async function loadOrders() {
      try {
        const status = document.getElementById('orderFilter').value;
        const orders = await api('/orders?status=' + status);
        
        if (!orders.length) {
          document.getElementById('ordersTable').innerHTML = '<div class="empty-state">📋 Belum ada order</div>';
          return;
        }
        
        document.getElementById('ordersTable').innerHTML = \`
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Produk</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              \${orders.map(o => \`
                <tr>
                  <td><code style="color:var(--accent-purple)">\${o.pakasir_order_id || o.id.slice(0,8)}</code></td>
                  <td>@\${o.telegram_username || 'anon'}</td>
                  <td>\${o.products?.name || '-'}</td>
                  <td>\${o.quantity}</td>
                  <td>\${formatRupiah(o.total_price)}</td>
                  <td>
                    <span class="badge \${o.status === 'paid' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-danger'}">
                      \${o.status}
                    </span>
                  </td>
                  <td>\${new Date(o.created_at).toLocaleString('id-ID')}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
      } catch (e) {
        console.error('loadOrders error:', e);
        document.getElementById('ordersTable').innerHTML = '<div class="empty-state">❌ Gagal memuat order</div>';
      }
    }
    
    function showTab(tab, el) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('productsTab').classList.toggle('hidden', tab !== 'products');
      document.getElementById('ordersTab').classList.toggle('hidden', tab !== 'orders');
    }
    
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
    
    function showAddProductModal() {
      document.getElementById('productModalTitle').textContent = 'Tambah Produk';
      document.getElementById('productForm').reset();
      document.getElementById('productId').value = '';
      document.getElementById('productActive').checked = true;
      document.getElementById('productModal').classList.add('active');
    }
    
    async function editProduct(id) {
      try {
        const p = await api('/products/' + id);
        document.getElementById('productModalTitle').textContent = 'Edit Produk';
        document.getElementById('productId').value = p.id;
        document.getElementById('productName').value = p.name;
        document.getElementById('productDescription').value = p.description || '';
        document.getElementById('productPrice').value = p.price;
        document.getElementById('productActive').checked = p.is_active;
        document.getElementById('productModal').classList.add('active');
      } catch (e) { showToast('Gagal load produk', 'error'); }
    }
    
    async function saveProduct(e) {
      e.preventDefault();
      const id = document.getElementById('productId').value;
      const data = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        price: parseInt(document.getElementById('productPrice').value),
        is_active: document.getElementById('productActive').checked,
      };
      try {
        if (id) {
          await api('/products/' + id, 'PUT', data);
          showToast('Produk diupdate!');
        } else {
          await api('/products', 'POST', data);
          showToast('Produk ditambahkan!');
        }
        closeModal('productModal');
        loadProducts();
        loadStats();
      } catch (e) { showToast(e.message || 'Gagal menyimpan', 'error'); }
    }
    
    async function deleteProduct(id) {
      if (!confirm('Yakin hapus produk ini?')) return;
      try {
        await api('/products/' + id, 'DELETE');
        showToast('Produk dihapus!');
        loadProducts();
        loadStats();
      } catch (e) { showToast('Gagal menghapus', 'error'); }
    }
    
    function showStockModal(id, name) {
      document.getElementById('stockProductId').value = id;
      document.getElementById('stockProductName').textContent = '📦 ' + name;
      document.getElementById('stockCredentials').value = '';
      document.getElementById('stockModal').classList.add('active');
    }
    
    async function saveStock(e) {
      e.preventDefault();
      const productId = document.getElementById('stockProductId').value;
      const text = document.getElementById('stockCredentials').value;
      const lines = text.split('\\n').filter(l => l.trim());
      const credentials = lines.map(line => {
        const [email, password, pin, extra_info] = line.split('|').map(s => (s || '').trim());
        return { 
          email, 
          password, 
          pin: pin === '-' || !pin ? null : pin, 
          extra_info: extra_info === '-' || !extra_info ? null : extra_info 
        };
      }).filter(c => c.email && c.password);
      
      if (!credentials.length) return showToast('Format tidak valid', 'error');
      
      try {
        await api('/products/' + productId + '/credentials', 'POST', { credentials });
        showToast(credentials.length + ' credentials ditambahkan!');
        closeModal('stockModal');
        loadProducts();
        loadStats();
      } catch (e) { showToast('Gagal menambah stok: ' + e.message, 'error'); }
    }
    
    async function viewCredentials(productId) {
      document.getElementById('credentialsList').innerHTML = '<div class="loading">Loading...</div>';
      document.getElementById('credentialsModal').classList.add('active');
      
      try {
        const creds = await api('/products/' + productId + '/credentials');
        
        if (!creds || !creds.length) {
          document.getElementById('credentialsList').innerHTML = '<div class="empty-state">📋 Tidak ada credentials</div>';
          return;
        }
        
        const available = creds.filter(c => !c.is_sold);
        const sold = creds.filter(c => c.is_sold);
        
        document.getElementById('credentialsList').innerHTML = \`
          <div style="margin-bottom:16px">
            <span class="badge badge-success">✅ Available: \${available.length}</span>
            <span class="badge badge-danger" style="margin-left:8px">❌ Sold: \${sold.length}</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Password</th>
                <th>PIN</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              \${creds.map(c => \`
                <tr>
                  <td style="font-family:monospace">\${c.email}</td>
                  <td style="font-family:monospace">\${c.password}</td>
                  <td>\${c.pin || '-'}</td>
                  <td><span class="badge \${c.is_sold ? 'badge-danger' : 'badge-success'}">\${c.is_sold ? 'Sold' : 'Ready'}</span></td>
                  <td>
                    \${!c.is_sold ? \`<button class="btn btn-sm btn-danger" onclick="deleteCredential('\${c.id}', '\${productId}')">🗑️</button>\` : ''}
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
      } catch (e) {
        console.error('viewCredentials error:', e);
        document.getElementById('credentialsList').innerHTML = '<div class="empty-state">❌ Gagal memuat credentials: ' + e.message + '</div>';
      }
    }
    
    async function deleteCredential(id, productId) {
      if (!confirm('Yakin hapus credential ini?')) return;
      try {
        await api('/credentials/' + id, 'DELETE');
        showToast('Credential dihapus!');
        viewCredentials(productId);
        loadProducts();
        loadStats();
      } catch (e) { showToast('Gagal menghapus', 'error'); }
    }
    
    // Init
    checkAuth();
  </script>
</body>
</html>
  `);
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Telegram Auto Order Bot",
    status: "running",
    endpoints: {
      webhook: "/webhook/pakasir",
      health: "/webhook/health",
      admin: "/admin",
      miniapp: "/miniapp",
      api: "/api/*",
    },
  });
});

// ============================================
// TELEGRAM MINI APP - Mobile Admin Panel
// ============================================
app.get("/miniapp", (req, res) => {
  res.send(getMiniAppHTML());
});

function getMiniAppHTML(): string {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#1a1a2e">
  <title>Admin Mini App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #1a1a2e;
      --bg-secondary: #16213e;
      --bg-card: rgba(255,255,255,0.05);
      --bg-card-hover: rgba(255,255,255,0.08);
      --border-color: rgba(255,255,255,0.1);
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --text-muted: #6b7280;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-purple: #8b5cf6;
      --tg-theme-bg: var(--bg-primary);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--tg-theme-bg-color, var(--bg-primary));
      color: var(--tg-theme-text-color, var(--text-primary));
      min-height: 100vh;
      padding-bottom: 80px;
      -webkit-tap-highlight-color: transparent;
    }
    
    /* Header */
    .header {
      background: var(--bg-secondary);
      padding: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 1px solid var(--border-color);
    }
    
    .header-title {
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 16px;
    }
    
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--accent-blue);
    }
    
    .stat-label {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Tabs */
    .tabs {
      display: flex;
      background: var(--bg-secondary);
      padding: 8px;
      gap: 4px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    
    .tabs::-webkit-scrollbar { display: none; }
    
    .tab {
      flex: 0 0 auto;
      padding: 10px 16px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    
    .tab.active {
      background: var(--accent-blue);
      color: white;
    }
    
    /* Content */
    .content {
      padding: 16px;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    
    .card-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .card-title {
      font-size: 15px;
      font-weight: 600;
    }
    
    .card-body {
      padding: 16px;
    }
    
    /* List Items */
    .list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .list-item:last-child { border-bottom: none; }
    .list-item:active { background: var(--bg-card-hover); }
    
    .list-item-main {
      flex: 1;
      min-width: 0;
    }
    
    .list-item-title {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .list-item-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    
    .list-item-right {
      text-align: right;
      margin-left: 12px;
    }
    
    .list-item-value {
      font-size: 14px;
      font-weight: 600;
    }
    
    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
    }
    
    .badge-success { background: rgba(34,197,94,0.15); color: var(--accent-green); }
    .badge-warning { background: rgba(234,179,8,0.15); color: var(--accent-yellow); }
    .badge-danger { background: rgba(239,68,68,0.15); color: var(--accent-red); }
    .badge-info { background: rgba(59,130,246,0.15); color: var(--accent-blue); }
    
    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-primary { background: var(--accent-blue); color: white; }
    .btn-success { background: var(--accent-green); color: white; }
    .btn-danger { background: var(--accent-red); color: white; }
    .btn-ghost { background: var(--bg-card); color: var(--text-primary); }
    .btn-sm { padding: 6px 10px; font-size: 12px; }
    .btn-block { width: 100%; }
    
    .btn:active { transform: scale(0.98); opacity: 0.9; }
    
    /* FAB */
    .fab {
      position: fixed;
      bottom: 90px;
      right: 16px;
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: var(--accent-blue);
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(59,130,246,0.4);
      z-index: 100;
    }
    
    /* Bottom Nav */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      display: flex;
      padding: 8px 0;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
      z-index: 100;
    }
    
    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 10px;
      cursor: pointer;
      transition: color 0.2s;
    }
    
    .nav-item.active { color: var(--accent-blue); }
    .nav-item-icon { font-size: 20px; margin-bottom: 4px; }
    
    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      align-items: flex-end;
    }
    
    .modal.active { display: flex; }
    
    .modal-content {
      background: var(--bg-secondary);
      width: 100%;
      max-height: 90vh;
      border-radius: 20px 20px 0 0;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }
    
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    
    .modal-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-title { font-size: 18px; font-weight: 600; }
    .modal-close { background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer; }
    .modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; }
    
    /* Form */
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
    
    .form-input {
      width: 100%;
      padding: 12px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 14px;
    }
    
    .form-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    
    textarea.form-input { min-height: 100px; resize: vertical; }
    
    /* Search */
    .search-bar {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    
    .search-input {
      flex: 1;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 14px;
      outline: none;
    }
    
    /* Chart placeholder */
    .chart-container {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    
    .chart-bars {
      display: flex;
      align-items: flex-end;
      height: 120px;
      gap: 4px;
      padding-top: 10px;
    }
    
    .chart-bar {
      flex: 1;
      background: var(--accent-blue);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s;
    }
    
    .chart-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 10px;
      color: var(--text-muted);
    }
    
    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
    }
    
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    
    /* Loading */
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }
    
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* Toast */
    .toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 10px;
      color: white;
      font-size: 13px;
      font-weight: 500;
      z-index: 2000;
      animation: fadeIn 0.3s ease;
    }
    
    .toast-success { background: var(--accent-green); }
    .toast-error { background: var(--accent-red); }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } }
    
    /* Utilities */
    .hidden { display: none !important; }
    .text-success { color: var(--accent-green); }
    .text-danger { color: var(--accent-red); }
    .text-warning { color: var(--accent-yellow); }
    .text-muted { color: var(--text-secondary); }
    .mt-2 { margin-top: 8px; }
    .mt-4 { margin-top: 16px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .flex { display: flex; }
    .gap-2 { gap: 8px; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-title">🤖 ${BOT_NAME || "Admin Panel"}</div>
    <div class="header-subtitle" id="userInfo">Loading...</div>
  </div>
  
  <!-- Stats -->
  <div class="stats-grid" id="statsGrid">
    <div class="stat-card">
      <div class="stat-value" id="statProducts">-</div>
      <div class="stat-label">Produk</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="statStock">-</div>
      <div class="stat-label">Stok</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="statOrders">-</div>
      <div class="stat-label">Order</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="statRevenue">-</div>
      <div class="stat-label">Revenue</div>
    </div>
  </div>
  
  <!-- Content Area -->
  <div id="contentArea"></div>
  
  <!-- FAB -->
  <button class="fab" id="fabBtn" onclick="showAddModal()">+</button>
  
  <!-- Bottom Navigation -->
  <div class="bottom-nav">
    <div class="nav-item active" onclick="showTab('dashboard')">
      <span class="nav-item-icon">📊</span>
      Dashboard
    </div>
    <div class="nav-item" onclick="showTab('products')">
      <span class="nav-item-icon">📦</span>
      Produk
    </div>
    <div class="nav-item" onclick="showTab('orders')">
      <span class="nav-item-icon">📋</span>
      Orders
    </div>
    <div class="nav-item" onclick="showTab('users')">
      <span class="nav-item-icon">👥</span>
      Users
    </div>
    <div class="nav-item" onclick="showTab('more')">
      <span class="nav-item-icon">⚙️</span>
      Lainnya
    </div>
  </div>
  
  <!-- Modal -->
  <div class="modal" id="modal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title" id="modalTitle">Modal</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <script>
    // Telegram WebApp initialization
    const tg = window.Telegram?.WebApp;
    let initData = '';
    let currentUser = null;
    let currentTab = 'dashboard';
    
    // Initialize
    if (tg) {
      tg.ready();
      tg.expand();
      initData = tg.initData;
      
      // Set theme colors
      document.body.style.setProperty('--tg-theme-bg', tg.themeParams.bg_color || '#1a1a2e');
      document.body.style.background = tg.themeParams.bg_color || '#1a1a2e';
      
      // Setup back button
      tg.BackButton.onClick(() => {
        if (document.getElementById('modal').classList.contains('active')) {
          closeModal();
        } else if (currentTab !== 'dashboard') {
          showTab('dashboard');
        } else {
          tg.close();
        }
      });
    }
    
    // API helper
    async function api(endpoint, method = 'GET', body = null) {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData
        }
      };
      if (body) opts.body = JSON.stringify(body);
      
      const res = await fetch('/api/miniapp' + endpoint, opts);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || 'API Error');
      }
      
      return data;
    }
    
    // Format helpers
    function formatRupiah(n) {
      return 'Rp ' + (n || 0).toLocaleString('id-ID');
    }
    
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }
    
    function formatShortNumber(n) {
      if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n/1000).toFixed(1) + 'K';
      return n.toString();
    }
    
    // Toast
    function showToast(msg, type = 'success') {
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
      
      if (tg) {
        tg.HapticFeedback.notificationOccurred(type === 'success' ? 'success' : 'error');
      }
    }
    
    // Modal
    function showModal(title, content) {
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalBody').innerHTML = content;
      document.getElementById('modal').classList.add('active');
      if (tg) tg.BackButton.show();
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
      if (tg && currentTab === 'dashboard') tg.BackButton.hide();
    }
    
    // Tab Navigation
    function showTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.nav-item').forEach((el, i) => {
        el.classList.toggle('active', ['dashboard','products','orders','users','more'][i] === tab);
      });
      
      if (tg) {
        if (tab !== 'dashboard') tg.BackButton.show();
        else tg.BackButton.hide();
      }
      
      switch(tab) {
        case 'dashboard': renderDashboard(); break;
        case 'products': renderProducts(); break;
        case 'orders': renderOrders(); break;
        case 'users': renderUsers(); break;
        case 'more': renderMore(); break;
      }
    }
    
    // ============ DASHBOARD ============
    async function renderDashboard() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const [statsRes, salesRes, topRes] = await Promise.all([
          api('/dashboard/stats'),
          api('/dashboard/sales?days=7'),
          api('/analytics/top-products?limit=5')
        ]);
        
        const stats = statsRes.data;
        const sales = salesRes.data;
        const topProducts = topRes.data;
        
        // Update stat cards
        document.getElementById('statProducts').textContent = stats.stock.totalProducts;
        document.getElementById('statStock').textContent = formatShortNumber(stats.stock.totalStock);
        document.getElementById('statOrders').textContent = formatShortNumber(stats.allTime.orders);
        document.getElementById('statRevenue').textContent = formatShortNumber(stats.allTime.revenue);
        
        // Calculate max for chart
        const maxSales = Math.max(...sales.map(s => s.revenue), 1);
        
        content.innerHTML = \`
          <div class="content">
            <div class="section-title">📈 Penjualan 7 Hari Terakhir</div>
            <div class="chart-container">
              <div class="chart-bars">
                \${sales.slice(-7).map(s => \`
                  <div class="chart-bar" style="height: \${(s.revenue/maxSales)*100}%" title="\${formatRupiah(s.revenue)}"></div>
                \`).join('')}
              </div>
              <div class="chart-labels">
                \${sales.slice(-7).map(s => \`<span>\${new Date(s.date).toLocaleDateString('id-ID', {weekday:'short'})}</span>\`).join('')}
              </div>
            </div>
            
            <div class="section-title">
              📊 Ringkasan
            </div>
            <div class="card">
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">Hari Ini</div>
                </div>
                <div class="list-item-right">
                  <div class="list-item-value text-success">\${formatRupiah(stats.today.revenue)}</div>
                  <div class="text-muted" style="font-size:11px">\${stats.today.orders} order</div>
                </div>
              </div>
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">Minggu Ini</div>
                </div>
                <div class="list-item-right">
                  <div class="list-item-value">\${formatRupiah(stats.week.revenue)}</div>
                  <div class="text-muted" style="font-size:11px">\${stats.week.orders} order</div>
                </div>
              </div>
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">Bulan Ini</div>
                </div>
                <div class="list-item-right">
                  <div class="list-item-value">\${formatRupiah(stats.month.revenue)}</div>
                  <div class="text-muted" style="font-size:11px">\${stats.month.orders} order</div>
                </div>
              </div>
            </div>
            
            <div class="section-title">
              🏆 Produk Terlaris
            </div>
            <div class="card">
              \${topProducts.length ? topProducts.map((p, i) => \`
                <div class="list-item">
                  <div class="list-item-main">
                    <div class="list-item-title">\${i+1}. \${p.product_name}</div>
                    <div class="list-item-subtitle">\${p.total_sold} terjual</div>
                  </div>
                  <div class="list-item-right">
                    <div class="list-item-value">\${formatRupiah(p.total_revenue)}</div>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada data</div>'}
            </div>
            
            <div class="section-title">
              ⚠️ Perlu Perhatian
            </div>
            <div class="card">
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">Stok Menipis</div>
                </div>
                <div class="list-item-right">
                  <span class="badge badge-warning">\${stats.stock.lowStockProducts} produk</span>
                </div>
              </div>
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">Stok Habis</div>
                </div>
                <div class="list-item-right">
                  <span class="badge badge-danger">\${stats.stock.outOfStockProducts} produk</span>
                </div>
              </div>
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
        showToast(err.message, 'error');
      }
    }
    
    // ============ PRODUCTS ============
    let productsData = [];
    
    async function renderProducts() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const res = await api('/products?all=true');
        productsData = res.data;
        
        const categories = productsData.filter(p => p.is_category);
        const products = productsData.filter(p => !p.is_category);
        
        content.innerHTML = \`
          <div class="content">
            <div class="search-bar">
              <span>🔍</span>
              <input type="text" class="search-input" placeholder="Cari produk..." oninput="filterProducts(this.value)">
            </div>
            
            <div class="section-title">
              📁 Kategori (\${categories.length})
              <button class="btn btn-sm btn-ghost" onclick="showAddCategoryModal()">+ Kategori</button>
            </div>
            <div class="card" id="categoriesList">
              \${categories.length ? categories.map(c => \`
                <div class="list-item" onclick="showCategoryDetail('\${c.id}')">
                  <div class="list-item-main">
                    <div class="list-item-title">📁 \${c.name}</div>
                  </div>
                  <div class="list-item-right">
                    <span class="badge \${c.is_active ? 'badge-success' : 'badge-danger'}">\${c.is_active ? 'Aktif' : 'Off'}</span>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada kategori</div>'}
            </div>
            
            <div class="section-title">
              📦 Produk (\${products.length})
              <button class="btn btn-sm btn-ghost" onclick="showAddProductModal()">+ Produk</button>
            </div>
            <div class="card" id="productsList">
              \${products.length ? products.map(p => \`
                <div class="list-item" onclick="showProductDetail('\${p.id}')">
                  <div class="list-item-main">
                    <div class="list-item-title">\${p.name}</div>
                    <div class="list-item-subtitle">\${formatRupiah(p.price)}</div>
                  </div>
                  <div class="list-item-right">
                    <div class="list-item-value \${p.stock > 5 ? 'text-success' : p.stock > 0 ? 'text-warning' : 'text-danger'}">\${p.stock}</div>
                    <div class="text-muted" style="font-size:10px">stok</div>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada produk</div>'}
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
      }
    }
    
    function filterProducts(query) {
      const q = query.toLowerCase();
      const filtered = productsData.filter(p => p.name.toLowerCase().includes(q));
      // Re-render filtered list would go here
    }
    
    function showProductDetail(id) {
      const p = productsData.find(x => x.id === id);
      if (!p) return;
      
      showModal('📦 ' + p.name, \`
        <div class="mb-4">
          <div class="text-muted mb-2">Harga</div>
          <div style="font-size:24px;font-weight:700">\${formatRupiah(p.price)}</div>
        </div>
        <div class="mb-4">
          <div class="text-muted mb-2">Stok Tersedia</div>
          <div style="font-size:24px;font-weight:700" class="\${p.stock > 5 ? 'text-success' : p.stock > 0 ? 'text-warning' : 'text-danger'}">\${p.stock}</div>
        </div>
        <div class="mb-4">
          <div class="text-muted mb-2">Status</div>
          <span class="badge \${p.is_active ? 'badge-success' : 'badge-danger'}">\${p.is_active ? 'Aktif' : 'Nonaktif'}</span>
        </div>
        <div class="mb-4">
          <div class="text-muted mb-2">Deskripsi</div>
          <div>\${p.description || '-'}</div>
        </div>
        <div class="flex gap-2 mt-4">
          <button class="btn btn-success btn-block" onclick="showAddStockModal('\${p.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Tambah Stok
          </button>
        </div>
        <div class="flex gap-2 mt-2">
          <button class="btn btn-ghost btn-block" onclick="showEditProductModal('\${p.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-ghost btn-block" onclick="showStockList('\${p.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Lihat Stok
          </button>
        </div>
        <div class="flex gap-2 mt-2">
          <button class="btn btn-danger btn-block" onclick="deleteProduct('\${p.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Hapus
          </button>
        </div>
      \`);
    }
    
    function showAddModal() {
      if (currentTab === 'products') {
        showAddProductModal();
      } else if (currentTab === 'orders') {
        showToast('Tidak bisa menambah order manual', 'error');
      } else {
        showAddProductModal();
      }
    }
    
    function showAddProductModal() {
      const categories = productsData.filter(p => p.is_category);
      showModal('➕ Tambah Produk', \`
        <form onsubmit="saveProduct(event)">
          <div class="form-group">
            <label class="form-label">Kategori (Opsional)</label>
            <select id="prodCategory" class="form-input">
              <option value="">-- Tanpa Kategori --</option>
              \${categories.map(c => \`<option value="\${c.id}">\${c.name}</option>\`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Produk *</label>
            <input type="text" id="prodName" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga (Rp) *</label>
            <input type="number" id="prodPrice" class="form-input" required min="1">
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <textarea id="prodDesc" class="form-input"></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">💾 Simpan</button>
        </form>
      \`);
    }
    
    function showAddCategoryModal() {
      showModal('➕ Tambah Kategori', \`
        <form onsubmit="saveCategory(event)">
          <div class="form-group">
            <label class="form-label">Nama Kategori *</label>
            <input type="text" id="catName" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <textarea id="catDesc" class="form-input"></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">💾 Simpan</button>
        </form>
      \`);
    }
    
    async function saveProduct(e) {
      e.preventDefault();
      try {
        await api('/products', 'POST', {
          name: document.getElementById('prodName').value,
          price: document.getElementById('prodPrice').value,
          description: document.getElementById('prodDesc').value,
          parent_id: document.getElementById('prodCategory').value || null,
          is_category: false,
          is_active: true
        });
        showToast('Produk berhasil ditambahkan!');
        closeModal();
        renderProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    
    async function saveCategory(e) {
      e.preventDefault();
      try {
        await api('/products', 'POST', {
          name: document.getElementById('catName').value,
          description: document.getElementById('catDesc').value,
          price: 0,
          is_category: true,
          is_active: true
        });
        showToast('Kategori berhasil ditambahkan!');
        closeModal();
        renderProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    
    function showAddStockModal(productId) {
      const p = productsData.find(x => x.id === productId);
      showModal('📤 Tambah Stok - ' + (p?.name || ''), \`
        <form onsubmit="saveStock(event, '\${productId}')">
          <div class="form-group">
            <label class="form-label">Credentials (satu per baris)</label>
            <div class="text-muted mb-2" style="font-size:11px">Format: email|password|pin|info</div>
            <textarea id="stockData" class="form-input" rows="8" placeholder="email1@test.com|pass123|1234|info
email2@test.com|pass456|-|-"></textarea>
          </div>
          <button type="submit" class="btn btn-success btn-block">📤 Tambah Stok</button>
        </form>
      \`);
    }
    
    async function saveStock(e, productId) {
      e.preventDefault();
      const text = document.getElementById('stockData').value;
      try {
        const res = await api('/products/' + productId + '/credentials/bulk', 'POST', { text });
        showToast(\`Berhasil menambah \${res.added} stok!\`);
        closeModal();
        renderProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    
    function showEditProductModal(productId) {
      const p = productsData.find(x => x.id === productId);
      if (!p) return;
      
      showModal('Edit Produk', \`
        <form onsubmit="updateProduct(event, '\${productId}')">
          <div class="form-group">
            <label class="form-label">Nama Produk</label>
            <input type="text" id="editProductName" class="form-input" value="\${p.name}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga</label>
            <input type="number" id="editProductPrice" class="form-input" value="\${p.price}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <textarea id="editProductDesc" class="form-input" rows="3">\${p.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select id="editProductStatus" class="form-input">
              <option value="true" \${p.is_active ? 'selected' : ''}>Aktif</option>
              <option value="false" \${!p.is_active ? 'selected' : ''}>Nonaktif</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Simpan Perubahan</button>
        </form>
      \`);
    }
    
    async function updateProduct(e, productId) {
      e.preventDefault();
      try {
        await api('/products/' + productId, 'PUT', {
          name: document.getElementById('editProductName').value,
          price: parseInt(document.getElementById('editProductPrice').value),
          description: document.getElementById('editProductDesc').value,
          is_active: document.getElementById('editProductStatus').value === 'true'
        });
        showToast('Produk berhasil diupdate!');
        closeModal();
        renderProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    
    async function showStockList(productId) {
      const p = productsData.find(x => x.id === productId);
      if (!p) return;
      
      showModal('Stok - ' + p.name, '<div class="loading"><div class="spinner"></div>Loading...</div>');
      
      try {
        const res = await api('/products/' + productId + '/credentials');
        const creds = res.data || [];
        
        if (creds.length === 0) {
          document.querySelector('.modal-body').innerHTML = '<div class="empty-state">Stok kosong</div>';
          return;
        }
        
        document.querySelector('.modal-body').innerHTML = \`
          <div class="text-muted mb-3">Total: \${creds.length} item</div>
          <div style="max-height:400px;overflow-y:auto">
            \${creds.map((c, i) => \`
              <div class="list-item" style="padding:8px 0;border-bottom:1px solid var(--border)">
                <div class="list-item-main">
                  <div style="font-size:12px;font-family:monospace">\${i+1}. \${c.email || '-'}</div>
                  <div class="text-muted" style="font-size:11px">Pass: \${c.password || '-'} | PIN: \${c.pin || '-'}</div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="deleteCredential('\${c.id}', '\${productId}')" style="padding:4px 8px">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            \`).join('')}
          </div>
        \`;
      } catch (err) {
        document.querySelector('.modal-body').innerHTML = '<div class="empty-state">Error: ' + err.message + '</div>';
      }
    }
    
    async function deleteCredential(credId, productId) {
      if (!confirm('Hapus credential ini?')) return;
      try {
        await api('/credentials/' + credId, 'DELETE');
        showToast('Credential dihapus!');
        showStockList(productId);
        renderProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    
    async function deleteProduct(id) {
      if (!confirm('Yakin hapus produk ini?')) return;
      try {
        await api('/products/' + id, 'DELETE');
        showToast('Produk dihapus!');
        closeModal();
        renderProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    
    // ============ ORDERS ============
    async function renderOrders() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const res = await api('/orders?limit=50');
        const orders = res.data;
        
        content.innerHTML = \`
          <div class="content">
            <div class="tabs mb-4">
              <button class="tab active" onclick="filterOrders('all', this)">Semua</button>
              <button class="tab" onclick="filterOrders('paid', this)">✅ Paid</button>
              <button class="tab" onclick="filterOrders('pending', this)">⏳ Pending</button>
              <button class="tab" onclick="filterOrders('expired', this)">❌ Expired</button>
            </div>
            
            <div class="card" id="ordersList">
              \${orders.length ? orders.map(o => \`
                <div class="list-item" onclick="showOrderDetail('\${o.id}')">
                  <div class="list-item-main">
                    <div class="list-item-title">@\${o.telegram_username || 'anon'}</div>
                    <div class="list-item-subtitle">\${o.products?.name || '-'} x\${o.quantity}</div>
                  </div>
                  <div class="list-item-right">
                    <div class="list-item-value">\${formatRupiah(o.total_price)}</div>
                    <span class="badge \${o.status === 'paid' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-danger'}">\${o.status}</span>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada order</div>'}
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
      }
    }
    
    async function filterOrders(status, btn) {
      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      
      const list = document.getElementById('ordersList');
      list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      
      try {
        const endpoint = status === 'all' ? '/orders?limit=50' : '/orders?limit=50&status=' + status;
        const res = await api(endpoint);
        const orders = res.data;
        
        list.innerHTML = orders.length ? orders.map(o => \`
          <div class="list-item" onclick="showOrderDetail('\${o.id}')">
            <div class="list-item-main">
              <div class="list-item-title">@\${o.telegram_username || 'anon'}</div>
              <div class="list-item-subtitle">\${o.products?.name || '-'} x\${o.quantity}</div>
            </div>
            <div class="list-item-right">
              <div class="list-item-value">\${formatRupiah(o.total_price)}</div>
              <span class="badge \${o.status === 'paid' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-danger'}">\${o.status}</span>
            </div>
          </div>
        \`).join('') : '<div class="empty-state">Tidak ada order</div>';
      } catch (err) {
        list.innerHTML = '<div class="empty-state">Error loading</div>';
      }
    }
    
    // ============ USERS ============
    async function renderUsers() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const res = await api('/users?limit=50');
        const users = res.data;
        
        content.innerHTML = \`
          <div class="content">
            <div class="search-bar">
              <span>🔍</span>
              <input type="text" class="search-input" placeholder="Cari user...">
            </div>
            
            <div class="section-title">👥 Top Users (\${res.total})</div>
            <div class="card">
              \${users.length ? users.map((u, i) => \`
                <div class="list-item" onclick="showUserDetail(\${u.user_id})">
                  <div class="list-item-main">
                    <div class="list-item-title">\${i+1}. @\${u.username || 'anon'}</div>
                    <div class="list-item-subtitle">\${u.paid_orders} transaksi</div>
                  </div>
                  <div class="list-item-right">
                    <div class="list-item-value">\${formatRupiah(u.total_spent)}</div>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada user</div>'}
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
      }
    }
    
    // ============ MORE/SETTINGS ============
    function renderMore() {
      const content = document.getElementById('contentArea');
      content.innerHTML = \`
        <div class="content">
          <div class="section-title">⚙️ Menu Lainnya</div>
          <div class="card">
            <div class="list-item" onclick="showTab('analytics')">
              <div class="list-item-main">
                <div class="list-item-title">📊 Analytics</div>
                <div class="list-item-subtitle">Grafik dan insights</div>
              </div>
              <div class="list-item-right">→</div>
            </div>
            <div class="list-item" onclick="renderVouchers()">
              <div class="list-item-main">
                <div class="list-item-title">🎟️ Voucher</div>
                <div class="list-item-subtitle">Kelola voucher diskon</div>
              </div>
              <div class="list-item-right">→</div>
            </div>
            <div class="list-item" onclick="renderActivityLog()">
              <div class="list-item-main">
                <div class="list-item-title">📜 Activity Log</div>
                <div class="list-item-subtitle">Riwayat aktivitas admin</div>
              </div>
              <div class="list-item-right">→</div>
            </div>
            <div class="list-item" onclick="renderQuickReplies()">
              <div class="list-item-main">
                <div class="list-item-title">💬 Quick Replies</div>
                <div class="list-item-subtitle">Template balasan chat</div>
              </div>
              <div class="list-item-right">→</div>
            </div>
          </div>
          
          <div class="section-title mt-4">ℹ️ Info</div>
          <div class="card">
            <div class="card-body text-muted" style="font-size:12px">
              Admin ID: \${currentUser?.id || '-'}<br>
              Username: @\${currentUser?.username || '-'}<br>
              Mini App v1.0
            </div>
          </div>
        </div>
      \`;
    }
    
    async function renderVouchers() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const res = await api('/vouchers');
        const vouchers = res.data;
        
        content.innerHTML = \`
          <div class="content">
            <div class="section-title">
              🎟️ Voucher
              <button class="btn btn-sm btn-ghost" onclick="showAddVoucherModal()">+ Tambah</button>
            </div>
            <div class="card">
              \${vouchers.length ? vouchers.map(v => \`
                <div class="list-item">
                  <div class="list-item-main">
                    <div class="list-item-title">\${v.code}</div>
                    <div class="list-item-subtitle">\${v.discount_type === 'percentage' ? v.discount_value + '%' : formatRupiah(v.discount_value)} off</div>
                  </div>
                  <div class="list-item-right">
                    <span class="badge \${v.is_active ? 'badge-success' : 'badge-danger'}">\${v.is_active ? 'Aktif' : 'Off'}</span>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada voucher</div>'}
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
      }
    }
    
    async function renderActivityLog() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const res = await api('/activity-logs?limit=50');
        const logs = res.data;
        
        content.innerHTML = \`
          <div class="content">
            <div class="section-title">📜 Activity Log</div>
            <div class="card">
              \${logs.length ? logs.map(l => \`
                <div class="list-item">
                  <div class="list-item-main">
                    <div class="list-item-title">\${l.action}</div>
                    <div class="list-item-subtitle">@\${l.admin_username || l.admin_id}</div>
                  </div>
                  <div class="list-item-right">
                    <div class="text-muted" style="font-size:11px">\${formatDate(l.created_at)}</div>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada aktivitas</div>'}
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
      }
    }
    
    async function renderQuickReplies() {
      const content = document.getElementById('contentArea');
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      
      try {
        const res = await api('/quick-replies');
        const replies = res.data;
        
        content.innerHTML = \`
          <div class="content">
            <div class="section-title">
              💬 Quick Replies
              <button class="btn btn-sm btn-ghost" onclick="showAddQuickReplyModal()">+ Tambah</button>
            </div>
            <div class="card">
              \${replies.length ? replies.map(r => \`
                <div class="list-item">
                  <div class="list-item-main">
                    <div class="list-item-title">\${r.title}</div>
                    <div class="list-item-subtitle">\${r.content.substring(0, 50)}...</div>
                  </div>
                </div>
              \`).join('') : '<div class="empty-state">Belum ada quick reply</div>'}
            </div>
          </div>
        \`;
      } catch (err) {
        content.innerHTML = \`<div class="empty-state"><div class="empty-icon">❌</div>\${err.message}</div>\`;
      }
    }
    
    // ============ INIT ============
    async function init() {
      try {
        const res = await api('/auth/verify');
        currentUser = res.user;
        document.getElementById('userInfo').textContent = '@' + (res.user.username || res.user.id);
        showTab('dashboard');
      } catch (err) {
        document.getElementById('contentArea').innerHTML = \`
          <div class="empty-state">
            <div class="empty-icon">🔒</div>
            <div>Akses Ditolak</div>
            <div class="text-muted mt-2">\${err.message}</div>
          </div>
        \`;
        document.getElementById('statsGrid').classList.add('hidden');
        document.querySelector('.bottom-nav').classList.add('hidden');
        document.getElementById('fabBtn').classList.add('hidden');
      }
    }
    
    init();
  </script>
</body>
</html>
`;
}

export function startWebServer(): void {
  app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`   - Webhook: http://localhost:${PORT}/webhook/pakasir`);
    console.log(`   - Admin: http://localhost:${PORT}/admin`);
    console.log(`   - Mini App: http://localhost:${PORT}/miniapp`);
    console.log(`   - API: http://localhost:${PORT}/api/*`);
  });
}

export { app };
