// ================================================================
// THEGYM — PREMIUM GYM MANAGEMENT + MEMBER PERFORMANCE SYSTEM
// ================================================================
// SINGLE FILE APPLICATION
//
// GitHub:
//   server.js
//
// Render:
//   Build Command: npm install mongodb
//   Start Command: node server.js
//
// Required Environment Variables:
//
//   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
//   DB_NAME=thegym
//   ADMIN_KEY=SKTCB
//   SUPREME_KEY=VAIVAIXXXI
//   SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
//
// PORT is automatically supplied by Render.
//
// ================================================================

const http = require("http");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

// ================================================================
// CONFIGURATION
// ================================================================

const PORT = Number(process.env.PORT || 3000);

const ADMIN_KEY =
  process.env.ADMIN_KEY || "SKTCB";

const SUPREME_KEY =
  process.env.SUPREME_KEY || "VAIVAIXXXI";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "CHANGE_THIS_SESSION_SECRET_IN_RENDER";

const MONGODB_URI =
  process.env.MONGODB_URI || "";

const DB_NAME =
  process.env.DB_NAME || "thegym";


// ================================================================
// PRODUCTION CHECKS
// ================================================================

if (!MONGODB_URI) {
  console.error(
    "ERROR: MONGODB_URI is missing."
  );

  console.error(
    "Add MONGODB_URI in Render Environment Variables."
  );

  process.exit(1);
}

if (
  SESSION_SECRET ===
  "CHANGE_THIS_SESSION_SECRET_IN_RENDER"
) {
  console.warn(
    "WARNING: Set a strong SESSION_SECRET in Render."
  );
}


// ================================================================
// DATABASE / SESSION STATE
// ================================================================

let db = null;
let members = null;

const sessions = new Map();


// ================================================================
// JSON RESPONSE
// ================================================================

function json(res, status, data) {

  res.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8",

    "Cache-Control":
      "no-store",

    "X-Content-Type-Options":
      "nosniff"
  });

  res.end(
    JSON.stringify(data)
  );
}


// ================================================================
// REQUEST BODY
// ================================================================

const readBody = req =>
  new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {

      body += chunk;

      if (body.length > 1000000) {
        req.destroy();
      }

    });

    req.on("end", () => {

      try {

        resolve(
          body
            ? JSON.parse(body)
            : {}
        );

      } catch (error) {

        reject(error);

      }

    });

    req.on("error", reject);

  });


// ================================================================
// SECURITY HELPERS
// ================================================================

function hashKey(key) {

  return crypto
    .createHash("sha256")
    .update(String(key))
    .digest("hex");

}


function safeEqual(a, b) {

  const x =
    Buffer.from(String(a));

  const y =
    Buffer.from(String(b));

  return (
    x.length === y.length &&
    crypto.timingSafeEqual(x, y)
  );

}


function newToken(
  role,
  identity = ""
) {

  return crypto
    .createHmac(
      "sha256",
      SESSION_SECRET
    )
    .update(
      role +
      "|" +
      identity +
      "|" +
      crypto.randomUUID()
    )
    .digest("hex");

}


function session(req) {

  return sessions.get(
    (req.headers.authorization || "")
      .replace(
        /^Bearer\s+/i,
        ""
      )
  );

}


function guard(
  req,
  res,
  roles
) {

  const s = session(req);

  if (
    !s ||
    !roles.includes(s.role)
  ) {

    json(
      res,
      401,
      {
        error:
          "Unauthorized"
      }
    );

    return null;
  }

  return s;
}


// ================================================================
// GROWTH CALCULATION
// ================================================================

function growth(member) {

  const joining =
    Number(member.joiningWeight);

  const current =
    Number(member.currentWeight);

  const goal =
    Number(member.goalWeight);

  if (
    !joining ||
    !goal ||
    joining === goal ||
    !Number.isFinite(current)
  ) {

    return 0;

  }

  let percentage;

  if (
    member.goalCategory ===
    "Loss"
  ) {

    percentage =
      ((joining - current) /
        (joining - goal)) *
      100;

  } else {

    percentage =
      ((current - joining) /
        (goal - joining)) *
      100;

  }

  return Math.round(
    percentage * 10
  ) / 10;

}


// ================================================================
// CLEAN DATABASE OBJECT
// ================================================================

function clean(member) {

  if (!member) {
    return null;
  }

  const output = {
    ...member,

    id:
      String(member._id),

    growth:
      growth(member)
  };

  delete output._id;

  // Never send the actual member Secret Key hash.
  delete output.secretKeyHash;

  return output;

}


// ================================================================
// CONNECT MONGODB
// ================================================================

async function connectMongo() {

  const client =
    new MongoClient(
      MONGODB_URI,
      {
        serverSelectionTimeoutMS:
          10000,

        maxPoolSize:
          10
      }
    );

  await client.connect();

  db =
    client.db(DB_NAME);

  members =
    db.collection(
      "members"
    );

  await members.createIndex(
    {
      secretKeyHash: 1
    },
    {
      unique: true
    }
  );

  await members.createIndex(
    {
      contact: 1
    }
  );

  console.log(
    "MongoDB connected:",
    DB_NAME
  );

}


// ================================================================
// COMPLETE FRONTEND
// ================================================================

