import express from "express";
import webhookRoutes from "./routes/webhook.js";
import adminRoutes from "./routes/admin.js";
import { PORT, BOT_NAME } from "../config.js";

const app = express();

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

// Routes
app.use("/webhook", webhookRoutes);
app.use("/api", adminRoutes);

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
    if (API_KEY) checkAuth();
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
      api: "/api/*",
    },
  });
});

export function startWebServer(): void {
  app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`   - Webhook: http://localhost:${PORT}/webhook/pakasir`);
    console.log(`   - Admin: http://localhost:${PORT}/admin`);
    console.log(`   - API: http://localhost:${PORT}/api/*`);
  });
}

export { app };
