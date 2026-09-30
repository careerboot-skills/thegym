// ================================================================
// THEGYM — COMPLETE FULL-FEATURED SINGLE FILE SYSTEM
// ================================================================

const http = require("http");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "SKTCB";
const SUPREME_KEY = process.env.SUPREME_KEY || "VAIVAIXXXI";
const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_THIS_SESSION_SECRET";
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
    console.log("MongoDB Connected:", DB_NAME);
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
  }
}

function sendHTML(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>TheGym — Full Portal</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #05070a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; padding: 12px; }
  .nav { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 16px; }
  .logo { font-weight: 900; letter-spacing: 2px; color: #b8ff3d; font-size: 20px; }
  .card { background: rgba(17, 22, 29, 0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 20px; max-width: 600px; margin: 0 auto 16px; }
  h1, h2 { font-size: 22px; margin-bottom: 12px; text-transform: uppercase; }
  p { color: #91a0ad; font-size: 13px; margin-bottom: 16px; line-height: 1.4; }
  input, select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: #080b10; color: #fff; font-size: 15px; margin-bottom: 10px; outline: none; }
  input:focus, select:focus { border-color: #b8ff3d; }
  button { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #b8ff3d; color: #05070a; font-weight: 800; font-size: 14px; cursor: pointer; margin-top: 4px; }
  .btn-sub { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); margin-top: 8px; }
  .btn-danger { background: #ff4d4d; color: #fff; }
  .err { color: #ff6657; font-size: 12px; margin-top: 8px; text-align: center; }
  .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: rgba(184,255,61,0.15); color: #b8ff3d; }
  .tag-red { background: rgba(255,77,77,0.15); color: #ff4d4d; }
  .table-wrap { overflow-x: auto; margin-top: 10px; }
  table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }
  th { color: #91a0ad; font-size: 10px; text-transform: uppercase; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
</head>
<body>

<div class="nav">
  <div class="logo">THEGYM</div>
  <div id="nav-actions"></div>
</div>

<div id="app"></div>

<script>
let token = localStorage.getItem('tg_token');
let role = localStorage.getItem('tg_role');

function setNav() {
  const el = document.getElementById('nav-actions');
  if (token) {
    el.innerHTML = '<button onclick="logout()" class="btn-sub" style="width:auto;padding:5px 10px;margin:0;">Logout (' + role + ')</button>';
  } else {
    el.innerHTML = '<span class="tag">LOGIN</span>';
  }
}

function landing() {
  setNav();
  document.getElementById('app').innerHTML = \`
    <div class="card" style="text-align:center;max-width:380px;">
      <h1>THEGYM SYSTEM</h1>
      <p>Enter Secret Key to access Admin, Supreme, or Member Dashboard.</p>
      <input type="password" id="key" placeholder="SECRET KEY" autocomplete="off">
      <button onclick="doLogin()">ACCESS DASHBOARD →</button>
      <div id="err" class="err"></div>
    </div>
  \`;
}

async function doLogin() {
  const key = document.getElementById('key').value.trim();
  const err = document.getElementById('err');
  err.textContent = '';
  if (!key) return err.textContent = 'Key required';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
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

async function showAdmin() {
  setNav();
  document.getElementById('app').innerHTML = \`
    <div class="card">
      <h2>MANAGEMENT PANEL (\${role.toUpperCase()})</h2>
      <div class="grid-2">
        <button onclick="showRegister()">+ ADD MEMBER</button>
        <button onclick="showMembers()" class="btn-sub">MEMBER SHEET</button>
      </div>
    </div>
    <div id="admin-view"></div>
  \`;
  showMembers();
}

function showRegister() {
  document.getElementById('admin-view').innerHTML = \`
    <div class="card">
      <h2>NEW MEMBER REGISTRATION</h2>
      <form onsubmit="handleReg(event)">
        <input name="name" placeholder="Member Full Name" required>
        <input name="secretKey" placeholder="Assign Secret Key" required>
        <div class="grid-2">
          <input type="date" name="joiningDate" required>
          <input type="number" step="0.1" name="joiningWeight" placeholder="Joining Wt (kg)" required>
        </div>
        <div class="grid-2">
          <select name="goalCategory"><option value="Loss">Weight Loss</option><option value="Gain">Weight Gain</option></select>
          <input type="number" step="0.1" name="goalWeight" placeholder="Goal Wt (kg)" required>
        </div>
        <div class="grid-2">
          <select name="fee"><option value="500">Fee: ₹500</option><option value="700">Fee: ₹700</option></select>
          <input name="contact" placeholder="Contact Mobile" required>
        </div>
        <input type="date" name="lastFeeDate" title="Last Fee Paid Date" required>
        <button type="submit">CREATE MEMBER PROFILE</button>
      </form>
      <div id="err" class="err"></div>
    </div>
  \`;
}

async function handleReg(e) {
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
    alert('Member Created Successfully!');
    showMembers();
  } catch (err) {
    document.getElementById('err').textContent = err.message;
  }
}

async function showMembers() {
  try {
    const res = await fetch('/api/members', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    let rows = data.members.map(m => \`
      <tr>
        <td><b>\${m.name}</b><br><small style="color:#91a0ad">\${m.contact}</small></td>
        <td>\${m.currentWeight} / \${m.goalWeight} kg</td>
        <td><span class="tag">\${m.growth}%</span></td>
        <td>₹\${m.fee}</td>
        <td>
          <button onclick="updateWeight('\${m.id}', '\${m.currentWeight}')" style="padding:4px 8px;font-size:11px;width:auto;">Weight</button>
          <button onclick="renewFee('\${m.id}')" class="btn-sub" style="padding:4px 8px;font-size:11px;width:auto;margin:0;">Fee</button>
          \${role === 'supreme' ? \`<button onclick="deleteMember('\${m.id}')" class="btn-danger" style="padding:4px 8px;font-size:11px;width:auto;margin:0;">X</button>\` : ''}
        </td>
      </tr>
    \`).join('');

    document.getElementById('admin-view').innerHTML = \`
      <div class="card" style="max-width:100%;">
        <h2>MEMBER DIRECTORY (\${data.members.length})</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Weight (Cur/Goal)</th><th>Growth</th><th>Fee</th><th>Actions</th></tr></thead>
            <tbody>\${rows || '<tr><td colspan="5">No active members found</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (e) {
    alert(e.message);
  }
}

async function updateWeight(id, cur) {
  const weight = prompt('Enter New Current Weight (kg):', cur);
  if (!weight) return;
  try {
    const res = await fetch('/api/members/' + id + '/weight', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ currentWeight: Number(weight) })
    });
    if (!res.ok) throw new Error('Update failed');
    showMembers();
  } catch (e) { alert(e.message); }
}

async function renewFee(id) {
  const date = prompt('Enter Fee Payment Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
  if (!date) return;
  try {
    const res = await fetch('/api/members/' + id + '/fee', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ lastFeeDate: date })
    });
    if (!res.ok) throw new Error('Fee update failed');
    alert('Fee Updated!');
    showMembers();
  } catch (e) { alert(e.message); }
}

async function deleteMember(id) {
  if (!confirm('Are you sure you want to delete this member?')) return;
  try {
    const res = await fetch('/api/members/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Delete failed');
    showMembers();
  } catch (e) { alert(e.message); }
}

async function showMember() {
  setNav();
  try {
    const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const m = data.member;
    
    document.getElementById('app').innerHTML = \`
      <div class="card" style="text-align:center;">
        <h2>WELCOME, \${m.name.toUpperCase()}</h2>
        <p>Goal: <b>\${m.goalCategory}</b> | Target: <b>\${m.goalWeight} kg</b></p>
        
        <div style="background:rgba(184,255,61,0.08);border:1px solid rgba(184,255,61,0.3);border-radius:12px;padding:20px;margin:16px 0;">
          <div style="font-size:11px;color:#91a0ad;text-transform:uppercase;">Overall Goal Progress</div>
          <div style="font-size:52px;font-weight:900;color:#b8ff3d;">\${m.growth}%</div>
        </div>

        <div class="grid-2" style="text-align:left;">
          <div style="background:#080b10;padding:12px;border-radius:8px;">
            <small style="color:#91a0ad">Joining Weight</small>
            <div style="font-weight:bold;font-size:18px;">\${m.joiningWeight} kg</div>
          </div>
          <div style="background:#080b10;padding:12px;border-radius:8px;">
            <small style="color:#91a0ad">Current Weight</small>
            <div style="font-weight:bold;font-size:18px;color:#b8ff3d;">\${m.currentWeight} kg</div>
          </div>
        </div>

        <div style="margin-top:16px;text-align:left;background:#080b10;padding:12px;border-radius:8px;">
          <small style="color:#91a0ad">Monthly Fee Status</small>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
            <b>₹\${m.fee} / month</b>
            <span class="tag">Paid: \${m.lastFeeDate}</span>
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
  if (role === 'admin' || role === 'supreme') showAdmin();
  else if (role === 'member') showMember();
  else landing();
}

route();
</script>
</body>
</html>`;

  res.end(page);
}

// ================================================================
// SERVER ROUTING & API ENDPOINTS
// ================================================================

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname.startsWith("/api/") && !members) {
      return json(res, 503, { error: "Database connecting, please retry in a few seconds..." });
    }

    // LOGIN
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

    // LIST MEMBERS
    if (url.pathname === "/api/members" && req.method === "GET") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const list = await members.find({}).sort({ createdAt: -1 }).toArray();
      return json(res, 200, { members: list.map(clean) });
    }

    // ADD MEMBER
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

    // UPDATE WEIGHT
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

    // UPDATE FEE DATE
    if (url.pathname.match(/^\/api\/members\/[a-f0-9]{24}\/fee$/) && req.method === "PATCH") {
      if (!guard(req, res, ["admin", "supreme"])) return;
      const id = url.pathname.split("/")[3];
      const body = await readBody(req);
      await members.updateOne(
        { _id: new ObjectId(id) },
        { $set: { lastFeeDate: String(body.lastFeeDate), updatedAt: new Date() } }
      );
      return json(res, 200, { ok: true });
    }

    // DELETE MEMBER (Supreme Only)
    if (url.pathname.match(/^\/api\/members\/[a-f0-9]{24}$/) && req.method === "DELETE") {
      if (!guard(req, res, ["supreme"])) return;
      const id = url.pathname.split("/")[3];
      await members.deleteOne({ _id: new ObjectId(id) });
      return json(res, 200, { ok: true });
    }

    // MEMBER SELF PROFILE
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
  console.log(`TheGym server listening on port ${PORT}`);
  connectMongo();
});