const html = String.raw`<!doctype html>

<html lang="en">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,viewport-fit=cover"
>

<meta
  name="theme-color"
  content="#05070a"
>

<meta
  name="description"
  content="TheGym Premium Fitness Management System"
>

<title>
TheGym — Premium Performance System
</title>

<style>

/* ============================================================
   THEGYM DESIGN SYSTEM
   ============================================================ */

@import url(
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap'
);

:root {

  --lime:#b8ff3d;
  --cyan:#40e7ff;

  --bg:#05070a;

  --card:
    rgba(11,15,20,.72);

  --line:
    rgba(255,255,255,.09);

  --muted:
    #91a0ad;

  --red:
    #ff6657;

  --orange:
    #ff9f43;

  --yellow:
    #ffd34e;

}


/* ============================================================
   RESET
   ============================================================ */

* {
  box-sizing:border-box;
}

html,
body {

  margin:0;

  min-height:100%;

  background:
    var(--bg);

  color:#fff;

  font-family:
    Inter,
    system-ui,
    sans-serif;

}

body {

  overflow-x:hidden;

}

button,
input,
select {

  font:inherit;

}


/* ============================================================
   BACKGROUND
   ============================================================ */

.bg {

  position:fixed;

  inset:0;

  z-index:-4;

  background:

    radial-gradient(
      circle at 70% 15%,
      rgba(64,231,255,.12),
      transparent 28%
    ),

    radial-gradient(
      circle at 15% 80%,
      rgba(184,255,61,.1),
      transparent 32%
    ),

    linear-gradient(
      145deg,
      #030507,
      #090d12 52%,
      #040608
    );

}


.noise {

  position:fixed;

  inset:0;

  z-index:-3;

  opacity:.045;

  pointer-events:none;

  background-image:url(
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E"
  );

}


/* ============================================================
   TOP BAR
   ============================================================ */

.topbar {

  height:78px;

  padding:
    12px 4vw;

  display:flex;

  align-items:center;

  justify-content:space-between;

  border-bottom:
    1px solid var(--line);

  background:
    rgba(3,5,7,.62);

  backdrop-filter:
    blur(18px);

  position:relative;

  z-index:5;

}


.brand {

  display:flex;

  align-items:center;

  gap:12px;

  font-weight:900;

  letter-spacing:.14em;

}


.logo {

  width:44px;

  height:44px;

  filter:
    drop-shadow(
      0 0 16px
      rgba(184,255,61,.35)
    );

}


/* ============================================================
   GENERAL
   ============================================================ */

.wrap {

  width:
    min(1400px,92vw);

  margin:auto;

}


.eyebrow {

  font-size:12px;

  letter-spacing:.22em;

  color:var(--lime);

  font-weight:800;

}


.title,
h1,
h2,
h3 {

  font-family:
    "Barlow Condensed",
    sans-serif;

  text-transform:uppercase;

}


.sub {

  color:var(--muted);

  line-height:1.7;

  max-width:660px;

}


/* ============================================================
   BUTTONS
   ============================================================ */

.btn {

  border:
    1px solid var(--line);

  background:
    #0b0f14;

  color:#fff;

  padding:
    13px 18px;

  border-radius:11px;

  cursor:pointer;

  font-weight:800;

  letter-spacing:.06em;

  transition:.2s;

  box-shadow:
    0 8px 30px
    rgba(0,0,0,.2);

}


.btn:hover {

  transform:
    translateY(-2px);

  border-color:
    rgba(255,255,255,.25);

}


.btn.primary {

  background:
    var(--lime);

  color:#061006;

  border-color:
    var(--lime);

  box-shadow:
    0 0 28px
    rgba(184,255,61,.22);

}


.btn.ghost {

  background:
    rgba(255,255,255,.035);

}


/* ============================================================
   PILLS
   ============================================================ */

.pill,
.tag {

  display:inline-flex;

  align-items:center;

  border:
    1px solid var(--line);

  border-radius:999px;

  padding:
    7px 11px;

  font-size:11px;

  font-weight:800;

  letter-spacing:.08em;

  color:#cbd3da;

  background:
    rgba(255,255,255,.035);

}


/* ============================================================
   HERO
   ============================================================ */

.hero {

  min-height:
    calc(100vh - 78px);

  display:grid;

  grid-template-columns:
    1.02fr .98fr;

  align-items:center;

  gap:30px;

  padding:
    5vh 0;

}


.title {

  font-size:
    clamp(76px,10vw,170px);

  line-height:.78;

  font-weight:900;

  letter-spacing:-.045em;

  margin:
    18px 0 26px;

}


.title span {

  color:var(--lime);

  text-shadow:
    0 0 40px
    rgba(184,255,61,.25);

}


.cta {

  display:flex;

  gap:12px;

  align-items:center;

  flex-wrap:wrap;

  margin-top:28px;

}


/* ============================================================
   3D STAGE
   ============================================================ */

.stage {

  height:650px;

  position:relative;

  overflow:hidden;

}


.stage canvas {

  position:absolute;

  inset:0;

  width:100%;

  height:100%;

}


.orb {

  position:absolute;

  width:300px;

  height:300px;

  border-radius:50%;

  left:50%;

  top:50%;

  transform:
    translate(-50%,-50%);

  background:

    radial-gradient(
      circle at 35% 30%,
      #eaffc4,
      rgba(184,255,61,.8) 8%,
      rgba(184,255,61,.1) 35%,
      transparent 70%
    );

  filter:blur(1px);

  box-shadow:
    0 0 100px
    rgba(184,255,61,.14);

  animation:
    pulse 4s ease-in-out infinite;

}


.orb:after {

  content:"";

  position:absolute;

  inset:-40px;

  border:
    1px solid
    rgba(184,255,61,.2);

  border-radius:50%;

  animation:
    spin 10s linear infinite;

}


/* ============================================================
   GLASS
   ============================================================ */

.glass {

  background:
    linear-gradient(
      145deg,
      rgba(17,22,29,.78),
      rgba(5,8,12,.66)
    );

  border:
    1px solid var(--line);

  border-radius:20px;

  padding:24px;

  box-shadow:

    0 25px 70px
    rgba(0,0,0,.32),

    inset 0 1px
    rgba(255,255,255,.035);

  backdrop-filter:
    blur(18px);

}


/* ============================================================
   CARDS
   ============================================================ */

.cards {

  display:grid;

  grid-template-columns:
    repeat(3,1fr);

  gap:16px;

  padding:
    20px 0 50px;

}


.stat h3 {

  color:var(--muted);

  font-size:12px;

  letter-spacing:.14em;

  margin:
    0 0 10px;

}


.stat b {

  font-family:
    "Barlow Condensed";

  font-size:52px;

  line-height:1;

}


/* ============================================================
   LOGIN
   ============================================================ */

.auth {

  min-height:
    calc(100vh - 60px);

  display:grid;

  place-items:center;

  padding:30px;

}


.authbox {

  width:
    min(540px,100%);

}


.authbox .glass {

  text-align:center;

  padding:42px;

}


.key {

  width:100%;

  padding:17px;

  border-radius:12px;

  border:
    1px solid var(--line);

  background:#070a0e;

  color:white;

  outline:none;

  text-align:center;

  letter-spacing:.2em;

  font-weight:800;

}


.key:focus {

  border-color:
    var(--lime);

  box-shadow:
    0 0 0 4px
    rgba(184,255,61,.08);

}


/* ============================================================
   FOOTER
   ============================================================ */

.footer {

  padding:
    24px 5vw;

  text-align:center;

  color:#6f7b85;

  font-size:11px;

  border-top:
    1px solid var(--line);

  background:
    rgba(0,0,0,.2);

}


/* ============================================================
   ADMIN
   ============================================================ */

.appmain {

  padding:
    42px 0 80px;

}


.dashboard {

  display:flex;

  flex-direction:column;

  gap:18px;

}


.dashhead {

  display:flex;

  justify-content:space-between;

  align-items:flex-start;

  gap:18px;

}


.dashhead h1 {

  font-size:
    clamp(48px,7vw,92px);

  line-height:.85;

  margin:
    10px 0;

}


.grid {

  display:grid;

  grid-template-columns:
    repeat(2,1fr);

  gap:18px;

}


.wide {

  min-height:210px;

  display:flex;

  flex-direction:column;

  justify-content:space-between;

}


.wide h2 {

  font-size:44px;

  margin:0;

}


/* ============================================================
   FORMS
   ============================================================ */

.formgrid {

  display:grid;

  grid-template-columns:
    repeat(2,1fr);

  gap:16px;

}


.field {

  display:flex;

  flex-direction:column;

  gap:8px;

}


.field label {

  font-size:11px;

  text-transform:uppercase;

  letter-spacing:.12em;

  color:#94a0aa;

  font-weight:800;

}


.field input,
.field select {

  padding:
    13px 14px;

  border-radius:10px;

  border:
    1px solid var(--line);

  background:#070a0e;

  color:#fff;

  outline:none;

}


.field input:focus,
.field select:focus {

  border-color:
    var(--lime);

}


.full {

  grid-column:
    1 / -1;

}


/* ============================================================
   TABLE
   ============================================================ */

.tablewrap {

  overflow:auto;

}


.table {

  width:100%;

  border-collapse:
    collapse;

  min-width:920px;

}


.table th,
.table td {

  padding:
    14px 12px;

  border-bottom:
    1px solid var(--line);

  text-align:left;

  font-size:12px;

  white-space:nowrap;

}


.table th {

  color:#77848f;

  text-transform:uppercase;

  letter-spacing:.1em;

  font-size:10px;

}


/* ============================================================
   STATUS COLORS
   ============================================================ */

.tag.green {

  background:
    rgba(90,230,125,.12);

  border-color:
    rgba(90,230,125,.25);

  color:#74f58f;

}


.tag.yellow {

  background:
    rgba(255,211,78,.1);

  border-color:
    rgba(255,211,78,.25);

  color:var(--yellow);

}


.tag.orange {

  background:
    rgba(255,159,67,.1);

  border-color:
    rgba(255,159,67,.25);

  color:var(--orange);

}


.tag.red {

  background:
    rgba(255,102,87,.1);

  border-color:
    rgba(255,102,87,.25);

  color:#ff7669;

}


/* ============================================================
   MEMBER DASHBOARD
   ============================================================ */

.memberhero {

  display:grid;

  grid-template-columns:
    1fr 1fr;

  gap:18px;

}


.bigstat {

  font-family:
    "Barlow Condensed";

  font-size:120px;

  font-weight:900;

  line-height:.85;

  color:var(--lime);

  text-shadow:
    0 0 50px
    rgba(184,255,61,.15);

}


.progress {

  height:12px;

  border-radius:999px;

  background:#11171e;

  overflow:hidden;

}


.bar {

  height:100%;

  background:
    linear-gradient(
      90deg,
      var(--lime),
      var(--cyan)
    );

  box-shadow:
    0 0 22px
    rgba(184,255,61,.5);

  transition:
    width 1s ease;

}


/* ============================================================
   TOAST
   ============================================================ */

.toast {

  position:fixed;

  right:20px;

  bottom:20px;

  padding:
    14px 18px;

  background:#111820;

  border:
    1px solid var(--line);

  border-radius:12px;

  z-index:99;

  box-shadow:
    0 20px 60px
    #0008;

}


/* ============================================================
   ANIMATIONS
   ============================================================ */

@keyframes pulse {

  50% {

    transform:
      translate(-50%,-50%)
      scale(1.08);

  }

}


@keyframes spin {

  to {

    transform:
      rotate(360deg);

  }

}


/* ============================================================
   MOBILE
   ============================================================ */

@media(max-width:850px) {

  .hero,
  .memberhero {

    grid-template-columns:1fr;

  }

  .stage {

    height:420px;

    order:-1;

  }

  .cards,
  .grid,
  .formgrid {

    grid-template-columns:1fr;

  }

  .full {

    grid-column:auto;

  }

  .dashhead {

    flex-direction:column;

  }

  .topbar {

    height:auto;

    min-height:70px;

  }

  .bigstat {

    font-size:88px;

  }

  .title {

    font-size:76px;

  }

}

</style>

</head>


<body>

<div id="app"></div>


<script>

/* ============================================================
   CLIENT APPLICATION
   ============================================================ */

const app =
  document.getElementById(
    "app"
  );


let token =
  localStorage.getItem(
    "tg_token"
  );

let role =
  localStorage.getItem(
    "tg_role"
  );


/* ============================================================
   TG SVG LOGO
   ============================================================ */

const logoSvg = `<svg
  class="logo"
  viewBox="0 0 100 100"
  xmlns="http://www.w3.org/2000/svg"
