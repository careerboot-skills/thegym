// ================================================================
// THEGYM — FORCE INPUT PORTAL
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
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
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
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

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
  }

  .top-nav {
    display: flex;
    justify-space: space-between;
    align-items: center;
    padding: 16px 24px;
    background: rgba(10, 14, 22, 0.95);
    border-bottom: 1px solid rgba(184, 255, 61, 0.2);
  }
  .brand-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #fff;
    letter-spacing: 2px;
  }

  .main-wrapper {
    flex: 1;
    padding: 24px 16px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .card-4k {
    background: rgba(15, 21, 32, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 28px;
    margin-bottom: 24px;
  }

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
  }
  input:focus, select:focus { border-color: #b8ff3d; }

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
  }

  .btn-sub {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
  }

  .status-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 800;
  }
  .status-green { background: rgba(0, 230, 118, 0.2); color: #00e676; border: 1px solid #00e676; }
  .status-yellow { background: rgba(255, 214, 0, 0.2); color: #ffd600; border: 1px solid #ffd600; }
  .status-orange { background: rgba(255, 145, 0, 0.2); color: #ff9100; border: 1px solid #ff9100; }
  .status-red { background: rgba(255, 99, 71, 0.25); color: #ff6347; border: 1px solid #ff6347; }

  .table-responsive { overflow-x: auto; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
  th { padding: 12px; background: rgba(255,255,255,0.03); color: #91a0ad; font-family: 'Orbitron', sans-serif; font-size: 11px; }
  td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media(max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<div class="top-nav">
  <div class="brand-title">THEGYM</div>
  <div id="nav-btn"></div>
</div>

<div class="main-wrapper" id="app"></div>

<script>
// FORCE CLEAR UNRELIABLE LOCAL STORAGE ON INITIAL LOAD IF UNVERIFIED
var token = localStorage.getItem('tg_token');
var role = localStorage.getItem('tg_role');

function renderNav() {
  var el = document.getElementById('nav-btn');
  if (token) {
    el.innerHTML = '<button onclick="logout()" class="btn-sub" style="width:auto;padding:8px 16px;">LOGOUT</button>';
  } else {
    el.innerHTML = '<span class="status-badge status-green">PORTAL ONLINE</span>';
  }
}

function renderLoginBox() {
  localStorage.removeItem('tg_token');
  localStorage.removeItem('tg_role');
  token = null;
  role = null;
  renderNav();

  document.getElementById('app').innerHTML = 
    '<div class="card-4k" style="max-width:420px;margin:40px auto;text-align:center;">' +
      '<h1 style="font-size:24px;color:#b8ff3d;margin-bottom:8px;font-family:\'Orbitron\';">SECRET KEY ACCESS</h1>' +
      '<p style="color:#91a0ad;font-size:13px;margin-bottom:20px;">Enter your assigned Secret Key below:</p>' +
      '<input type="password" id="keyInput" placeholder="ENTER SECRET KEY" style="text-align:center;letter-spacing:3px;" autofocus>' +
      '<button onclick="doLogin()">VERIFY KEY →</button>' +
      '<div id="err" style="color:#ff6347;font-size:13px;margin-top:14px;"></div>' +
    '</div>';
}

function doLogin() {
  var inputEl = document.getElementById('keyInput');
  if (!inputEl) return;
  var keyVal = inputEl.value.trim();
  var errEl = document.getElementById('err');
  errEl.textContent = '';
  if (!keyVal) { errEl.textContent = 'Secret key is required'; return; }

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: keyVal })
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
    errEl.textContent = e.message;
  });
}

function logout() {
  renderLoginBox();
}

function showAdminPanel() {
  renderNav();
  document.getElementById('app').innerHTML = 
    '<div class="card-4k">' +
      '<h2 style="color:#b8ff3d;margin-bottom:16px;font-family:\'Orbitron\';">ADMIN PANEL</h2>' +
      '<div class="grid-2">' +
        '<button onclick="showRegisterForm()">MEMBERS REGISTER PAGE</button>' +
        '<button onclick="showMembersSheet()" class="btn-sub">MEMBERS PROFILE PAGE</button>' +
      '</div>' +
    '</div>' +
    '<div id="admin-content"></div>';
  showMembersSheet();
}

function showRegisterForm() {
  document.getElementById('admin-content').innerHTML = 
    '<div class="card-4k" style="max-width:650px;margin:0 auto;">' +
      '<h3 style="margin-bottom:20px;font-size:18px;font-family:\'Orbitron\';">NEW MEMBER REGISTRATION</h3>' +
      '<form onsubmit="handleRegister(event)">' +
        '<input name="name" placeholder="Member Full Name" required>' +
        '<input name="secretKey" placeholder="Assign Secret Key" required>' +
        '<div class="grid-2">' +
          '<div><label style="font-size:11px;color:#91a0ad;">Joining Date</label><input type="date" name="joiningDate" required></div>' +
          '<div><label style="font-size:11px;color:#91a0ad;">Joining Day Weight (kg)</label><input type="number" step="0.1" name="joiningWeight" placeholder="e.g. 75.5" required></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div><label style="font-size:11px;color:#91a0ad;">Goal Category</label><select name="goalCategory"><option value="Loss">Weight Loss</option><option value="Gain">Weight Gain</option></select></div>' +
          '<div><label style="font-size:11px;color:#91a0ad;">Goal Weight (kg)</label><input type="number" step="0.1" name="goalWeight" placeholder="e.g. 68.0" required></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div><label style="font-size:11px;color:#91a0ad;">Members Fees</label><select name="fee"><option value="500">₹500</option><option value="700">₹700</option></select></div>' +
          '<div><label style="font-size:11px;color:#91a0ad;">Contact Number</label><input name="contact" placeholder="Mobile Number" required></div>' +
        '</div>' +
        '<div><label style="font-size:11px;color:#91a0ad;">Last Fees Submission Date</label><input type="date" name="lastFeeDate" required></div>' +
        '<button type="submit" style="margin-top:10px;">REGISTER MEMBER</button>' +
      '</form>' +
      '<div id="err" style="color:#ff6347;font-size:13px;margin-top:10px;"></div>' +
    '</div>';
}

function handleRegister(e) {
  e.preventDefault();
  var form = e.target;
  var body = {
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

  fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body)
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error);
    alert('Member Registered Successfully!');
    showMembersSheet();
  })
  .catch(function(err) {
    document.getElementById('err').textContent = err.message;
  });
}

