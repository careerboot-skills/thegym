// ================================================================
// THEGYM — FULLY INTEGRATED 4K PORTAL
// Single-file Node.js + HTTP + MongoDB Engine
// ================================================================

const http = require("http");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

// ----------------------------------------------------------------
// CONFIGURATION & ENVIRONMENT
// ----------------------------------------------------------------
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = String(process.env.ADMIN_KEY || "SKTCB").trim();
const SUPREME_KEY = String(process.env.SUPREME_KEY || "VAIVAIXXXI").trim();
const SESSION_SECRET = process.env.SESSION_SECRET || "THEGYM_CAREERBOOT_2026_SECRET";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "thegym";

let db = null;
let members = null;
let isMongoConnected = false;

// In-memory session store
const sessions = new Map();

// ----------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------
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
  return crypto.createHash("sha256").update(String(key).trim()).digest("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a).trim());
  const bufB = Buffer.from(String(b).trim());
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function newToken(role, identity = "") {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(role + "|" + identity + "|" + crypto.randomUUID())
    .digest("hex");
}

function session(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return sessions.get(token);
}

function guard(req, res, roles) {
  const s = session(req);
  if (!s || !roles.includes(s.role)) {
    json(res, 401, { error: "Unauthorized access" });
    return null;
  }
  return s;
}

// Growth % Calculation
function calculateGrowth(member) {
  const joining = Number(member.joiningWeight);
  const current = Number(member.currentWeight);
  const goal = Number(member.goalWeight);

  if (!joining || !goal || joining === goal || !Number.isFinite(current)) return 0;

  let percentage = 0;
  if (member.goalCategory === "Loss") {
    percentage = ((joining - current) / (joining - goal)) * 100;
  } else {
    percentage = ((current - joining) / (goal - joining)) * 100;
  }
  return Math.round(percentage * 10) / 10;
}

function cleanMember(member) {
  if (!member) return null;
  const output = { ...member, id: String(member._id), growth: calculateGrowth(member) };
  delete output._id;
  delete output.secretKeyHash;
  return output;
}

// ----------------------------------------------------------------
// MONGO DB CONNECTION SETUP
// ----------------------------------------------------------------
async function connectMongo() {
  try {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(DB_NAME);
    members = db.collection("members");
    await members.createIndex({ secretKeyHash: 1 }, { unique: true });
    isMongoConnected = true;
    console.log("MongoDB Connected Successfully to Database:", DB_NAME);
  } catch (err) {
    isMongoConnected = false;
    console.warn("MongoDB Offline Mode. Utilizing fallback memory/handlers.");
  }
}

// ----------------------------------------------------------------
// HTML & FRONTEND ENGINE
// ----------------------------------------------------------------
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

  body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: 
      radial-gradient(circle at 20% 20%, rgba(204, 255, 0, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(0, 230, 118, 0.05) 0%, transparent 40%),
      linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px;
    z-index: -1;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 32px;
    background: rgba(8, 12, 18, 0.95);
    border-bottom: 1px solid var(--border-line);
    backdrop-filter: blur(12px);
  }

  .logo-box {
    display: flex;
    align-items: center;
    gap: 12px;
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

  .card-4k {
    background: var(--card-bg);
    border: 1px solid var(--border-line);
    border-radius: 24px;
    padding: 32px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(204, 255, 0, 0.03);
    backdrop-filter: blur(16px);
    transition: transform 0.3s ease, border-color 0.3s ease;
  }

  .card-4k:hover {
    border-color: rgba(204, 255, 0, 0.4);
  }

  .nav-tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .tab-btn {
    padding: 12px 24px;
    border-radius: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-line);
    color: #fff;
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn.active {
    background: var(--lime);
    color: #000;
    box-shadow: 0 0 20px var(--lime-glow);
  }

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
    transition: all 0.2s;
  }

  input:focus, select:focus {
    border-color: var(--lime);
    box-shadow: 0 0 12px var(--lime-glow);
  }

  label {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  button.btn-action {
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, var(--lime), #99cc00);
    color: #000;
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
    font-size: 15px;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow: 0 8px 24px var(--lime-glow);
    transition: all 0.2s ease;
  }

  button.btn-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px var(--lime-glow);
  }

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

  .table-box {
    overflow-x: auto;
    margin-top: 16px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

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

  footer {
    text-align: center;
    padding: 24px 16px;
    background: rgba(4, 7, 12, 0.95);
    border-top: 1px solid var(--border-line);
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    letter-spacing: 0.5px;
  }

  footer span {
    color: var(--lime);
    font-weight: 700;
  }

  /* Gym Sticker Animations */
  .sticker-float {
    display: inline-block;
    animation: floatAnim 3s infinite ease-in-out;
  }

  @keyframes floatAnim {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(4deg); }
  }
</style>
</head>
<body>

<header>
  <div class="logo-box">
    <svg width="42" height="42" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ccff00" />
          <stop offset="100%" stop-color="#00e676" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="#0c121a" stroke="url(#tgGrad)" stroke-width="4"/>
      <path d="M 22 30 L 78 30 M 50 30 L 50 78" stroke="url(#tgGrad)" stroke-width="12" stroke-linecap="round" />
      <path d="M 68 45 L 78 45 C 78 68 62 78 48 78" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none" />
    </svg>
    <div class="brand-text">TheGym</div>
  </div>
  <div id="navRight"><span class="badge bg-green">SYSTEM READY</span></div>
</header>

<div class="wrapper" id="app">
  <!-- Dynamic Routing Target -->
</div>

<footer>
  TheGym <span>+91 70079 47859</span>, WhatsApp <span>+91 78958 32442</span>, ®CareerBoot ©2026
</footer>

<script>
var token = localStorage.getItem('tg_token');
var role = localStorage.getItem('tg_role');

function renderNav() {
  var el = document.getElementById('navRight');
  if (!el) return;
  if (token) {
    el.innerHTML = '<button onclick="logout()" class="tab-btn" style="padding:8px 16px;">LOGOUT</button>';
  } else {
    el.innerHTML = '<span class="badge bg-green">SYSTEM READY</span>';
  }
}

function renderLogin() {
  localStorage.removeItem('tg_token');
  localStorage.removeItem('tg_role');
  token = null; role = null;
  renderNav();

  document.getElementById('app').innerHTML =
    '<div class="card-4k" style="max-width:440px;margin:60px auto;text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:12px;" class="sticker-float">🏋️️‍♂️</div>' +
      '<h2 style="font-family:\'Orbitron\';color:var(--lime);margin-bottom:8px;">PORTAL ACCESS</h2>' +
      '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:24px;">Enter Secret Key to Access Your Portal</p>' +
      '<input type="password" id="keyInput" placeholder="ENTER SECRET KEY" style="text-align:center;letter-spacing:4px;font-size:18px;" autofocus>' +
      '<button class="btn-action" onclick="login()">VERIFY SECRET KEY →</button>' +
      '<div id="err" style="color:#ff6347;font-size:13px;margin-top:16px;font-weight:bold;"></div>' +
    '</div>';
}

function login() {
  var key = document.getElementById('keyInput').value.trim();
  var err = document.getElementById('err');
  if (!key) { err.textContent = 'Please enter a valid Secret Key'; return; }

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error);
    token = data.token;
    role = data.role;
    localStorage.setItem('tg_token', token);
    localStorage.setItem('tg_role', role);
    route();
  })
  .catch(function(e) {
    err.textContent = e.message;
  });
}