>
<rect
  x="4"
  y="4"
  width="92"
  height="92"
  rx="24"
  fill="#b8ff3d"
/>
<path
  d="M24 30h12v15h28V30h12v40H64V55H36v15H24z"
  fill="#071006"
/>
<circle
  cx="78"
  cy="50"
  r="7"
  fill="#071006"
/>
</svg>`;





/* ============================================================
   SHELL
   ============================================================ */

function shell(content) {

  app.innerHTML =

    '<div class="bg"></div>' +

    '<div class="noise"></div>' +

    content;

}


/* ============================================================
   FOOTER
   ============================================================ */

function footer() {

  return `

  <div class="footer">

    TheGym +91 70079 47859

    · WhatsApp +91 78958 32442

    · ®CareerBoot ©2026

  </div>

  `;

}


/* ============================================================
   TOP BAR
   ============================================================ */

function topbar(title) {

  return `

<header class="topbar">

  <div class="brand">

    ${logo}

    <span>THEGYM</span>

  </div>

  <div
    style="
      display:flex;
      gap:8px;
      align-items:center
    "
  >

    <span class="pill">

      ${title}

    </span>

    <button
      class="btn ghost"
      onclick="logout()"
    >

      LOG OUT

    </button>

  </div>

</header>

`;

}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function esc(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    char => ({

      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"

    }[char])

  );

}


/* ============================================================
   DATE FORMAT
   ============================================================ */

function fmt(date) {

  return new Date(
    date + "T00:00:00"
  ).toLocaleDateString(
    "en-IN",
    {
      day:"2-digit",
      month:"short",
      year:"numeric"
    }
  );

}


/* ============================================================
   API HELPER
   ============================================================ */

async function api(
  url,
  options = {}
) {

  options.headers = {

    ...(options.headers || {}),

    Authorization:
      "Bearer " + token,

    "Content-Type":
      "application/json"

  };


  const response =
    await fetch(
      url,
      options
    );


  const data =
    await response.json();


  if (!response.ok) {

    if (
      response.status === 401
    ) {

      localStorage.clear();

      token = null;

      role = null;

      landing();

    }

    throw new Error(
      data.error ||
      "Request failed"
    );

  }


  return data;

}


/* ============================================================
   TOAST
   ============================================================ */

function toast(message) {

  const element =
    document.createElement(
      "div"
    );

  element.className =
    "toast";

  element.textContent =
    message;

  document.body.appendChild(
    element
  );

  setTimeout(
    () => element.remove(),
    2600
  );

}


/* ============================================================
   LOGIN
   ============================================================ */

function login() {

  shell(`

