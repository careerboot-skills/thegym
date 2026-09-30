// ================================================================
// THEGYM — FULLY INTEGRATED PORTAL (FIXED SUPREME LOGIN)
// Single-file Node.js + HTTP + MongoDB Portal
// ================================================================

const http = require("http");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = String(process.env.ADMIN_KEY || "SKTCB").trim();
const SUPREME_KEY = String(process.env.SUPREME_KEY || "VAIVAIXXXI").trim();
const SESSION_SECRET = process.env.SESSION_SECRET || "THEGYM_CAREERBOOT_2026_SECRET";
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "thegym";

let db = null;
let members = null;
let isMongoConnected = false;
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
  return crypto.createHash("sha256").update(String(key).trim()).digest("hex");
}

// Safe string comparison without crashing timingSafeEqual
function safeEqual(inputKey, targetKey) {
  const strA = String(inputKey).trim();
  const strB = String(targetKey).trim();
  
  if (strA.length !== strB.length) return false;
  
  const bufA = Buffer.from(strA);
  const bufB = Buffer.from(strB);
  
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
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
  if (!MONGODB_URI) {
    console.warn("MongoDB Warning: MONGODB_URI environment variable is missing.");
    return;
  }
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
    console.error("MongoDB Connection Failed:", err.message);
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

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 32px;
    background: rgba(8, 12, 18, 0.95);
    border-bottom: 1px solid var(--border-line);
  }

  .brand-text {
    font-family: 'Orbitron', sans-serif;
    font-size: 24px;
    font-weight: 900;
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
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
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
  }

  input:focus { border-color: var(--lime); }

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
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-line);
    color: #fff;
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

  .table-box { overflow-x: auto; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th { padding: 14px 16px; color: rgba(255,255,255,0.6); font-family: 'Orbitron', sans-serif; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); white-space: nowrap; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

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

<header>
  <div class="brand-text">TheGym</div>
  <div id="navRight"><span class="badge bg-green">SYSTEM READY</span></div>
</header>

<div class="wrapper" id="app">
  <div class="card-4k" style="max-width:440px;margin:60px auto;text-align:center;">
    <h2 style="color:var(--lime);margin-bottom:8px;">PORTAL ACCESS</h2>
    <p style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:24px;">Enter Secret Key to Access Portal</p>
    <input type="password" id="keyInput" placeholder="ENTER SECRET KEY" style="text-align:center;letter-spacing:4px;font-size:18px;" autofocus>
    <button id="btnVerify" onclick="login()">VERIFY SECRET KEY →</button>
    <div id="err" style="color:#ff6347;font-size:13px;margin-top:16px;font-weight:bold;"></div>
  </div>
</div>

<footer>
  TheGym +91 70079 47859, WhatsApp +91 78958 32442, ®CareerBoot ©2026
</footer>

<script>
var token = localStorage.getItem('tg_token');
var role = localStorage.getItem('tg_role');

function renderNav() {
  var el = document.getElementById('navRight');
  if (!el) return;
  if (token) {
    el.innerHTML = '<button onclick="logout()" style="padding:10px 20px;width:auto;background:transparent;color:#fff;border:1px solid var(--border-line);">LOGOUT</button>';
  } else {
    el.innerHTML = '<span class="badge bg-green">SYSTEM READY</span>';
  }
}

function renderLogin() {
  localStorage.removeItem('tg_token');
  localStorage.removeItem('tg_role');
  token = null; role = null;
  renderNav();

  var app = document.getElementById('app');
  if (!app) return;

  app.innerHTML =
    '<div class="card-4k" style="max-width:440px;margin:60px auto;text-align:center;">' +
      '<h2 style="color:var(--lime);margin-bottom:8px;">PORTAL ACCESS</h2>' +
      '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:24px;">Enter Secret Key to Access Portal</p>' +
      '<input type="password" id="keyInput" placeholder="ENTER SECRET KEY" style="text-align:center;letter-spacing:4px;font-size:18px;" autofocus>' +
      '<button id="btnVerify" onclick="login()">VERIFY SECRET KEY →</button>' +
      '<div id="err" style="color:#ff6347;font-size:13px;margin-top:16px;font-weight:bold;"></div>' +
    '</div>';
}

function login() {
  var keyInput = document.getElementById('keyInput');
  var key = keyInput ? keyInput.value.trim() : '';
  var err = document.getElementById('err');
  var btn = document.getElementById('btnVerify');

  if (err) err.textContent = '';
  if (!key) { if (err) err.textContent = 'Please enter a valid Secret Key'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'VERIFYING...'; }

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (btn) { btn.disabled = false; btn.textContent = 'VERIFY SECRET KEY →'; }
    if (data.error) throw new Error(data.error);
    token = data.token;
    role = data.role;
    localStorage.setItem('tg_token', token);
    localStorage.setItem('tg_role', role);
    route();
  })
  .catch(function(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'VERIFY SECRET KEY →'; }
    if (err) err.textContent = e.message;
  });
}

function logout() {
  renderLogin();
}

function showSupremeDashboard() {
  renderNav();
  fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) {
    if (res.status === 401) { renderLogin(); return null; }
    return res.json();
  })
  .then(function(data) {
    if (!data) return;
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

    var app = document.getElementById('app');
    if (app) {
      app.innerHTML =
        '<div class="card-4k">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;">' +
            '<div>' +
              '<h2 style="color:var(--lime);">SUPREME ADMIN REPORT DASHBOARD</h2>' +
              '<p style="color:rgba(255,255,255,0.6);font-size:13px;">Live Member Tracker</p>' +
            '</div>' +
            '<div class="badge bg-green">TODAY: ' + todayStr + '</div>' +
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
    }
  });
}

function route() {
  if (!token || !role) return renderLogin();
  if (role === 'supreme') showSupremeDashboard();
  else renderLogin();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', route);
} else {
  route();
}
</script>
</body>
</html>`;

  res.end(page);
}

// ================================================================
// SERVER ROUTES
// ================================================================
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const key = String(body.key || "").trim();
      let role = null, identity = "";

      if (!key) {
        return json(res, 400, { error: "Key field cannot be empty" });
      }

      // Check Supreme Key
      if (safeEqual(key, SUPREME_KEY)) {
        role = "supreme";
        identity = "supreme";
        console.log("-> Supreme Login Successful");
      }
      // Check Admin Key
      else if (safeEqual(key, ADMIN_KEY)) {
        role = "admin";
        identity = "admin";
        console.log("-> Admin Login Successful");
      }
      // Check Member Key in MongoDB
      else if (members) {
        const hashed = hashKey(key);
        const member = await members.findOne({ secretKeyHash: hashed });
        if (member) {
          role = "member";
          identity = String(member._id);
          console.log("-> Member Login Successful:", member.name);
        }
      }

      if (!role) {
        console.log("-> Login Attempt Failed for Key:", key);
        return json(res, 401, { error: "Invalid Secret Key" });
      }

      const tkn = newToken(role, identity);
      sessions.set(tkn, { role, identity });
      return json(res, 200, { token: tkn, role });
    }

    if (url.pathname === "/api/members" && req.method === "GET") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      let list = [];
      if (members) {
        list = await members.find({}).sort({ createdAt: 1 }).toArray();
      }
      return json(res, 200, { members: list.map(cleanMember) });
    }

    sendHTML(res);
  } catch (err) {
    console.error("Server Execution Error:", err);
    json(res, 500, { error: "Internal Server Error" });
  }
});

server.listen(PORT, () => {
  console.log("TheGym Portal running on http://localhost:" + PORT);
  console.log("Supreme Key Configured:", SUPREME_KEY);
  connectMongo();
});