function logout() {
  renderLogin();
}

function showAdminPanel(tab) {
  renderNav();
  tab = tab || 'register';

  var contentHtml = '';
  if (tab === 'register') {
    var todayStr = new Date().toISOString().split('T')[0];
    contentHtml =
      '<form onsubmit="createMember(event)" class="card-4k">' +
        '<h3 style="color:var(--lime);font-family:\'Orbitron\';margin-bottom:20px;">CREATE NEW MEMBER RECORD</h3>' +
        '<div class="grid-2">' +
          '<div><label>Member Name</label><input type="text" id="mName" required placeholder="John Doe"></div>' +
          '<div><label>Assign Secret Key</label><input type="text" id="mKey" required placeholder="e.g. GYM123"></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div><label>Joining Date</label><input type="date" id="mJDate" value="' + todayStr + '" required></div>' +
          '<div><label>Joining Day Weight (kg)</label><input type="number" step="0.1" id="mJWeight" required placeholder="75.0"></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div><label>Goal Category</label><select id="mGoalCat"><option value="Loss">Weight Loss</option><option value="Gain">Weight Gain / Muscle</option></select></div>' +
          '<div><label>Goal Weight (kg)</label><input type="number" step="0.1" id="mGWeight" required placeholder="68.0"></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div><label>Member Fees</label><select id="mFee"><option value="500">₹500 / Month</option><option value="700">₹700 / Month</option></select></div>' +
          '<div><label>Contact Number</label><input type="text" id="mContact" required placeholder="+91 9876543210"></div>' +
        '</div>' +
        '<div><label>Last Fees Submission Date</label><input type="date" id="mFeeDate" value="' + todayStr + '" required></div>' +
        '<button type="submit" class="btn-action" style="margin-top:12px;">REGISTER MEMBER NOW 🔥</button>' +
        '<div id="regMsg" style="margin-top:12px;font-weight:bold;text-align:center;"></div>' +
      '</form>';
  } else {
    contentHtml =
      '<div class="card-4k">' +
        '<h3 style="color:var(--lime);font-family:\'Orbitron\';margin-bottom:20px;">MEMBERS PROFILE & CURRENT WEIGHT SHEET</h3>' +
        '<div id="profileList">Loading members...</div>' +
      '</div>';
    fetchMembersForAdmin();
  }

  document.getElementById('app').innerHTML =
    '<div>' +
      '<div class="nav-tabs">' +
        '<button class="tab-btn ' + (tab === 'register' ? 'active' : '') + '" onclick="showAdminPanel(\'register\')">REGISTER MEMBER</button>' +
        '<button class="tab-btn ' + (tab === 'profile' ? 'active' : '') + '" onclick="showAdminPanel(\'profile\')">MEMBERS PROFILE SHEET</button>' +
      '</div>' +
      contentHtml +
    '</div>';
}

