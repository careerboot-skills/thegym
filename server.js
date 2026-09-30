const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thegym';
const SECRET_ADMIN = process.env.SECRET_ADMIN || 'TGTA26';
const SECRET_SUPREME = process.env.SECRET_SUPREME || 'VAIXXXI';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// ==========================================
// MONGODB SCHEMA & MODEL
// ==========================================
const memberSchema = new mongoose.Schema({
  slNo: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  fees: { type: Number, required: true },
  paidOn: { type: Date, required: true, default: Date.now },
  renewalDate: { type: Date, required: true }
}, { timestamps: true });

// Pre-validate hook to calculate exact 30-day renewal date
memberSchema.pre('validate', function(next) {
  if (this.paidOn) {
    const paid = new Date(this.paidOn);
    const renewal = new Date(paid);
    renewal.setDate(paid.getDate() + 30);
    this.renewalDate = renewal;
  }
  next();
});

const Member = mongoose.model('Member', memberSchema);

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ==========================================
// REST API ROUTES
// ==========================================

// Authenticate Role based on Secret Keys
app.post('/api/auth', (req, res) => {
  const { secretKey } = req.body;
  if (secretKey === SECRET_SUPREME) {
    return res.json({ success: true, role: 'SUPREME', message: 'Welcome Supreme Admin' });
  } else if (secretKey === SECRET_ADMIN) {
    return res.json({ success: true, role: 'ADMIN', message: 'Welcome Admin' });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid Secret Key!' });
  }
});

