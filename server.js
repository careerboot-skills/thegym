// ================================================================
// THEGYM — 4K HIGH-VIBE GYM MANAGEMENT & PERFORMANCE PORTAL
// ================================================================

const http = require("http");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "SKTCB";
const SUPREME_KEY = process.env.SUPREME_KEY || "VAIVAIXXXI";
const SESSION_SECRET = process.env.SESSION_SECRET || "THEGYM_CAREERBOOT_2026_SECRET";
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "thegym";

let db = null;
let members = null;
const sessions = new Map();

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
}

const readBody = req =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2000000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

function hashKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function newToken(role, identity = "") {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(role + "|" + identity + "|" + crypto.randomUUID())
    .digest("hex");
}

function session(req) {
  return sessions.get((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
}

function guard(req, res, roles) {
  const s = session(req);
  if (!s || !roles.includes(s.role)) {
    json(res, 401, { error: "Unauthorized access" });
    return null;
  }
  return s;
}

function growth(member) {
  const joining = Number(member.joiningWeight);
  const current = Number(member.currentWeight);
  const goal = Number(member.goalWeight);
  if (!joining || !goal || joining === goal || !Number.isFinite(current)) return 0;
  let percentage = member.goalCategory === "Loss"
    ? ((joining - current) / (joining - goal)) * 100
    : ((current - joining) / (goal - joining)) * 100;
  return Math.round(percentage * 10) / 10;
}

function clean(member) {
  if (!member) return null;
  const output = { ...member, id: String(member._id), growth: growth(member) };
  delete output._id;
  delete output.secretKeyHash;
  return output;
}

async function connectMongo() {
  if (!MONGODB_URI) return;
  try {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
    await client.connect();
    db = client.db(DB_NAME);
    members = db.collection("members");
    await members.createIndex({ secretKeyHash: 1 }, { unique: true });
    await members.createIndex({ contact: 1 });
    console.log("MongoDB Connected to:", DB_NAME);
  } catch (err) {
    console.error("MongoDB Error:", err.message);
  }
}

function sendHTML(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>TheGym — 4K Premium Portal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #030508;
    color: #f0f4f8;
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    position: relative;
  }

  /* 4D ANIMATED BACKGROUND LIGHTING */
  body::before {
    content: '';
    position: fixed;
    top: -10%; left: -10%;
    width: 120%; height: 120%;
    background: 
      radial-gradient(circle at 20% 20%, rgba(184, 255, 61, 0.12) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(255, 77, 77, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.06) 0%, transparent 50%);
    z-index: -1;
    animation: pulseBg 12s ease-in-out infinite alternate;
  }

  @keyframes pulseBg {
    0% { transform: scale(1) rotate(0deg); }
    100% { transform: scale(1.08) rotate(3deg); }
  }

  /* GYM VIBING DUMBBELL FLOAT ANIMATION */
  .gym-sticker {
    position: fixed;
    opacity: 0.08;
    pointer-events: none;
    z-index: 0;
    animation: floatSticker 8s infinite ease-in-out alternate;
  }
  @keyframes floatSticker {
    0% { transform: translateY(0px) rotate(0deg); }
    100% { transform: translateY(-25px) rotate(10deg); }
  }

  /* TOP NAVBAR */
  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: rgba(10, 14, 22, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(184, 255, 61, 0.2);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .tg-badge {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #b8ff3d, #7acc00);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(184, 255, 61, 0.5);
  }
  .tg-badge svg { width: 28px; height: 28px; fill: #030508; }
  .brand-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #fff;
    text-shadow: 0 0 10px rgba(255,255,255,0.3);
  }

  .main-wrapper {
    flex: 1;
    padding: 24px 16px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    z-index: 10;
  }

  /* GLASS CARD CONTAINERS */
  .card-4k {
    background: rgba(15, 21, 32, 0.75);
    backdrop-filter: blur(25px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 30px 60px rgba(0,0,0,0.6);
    margin-bottom: 24px;
    transition: transform 0.3s ease, border-color 0.3s ease;
  }
  .card-4k:hover {
    border-color: rgba(184, 255, 61, 0.4);
  }

  h1, h2, h3 {
    font-family: 'Orbitron', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* INPUTS & BUTTONS */
  input, select {
    width: 100%;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(5, 8, 14, 0.9);
    color: #fff;
    font-size: 15px;
    margin-bottom: 14px;
    outline: none;
    transition: all 0.2s ease;
  }
  input:focus, select:focus {
    border-color: #b8ff3d;
    box-shadow: 0 0 15px rgba(184, 255, 61, 0.3);
  }

  button {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #b8ff3d, #8ae600);
    color: #030508;
    font-weight: 800;
    font-size: 15px;
    cursor: pointer;
    font-family: 'Orbitron', sans-serif;
    letter-spacing: 1px;
    box-shadow: 0 0 20px rgba(184, 255, 61, 0.3);
    transition: all 0.2s ease;
  }
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(184, 255, 61, 0.6);
  }
  .btn-sub {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    box-shadow: none;
  }
  .btn-sub:hover {
    background: rgba(255,255,255,0.1);
  }

  /* STATUS BADGES */
  .status-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .status-green { background: rgba(0, 230, 118, 0.2); color: #00e676; border: 1px solid #00e676; }
  .status-yellow { background: rgba(255, 214, 0, 0.2); color: #ffd600; border: 1px solid #ffd600; }
  .status-orange { background: rgba(255, 145, 0, 0.2); color: #ff9100; border: 1px solid #ff9100; }
  .status-red { background: rgba(255, 99, 71, 0.25); color: #ff6347; border: 1px solid #ff6347; box-shadow: 0 0 10px rgba(255,99,71,0.4); }

  /* 4K DATA TABLE */
  .table-responsive { overflow-x: auto; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
  th {
    padding: 14px;
    background: rgba(255,255,255,0.03);
    color: #91a0ad;
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    letter-spacing: 1px;
    border-bottom: 2px solid rgba(255,255,255,0.1);
  }
  td {
    padding: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    white-space: nowrap;
  }

  /* FOOTER */
  .footer {
    text-align: center;
    padding: 20px;
    background: rgba(5, 8, 14, 0.9);
    border-top: 1px solid rgba(255,255,255,0.1);
    color: #728191;
    font-size: 13px;
    letter-spacing: 0.5px;
  }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media(max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<!-- GYM VIBING STICKERS -->
<svg class="gym-sticker" style="top:15%;left:5%;width:120px;" viewBox="0 0 24 24"><path fill="#b8ff3d" d="M5,5A2,2 0 0,0 3,7V17A2,2 0 0,0 5,19H6V5H5M19,5H18V19H19A2,2 0 0,0 21,17V7A2,2 0 0,0 19,5M9,3H7V21H9V3M17,3H15V21H17V3M11,8H13V16H11V8Z"/></svg>
<svg class="gym-sticker" style="bottom:15%;right:5%;width:140px;" viewBox="0 0 24 24"><path fill="#b8ff3d" d="M20.57,14.86L22,13.43L20.57,12L17,15.57L8.43,7L12,3.43L10.57,2L9.14,3.43L7.71,2L6.29,3.43L7.71,4.86L3.43,9.14L2,7.71L0.57,9.14L2,10.57L0.57,12L2,13.43L3.43,12L12,20.57L8.43,17L7,18.43L8.43,19.86L7,21.29L8.43,22.71L9.86,21.29L11.29,22.71L12.71,21.29L11.29,19.86L19.86,11.29L21.29,12.71L22.71,11.29L21.29,9.86L20.57,10.57L20.57,14.86Z"/></svg>

<!-- NAVBAR -->
<div class="top-nav">
  <div class="brand-logo">
    <div class="tg-badge">
      <svg viewBox="0 0 24 24"><path d="M5,4H19A2,2 0 0,1 21,6V8H3V6A2,2 0 0,1 5,4M3,10H21V18A2,2 0 0,1 19,20H5A2,2 0 0,1 3,18V10M11,12V16H13V12H11Z"/></svg>
    </div>
    <div class="brand-title">THEGYM</div>
  </div>
  <div id="nav-btn"></div>
</div>

<!-- MAIN VIEW CONTAINER -->
<div class="main-wrapper" id="app"></div>

<!-- FOOTER -->
<div class="footer">
  TheGym +91 70079 47859, WhatsApp +91 78958 32442, ®CareerBoot ©2026
</div>

<script>
let token = localStorage.getItem('tg_token');
let role = localStorage.getItem('tg_role');

function renderNav() {
  const el = document.getElementById('nav-btn');
  if (token) {
    el.innerHTML = '<button onclick="logout()" class="btn-sub" style="width:auto;padding:8px 16px;">LOGOUT (' + role.toUpperCase() + ')</button>';
  } else {
    el.innerHTML = '<span class="status-badge status-green">PORTAL READY</span>';
  }
}

function landing() {
  renderNav();
  document.getElementById('app').innerHTML = \`
    <div class="card-4k" style="max-width:420px;margin:40px auto;text-align:center;">
      <h1 style="font-size:26px;color:#b8ff3d;margin-bottom:8px;">THEGYM ACCESS</h1>
      <p style="color:#91a0ad;font-size:14px;margin-bottom:24px;">Enter your assigned Secret Key to proceed.</p>
      <input type="password" id="key" placeholder="ENTER SECRET KEY" autocomplete="off" style="text-align:center;letter-spacing:3px;">
      <button onclick="doLogin()">ACCESS PORTAL →</button>
      <div id="err" style="color:#ff6347;font-size:13px;margin-top:14px;"></div>
    </div>
  \`;
}

async function doLogin() {
  const key = document.getElementById('key').value.trim();
  const err = document.getElementById('err');
  err.textContent = '';
  if (!key) return err.textContent = 'Secret key is required';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    token = data.token;
    role = data.role;
    localStorage.setItem('tg_token', token);
    localStorage.setItem('tg_role', role);
    route();
  } catch (e) {
    err.textContent = e.message;
  }
}

function logout() {
  localStorage.clear();
  token = null; role = null;
  landing();
}

// ================================================================
// ADMIN PANEL
// ================================================================
function showAdminPanel() {
  renderNav();
  document.getElementById('app').innerHTML = \`
    <div class="card-4k">
      <h2 style="color:#b8ff3d;margin-bottom:16px;">ADMIN PANEL</h2>
      <div class="grid-2">
        <button onclick="showRegisterForm()">MEMBERS REGISTER PAGE</button>
        <button onclick="showMembersSheet()" class="btn-sub">MEMBERS PROFILE PAGE</button>
      </div>
    </div>
    <div id="admin-content"></div>
  \`;
  showMembersSheet();
}

function showRegisterForm() {
  document.getElementById('admin-content').innerHTML = \`
    <div class="card-4k" style="max-width:650px;margin:0 auto;">
      <h2 style="margin-bottom:20px;font-size:20px;">NEW MEMBER REGISTRATION</h2>
      <form onsubmit="handleRegister(event)">
        <input name="name" placeholder="Member Full Name" required>
        <input name="secretKey" placeholder="Assign Secret Key" required>
        <div class="grid-2">
          <div><label style="font-size:11px;color:#91a0ad;">Joining Date</label><input type="date" name="joiningDate" required></div>
          <div><label style="font-size:11px;color:#91a0ad;">Joining Day Weight (kg)</label><input type="number" step="0.1" name="joiningWeight" placeholder="e.g. 75.5" required></div>
        </div>
        <div class="grid-2">
          <div><label style="font-size:11px;color:#91a0ad;">Goal Category</label><select name="goalCategory"><option value="Loss">Weight Loss</option><option value="Gain">Weight Gain</option></select></div>
          <div><label style="font-size:11px;color:#91a0ad;">Goal Weight (kg)</label><input type="number" step="0.1" name="goalWeight" placeholder="e.g. 68.0" required></div>
        </div>
        <div class="grid-2">
          <div><label style="font-size:11px;color:#91a0ad;">Members Fees</label><select name="fee"><option value="500">₹500</option><option value="700">₹700</option></select></div>
          <div><label style="font-size:11px;color:#91a0ad;">Contact Number</label><input name="contact" placeholder="Mobile Number" required></div>
        </div>
        <div><label style="font-size:11px;color:#91a0ad;">Last Fees Submission Date</label><input type="date" name="lastFeeDate" required></div>
        <button type="submit" style="margin-top:10px;">REGISTER MEMBER</button>
      </form>
      <div id="err" style="color:#ff6347;font-size:13px;margin-top:10px;"></div>
    </div>
  \`;
}

async function handleRegister(e) {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert('Member Registered Successfully!');
    showMembersSheet();
  } catch (err) {
    document.getElementById('err').textContent = err.message;
  }
}

async function showMembersSheet() {
  try {
    const res = await fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    let rows = data.members.map(m => \`
      <tr>
        <td><b>\${m.name}</b></td>
        <td>\${m.joiningDate}</td>
        <td>\${m.joiningWeight} kg</td>
        <td><b>\${m.currentWeight} kg</b> <button onclick="editWeight('\${m.id}', '\${m.currentWeight}')" style="padding:4px 8px;font-size:10px;width:auto;display:inline-block;margin-left:6px;">EDIT</button></td>
        <td><span class="status-badge status-green">\${m.growth}%</span></td>
      </tr>
    \`).join('');

    document.getElementById('admin-content').innerHTML = \`
      <div class="card-4k">
        <h2>MEMBERS PROFILE SHEET</h2>
        <div class="table-responsive">
          <table>
            <thead>
              <tr><th>Name</th><th>Joining Date</th><th>Joining Weight</th><th>Current Day Weight</th><th>Growth Status (%)</th></tr>
            </thead>
            <tbody>\${rows || '<tr><td colspan="5">No members registered yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (e) {
    alert(e.message);
  }
}

async function editWeight(id, oldWt) {
  const weight = prompt('Enter Current Day Weight (kg):', oldWt);
  if (!weight) return;
  try {
    const res = await fetch('/api/members/' + id + '/weight', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ currentWeight: Number(weight) })
    });
    if (!res.ok) throw new Error('Weight update failed');
    showMembersSheet();
  } catch (e) { alert(e.message); }
}

// ================================================================
// SUPREME ADMIN PANEL — REPORT DASHBOARD
// ================================================================
async function showSupremeDashboard() {
  renderNav();
  try {
    const res = await fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const todayStr = new Date().toISOString().split('T')[0];

    let rows = data.members.map((m, index) => {
      // Calculate Days Balance / Overdue
      const lastFee = new Date(m.lastFeeDate);
      const today = new Date();
      const diffTime = today - lastFee;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let statusHtml = '';
      if (diffDays > 30) {
        const gone = diffDays - 30;
        statusHtml = \`<span class="status-badge status-red">\${gone} Days Gone</span>\`;
      } else {
        const remaining = 30 - diffDays;
        if (remaining >= 20) {
          statusHtml = \`<span class="status-badge status-green">\${remaining} Days Balance</span>\`;
        } else if (remaining >= 11) {
          statusHtml = \`<span class="status-badge status-yellow">\${remaining} Days Balance</span>\`;
        } else {
          statusHtml = \`<span class="status-badge status-orange">\${remaining} Days Balance</span>\`;
        }
      }

      return \`
        <tr>
          <td><b>\${index + 1}</b></td>
          <td><b>\${m.name}</b></td>
          <td>\${todayStr}</td>
          <td>₹\${m.fee}</td>
          <td>\${statusHtml}</td>
          <td><span class="status-badge status-green">\${m.growth}%</span></td>
          <td>\${m.contact}</td>
        </tr>
      \`;
    }).join('');

    document.getElementById('app').innerHTML = \`
      <div class="card-4k">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
          <div>
            <h2 style="color:#b8ff3d;">SUPREME ADMIN REPORT DASHBOARD</h2>
            <p style="color:#91a0ad;font-size:13px;">Daily-to-Monthly Live Tracking System</p>
          </div>
          <div class="status-badge status-green">TODAY: \${todayStr}</div>
        </div>

        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>SL NO.</th>
                <th>NAME</th>
                <th>DATE</th>
                <th>FEES</th>
                <th>STATUS</th>
                <th>GROWTH</th>
                <th>CONTACT NUMBER</th>
              </tr>
            </thead>
            <tbody>\${rows || '<tr><td colspan="7">No report data available</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (e) {
    alert(e.message);
  }
}

// ================================================================
// MEMBER PERFORMANCE PAGE
// ================================================================
async function showMemberPerformance() {
  renderNav();
  try {
    const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const m = data.member;

    document.getElementById('app').innerHTML = \`
      <div class="card-4k" style="text-align:center;max-width:600px;margin:20px auto;">
        <div style="font-size:12px;letter-spacing:2px;color:#b8ff3d;font-family:'Orbitron';">MEMBER PERFORMANCE DASHBOARD</div>
        <h1 style="font-size:32px;margin:12px 0 20px;color:#fff;">\${m.name.toUpperCase()}</h1>

        <!-- VIBING PROGRESS BAR -->
        <div style="background:rgba(5,8,14,0.9);border-radius:16px;padding:24px;border:1px solid rgba(184,255,61,0.3);margin-bottom:24px;">
          <div style="font-size:12px;color:#91a0ad;margin-bottom:8px;">GROWTH STATUS</div>
          <div style="font-size:64px;font-weight:900;color:#b8ff3d;font-family:'Orbitron';text-shadow:0 0 25px rgba(184,255,61,0.5);">\${m.growth}%</div>
          
          <div style="width:100%;background:rgba(255,255,255,0.1);height:12px;border-radius:6px;overflow:hidden;margin-top:16px;">
            <div style="width:\${Math.min(100, Math.max(0, m.growth))}%;background:linear-gradient(90deg, #b8ff3d, #00e676);height:100%;"></div>
          </div>
        </div>

        <div class="grid-2">
          <div style="background:rgba(5,8,14,0.8);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:11px;color:#91a0ad;">GOAL CATEGORY</div>
            <div style="font-size:18px;font-weight:bold;color:#fff;margin-top:4px;">\${m.goalCategory}</div>
          </div>
          <div style="background:rgba(5,8,14,0.8);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:11px;color:#91a0ad;">TARGET GOAL WEIGHT</div>
            <div style="font-size:18px;font-weight:bold;color:#b8ff3d;margin-top:4px;">\${m.goalWeight} kg</div>
          </div>
        </div>
      </div>
    \`;
  } catch (e) {
    alert(e.message);
  }
}

function route() {
  if (!token) { landing(); return; }
  if (role === 'supreme') showSupremeDashboard();
  else if (role === 'admin') showAdminPanel();
  else if (role === 'member') showMemberPerformance();
  else landing();
}

route();
</script>
</body>
</html>`;

  res.end(page);
}

// ================================================================
// SERVER ENDPOINTS
// ================================================================
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname.startsWith("/api/") && !members) {
      return json(res, 503, { error: "Database connecting, please wait..." });
    }

    // LOGIN ENDPOINT
    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const key = String(body.key || "").trim();
      let role = null, identity = "";

      if (safeEqual(key, SUPREME_KEY)) { role = "supreme"; identity = "supreme"; }
      else if (safeEqual(key, ADMIN_KEY)) { role = "admin"; identity = "admin"; }
      else {
        const member = await members.findOne({ secretKeyHash: hashKey(key), active: { $ne: false } });
        if (member) { role = "member"; identity = String(member._id); }
      }

      if (!role) return json(res, 401, { error: "Invalid Secret Key" });

      const tkn = newToken(role, identity);
      sessions.set(tkn, { role, identity, created: Date.now() });
      return json(res, 200, { token: tkn, role });
    }

    // GET ALL MEMBERS
    if (url.pathname === "/api/members" && req.method === "GET") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const list = await members.find({}).sort({ createdAt: 1 }).toArray();
      return json(res, 200, { members: list.map(clean) });
    }

    // CREATE MEMBER
    if (url.pathname === "/api/members" && req.method === "POST") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const body = await readBody(req);
      const member = {
        name: String(body.name).trim(),
        secretKeyHash: hashKey(String(body.secretKey).trim()),
        joiningDate: String(body.joiningDate),
        joiningWeight: Number(body.joiningWeight),
        currentWeight: Number(body.joiningWeight),
        goalCategory: body.goalCategory === "Gain" ? "Gain" : "Loss",
        goalWeight: Number(body.goalWeight),
        fee: Number(body.fee) === 700 ? 700 : 500,
        contact: String(body.contact).trim(),
        lastFeeDate: String(body.lastFeeDate),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await members.insertOne(member);
      return json(res, 201, { member: clean({ ...member, _id: result.insertedId }) });
    }

    // UPDATE CURRENT WEIGHT
    if (url.pathname.match(/^\/api\/members\/[a-f0-9]{24}\/weight$/) && req.method === "PATCH") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const id = url.pathname.split("/")[3];
      const body = await readBody(req);
      await members.updateOne(
        { _id: new ObjectId(id) },
        { $set: { currentWeight: Number(body.currentWeight), updatedAt: new Date() } }
      );
      return json(res, 200, { ok: true });
    }

    // GET MEMBER SELF DATA
    if (url.pathname === "/api/me" && req.method === "GET") {
      const s = guard(req, res, ["member"]);
      if (!s) return;
      const member = await members.findOne({ _id: new ObjectId(s.identity) });
      return json(res, 200, { member: clean(member) });
    }

    // HEALTH CHECK
    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, name: "TheGym", database: !!db });
    }

    sendHTML(res);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "Server Error" });
  }
});

server.listen(PORT, () => {
  console.log(`TheGym 4K Portal running on port ${PORT}`);
  connectMongo();
});