function createMember(e) {
  e.preventDefault();
  var msg = document.getElementById('regMsg');
  var payload = {
    name: document.getElementById('mName').value,
    secretKey: document.getElementById('mKey').value,
    joiningDate: document.getElementById('mJDate').value,
    joiningWeight: document.getElementById('mJWeight').value,
    goalCategory: document.getElementById('mGoalCat').value,
    goalWeight: document.getElementById('mGWeight').value,
    fee: document.getElementById('mFee').value,
    contact: document.getElementById('mContact').value,
    lastFeeDate: document.getElementById('mFeeDate').value
  };

  fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error);
    msg.style.color = '#00e676';
    msg.textContent = 'Member Registered Successfully!';
    setTimeout(function() { showAdminPanel('profile'); }, 1000);
  })
  .catch(function(err) {
    msg.style.color = '#ff6347';
    msg.textContent = err.message;
  });
}

function fetchMembersForAdmin() {
  fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var container = document.getElementById('profileList');
    if (!data.members || !data.members.length) {
      container.innerHTML = '<p style="color:rgba(255,255,255,0.5);">No members registered yet.</p>';
      return;
    }

    var rows = data.members.map(function(m) {
      return '<tr>' +
        '<td><b>' + m.name + '</b></td>' +
        '<td>' + m.joiningDate + '</td>' +
        '<td>' + m.joiningWeight + ' kg</td>' +
        '<td><input type="number" step="0.1" value="' + (m.currentWeight || '') + '" style="width:100px;margin:0;padding:8px;" id="cw_' + m.id + '"></td>' +
        '<td><span class="badge bg-green">' + m.growth + '%</span></td>' +
        '<td><button onclick="updateWeight(\'' + m.id + '\')" class="tab-btn" style="padding:6px 12px;font-size:11px;">UPDATE</button></td>' +
      '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="table-box"><table>' +
        '<thead><tr><th>NAME</th><th>JOINING DATE</th><th>JOINING WEIGHT</th><th>CURRENT WEIGHT</th><th>GROWTH</th><th>ACTION</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  });
}

function updateWeight(id) {
  var val = document.getElementById('cw_' + id).value;
  fetch('/api/members/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ currentWeight: val })
  })
  .then(function(res) { return res.json(); })
  .then(function() {
    fetchMembersForAdmin();
  });
}

function showSupremeDashboard() {
  renderNav();
  fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var todayStr = new Date().toISOString().split('T')[0];

    var rows = (data.members || []).map(function(m, idx) {
      var lastFee = new Date(m.lastFeeDate);
      var today = new Date();
      var diffDays = Math.floor((today - lastFee) / (1000 * 60 * 60 * 24));

      var statusHtml = '';
      if (diffDays > 30) {
        statusHtml = '<span class="badge bg-red">' + (diffDays - 30) + ' Days Gone</span>';
      } else {
        var rem = 30 - diffDays;
        if (rem >= 20) statusHtml = '<span class="badge bg-green">' + rem + ' Days Balance</span>';
        else if (rem >= 11) statusHtml = '<span class="badge bg-yellow">' + rem + ' Days Balance</span>';
        else statusHtml = '<span class="badge bg-orange">' + rem + ' Days Balance</span>';
      }

      return '<tr>' +
        '<td><b>' + (idx + 1) + '</b></td>' +
        '<td><b>' + m.name + '</b></td>' +
        '<td>' + todayStr + '</td>' +
        '<td>₹' + m.fee + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td><span class="badge bg-green">' + m.growth + '%</span></td>' +
        '<td>' + m.contact + '</td>' +
      '</tr>';
    }).join('');

    document.getElementById('app').innerHTML =
      '<div class="card-4k">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;">' +
          '<div>' +
            '<h2 style="color:var(--lime);font-family:\'Orbitron\';">SUPREME ADMIN REPORT DASHBOARD</h2>' +
            '<p style="color:rgba(255,255,255,0.6);font-size:13px;">Live Member Financial & Performance Tracker</p>' +
          '</div>' +
          '<div class="badge bg-green" style="font-size:14px;">TODAY: ' + todayStr + '</div>' +
        '</div>' +
        '<div class="table-box">' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th>SL NO.</th>' +
                '<th>NAME</th>' +
                '<th>DATE</th>' +
                '<th>FEES</th>' +
                '<th>STATUS</th>' +
                '<th>GROWTH</th>' +
                '<th>CONTACT NUMBER</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + (rows || '<tr><td colspan="7">No records available</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  });
}

