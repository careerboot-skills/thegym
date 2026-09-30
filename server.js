// ================================================================
// THEGYM — FULLY INTEGRATED 4K ANIMATED WEB PORTAL
// Single-file Node.js + Express/HTTP + MongoDB Portal
// ================================================================

const http = require("http");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "SKTCB";
const SUPREME_KEY = process.env.SUPREME_KEY || "VAIVAIXXXI";
const SESSION_SECRET = process.env.SESSION_SECRET || "THEGYM_CAREERBOOT_2026_SECRET";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "thegym";

let db = null;
let members = null;
const sessions = new Map();

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
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

function calculateGrowth(member) {
  const joining = Number(member.joiningWeight);
  const current = Number(member.currentWeight);
  const goal = Number(member.goalWeight);
  if (!joining || !goal || joining === goal || !Number.isFinite(current)) return 0;
  let percentage = member.goalCategory === "Loss"
    ? ((joining - current) / (joining - goal)) * 100
    : ((current - joining) / (goal - joining)) * 100;
  return Math.round(percentage * 10) / 10;
}

function cleanMember(member) {
  if (!member) return null;
  const output = { ...member, id: String(member._id), growth: calculateGrowth(member) };
  delete output._id;
  delete output.secretKeyHash;
  return output;
}

async function connectMongo() {
  if (!MONGODB_URI) return;
  try {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    db = client.db(DB_NAME);
    members = db.collection("members");
    await members.createIndex({ secretKeyHash: 1 }, { unique: true });
    console.log("MongoDB Connected to:", DB_NAME);
  } catch (err) {
    console.error("MongoDB Connection Warning:", err.message);
  }
}