<main class="auth">

  <div class="authbox">

    <div class="glass">

      ${logo}

      <div
        class="eyebrow"
        style="margin-top:20px"
      >

        THEGYM //
        SECURE ACCESS

      </div>

      <h1
        style="
          font-size:70px;
          margin:12px 0
        "
      >

        ENTER ACCESS

      </h1>

      <p
        class="sub"
        style="
          margin:0 auto 24px
        "
      >

        Enter your assigned
        Secret Key.

        TheGym automatically
        routes you to the
        correct secure panel.

      </p>

      <input
        id="key"
        class="key"
        placeholder="SECRET KEY"
        autocomplete="off"
      >

      <div
        style="margin-top:16px"
      >

        <button
          class="btn primary"
          onclick="doLogin()"
        >

          ACCESS THEGYM →

        </button>

      </div>

      <div
        id="err"
        class="mini"
        style="margin-top:15px"
      ></div>

    </div>

  </div>

</main>

${footer()}

`);


  document
    .getElementById("key")
    .onkeydown =
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          doLogin();

        }

      };

}


/* ============================================================
   LOGIN REQUEST
   ============================================================ */

async function doLogin() {

  const errorElement =
    document.getElementById(
      "err"
    );

  errorElement.textContent = "";


  try {

    const response =
      await fetch(
        "/api/login",
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:JSON.stringify({

            key:
              document
                .getElementById("key")
                .value
                .trim()

          })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error
      );

    }


    token =
      data.token;

    role =
      data.role;


    localStorage.setItem(
      "tg_token",
      token
    );

    localStorage.setItem(
      "tg_role",
      role
    );


    route();


  } catch (err) {

    errorElement.textContent =
      err.message;

  }

}


/* ============================================================
   LOGOUT
   ============================================================ */

function logout() {

  fetch(
    "/api/logout",
    {
      method:"POST",

      headers:{
        Authorization:
          "Bearer " + token
      }
    }
  ).finally(() => {

    localStorage.clear();

    token = null;

    role = null;

    landing();

  });

}


/* ============================================================
   LANDING
   ============================================================ */

function landing() {

  shell(`

<header class="topbar">

  <div class="brand">

    ${logo}

    <span>THEGYM</span>

  </div>

  <span class="pill">

    PREMIUM FITNESS SYSTEM

  </span>

</header>


<main class="wrap">

<section class="hero">

  <div>

    <div class="eyebrow">

      NEXT-GENERATION
      GYM EXPERIENCE

    </div>

    <div class="title">

      TRAIN<br>

      <span>HARDER.</span><br>

      LIVE<br>

      STRONG.

    </div>

    <p class="sub">

      A cinematic performance
      platform for TheGym
      members and management.

      Premium dashboards,
      live progress tracking
      and an immersive gym
      atmosphere.

    </p>

    <div class="cta">

      <button
        class="btn primary"
        onclick="login()"
      >

        ENTER THEGYM →

      </button>

      <span class="pill">

        4K UI · 3D-STYLE · LIVE DATA

      </span>

    </div>

  </div>


  <div
    class="stage"
    id="stage"
  >

    <div class="orb"></div>

  </div>

</section>


<section class="cards">

  <div class="glass stat">

    <h3>
      MEMBER EXPERIENCE
    </h3>

    <b>LIVE</b>

  </div>


  <div class="glass stat">

    <h3>
      TRACKING
    </h3>

    <b>24/7</b>

  </div>


  <div class="glass stat">

    <h3>
      THEGYM
    </h3>

    <b>2026</b>

  </div>

</section>

</main>


${footer()}

`);


  animateStage();

}


/* ============================================================
   HERO 3D PARTICLE ANIMATION
   ============================================================ */

function animateStage() {

  const element =
    document.getElementById(
      "stage"
    );

  if (!element) {
    return;
  }


  const canvas =
    document.createElement(
      "canvas"
    );

  const context =
    canvas.getContext(
      "2d"
    );


  const points = [];


  function resize() {

    canvas.width =
      element.clientWidth *
      devicePixelRatio;

    canvas.height =
      element.clientHeight *
      devicePixelRatio;

    context.setTransform(
      devicePixelRatio,
      0,
      0,
      devicePixelRatio,
      0,
      0
    );

  }


  element.appendChild(
    canvas
  );


  resize();


  addEventListener(
    "resize",
    resize
  );


  for (
    let i = 0;
    i < 180;
    i++
  ) {

    points.push({

      angle:
        Math.random() *
        Math.PI *
        2,

      radius:
        80 +
        Math.random() *
        210,

      depth:
        Math.random(),

      velocity:
        .001 +
        Math.random() *
        .003

    });

  }


  function frame(time) {

    context.clearRect(
      0,
      0,
      element.clientWidth,
      element.clientHeight
    );


    const width =
      element.clientWidth;

    const height =
      element.clientHeight;

    const centerX =
      width / 2;

    const centerY =
      height / 2;


    points.forEach(
      point => {

        point.angle +=
          point.velocity;

        point.depth +=
          .002;


        if (
          point.depth > 1
        ) {

          point.depth = 0;

        }


        const radius =
          point.radius *
          (
            .7 +
            .3 *
            Math.sin(
              time *
              .001 +
              point.angle *
              3
            )
          );


        const x =
          centerX +
          Math.cos(
            point.angle +
            time *
            .00025
          ) *
          radius;


        const y =
          centerY +
          Math.sin(
            point.angle * 1.35 +
            time *
            .00018
          ) *
          radius *
          .72;


        const size =
          1 +
          (1 - point.depth) *
          3;


        context.fillStyle =
          point.angle % 2 < 1
            ? "#b8ff3d"
            : "#40e7ff";


        context.globalAlpha =
          .2 +
          .6 *
          (1 - point.depth);


        context.beginPath();

        context.arc(
          x,
          y,
          size,
          0,
          Math.PI * 2
        );

        context.fill();

      }
    );


    requestAnimationFrame(
      frame
    );

  }


  requestAnimationFrame(
    frame
  );

}


/* ============================================================
   ADMIN PANEL
   ============================================================ */

function admin() {

  shell(

    topbar(
      "ADMIN PANEL"
    ) +

    `