function showMembersSheet() {
  fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) {
    if (res.status === 401) { renderLoginBox(); return null; }
    return res.json();
  })
  .then(function(data) {
    if (!data) return;
    if (data.error) throw new Error(data.error);

    var rows = data.members.map(function(m) {
      return '<tr>' +
        '<td><b>' + m.name + '</b></td>' +
        '<td>' + m.joiningDate + '</td>' +
        '<td>' + m.joiningWeight + ' kg</td>' +
        '<td><b>' + m.currentWeight + ' kg</b> <button onclick="editWeight(\'' + m.id + '\', \'' + m.currentWeight + '\')" style="padding:4px 8px;font-size:10px;width:auto;display:inline-block;margin-left:6px;">EDIT</button></td>' +
        '<td><span class="status-badge status-green">' + m.growth + '%</span></td>' +
      '</tr>';
    }).join('');

    document.getElementById('admin-content').innerHTML = 
      '<div class="card-4k">' +
        '<h3 style="font-family:\'Orbitron\';margin-bottom:12px;">MEMBERS PROFILE SHEET</h3>' +
        '<div class="table-responsive">' +
          '<table>' +
            '<thead><tr><th>Name</th><th>Joining Date</th><th>Joining Weight</th><th>Current Weight</th><th>Growth Status (%)</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="5">No members registered yet</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  });
}

function editWeight(id, oldWt) {
  var weight = prompt('Enter Current Day Weight (kg):', oldWt);
  if (!weight) return;
  fetch('/api/members/' + id + '/weight', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ currentWeight: Number(weight) })
  })
  .then(function(res) { return res.json(); })
  .then(function() { showMembersSheet(); });
}