function showMemberDashboard() {
  renderNav();
  fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var m = data.member;
    document.getElementById('app').innerHTML =
      '<div class="card-4k" style="max-width:600px;margin:0 auto;text-align:center;">' +
        '<div style="font-size:54px;" class="sticker-float">⚡</div>' +
        '<h3 style="color:rgba(255,255,255,0.6);font-family:\'Orbitron\';letter-spacing:2px;font-size:12px;">MEMBER PERFORMANCE DASHBOARD</h3>' +
        '<h1 style="color:var(--lime);font-family:\'Orbitron\';font-size:36px;margin:12px 0;">' + m.name.toUpperCase() + '</h1>' +
        '<div class="grid-2" style="margin:24px 0;">' +
          '<div style="background:rgba(255,255,255,0.03);padding:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">' +
            '<div style="font-size:12px;color:rgba(255,255,255,0.5);">GOAL WEIGHT</div>' +
            '<div style="font-size:28px;font-weight:900;color:#fff;margin-top:4px;">' + m.goalWeight + ' kg</div>' +
            '<div class="badge bg-yellow" style="margin-top:8px;">' + m.goalCategory + '</div>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.03);padding:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">' +
            '<div style="font-size:12px;color:rgba(255,255,255,0.5);">TRANSFORMATION GROWTH</div>' +
            '<div style="font-size:28px;font-weight:900;color:var(--lime);margin-top:4px;">' + m.growth + '%</div>' +
            '<div class="badge bg-green" style="margin-top:8px;">ON TRACK</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:rgba(204,255,0,0.05);padding:16px;border-radius:14px;border:1px solid var(--border-line);color:var(--lime);font-weight:700;font-size:14px;">' +
          '💪 "Consistency is what transforms average into excellence!"' +
        '</div>' +
      '</div>';
  });
}