<main class="appmain">

<div class="wrap dashboard">

<div class="dashhead">

  <div>

    <div class="eyebrow">
      CONTROL CENTER
    </div>

    <h1>
      ADMIN PANEL
    </h1>

    <p class="mini">

      Create members and
      maintain live
      performance records.

    </p>

  </div>

</div>


<div class="grid">


<div class="glass wide">

  <div>

    <h2>
      Members Register
    </h2>

    <p class="mini">

      Create a new member
      profile with a unique
      access key.

    </p>

  </div>

  <button
    class="btn primary"
    onclick="registerView()"
  >

    OPEN REGISTER →

  </button>

</div>


<div class="glass wide">

  <div>

    <h2>
      Members Profile
    </h2>

    <p class="mini">

      Update today's weight
      and inspect growth
      percentage.

    </p>

  </div>

  <button
    class="btn ghost"
    onclick="profilesView()"
  >

    OPEN PROFILES →

  </button>

</div>


</div>

</div>

</main>

${footer()}

`

  );

}


/* ============================================================
   MEMBER REGISTER
   ============================================================ */

function registerView() {

  shell(

    topbar(
      "MEMBERS REGISTER"
    ) +

    `

<main class="appmain">

<div class="wrap">

<div class="glass">

<div class="dashhead">

  <div>

    <div class="eyebrow">
      DATA ENTRY SHEET
    </div>

    <h1>
      NEW MEMBER
    </h1>

  </div>


  <button
    class="btn ghost"
    onclick="admin()"
  >

    ← BACK

  </button>

</div>


<form
  id="reg"
  class="formgrid"
>


<div class="field">

<label>Name</label>

<input
  name="name"
  required
>

</div>


<div class="field">

<label>Secret Key</label>

<input
  name="secretKey"
  required
>

</div>


<div class="field">

<label>Joining Date</label>

<input
  type="date"
  name="joiningDate"
  required
>

</div>


<div class="field">

<label>
  Joining Day Weight (kg)
</label>

<input
  type="number"
  step="0.1"
  min="1"
  name="joiningWeight"
  required
>

</div>


<div class="field">

<label>
  Goal Category
</label>

<select
  name="goalCategory"
>

<option value="Loss">
  Weight Loss
</option>

<option value="Gain">
  Weight Gain
</option>

</select>

</div>


<div class="field">

<label>
  Goal Weight (kg)
</label>

<input
  type="number"
  step="0.1"
  min="1"
  name="goalWeight"
  required
>

</div>


<div class="field">

<label>
  Member Fees
</label>

<select name="fee">

<option value="500">
  ₹500
</option>

<option value="700">
  ₹700
</option>

</select>

</div>


<div class="field">

<label>
  Contact Number
</label>

<input
  name="contact"
  inputmode="tel"
  required
>

</div>


<div class="field">

<label>
  Last Fees Submission Date
</label>

<input
  type="date"
  name="lastFeeDate"
  required
>

</div>


<div class="full">

<button
  class="btn primary"
  type="submit"
>

CREATE MEMBER PROFILE →

</button>

</div>


</form>

</div>

</div>

</main>

${footer()}

`

  );


  document
    .getElementById("reg")
    .onsubmit =
      async event => {

        event.preventDefault();


        try {

          await api(
            "/api/members",
            {
              method:"POST",

              body:
                JSON.stringify(
                  Object.fromEntries(
                    new FormData(
                      event.target
                    )
                  )
                )
            }
          );


          toast(
            "Member created successfully"
          );


          event.target.reset();


        } catch (error) {

          toast(
            error.message
          );

        }

      };

}


/* ============================================================
   MEMBER PROFILE
   ============================================================ */

async function profilesView() {

  try {

    const data =
      await api(
        "/api/members"
      );


    shell(

      topbar(
        "MEMBERS PROFILE"
      ) +

      `

<main class="appmain">

<div class="wrap">

<div class="glass">

<div class="dashhead">

<div>

<div class="eyebrow">
LIVE MEMBER SHEET
</div>

<h1>
MEMBERS PROFILE
</h1>

</div>


<button
class="btn ghost"
onclick="admin()"
>
← BACK
</button>

</div>


<div class="tablewrap">

<table class="table">

<thead>

<tr>

<th>Name</th>

<th>Joining Date</th>

<th>Current Weight</th>

<th>Joining Weight</th>

<th>Goal</th>

<th>Growth</th>

<th>Contact</th>

<th>Update</th>

</tr>

</thead>


<tbody>

${
data.members.length
? data.members.map(
  member => `

<tr>

<td>
<b>
${esc(member.name)}
</b>
</td>


<td>
${fmt(member.joiningDate)}
</td>


<td>

<input
id="w-${member.id}"
value="${member.currentWeight}"
type="number"
step="0.1"
style="
width:90px;
background:#080b10;
color:white;
border:1px solid #222;
border-radius:8px;
padding:7px
"
>

</td>


<td>
${member.joiningWeight} kg
</td>


<td>

${esc(member.goalCategory)}
:
${member.goalWeight}
kg

</td>


<td>

<span
class="tag ${
  member.growth >= 0
    ? "green"
    : "red"
}"
>

${member.growth}%

</span>

</td>


<td>
${esc(member.contact)}
</td>


<td>

<button
class="btn primary"
style="
padding:8px 10px
"
onclick="
updateWeight(
'${member.id}'
)
"
>

SAVE

</button>

</td>

</tr>

`
).join("")

: `

<tr>

<td
colspan="8"
style="
text-align:center;
padding:40px
"
>

No members yet.

</td>

</tr>

`

}