// Fetch all members ordered by renewalDate ascending (nearest renewal date first)
app.get('/api/members', async (req, res) => {
  try {
    const members = await Member.find().sort({ renewalDate: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new member
app.post('/api/members', async (req, res) => {
  try {
    const { name, fees, paidOn } = req.body;
    
    // Auto-increment SL No
    const count = await Member.countDocuments();
    const slNo = count + 1;

    const paidDate = paidOn ? new Date(paidOn) : new Date();

    const newMember = new Member({
      slNo,
      name,
      fees: Number(fees),
      paidOn: paidDate
    });

    await newMember.save();

    // Broadcast update via WebSockets
    const allMembers = await Member.find().sort({ renewalDate: 1 });
    io.emit('dataUpdate', allMembers);

    res.status(201).json({ success: true, member: newMember });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// WebSockets Connection
io.on('connection', (socket) => {
  console.log('Client connected to real-time updates');
});

// ==========================================
// COMPLETE FRONTEND HTML & CSS & JS
// ==========================================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TheGym | Premium Fitness Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Teko:wght@500;700&family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', sans-serif;
    }
    body {
      background: #08080a;
      color: #ffffff;
      overflow-x: hidden;
      min-height: 100vh;
    }

    /* Screen Sections */
    .screen {
      display: none;
      width: 100vw;
      min-height: 100vh;
    }
    .screen.active {
      display: flex;
      flex-direction: column;
    }

    /* LOGIN SCREEN LAYOUT: 15% - 25% - 60% */
    #login-screen {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: radial-gradient(circle at top, #1a1a24 0%, #08080a 100%);
    }

    /* Top 15%: Branding Header */
    .brand-header {
      height: 15vh;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
    }
    .brand-header svg {
      width: 60px;
      height: 60px;
      filter: drop-shadow(0 0 10px #ff0055);
    }
    .brand-title {
      font-family: 'Teko', sans-serif;
      font-size: 3.5rem;
      letter-spacing: 3px;
      text-transform: uppercase;
      background: linear-gradient(45deg, #ff0055, #ff5500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Next 25%: Login Area */
    .login-container {
      height: 25vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 20px;
      z-index: 10;
    }
    .login-card {
      background: rgba(20, 20, 28, 0.85);
      border: 1px solid rgba(255, 0, 85, 0.3);
      box-shadow: 0 0 30px rgba(255, 0, 85, 0.15);
      padding: 20px 30px;
      border-radius: 16px;
      display: flex;
      gap: 15px;
      align-items: center;
      backdrop-filter: blur(15px);
    }
    .login-card input {
      background: #0d0d12;
      border: 1px solid #333;
      color: #fff;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 1.1rem;
      outline: none;
      letter-spacing: 2px;
      text-align: center;
      width: 280px;
      transition: all 0.3s;
    }
    .login-card input:focus {
      border-color: #ff0055;
      box-shadow: 0 0 15px rgba(255,0,85,0.4);
    }
    .login-card button {
      background: linear-gradient(45deg, #ff0055, #ff5500);
      border: none;
      color: #fff;
      padding: 14px 30px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .login-card button:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 20px rgba(255,0,85,0.5);
    }

    /* Remaining 60%: 4D Interactive Canvas Area */
    .animation-container {
      height: 60vh;
      position: relative;
      width: 100%;
      overflow: hidden;
      background: radial-gradient(ellipse at bottom, rgba(255,0,85,0.08) 0%, transparent 70%);
    }
    #animationCanvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* DASHBOARDS STYLING */
    .dashboard {
      padding: 40px;
      max-width: 1600px;
      margin: 0 auto;
      width: 100%;
    }
    .dash-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .dash-header h1 {
      font-family: 'Teko', sans-serif;
      font-size: 3rem;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .badge-supreme {
      background: rgba(255,0,85,0.2);
      border: 1px solid #ff0055;
      color: #ff0055;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 700;
    }
    .badge-admin {
      background: rgba(0,212,255,0.2);
      border: 1px solid #00d4ff;
      color: #00d4ff;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 700;
    }

    /* Admin Options */
    .admin-options {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 40px;
    }
    .option-card {
      background: rgba(20,20,28,0.6);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 50px 30px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      backdrop-filter: blur(10px);
    }
    .option-card:hover {
      border-color: #ff0055;
      transform: translateY(-8px);
      box-shadow: 0 10px 30px rgba(255,0,85,0.2);
    }
    .option-card h3 {
      font-size: 2rem;
      margin-bottom: 15px;
      font-family: 'Teko', sans-serif;
      letter-spacing: 1px;
    }

    /* Tables */
    .table-container {
      background: rgba(18,18,24,0.8);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.08);
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th, td {
      padding: 18px 24px;
      font-size: 1.05rem;
    }
    th {
      background: rgba(255,255,255,0.03);
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 1px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    tr {
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.2s;
    }
    tr:hover {
      background: rgba(255,255,255,0.02);
    }

    /* Highlight Row: Tomato Red for <= 5 days remaining */
    tr.tomato-alert {
      background: rgba(255, 99, 71, 0.22) !important;
      border-left: 5px solid #FF6347;
    }
    tr.tomato-alert td {
      color: #ffa392;
      font-weight: 600;
    }

    /* PREMIUM POPUPS */
    .popup-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(12px);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .popup-overlay.active {
      display: flex;
    }
    .popup-box {
      background: linear-gradient(135deg, #181824 0%, #0d0d14 100%);
      border: 1px solid rgba(255, 0, 85, 0.4);
      box-shadow: 0 0 50px rgba(255, 0, 85, 0.3);
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 500px;
      position: relative;
      animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popIn {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .popup-box h2 {
      font-family: 'Teko', sans-serif;
      font-size: 2.5rem;
      letter-spacing: 1px;
      margin-bottom: 20px;
      color: #ff0055;
      text-transform: uppercase;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.9rem;
      color: #aaa;
    }
    .form-group input {
      width: 100%;
      background: #09090d;
      border: 1px solid #2a2a38;
      padding: 12px 16px;
      color: #fff;
      border-radius: 8px;
      font-size: 1rem;
      outline: none;
    }
    .form-group input:focus {
      border-color: #ff0055;
    }
    .btn-group {
      display: flex;
      gap: 15px;
      margin-top: 30px;
    }
    .btn-submit {
      flex: 1;
      background: linear-gradient(45deg, #ff0055, #ff5500);
      border: none;
      color: #fff;
      padding: 12px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-cancel {
      flex: 1;
      background: transparent;
      border: 1px solid #444;
      color: #ccc;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
    }
    .btn-logout {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 8px 18px;
      border-radius: 8px;
      cursor: pointer;
    }
    .btn-logout:hover {
      background: #ff0055;
      border-color: #ff0055;
    }
  </style>
</head>
<body>

  <!-- ========================================== -->
  <!-- 1. LOGIN SCREEN -->
  <!-- ========================================== -->
  <div id="login-screen" class="screen active">
    <!-- Top 15%: TG Logo & Branding -->
    <div class="brand-header">
      <svg viewBox="0 0 100 100">
        <path d="M20,20 L80,20 L80,35 L55,35 L55,80 L40,80 L40,35 L20,35 Z" fill="#ff0055"/>
        <path d="M50,45 L85,45 L85,80 L60,80 L60,65 L70,65 L70,58 L50,58 Z" fill="#ff5500"/>
      </svg>
      <div class="brand-title">TheGym</div>
    </div>

    <!-- Next 25%: Login Area -->
    <div class="login-container">
      <div class="login-card">
        <input type="password" id="secretKeyInput" placeholder="ENTER SECRET KEY" />
        <button onclick="handleLogin()">Login</button>
      </div>
    </div>

    <!-- Remaining 60%: 4D Weightlifting Animation Canvas -->
    <div class="animation-container">
      <canvas id="animationCanvas"></canvas>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- 2. ADMIN DASHBOARD -->
  <!-- ========================================== -->
  <div id="admin-dashboard" class="screen">
    <div class="dashboard">
      <div class="dash-header">
        <div>
          <h1>Admin Portal</h1>
          <span class="badge-admin">Authorized Admin</span>
        </div>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>

      <div class="admin-options">
        <div class="option-card" onclick="openAddMemberModal()">
          <h3>1st: Add Member</h3>
          <p style="color:#888;">Register a new athlete with payment details</p>
        </div>
        <div class="option-card" onclick="showAdminDataSheet()">
          <h3>2nd: Data Sheet</h3>
          <p style="color:#888;">View full membership directory & renewal dates</p>
        </div>
      </div>

      <!-- Data Sheet Section -->
      <div id="adminDataSheetContainer" style="margin-top: 40px; display: none;">
        <h2 style="font-family:'Teko'; font-size: 2rem; margin-bottom: 15px;">Member Data Sheet</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>SL No.</th>
                <th>Name</th>
                <th>Fees (₹)</th>
                <th>Paid On</th>
                <th>Renewal Date (+30 Days)</th>
              </tr>
            </thead>
            <tbody id="adminTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- 3. SUPREME ADMIN DASHBOARD -->
  <!-- ========================================== -->
  <div id="supreme-dashboard" class="screen">
    <div class="dashboard">
      <div class="dash-header">
        <div>
          <h1>Supreme Control Dashboard</h1>
          <span class="badge-supreme">Supreme Authority</span>
        </div>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>

      <h2 style="font-family:'Teko'; font-size: 2rem; margin-bottom: 15px; color:#aaa;">
        Live Fees Renewal Status (Sorted by Nearest Date)
      </h2>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>SL No.</th>
              <th>Name</th>
              <th>Fees (₹)</th>
              <th>Paid On</th>
              <th>Renewal Date</th>
              <th>Days Remaining</th>
            </tr>
          </thead>
          <tbody id="supremeTableBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- PREMIUM POPUPS -->
  <!-- ========================================== -->
  <div class="popup-overlay" id="addMemberModal">
    <div class="popup-box">
      <h2>Add New Member</h2>
      <form id="addMemberForm" onsubmit="submitMemberForm(event)">
        <div class="form-group">
          <label>Member Full Name</label>
          <input type="text" id="memberName" required placeholder="e.g. Alex Mercer" />
        </div>
        <div class="form-group">
          <label>Fees Amount (₹)</label>
          <input type="number" id="memberFees" required placeholder="e.g. 2500" />
        </div>
        <div class="form-group">
          <label>Paid On Date</label>
          <input type="date" id="memberPaidOn" required />
        </div>
        <div class="btn-group">
          <button type="submit" class="btn-submit">Add Athlete</button>
          <button type="button" class="btn-cancel" onclick="closeAddMemberModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const socket = io();

    // Set today as default for date input
    document.getElementById('memberPaidOn').valueAsDate = new Date();

    // Listen to WebSocket broadcasts for real-time live data update
    socket.on('dataUpdate', (members) => {
      renderTables(members);
    });

    // Handle Authentication Login
    async function handleLogin() {
      const secretKey = document.getElementById('secretKeyInput').value.trim();
      if (!secretKey) return alert('Please enter secret key!');

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretKey })
        });
        const data = await res.json();

        if (data.success) {
          document.getElementById('login-screen').classList.remove('active');
          if (data.role === 'SUPREME') {
            document.getElementById('supreme-dashboard').classList.add('active');
            loadMembers();
          } else if (data.role === 'ADMIN') {
            document.getElementById('admin-dashboard').classList.add('active');
          }
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert('Authentication failed!');
      }
    }

    function logout() {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('login-screen').classList.add('active');
      document.getElementById('secretKeyInput').value = '';
    }

    function showAdminDataSheet() {
      const container = document.getElementById('adminDataSheetContainer');
      container.style.display = 'block';
      loadMembers();
    }

    async function loadMembers() {
      const res = await fetch('/api/members');
      const members = await res.json();
      renderTables(members);
    }

    function renderTables(members) {
      const adminTbody = document.getElementById('adminTableBody');
      const supremeTbody = document.getElementById('supremeTableBody');

      if (adminTbody) adminTbody.innerHTML = '';
      if (supremeTbody) supremeTbody.innerHTML = '';

      const now = new Date();

      members.forEach(m => {
        const paidDate = new Date(m.paidOn).toLocaleDateString();
        const renewalDateObj = new Date(m.renewalDate);
        const renewalDateStr = renewalDateObj.toLocaleDateString();

        // Calculate days remaining
        const diffTime = renewalDateObj - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Admin Table Row
        if (adminTbody) {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td>\${m.slNo}</td>
            <td>\${m.name}</td>
            <td>₹\${m.fees}</td>
            <td>\${paidDate}</td>
            <td>\${renewalDateStr}</td>
          \`;
          adminTbody.appendChild(tr);
        }

        // Supreme Admin Table Row (Highlighted with tomato red if <= 5 days remaining)
        if (supremeTbody) {
          const tr = document.createElement('tr');
          if (diffDays <= 5) {
            tr.classList.add('tomato-alert');
          }
          tr.innerHTML = \`
            <td>\${m.slNo}</td>
            <td>\${m.name}</td>
            <td>₹\${m.fees}</td>
            <td>\${paidDate}</td>
            <td>\${renewalDateStr}</td>
            <td>\${diffDays < 0 ? 'Expired (' + Math.abs(diffDays) + ' days ago)' : diffDays + ' Days'}</td>
          \`;
          supremeTbody.appendChild(tr);
        }
      });
    }

    // Modal Control
    function openAddMemberModal() {
      document.getElementById('addMemberModal').classList.add('active');
    }
    function closeAddMemberModal() {
      document.getElementById('addMemberModal').classList.remove('active');
    }

    async function submitMemberForm(e) {
      e.preventDefault();
      const name = document.getElementById('memberName').value;
      const fees = document.getElementById('memberFees').value;
      const paidOn = document.getElementById('memberPaidOn').value;

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, fees, paidOn })
      });

      const data = await res.json();
      if (data.success) {
        closeAddMemberModal();
        document.getElementById('addMemberForm').reset();
        document.getElementById('memberPaidOn').valueAsDate = new Date();
        loadMembers();
      } else {
        alert('Error adding member: ' + data.error);
      }
    }

    // ==========================================
    // 4D Interactive Canvas Animation (Man & Woman Lifting Weights)
    // ==========================================
    const canvas = document.getElementById('animationCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let angle = 0;

    function drawLifter(x, y, scale, timeOffset, isWoman) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // 4D depth perspective oscillator
      const squatHeight = Math.sin(angle + timeOffset) * 25; 
      const colorGlow = isWoman ? '#ff0055' : '#00d4ff';

      // Barbell & Weights
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-70, -60 + squatHeight);
      ctx.lineTo(70, -60 + squatHeight);
      ctx.stroke();

      // Heavy Weight Plates
      ctx.fillStyle = colorGlow;
      ctx.shadowColor = colorGlow;
      ctx.shadowBlur = 15;
      ctx.fillRect(-85, -85 + squatHeight, 15, 50);
      ctx.fillRect(70, -85 + squatHeight, 15, 50);

      // Body Structure
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 0;

      // Head
      ctx.beginPath();
      ctx.arc(0, -70 + squatHeight, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Torso
      ctx.beginPath();
      ctx.moveTo(0, -58 + squatHeight);
      ctx.lineTo(0, -10 + squatHeight);
      ctx.stroke();

      // Squatting Legs
      ctx.beginPath();
      ctx.moveTo(0, -10 + squatHeight);
      ctx.lineTo(-25, 15 + squatHeight / 2);
      ctx.lineTo(-30, 50);
      ctx.moveTo(0, -10 + squatHeight);
      ctx.lineTo(25, 15 + squatHeight / 2);
      ctx.lineTo(30, 50);
      ctx.stroke();

      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;

      // Draw Male Lifter (Left) & Female Lifter (Right)
      drawLifter(width * 0.35, height * 0.65, 1.2, 0, false);
      drawLifter(width * 0.65, height * 0.65, 1.1, Math.PI, true);

      angle += 0.04;
      requestAnimationFrame(animate);
    }

    animate();
  </script>
</body>
</html>
  `);
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server executing on port ${PORT}`);
});