function route() {
  if (!token || !role) return renderLogin();
  if (role === 'admin') showAdminPanel('register');
  else if (role === 'supreme') showSupremeDashboard();
  else if (role === 'member') showMemberDashboard();
  else renderLogin();
}

window.onload = route;
</script>
</body>
</html>`;

  res.end(page);
}

// ----------------------------------------------------------------
// SERVER ROUTING & API ENDPOINTS
// ----------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    // Login Endpoint
    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const key = String(body.key || "").trim();
      let role = null, identity = "";

      if (safeEqual(key, SUPREME_KEY)) {
        role = "supreme";
        identity = "supreme";
      } else if (safeEqual(key, ADMIN_KEY)) {
        role = "admin";
        identity = "admin";
      } else if (members) {
        const hashed = hashKey(key);
        const member = await members.findOne({ secretKeyHash: hashed });
        if (member) {
          role = "member";
          identity = String(member._id);
        }
      }

      if (!role) return json(res, 401, { error: "Invalid Secret Key" });

      const tkn = newToken(role, identity);
      sessions.set(tkn, { role, identity });
      return json(res, 200, { token: tkn, role });
    }

    // Member List (Admin & Supreme)
    if (url.pathname === "/api/members" && req.method === "GET") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      let list = [];
      if (members) {
        list = await members.find({}).sort({ createdAt: 1 }).toArray();
      }
      return json(res, 200, { members: list.map(cleanMember) });
    }

    // Register Member (Admin)
    if (url.pathname === "/api/members" && req.method === "POST") {
      if (!guard(req, res, ["admin"])) return;
      const body = await readBody(req);

      if (!body.name || !body.secretKey) {
        return json(res, 400, { error: "Name and Secret Key are required" });
      }

      const doc = {
        name: String(body.name).trim(),
        secretKeyHash: hashKey(body.secretKey),
        joiningDate: body.joiningDate || new Date().toISOString().split("T")[0],
        joiningWeight: Number(body.joiningWeight) || 0,
        currentWeight: Number(body.joiningWeight) || 0,
        goalCategory: body.goalCategory === "Gain" ? "Gain" : "Loss",
        goalWeight: Number(body.goalWeight) || 0,
        fee: Number(body.fee) === 700 ? 700 : 500,
        contact: String(body.contact || "").trim(),
        lastFeeDate: body.lastFeeDate || new Date().toISOString().split("T")[0],
        createdAt: new Date()
      };

      if (members) {
        try {
          await members.insertOne(doc);
        } catch (e) {
          return json(res, 400, { error: "Secret Key already assigned to another member!" });
        }
      }

      return json(res, 201, { success: true });
    }

    // Update Current Weight (Admin)
    if (url.pathname.startsWith("/api/members/") && req.method === "PATCH") {
      if (!guard(req, res, ["admin"])) return;
      const id = url.pathname.replace("/api/members/", "");
      const body = await readBody(req);

      if (members && ObjectId.isValid(id)) {
        await members.updateOne(
          { _id: new ObjectId(id) },
          { $set: { currentWeight: Number(body.currentWeight) || 0 } }
        );
      }
      return json(res, 200, { success: true });
    }

    // Member Profile (Self)
    if (url.pathname === "/api/me" && req.method === "GET") {
      const s = guard(req, res, ["member"]);
      if (!s) return;

      let memberDoc = null;
      if (members && ObjectId.isValid(s.identity)) {
        memberDoc = await members.findOne({ _id: new ObjectId(s.identity) });
      }

      return json(res, 200, { member: cleanMember(memberDoc) });
    }

    // Default: Send HTML Single Page Application
    sendHTML(res);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "Internal Server Error" });
  }
});

// ----------------------------------------------------------------
// BOOTSTRAP SERVER & DATABASE
// ----------------------------------------------------------------
server.listen(PORT, () => {
  console.log("TheGym Portal running on http://localhost:" + PORT);
  connectMongo();
});