</tbody>

</table>

</div>

</div>

</div>

</main>

${footer()}

`

    );

  } catch (error) {

    toast(
      error.message
    );

  }

}


/* ============================================================
   UPDATE WEIGHT
   ============================================================ */

async function updateWeight(id) {

  try {

    const input =
      document.getElementById(
        "w-" + id
      );


    await api(
      "/api/members/" +
      encodeURIComponent(id),
      {
        method:"PATCH",

        body:
          JSON.stringify({

            currentWeight:
              input.value

          })
      }
    );


    toast(
      "Weight updated"
    );


    profilesView();


  } catch (error) {

    toast(
      error.message
    );

  }

}


/* ============================================================
   FEE STATUS
   ============================================================ */

function feeStatus(lastDate) {

  const days =
    Math.floor(

      (
        Date.now() -
        new Date(
          lastDate +
          "T00:00:00"
        ).getTime()
      ) /

      86400000

    );


  if (days <= 30) {

    const balance =
      30 - days;


    return {

      text:
        balance +
        " days balance",

      cls:
        balance >= 20
          ? "green"
          : balance >= 11
          ? "yellow"
          : "orange"

    };

  }


  return {

    text:
      (days - 30) +
      " days gone",

    cls:
      "red"

  };

}


/* ============================================================
   SUPREME ADMIN
   ============================================================ */

async function supreme() {

  try {

    const data =
      await api(
        "/api/members"
      );


    const today =
      new Date()
        .toISOString()
        .slice(0,10);


    const rows =
      data.members
        .map(
          (member, index) => {

            const status =
              feeStatus(
                member.lastFeeDate
              );


            return `

<tr>

<td>
${index + 1}
</td>


<td>
<b>
${esc(member.name)}
</b>
</td>


<td>
${fmt(today)}
</td>


<td>
₹${member.fee}
</td>


<td>

<span
class="tag ${status.cls}"
>

${status.text}

</span>

</td>


<td>

<span
class="tag ${
  member.growth >= 0
    ? "green"
    : "red"
}"
>

${member.growth}%

</span>

</td>


<td>
${esc(member.contact)}
</td>

</tr>

`;

          }
        )
        .join("");


    const active =
      data.members.filter(
        member =>
          member.active !== false
      ).length;


    const average =
      data.members.length
        ? Math.round(

            data.members.reduce(
              (sum, member) =>
                sum +
                member.growth,
              0
            ) /
            data.members.length *
            10

          ) / 10

        : 0;


    shell(

      topbar(
        "SUPREME ADMIN"
      ) +

      `

<main class="appmain">

<div class="wrap dashboard">


<div class="dashhead">

<div>

<div class="eyebrow">

SUPREME COMMAND //
${fmt(today)}

</div>

<h1>
REPORT DASHBOARD
</h1>

<p class="mini">

Daily-to-monthly member
and fee monitoring.

</p>

</div>

</div>


<div
class="grid"
style="
grid-template-columns:
repeat(4,1fr)
"
>


<div class="glass stat">

<h3>
ACTIVE MEMBERS
</h3>

<b>
${active}
</b>

</div>


<div class="glass stat">

<h3>
AVERAGE GROWTH
</h3>

<b>
${average}%
</b>

</div>


<div class="glass stat">

<h3>
REPORT DATE
</h3>

<b
style="font-size:28px"
>

${fmt(today)}

</b>

</div>


<div class="glass stat">

<h3>
FEE OPTIONS
</h3>

<b
style="font-size:28px"
>

₹500 / ₹700

</b>

</div>


</div>


<div class="glass">

<div class="tablewrap">

<table class="table">

<thead>

<tr>

<th>
SL No.
</th>

<th>
Name
</th>

<th>
Date
</th>

<th>
Fees
</th>

<th>
Status
</th>

<th>
Growth
</th>

<th>
Contact Number
</th>

</tr>

</thead>


<tbody>

${
rows ||
`
<tr>
<td
colspan="7"
style="text-align:center"
>
No members yet.
</td>
</tr>
`
}

</tbody>

</table>

</div>

</div>


</div>

</main>

${footer()}

`

    );


  } catch (error) {

    toast(
      error.message
    );

  }

}


/* ============================================================
   MEMBER PERFORMANCE
   ============================================================ */

async function member() {

  try {

    const data =
      await api(
        "/api/me"
      );


    const member =
      data.member;


    const progress =
      Math.max(
        0,
        Math.min(
          100,
          member.growth
        )
      );


    shell(

      topbar(
        "MEMBER PERFORMANCE"
      ) +

      `

<main class="appmain">

<div class="wrap dashboard">

<div class="memberhero">


<div class="glass">

<div class="eyebrow">

YOUR PERFORMANCE //
LIVE

</div>


<h1
style="
font-size:72px;
margin:10px 0
"
>

${esc(member.name)}

</h1>


<p class="mini">

Goal:
${esc(member.goalCategory)}

· Target
${member.goalWeight}
kg

</p>


<div
style="
margin:50px 0 14px
"
>

<div class="mini">

GROWTH STATUS

</div>


<div class="bigstat">

${member.growth}%

</div>

</div>


<div class="progress">

<div
class="bar"
style="
width:${progress}%
"
></div>

</div>


<p
class="mini"
style="
margin-top:14px
"
>

Current:

<b style="color:white">

${member.currentWeight}
kg

</b>

· Joined:

${member.joiningWeight}
kg

· Target:

${member.goalWeight}
kg

</p>


</div>


<div
class="glass"
style="
position:relative;
overflow:hidden
"
>

<div class="eyebrow">

THEGYM ENERGY

</div>


<h2
style="
font-size:46px;
margin:10px 0
"
>

TRAIN.
TRACK.
TRANSFORM.

</h2>


<p class="sub">

Your dashboard updates
from the latest weight
recorded by TheGym
administration.

</p>


<div
id="miniCanvas"
style="
height:270px
"
></div>


</div>


</div>

</div>

</main>

${footer()}