function sendHTML(res) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>TheGym — Premium 4K Portal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

  :root {
    --lime: #ccff00;
    --lime-glow: rgba(204, 255, 0, 0.4);
    --dark-bg: #030508;
    --card-bg: rgba(13, 19, 28, 0.85);
    --border-line: rgba(204, 255, 0, 0.2);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--dark-bg);
    color: #f0f4f8;
    font-family: 'Plus Jakarta Sans', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    position: relative;
  }

  /* Animated Gym Atmosphere Background */
  body::before {
    content: '';
    position: fixed;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at 50% 50%, rgba(204, 255, 0, 0.05) 0%, transparent 60%),
                radial-gradient(circle at 20% 20%, rgba(0, 230, 118, 0.03) 0%, transparent 40%);
    animation: rotateBg 30s linear infinite;
    z-index: -2;
  }

  @keyframes rotateBg {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Animated Gym Stickers */
  .sticker {
    position: fixed;
    font-size: 38px;
    opacity: 0.15;
    user-select: none;
    pointer-events: none;
    animation: floatSticker 6s ease-in-out infinite alternate;
    z-index: -1;
  }
  .s1 { top: 10%; left: 5%; animation-delay: 0s; }
  .s2 { top: 70%; left: 8%; animation-delay: 1.5s; }
  .s3 { top: 15%; right: 6%; animation-delay: 3s; }
  .s4 { top: 75%; right: 7%; animation-delay: 4.5s; }

  @keyframes floatSticker {
    0% { transform: translateY(0) rotate(0deg) scale(1); }
    100% { transform: translateY(-20px) rotate(10deg) scale(1.1); }
  }

  /* Header / Navigation */
  header {
    display: flex;
    justify-space: space-between;
    align-items: center;
    padding: 16px 32px;
    background: rgba(8, 12, 18, 0.95);
    border-bottom: 1px solid var(--border-line);
    backdrop-filter: blur(12px);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-logo {
    width: 44px;
    height: 44px;
    filter: drop-shadow(0 0 8px var(--lime-glow));
  }

  .brand-text {
    font-family: 'Orbitron', sans-serif;
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 2px;
    background: linear-gradient(135deg, #fff, var(--lime));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .wrapper {
    flex: 1;
    max-width: 1240px;
    width: 100%;
    margin: 0 auto;
    padding: 32px 16px;
  }

  /* 4K Glass Card */
  .card-4k {
    background: var(--card-bg);
    border: 1px solid var(--border-line);
    border-radius: 24px;
    padding: 32px;
    backdrop-filter: blur(20px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    margin-bottom: 24px;
  }

  h1, h2, h3 { font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }

  input, select {
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(4, 7, 12, 0.8);
    color: #fff;
    font-size: 15px;
    margin-top: 6px;
    margin-bottom: 16px;
    outline: none;
    transition: all 0.3s ease;
  }

  input:focus, select:focus {
    border-color: var(--lime);
    box-shadow: 0 0 12px var(--lime-glow);
  }

  button {
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, var(--lime), #99cc00);
    color: #000;
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
    font-size: 15px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: all 0.3s ease;
    box-shadow: 0 8px 24px var(--lime-glow);
  }

  button:hover {
    transform: translateY(-2deg);
    box-shadow: 0 12px 32px var(--lime-glow);
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-line);
    color: #fff;
    box-shadow: none;
  }

  .btn-secondary:hover {
    background: rgba(204, 255, 0, 0.1);
    border-color: var(--lime);
  }

  /* Status Badges */
  .badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 800;
    font-family: 'Orbitron', sans-serif;
  }
  .bg-green { background: rgba(0, 230, 118, 0.15); color: #00e676; border: 1px solid #00e676; }
  .bg-yellow { background: rgba(255, 214, 0, 0.15); color: #ffd600; border: 1px solid #ffd600; }
  .bg-orange { background: rgba(255, 145, 0, 0.15); color: #ff9100; border: 1px solid #ff9100; }
  .bg-red { background: rgba(255, 99, 71, 0.2); color: #ff6347; border: 1px solid #ff6347; }

  /* Table Design */
  .table-box { overflow-x: auto; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th {
    padding: 14px 16px;
    color: rgba(255,255,255,0.6);
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  td {
    padding: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    white-space: nowrap;
  }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media(max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }

  /* Footer */
  footer {
    text-align: center;
    padding: 24px 16px;
    background: rgba(4, 7, 12, 0.95);
    border-top: 1px solid var(--border-line);
    font-size: 13px;
    color: rgba(255,255,255,0.7);
  }
</style>
</head>
<body>

<div class="sticker s1">🏋️‍♂️</div>
<div class="sticker s2">🥊</div>
<div class="sticker s3">⚡</div>
<div class="sticker s4">🔥</div>

<header>
  <div class="brand">
    <!-- SVG Logo TG -->
    <svg class="brand-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#0D131C"/>
      <rect x="2" y="2" width="96" height="96" rx="18" stroke="#CCFF00" stroke-width="4" stroke-opacity="0.4"/>
      <path d="M20 30H50M35 30V70" stroke="#CCFF00" stroke-width="10" stroke-linecap="round"/>
      <path d="M75 35C70 30 55 30 55 50C55 70 75 70 75 55H65" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>
    </svg>
    <div class="brand-text">TheGym</div>
  </div>
  <div id="navRight"></div>
</header>

<div class="wrapper" id="app"></div>

<footer>
  TheGym +91 70079 47859, WhatsApp +91 78958 32442, ®CareerBoot ©2026
</footer>

<script>
let token = localStorage.getItem('tg_token');
let role = localStorage.getItem('tg_role');

function renderNav() {
  const el = document.getElementById('navRight');
  if (token) {
    el.innerHTML = '<button onclick="logout()" class="btn-secondary" style="padding:10px 20px;width:auto;">LOGOUT</button>';
  } else {
    el.innerHTML = '<span class="badge bg-green">4K SYSTEM READY</span>';
  }
}

function renderLogin() {
  localStorage.removeItem('tg_token');
  localStorage.removeItem('tg_role');
  token = null; role = null;
  renderNav();

  document.getElementById('app').innerHTML = \`
    <div class="card-4k" style="max-width:440px;margin:60px auto;text-align:center;">
      <h2 style="color:var(--lime);margin-bottom:8px;">PORTAL ACCESS</h2>
      <p style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:24px;">Enter Secret Key to Access Portal</p>
      <input type="password" id="keyInput" placeholder="ENTER SECRET KEY" style="text-align:center;letter-spacing:4px;font-size:18px;" autofocus>
      <button onclick="login()">VERIFY SECRET KEY →</button>
      <div id="err" style="color:#ff6347;font-size:13px;margin-top:16px;"></div>
    </div>
  \`;
}

async function login() {
  const key = document.getElementById('keyInput').value.trim();
  const err = document.getElementById('err');
  err.textContent = '';
  if (!key) return err.textContent = 'Please enter a valid Secret Key';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    token = data.token;
    role = data.role;
    localStorage.setItem('tg_token', token);
    localStorage.setItem('tg_role', role);
    route();
  } catch(e) {
    err.textContent = e.message;
  }
}

function logout() {
  renderLogin();
}

function showAdminPanel() {
  renderNav();
  document.getElementById('app').innerHTML = \`
    <div class="card-4k">
      <div style="display:flex;justify-space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <h2 style="color:var(--lime);">ADMIN CONTROL PANEL</h2>
        <div style="display:flex;gap:12px;">
          <button onclick="showRegisterForm()" style="width:auto;padding:12px 20px;">+ REGISTER NEW MEMBER</button>
          <button onclick="showMembersProfileSheet()" class="btn-secondary" style="width:auto;padding:12px 20px;">MEMBERS PROFILE PAGE</button>
        </div>
      </div>
      <div id="adminContent"></div>
    </div>
  \`;
  showMembersProfileSheet();
}

function showRegisterForm() {
  document.getElementById('adminContent').innerHTML = \`
    <div style="max-width:680px;margin:20px auto;background:rgba(4,7,12,0.6);padding:24px;border-radius:18px;border:1px solid var(--border-line);">
      <h3 style="margin-bottom:20px;color:var(--lime);">MEMBERS REGISTER PAGE</h3>
      <form onsubmit="handleRegister(event)">
        <label style="font-size:12px;color:rgba(255,255,255,0.7);">Full Name</label>
        <input name="name" placeholder="John Doe" required>

        <label style="font-size:12px;color:rgba(255,255,255,0.7);">Assign Secret Key</label>
        <input name="secretKey" placeholder="e.g. USER123" required>

        <div class="grid-2">
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.7);">Joining Date</label>
            <input type="date" name="joiningDate" required>
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.7);">Joining Day Weight (kg)</label>
            <input type="number" step="0.1" name="joiningWeight" placeholder="80" required>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.7);">Goal Category</label>
            <select name="goalCategory">
              <option value="Loss">Weight Loss</option>
              <option value="Gain">Weight Gain</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.7);">Goal Weight (kg)</label>
            <input type="number" step="0.1" name="goalWeight" placeholder="70" required>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.7);">Members Fees</label>
            <select name="fee">
              <option value="500">₹500</option>
              <option value="700">₹700</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.7);">Contact Number</label>
            <input name="contact" placeholder="+91 9876543210" required>
          </div>
        </div>

        <label style="font-size:12px;color:rgba(255,255,255,0.7);">Last Fees Submission Date</label>
        <input type="date" name="lastFeeDate" required>

        <button type="submit" style="margin-top:12px;">CREATE MEMBER PROFILE</button>
      </form>
      <div id="regErr" style="color:#ff6347;font-size:13px;margin-top:12px;"></div>
    </div>
  \`;
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const body = {
    name: form.name.value,
    secretKey: form.secretKey.value,
    joiningDate: form.joiningDate.value,
    joiningWeight: form.joiningWeight.value,
    goalCategory: form.goalCategory.value,
    goalWeight: form.goalWeight.value,
    fee: form.fee.value,
    contact: form.contact.value,
    lastFeeDate: form.lastFeeDate.value
  };

  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    alert('Member Created Successfully!');
    showMembersProfileSheet();
  } catch(err) {
    document.getElementById('regErr').textContent = err.message;
  }
}

async function showMembersProfileSheet() {
  const res = await fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } });
  if (res.status === 401) return renderLogin();
  const data = await res.json();

  const rows = data.members.map(m => \`
    <tr>
      <td><b>\${m.name}</b></td>
      <td>\${m.joiningDate}</td>
      <td><b>\${m.currentWeight} kg</b> <button onclick="editWeight('\${m.id}', \${m.currentWeight})" class="btn-secondary" style="padding:4px 10px;font-size:10px;width:auto;display:inline-block;margin-left:8px;">EDIT</button></td>
      <td>\${m.joiningWeight} kg</td>
      <td><span class="badge bg-green">\${m.growth}%</span></td>
    </tr>
  \`).join('');

  document.getElementById('adminContent').innerHTML = \`
    <h3 style="color:var(--lime);margin-top:12px;">MEMBERS PROFILE SHEET</h3>
    <div class="table-box">
      <table>
        <thead>
          <tr>
            <th>NAME</th>
            <th>JOINING DATE</th>
            <th>CURRENT DAY WEIGHT</th>
            <th>JOINING DATE WEIGHT</th>
            <th>GROWTH STATUS (%)</th>
          </tr>
        </thead>
        <tbody>\${rows || '<tr><td colspan="5">No members found</td></tr>'}</tbody>
      </table>
    </div>
  \`;
}

async function editWeight(id, oldWt) {
  const w = prompt('Enter Current Day Weight (kg):', oldWt);
  if (!w) return;
  await fetch('/api/members/' + id + '/weight', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ currentWeight: Number(w) })
  });
  showMembersProfileSheet();
}

async function showSupremeDashboard() {
  renderNav();
  const res = await fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } });
  if (res.status === 401) return renderLogin();
  const data = await res.json();

  const todayStr = new Date().toISOString().split('T')[0];

  const rows = data.members.map((m, idx) => {
    const lastFee = new Date(m.lastFeeDate);
    const today = new Date();
    const diffDays = Math.floor((today - lastFee) / (1000 * 60 * 60 * 24));

    let statusHtml = '';
    if (diffDays > 30) {
      statusHtml = \`<span class="badge bg-red">\${diffDays - 30} Days Gone</span>\`;
    } else {
      const rem = 30 - diffDays;
      if (rem >= 20) statusHtml = \`<span class="badge bg-green">\${rem} Days Balance</span>\`;
      else if (rem >= 11) statusHtml = \`<span class="badge bg-yellow">\${rem} Days Balance</span>\`;
      else statusHtml = \`<span class="badge bg-orange">\${rem} Days Balance</span>\`;
    }

    return \`
      <tr>
        <td><b>\${idx + 1}</b></td>
        <td><b>\${m.name}</b></td>
        <td>\${todayStr}</td>
        <td>₹\${m.fee}</td>
        <td>\${statusHtml}</td>
        <td><span class="badge bg-green">\${m.growth}%</span></td>
        <td>\${m.contact}</td>
      </tr>
    \`;
  }).join('');

  document.getElementById('app').innerHTML = \`
    <div class="card-4k">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;">
        <div>
          <h2 style="color:var(--lime);">SUPREME ADMIN REPORT DASHBOARD</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:13px;">Daily-to-Monthly Live Member Tracker</p>
        </div>
        <div class="badge bg-green">TODAY: \${todayStr}</div>
      </div>
      <div class="table-box">
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
          <tbody>\${rows || '<tr><td colspan="7">No records available</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  \`;
}

async function showUserPerformance() {
  renderNav();
  const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
  if (res.status === 401) return renderLogin();
  const data = await res.json();
  const m = data.member;

  document.getElementById('app').innerHTML = \`
    <div class="card-4k" style="max-width:600px;margin:30px auto;text-align:center;">
      <div style="font-family:'Orbitron';font-size:12px;letter-spacing:2px;color:var(--lime);margin-bottom:8px;">MEMBER PERFORMANCE DASHBOARD</div>
      <h1 style="font-size:36px;margin-bottom:24px;color:#fff;">\${m.name.toUpperCase()}</h1>

      <div style="background:rgba(4,7,12,0.9);border-radius:20px;padding:32px;border:1px solid var(--lime);box-shadow:0 0 30px var(--lime-glow);margin-bottom:24px;">
        <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:8px;">GROWTH STATUS</div>
        <div style="font-size:72px;font-weight:900;color:var(--lime);font-family:'Orbitron';">\${m.growth}%</div>
      </div>

      <div class="grid-2">
        <div style="background:rgba(4,7,12,0.7);padding:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:12px;color:rgba(255,255,255,0.6);">GOAL CATEGORY</div>
          <div style="font-size:20px;font-weight:bold;color:#fff;margin-top:6px;">Weight \${m.goalCategory}</div>
        </div>
        <div style="background:rgba(4,7,12,0.7);padding:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:12px;color:rgba(255,255,255,0.6);">TARGET GOAL WEIGHT</div>
          <div style="font-size:20px;font-weight:bold;color:var(--lime);margin-top:6px;">\${m.goalWeight} kg</div>
        </div>
      </div>
    </div>
  \`;
}

function route() {
  if (!token || !role) return renderLogin();
  if (role === 'supreme') showSupremeDashboard();
  else if (role === 'admin') showAdminPanel();
  else if (role === 'member') showUserPerformance();
  else renderLogin();
}

renderLogin();
</script>
</body>
</html>\`;

  res.end(page);
}

// ================================================================
// SERVER ROUTES & API ENDPOINTS
// ================================================================
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const key = String(body.key || "").trim();
      let role = null, identity = "";

      if (safeEqual(key, SUPREME_KEY)) { role = "supreme"; identity = "supreme"; }
      else if (safeEqual(key, ADMIN_KEY)) { role = "admin"; identity = "admin"; }
      else if (members) {
        const member = await members.findOne({ secretKeyHash: hashKey(key) });
        if (member) { role = "member"; identity = String(member._id); }
      }

      if (!role) return json(res, 401, { error: "Invalid Secret Key" });

      const tkn = newToken(role, identity);
      sessions.set(tkn, { role, identity });
      return json(res, 200, { token: tkn, role });
    }

    if (url.pathname === "/api/members" && req.method === "GET") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const list = await members.find({}).sort({ createdAt: 1 }).toArray();
      return json(res, 200, { members: list.map(cleanMember) });
    }

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
        createdAt: new Date()
      };
      const result = await members.insertOne(member);
      return json(res, 201, { member: cleanMember({ ...member, _id: result.insertedId }) });
    }

    if (url.pathname.match(/^\/api\/members\/[a-f0-9]{24}\/weight$/) && req.method === "PATCH") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const id = url.pathname.split("/")[3];
      const body = await readBody(req);
      await members.updateOne(
        { _id: new ObjectId(id) },
        { $set: { currentWeight: Number(body.currentWeight) } }
      );
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/api/me" && req.method === "GET") {
      const s = guard(req, res, ["member"]);
      if (!s) return;
      const member = await members.findOne({ _id: new ObjectId(s.identity) });
      return json(res, 200, { member: cleanMember(member) });
    }

    sendHTML(res);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "Server Error" });
  }
});

server.listen(PORT, () => {
  console.log(`TheGym Portal running on http://localhost:${PORT}`);
  connectMongo();
});