function showSupremeDashboard() {
  renderNav();
  fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) {
    if (res.status === 401) { renderLoginBox(); return null; }
    return res.json();
  })
  .then(function(data) {
    if (!data) return;
    if (data.error) throw new Error(data.error);
    var todayStr = new Date().toISOString().split('T')[0];

    var rows = data.members.map(function(m, index) {
      var lastFee = new Date(m.lastFeeDate);
      var today = new Date();
      var diffDays = Math.floor((today - lastFee) / (1000 * 60 * 60 * 24));
      
      var statusHtml = '';
      if (diffDays > 30) {
        statusHtml = '<span class="status-badge status-red">' + (diffDays - 30) + ' Days Gone</span>';
      } else {
        var rem = 30 - diffDays;
        if (rem >= 20) statusHtml = '<span class="status-badge status-green">' + rem + ' Days Balance</span>';
        else if (rem >= 11) statusHtml = '<span class="status-badge status-yellow">' + rem + ' Days Balance</span>';
        else statusHtml = '<span class="status-badge status-orange">' + rem + ' Days Balance</span>';
      }

      return '<tr>' +
        '<td><b>' + (index + 1) + '</b></td>' +
        '<td><b>' + m.name + '</b></td>' +
        '<td>' + todayStr + '</td>' +
        '<td>₹' + m.fee + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td><span class="status-badge status-green">' + m.growth + '%</span></td>' +
        '<td>' + m.contact + '</td>' +
      '</tr>';
    }).join('');

    document.getElementById('app').innerHTML = 
      '<div class="card-4k">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
          '<div><h2 style="color:#b8ff3d;font-family:\'Orbitron\';">SUPREME ADMIN REPORT DASHBOARD</h2><p style="color:#91a0ad;font-size:13px;">Daily-to-Monthly Live Tracking System</p></div>' +
          '<div class="status-badge status-green">TODAY: ' + todayStr + '</div>' +
        '</div>' +
        '<div class="table-responsive">' +
          '<table>' +
            '<thead><tr><th>SL NO.</th><th>NAME</th><th>DATE</th><th>FEES</th><th>STATUS</th><th>GROWTH</th><th>CONTACT NUMBER</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="7">No report data available</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  });
}

function showMemberPerformance() {
  renderNav();
  fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
  .then(function(res) {
    if (res.status === 401) { renderLoginBox(); return null; }
    return res.json();
  })
  .then(function(data) {
    if (!data) return;
    if (data.error) throw new Error(data.error);
    var m = data.member;

    document.getElementById('app').innerHTML = 
      '<div class="card-4k" style="text-align:center;max-width:600px;margin:20px auto;">' +
        '<div style="font-size:12px;letter-spacing:2px;color:#b8ff3d;font-family:\'Orbitron\';">MEMBER PERFORMANCE DASHBOARD</div>' +
        '<h1 style="font-size:32px;margin:12px 0 20px;color:#fff;">' + m.name.toUpperCase() + '</h1>' +
        '<div style="background:rgba(5,8,14,0.9);border-radius:16px;padding:24px;border:1px solid rgba(184,255,61,0.3);margin-bottom:24px;">' +
          '<div style="font-size:12px;color:#91a0ad;margin-bottom:8px;">GROWTH STATUS</div>' +
          '<div style="font-size:64px;font-weight:900;color:#b8ff3d;font-family:\'Orbitron\';">' + m.growth + '%</div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div style="background:rgba(5,8,14,0.8);padding:16px;border-radius:12px;">' +
            '<div style="font-size:11px;color:#91a0ad;">GOAL CATEGORY</div>' +
            '<div style="font-size:18px;font-weight:bold;color:#fff;margin-top:4px;">' + m.goalCategory + '</div>' +
          '</div>' +
          '<div style="background:rgba(5,8,14,0.8);padding:16px;border-radius:12px;">' +
            '<div style="font-size:11px;color:#91a0ad;">TARGET GOAL WEIGHT</div>' +
            '<div style="font-size:18px;font-weight:bold;color:#b8ff3d;margin-top:4px;">' + m.goalWeight + ' kg</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  });
}

function route() {
  if (!token || !role) { renderLoginBox(); return; }
  if (role === 'supreme') showSupremeDashboard();
  else if (role === 'admin') showAdminPanel();
  else if (role === 'member') showMemberPerformance();
  else renderLoginBox();
}

// ALWAYS START AT LOGIN BOX UNLESS EXPLICITLY VALIDATED
renderLoginBox();
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

    if (url.pathname === "/api/members" && req.method === "GET") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const list = await members.find({}).sort({ createdAt: 1 }).toArray();
      return json(res, 200, { members: list.map(clean) });
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
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await members.insertOne(member);
      return json(res, 201, { member: clean({ ...member, _id: result.insertedId }) });
    }

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

    if (url.pathname === "/api/me" && req.method === "GET") {
      const s = guard(req, res, ["member"]);
      if (!s) return;
      const member = await members.findOne({ _id: new ObjectId(s.identity) });
      return json(res, 200, { member: clean(member) });
    }

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
  console.log(`TheGym Portal running on port ${PORT}`);
  connectMongo();
});