`

    );


    animateMini();


  } catch (error) {

    toast(
      error.message
    );

  }

}


/* ============================================================
   MEMBER MINI ANIMATION
   ============================================================ */

function animateMini() {

  const element =
    document.getElementById(
      "miniCanvas"
    );


  if (!element) {
    return;
  }


  const canvas =
    document.createElement(
      "canvas"
    );


  element.appendChild(
    canvas
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const points = [];


  function resize() {

    canvas.width =
      element.clientWidth *
      devicePixelRatio;

    canvas.height =
      element.clientHeight *
      devicePixelRatio;

    context.setTransform(
      devicePixelRatio,
      0,
      0,
      devicePixelRatio,
      0,
      0
    );

  }


  resize();


  addEventListener(
    "resize",
    resize
  );


  for (
    let i = 0;
    i < 100;
    i++
  ) {

    points.push({

      angle:
        Math.random() *
        Math.PI *
        2,

      radius:
        20 +
        Math.random() *
        110,

      velocity:
        .002 +
        Math.random() *
        .004

    });

  }


  function frame(time) {

    context.clearRect(
      0,
      0,
      element.clientWidth,
      element.clientHeight
    );


    const centerX =
      element.clientWidth / 2;

    const centerY =
      element.clientHeight / 2;


    points.forEach(
      point => {

        point.angle +=
          point.velocity;


        const radius =
          point.radius +
          Math.sin(
            time *
            .002 +
            point.angle *
            4
          ) *
          15;


        const x =
          centerX +
          Math.cos(
            point.angle +
            time *
            .0004
          ) *
          radius;


        const y =
          centerY +
          Math.sin(
            point.angle * 1.4 +
            time *
            .0003
          ) *
          radius *
          .7;


        context.fillStyle =
          point.angle % 2 < 1
            ? "#b8ff3d"
            : "#40e7ff";


        context.globalAlpha =
          .5;


        context.beginPath();

        context.arc(
          x,
          y,
          1.7,
          0,
          Math.PI * 2
        );

        context.fill();

      }
    );


    requestAnimationFrame(
      frame
    );

  }


  requestAnimationFrame(
    frame
  );

}


/* ============================================================
   ROUTER
   ============================================================ */

function route() {

  if (!token) {

    landing();

    return;

  }


  if (role === "admin") {

    admin();

  }

  else if (
    role === "supreme"
  ) {

    supreme();

  }

  else if (
    role === "member"
  ) {

    member();

  }

  else {

    localStorage.clear();

    token = null;

    role = null;

    landing();

  }

}


/* ============================================================
   START CLIENT
   ============================================================ */

route();

</script>

</body>

</html>`;


/* ================================================================
   HTML RESPONSE
   ================================================================ */

function sendHTML(res) {

  res.writeHead(
    200,
    {
      "Content-Type":
        "text/html; charset=utf-8",

      "Cache-Control":
        "no-store"
    }
  );

  res.end(html);

}


/* ================================================================
   HTTP SERVER / API
   ================================================================ */

const server =
  http.createServer(
    async (req, res) => {

      try {

        const url =
          new URL(
            req.url,
            "http://localhost"
          );


        // ========================================================
        // LOGIN
        // ========================================================

        if (
          url.pathname ===
            "/api/login" &&
          req.method === "POST"
        ) {

          const body =
            await readBody(req);

          const key =
            String(
              body.key || ""
            ).trim();


          if (!key) {

            return json(
              res,
              400,
              {
                error:
                  "Secret Key is required"
              }
            );

          }


          let role = null;

          let identity = "";


          // SUPREME ADMIN

          if (
            safeEqual(
              key,
              SUPREME_KEY
            )
          ) {

            role =
              "supreme";

            identity =
              "supreme";

          }


          // ADMIN

          else if (
            safeEqual(
              key,
              ADMIN_KEY
            )
          ) {

            role =
              "admin";

            identity =
              "admin";

          }


          // MEMBER

          else {

            const member =
              await members.findOne(
                {
                  secretKeyHash:
                    hashKey(key),

                  active:
                    {
                      $ne:false
                    }
                }
              );


            if (member) {

              role =
                "member";

              identity =
                String(
                  member._id
                );

            }

          }


          if (!role) {

            return json(
              res,
              401,
              {
                error:
                  "Invalid Secret Key"
              }
            );

          }


          const token =
            newToken(
              role,
              identity
            );


          sessions.set(
            token,
            {
              role,
              identity,
              created:
                Date.now()
            }
          );


          return json(
            res,
            200,
            {
              token,
              role
            }
          );

        }


        // ========================================================
        // LOGOUT
        // ========================================================

        if (
          url.pathname ===
            "/api/logout" &&
          req.method === "POST"
        ) {

          sessions.delete(
            (
              req.headers.authorization ||
              ""
            ).replace(
              /^Bearer\s+/i,
              ""
            )
          );


          return json(
            res,
            200,
            {
              ok:true
            }
          );

        }


        // ========================================================
        // GET MEMBERS
        // ========================================================

        if (
          url.pathname ===
            "/api/members" &&
          req.method === "GET"
        ) {

          if (
            !guard(
              req,
              res,
              [
                "admin",
                "supreme"
              ]
            )
          ) {

            return;

          }


          const list =
            await members
              .find({})
              .sort({
                createdAt:1
              })
              .toArray();


          return json(
            res,
            200,
            {
              members:
                list.map(clean)
            }
          );

        }


        // ========================================================
        // CREATE MEMBER
        // ========================================================

        if (
          url.pathname ===
            "/api/members" &&
          req.method === "POST"
        ) {

          if (
            !guard(
              req,
              res,
              [
                "admin",
                "supreme"
              ]
            )
          ) {

            return;

          }


          const body =
            await readBody(req);


          const required = [

            "name",

            "secretKey",

            "joiningDate",

            "joiningWeight",

            "goalCategory",

            "goalWeight",

            "fee",

            "contact",

            "lastFeeDate"

          ];


          for (
            const field
            of required
          ) {

            if (
              String(
                body[field] ?? ""
              ).trim() === ""
            ) {

              return json(
                res,
                400,
                {
                  error:
                    "Missing field: " +
                    field
                }
              );

            }

          }


          const name =
            String(
              body.name
            ).trim();


          const secretKey =
            String(
              body.secretKey
            ).trim();


          const joiningDate =
            String(
              body.joiningDate
            );


          const joiningWeight =
            Number(
              body.joiningWeight
            );


          const goalWeight =
            Number(
              body.goalWeight
            );


          const goalCategory =
            body.goalCategory ===
            "Gain"
              ? "Gain"
              : "Loss";


          const fee =
            Number(
              body.fee
            ) === 700
              ? 700
              : 500;


          const contact =
            String(
              body.contact
            ).trim();


          const lastFeeDate =
            String(
              body.lastFeeDate
            );


          // ======================================================
          // VALIDATION
          // ======================================================

          if (
            !name ||
            !secretKey ||
            !/^\d{4}-\d{2}-\d{2}$/
              .test(joiningDate) ||
            !/^\d{4}-\d{2}-\d{2}$/
              .test(lastFeeDate)
          ) {

            return json(
              res,
              400,
              {
                error:
                  "Please enter valid member details and dates."
              }
            );

          }


          if (
            !Number.isFinite(
              joiningWeight
            ) ||
            joiningWeight <= 0 ||
            !Number.isFinite(
              goalWeight
            ) ||
            goalWeight <= 0
          ) {

            return json(
              res,
              400,
              {
                error:
                  "Weights must be valid positive numbers."
              }
            );

          }


          // ======================================================
          // REALISTIC GOAL VALIDATION
          // ======================================================

          if (
            goalCategory ===
              "Loss" &&
            goalWeight >=
              joiningWeight
          ) {

            return json(
              res,
              400,
              {
                error:
                  "For Weight Loss, Goal Weight should be lower than Joining Weight."
              }
            );

          }


          if (
            goalCategory ===
              "Gain" &&
            goalWeight <=
              joiningWeight
          ) {

            return json(
              res,
              400,
              {
                error:
                  "For Weight Gain, Goal Weight should be higher than Joining Weight."
              }
            );

          }


          if (
            !/^[0-9+()\-\s]{7,20}$/
              .test(contact)
          ) {

            return json(
              res,
              400,
              {
                error:
                  "Please enter a valid contact number."
              }
            );

          }


          // ======================================================
          // MEMBER DOCUMENT
          // ======================================================

          const member = {

            name,

            secretKeyHash:
              hashKey(
                secretKey
              ),

            joiningDate,

            joiningWeight,

            currentWeight:
              joiningWeight,

            goalCategory,

            goalWeight,

            fee,

            contact,

            lastFeeDate,

            active:true,

            createdAt:
              new Date(),

            updatedAt:
              new Date()

          };


          try {

            const result =
              await members.insertOne(
                member
              );


            return json(
              res,
              201,
              {
                member:
                  clean({
                    ...member,

                    _id:
                      result.insertedId
                  })
              }
            );


          } catch (error) {

            if (
              error &&
              error.code ===
                11000
            ) {

              return json(
                res,
                409,
                {
                  error:
                    "Secret Key already assigned to another member."
                }
              );

            }


            throw error;

          }

        }


        // ========================================================
        // UPDATE MEMBER
        // ========================================================

        const memberRoute =
          url.pathname.match(
            /^\/api\/members\/([^/]+)$/
          );


        if (
          memberRoute &&
          req.method === "PATCH"
        ) {

          if (
            !guard(
              req,
              res,
              [
                "admin",
                "supreme"
              ]
            )
          ) {

            return;

          }


          let id;


          try {

            id =
              new ObjectId(
                decodeURIComponent(
                  memberRoute[1]
                )
              );

          } catch {

            return json(
              res,
              400,
              {
                error:
                  "Invalid member ID"
              }
            );

          }


          const body =
            await readBody(req);


          const update = {

            updatedAt:
              new Date()

          };


          if (
            body.currentWeight !==
            undefined
          ) {

            const weight =
              Number(
                body.currentWeight
              );


            if (
              !Number.isFinite(
                weight
              ) ||
              weight <= 0
            ) {

              return json(
                res,
                400,
                {
                  error:
                    "Invalid current weight"
                }
              );

            }


            update.currentWeight =
              weight;

          }


          if (
            body.lastFeeDate !==
            undefined
          ) {

            if (
              !/^\d{4}-\d{2}-\d{2}$/
                .test(
                  String(
                    body.lastFeeDate
                  )
                )
            ) {

              return json(
                res,
                400,
                {
                  error:
                    "Invalid fee date"
                }
              );

            }


            update.lastFeeDate =
              String(
                body.lastFeeDate
              );

          }


          if (
            body.active !==
            undefined
          ) {

            update.active =
              !!body.active;

          }


          if (
            body.name !==
            undefined
          ) {

            update.name =
              String(
                body.name
              ).trim();

          }


          if (
            body.contact !==
            undefined
          ) {

            update.contact =
              String(
                body.contact
              ).trim();

          }


          const result =
            await members.findOneAndUpdate(

              {
                _id:id
              },

              {
                $set:update
              },

              {
                returnDocument:
                  "after"
              }

            );


          if (!result) {

            return json(
              res,
              404,
              {
                error:
                  "Member not found"
              }
            );

          }


          return json(
            res,
            200,
            {
              member:
                clean(result)
            }
          );

        }


        // ========================================================
        // CURRENT MEMBER
        // ========================================================

        if (
          url.pathname ===
            "/api/me" &&
          req.method === "GET"
        ) {

          const currentSession =
            guard(
              req,
              res,
              ["member"]
            );


          if (!currentSession) {
            return;
          }


          let id;


          try {

            id =
              new ObjectId(
                currentSession.identity
              );

          } catch {

            return json(
              res,
              401,
              {
                error:
                  "Invalid session"
              }
            );

          }


          const member =
            await members.findOne(
              {
                _id:id,

                active:
                  {
                    $ne:false
                  }
              }
            );


          if (!member) {

            return json(
              res,
              404,
              {
                error:
                  "Member not found"
              }
            );

          }


          return json(
            res,
            200,
            {
              member:
                clean(member)
            }
          );

        }


        // ========================================================
        // HEALTH CHECK
        // ========================================================

        if (
          url.pathname ===
          "/health"
        ) {

          return json(
            res,
            200,
            {
              ok:true,

              name:
                "TheGym",

              database:
                !!db
            }
          );

        }


        // ========================================================
        // FRONTEND
        // ========================================================

        sendHTML(res);


      } catch (error) {

        console.error(
          error
        );


        json(
          res,
          500,
          {
            error:
              "Server error"
          }
        );

      }

    }
  );


// ================================================================
// START
// ================================================================

connectMongo()

  .then(() => {

    server.listen(
      PORT,
      () => {

        console.log(
          `TheGym running on port ${PORT}`
        );

      }
    );

  })

  .catch(error => {

    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);

  });
