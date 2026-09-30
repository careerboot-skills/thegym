const http=require('http');const crypto=require('crypto');const {MongoClient,ObjectId}=require('mongodb');

const PORT=Number(process.env.PORT||3000);
const DB=process.env.DB_NAME||'thegym';

const ADMIN_KEY=process.env.ADMIN_KEY||'SKTCB';
const SUPREME_KEY=process.env.SUPREME_KEY||'VAIVAIXXXI';
const URI=process.env.MONGODB_URI||'';

const SECRET=process.env.SESSION_SECRET||'CHANGE_ME_NOW';

let db,members;
const sessions=new Map();

/* =========================================================
   HELPERS
========================================================= */

const j=(res,status,data)=>{
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store'
  });
  res.end(JSON.stringify(data));
};

const body=req=>new Promise((ok,bad)=>{
  let s='';
  req.on('data',c=>{
    s+=c;
    if(s.length>1e6)req.destroy();
  });
  req.on('end',()=>{
    try{
      ok(s?JSON.parse(s):{});
    }catch(e){
      bad(e);
    }
  });
  req.on('error',bad);
});

const hash=x=>
  crypto.createHash('sha256')
  .update(String(x))
  .digest('hex');

const sess=req=>
  sessions.get(
    (req.headers.authorization||'')
    .replace(/^Bearer\s+/i,'')
  );

function guard(req,res,roles){
  const s=sess(req);

  if(!s||!roles.includes(s.role)){
    j(res,401,{error:'Unauthorized'});
    return null;
  }

  return s;
}

/* =========================================================
   GROWTH
========================================================= */

function growth(m){

  const a=+m.joiningWeight;
  const c=+m.currentWeight;
  const g=+m.goalWeight;

  if(!a||!c||!g||a===g)return 0;

  let p;

  if(m.goalCategory==='Loss'){
    p=((a-c)/(a-g))*100;
  }else{
    p=((c-a)/(g-a))*100;
  }

  return Math.round(
    Math.max(0,Math.min(100,p))*10
  )/10;
}

/* =========================================================
   CLEAN MEMBER
========================================================= */

function clean(m){

  if(!m)return null;

  const x={
    ...m,
    id:String(m._id),
    growth:growth(m)
  };

  delete x._id;
  delete x.secretKeyHash;

  return x;
}

/* =========================================================
   FEES
========================================================= */

function daysSince(s){

  const d=new Date(s+'T00:00:00');

  const n=new Date();
  n.setHours(0,0,0,0);

  return Math.floor(
    (n-d)/86400000
  );
}

function feeStatus(m){

  const d=daysSince(m.lastFeeDate);
  const left=30-d;

  return {
    daysGone:d,
    daysBalance:left,

    status:
      d>30
        ?'OVERDUE'
        :left+' DAYS BALANCE',

    tone:
      d>30
        ?'red'
        :left>=20
          ?'green'
          :left>=11
            ?'yellow'
            :'orange'
  };
}

/* =========================================================
   SVG LOGO
========================================================= */

const logo=
'<svg class="logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+
'<rect x="4" y="4" width="92" height="92" rx="24" fill="#b8ff3d"/>'+
'<path d="M22 28h14v16h28V28h14v44H64V58H36v14H22z" fill="#071006"/>'+
'<circle cx="79" cy="50" r="7" fill="#071006"/>'+
'</svg>';

/* =========================================================
   COMPLETE FRONTEND
========================================================= */

const html=String.raw`<!doctype html>

<html>

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<meta
name="theme-color"
content="#05070a"
>

<title>
TheGym — Premium Performance System
</title>

<style>

@import url(
'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap'
);

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  background:#05070a;
  color:#fff;
  font-family:
    Inter,
    system-ui,
    sans-serif;
}

body{
  overflow-x:hidden;
}

button,
input,
select{
  font:inherit;
}

/* BACKGROUND */

.bg{
  position:fixed;
  inset:0;
  z-index:-3;

  background:
    radial-gradient(
      circle at 75% 15%,
      #40e7ff1c,
      transparent 28%
    ),
    radial-gradient(
      circle at 15% 80%,
      #b8ff3d18,
      transparent 32%
    ),
    linear-gradient(
      145deg,
      #030507,
      #0a1016 55%,
      #040608
    );
}

.noise{
  position:fixed;
  inset:0;
  z-index:-2;
  opacity:.035;
  pointer-events:none;

  background-image:url(
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"
  );
}

/* TOP */

.top{
  height:76px;
  padding:12px 4vw;

  display:flex;
  align-items:center;
  justify-content:space-between;

  border-bottom:
    1px solid #ffffff12;

  background:#030507b8;

  backdrop-filter:
    blur(18px);

  position:sticky;
  top:0;
  z-index:10;
}

.brand{
  display:flex;
  gap:12px;
  align-items:center;

  font-weight:900;
  letter-spacing:.15em;
}

.logo{
  width:44px;
  height:44px;

  filter:
    drop-shadow(
      0 0 18px
      #b8ff3d55
    );
}

.wrap{
  width:min(1400px,92vw);
  margin:auto;
}

.pill{
  border:
    1px solid #ffffff14;

  border-radius:999px;

  padding:
    8px 12px;

  color:#aebac4;

  font-size:11px;

  letter-spacing:.12em;
}

/* BUTTONS */

.btn{
  border:
    1px solid #ffffff18;

  background:#0b1016;

  color:#fff;

  padding:
    12px 18px;

  border-radius:10px;

  cursor:pointer;

  font-weight:800;

  transition:.2s;
}

.btn:hover{
  transform:
    translateY(-2px);

  border-color:
    #b8ff3d66;
}

.primary{
  background:#b8ff3d;
  color:#071006;

  box-shadow:
    0 0 30px
    #b8ff3d24;
}

.ghost{
  background:#ffffff08;
}

/* HERO */

.hero{
  min-height:
    calc(100vh - 76px);

  display:grid;

  grid-template-columns:
    1fr 1fr;

  align-items:center;

  gap:30px;
}

.eyebrow{
  font-size:12px;
  letter-spacing:.22em;
  color:#b8ff3d;
  font-weight:900;
}

.title,
h1,
h2,
h3{
  font-family:
    'Barlow Condensed',
    sans-serif;

  text-transform:
    uppercase;
}

.title{
  font-size:
    clamp(70px,9vw,150px);

  line-height:.78;

  font-weight:900;

  margin:
    18px 0;
}

.title span{
  color:#b8ff3d;
}

.sub{
  color:#91a0ad;

  line-height:1.7;

  max-width:650px;
}

.cta{
  display:flex;
  gap:12px;
  align-items:center;
  flex-wrap:wrap;
  margin-top:26px;
}

/* 3D STAGE */

.stage{
  height:650px;
  position:relative;

  display:grid;
  place-items:center;

  perspective:1200px;
}

.orb{
  width:min(480px,70vw);
  aspect-ratio:1;

  border-radius:50%;

  background:
    radial-gradient(
      circle at 35% 28%,
      #fff,
      #b8ff3d 7%,
      #17300a 25%,
      #060b0d 58%,
      #000
    );

  box-shadow:
    0 0 80px #b8ff3d22,
    inset -40px -30px 80px #000;

  animation:
    float 5s ease-in-out infinite;

  transform-style:
    preserve-3d;
}

.orb:before,
.orb:after{
  content:'';

  position:absolute;

  border:
    1px solid #b8ff3d55;

  border-radius:50%;

  inset:9%;

  transform:
    rotateX(68deg);

  animation:
    spin 9s linear infinite;
}

.orb:after{
  inset:18%;

  border-color:
    #40e7ff55;

  transform:
    rotateY(70deg);

  animation-duration:
    7s;
}

/* GLASS */

.glass{
  background:
    #0b1016bb;

  border:
    1px solid #ffffff12;

  border-radius:22px;

  box-shadow:
    0 25px 90px #0008,
    inset 0 1px #ffffff08;

  backdrop-filter:
    blur(20px);
}

/* LOGIN */

.auth{
  min-height:
    calc(100vh - 76px);

  display:grid;
  place-items:center;

  padding:30px;
}

.authbox{
  width:min(520px,94vw);
  text-align:center;
}

.authbox .glass{
  padding:38px;
}

.key{
  width:100%;

  padding:17px;

  border-radius:12px;

  border:
    1px solid #ffffff16;

  background:#05080c;

  color:#fff;

  outline:none;

  text-align:center;

  letter-spacing:.18em;
}

.key:focus{
  border-color:#b8ff3d88;

  box-shadow:
    0 0 25px
    #b8ff3d18;
}

/* FOOTER */

.footer{
  text-align:center;

  padding:
    28px 16px 40px;

  color:#73808b;

  font-size:12px;
}

/* DASHBOARD */

.dash{
  padding:
    30px 0 60px;
}

.head{
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:20px;
  margin-bottom:24px;
}

.head h1{
  font-size:64px;
  line-height:.9;
  margin:8px 0;
}

/* CARDS */

.cards{
  display:grid;

  grid-template-columns:
    repeat(4,1fr);

  gap:14px;
}

.stat{
  padding:20px;
}

.stat small{
  color:#83909b;
}

.stat b{
  display:block;

  font-family:
    'Barlow Condensed';

  font-size:48px;

  margin-top:8px;
}

/* PANEL */

.panel{
  padding:20px;
  margin-top:16px;
}

.actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

/* FORM */

.formgrid{
  display:grid;

  grid-template-columns:
    repeat(2,1fr);

  gap:12px;
}

.field{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.field label{
  font-size:11px;

  color:#91a0ad;

  text-transform:
    uppercase;

  letter-spacing:.12em;
}

.field input,
.field select{
  padding:13px;

  border-radius:10px;

  border:
    1px solid #ffffff14;

  background:#070b10;

  color:#fff;

  outline:none;
}

.full{
  grid-column:1/-1;
}

/* TABLE */

.tablewrap{
  overflow:auto;
  border-radius:14px;
}

.table{
  width:100%;

  border-collapse:
    collapse;

  min-width:900px;
}

.table th,
.table td{
  padding:
    13px 12px;

  border-bottom:
    1px solid #ffffff0d;

  text-align:left;

  white-space:
    nowrap;
}

.table th{
  font-size:11px;

  color:#83909b;

  text-transform:
    uppercase;

  letter-spacing:.1em;
}

/* FEE BADGES */

.badge{
  display:inline-flex;

  padding:
    7px 9px;

  border-radius:
    999px;

  font-size:11px;

  font-weight:900;
}

.green{
  background:#b8ff3d20;
  color:#b8ff3d;
}

.yellow{
  background:#ffd34e22;
  color:#ffd34e;
}

.orange{
  background:#ff9f4322;
  color:#ff9f43;
}

.red{
  background:#ff665722;
  color:#ff8a7f;
}

/* MEMBER */

.memberhero{
  display:grid;

  grid-template-columns:
    1.3fr .7fr;

  gap:16px;
}

.big{
  font-family:
    'Barlow Condensed';

  font-size:130px;

  font-weight:900;

  line-height:.75;

  color:#b8ff3d;

  text-shadow:
    0 0 50px
    #b8ff3d20;
}

.progress{
  height:12px;

  background:#11171e;

  border-radius:999px;

  overflow:hidden;
}

.bar{
  height:100%;

  background:
    linear-gradient(
      90deg,
      #b8ff3d,
      #40e7ff
    );

  transition:
    1s;

  width:0;
}

.mini{
  font-size:12px;
  color:#91a0ad;
}

/* TOAST */

.toast{
  position:fixed;

  right:18px;
  bottom:18px;

  background:#111820;

  border:
    1px solid #ffffff18;

  padding:
    14px 17px;

  border-radius:12px;

  z-index:100;

  box-shadow:
    0 20px 60px
    #0008;
}

/* ANIMATION */

@keyframes float{

  50%{
    transform:
      translateY(-20px)
      rotateY(12deg);
  }

}

@keyframes spin{

  to{
    transform:
      rotate(360deg);
  }

}

/* MOBILE */

@media(max-width:850px){

  .hero,
  .memberhero{
    grid-template-columns:1fr;
  }

  .stage{
    height:400px;
    order:-1;
  }

  .cards,
  .formgrid{
    grid-template-columns:1fr;
  }

  .head{
    align-items:start;
    flex-direction:column;
  }

  .head h1{
    font-size:52px;
  }

  .big{
    font-size:90px;
  }

  .top{
    height:auto;
    min-height:70px;
  }

  .title{
    font-size:78px;
  }

}

</style>

</head>

<body>

<div id="app"></div>

<script>

const APP=
  document.getElementById('app');

let token=
  localStorage.tg_token||'';

let role=
  localStorage.tg_role||'';

/*
  The SVG is inserted as a normal JavaScript
  template string. It is deliberately generated
  by the server so nested HTML does not break
  the main server.js template literal.
*/

const LOGO=\`${logo}\`;

/* =========================================================
   CLIENT HELPERS
========================================================= */

const esc=v=>
  String(v??'')
  .replace(
    /[&<>"']/g,
    c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c])
  );

const shell=x=>
  APP.innerHTML=
    '<div class="bg"></div>'+
    '<div class="noise"></div>'+
    x;

const footer=()=>
  '<div class="footer">'+
  'TheGym +91 70079 47859 · '+
  'WhatsApp +91 78958 32442 · '+
  '®CareerBoot ©2026'+
  '</div>';

const top=t=>
  '<header class="top">'+

    '<div class="brand">'+
      LOGO+
      '<span>THEGYM</span>'+
    '</div>'+

    '<div style="display:flex;gap:8px;align-items:center">'+

      '<span class="pill">'+
        esc(t)+
      '</span>'+

      '<button class="btn ghost" onclick="logout()">'+
        'LOG OUT'+
      '</button>'+

    '</div>'+

  '</header>';

const toast=m=>{

  const x=
    document.createElement('div');

  x.className='toast';

  x.textContent=m;

  document.body.appendChild(x);

  setTimeout(
    ()=>x.remove(),
    2600
  );

};

/* =========================================================
   API
========================================================= */

async function api(u,o={}){

  o.headers={
    ...(o.headers||{}),

    Authorization:
      'Bearer '+token,

    'Content-Type':
      'application/json'
  };

  const r=
    await fetch(u,o);

  const d=
    await r.json();

  if(!r.ok){

    if(r.status===401){

      localStorage.clear();

      token='';
      role='';

      landing();
    }

    throw Error(
      d.error||
      'Request failed'
    );
  }

  return d;
}

/* =========================================================
   LANDING
========================================================= */

function landing(){

  shell(

    '<header class="top">'+

      '<div class="brand">'+
        LOGO+
        '<span>THEGYM</span>'+
      '</div>'+

      '<span class="pill">'+
        'PREMIUM FITNESS SYSTEM'+
      '</span>'+

    '</header>'+

    '<main class="wrap hero">'+

      '<div>'+

        '<div class="eyebrow">'+
          'NEXT-GENERATION GYM EXPERIENCE'+
        '</div>'+

        '<div class="title">'+
          'TRAIN<br>'+
          '<span>HARDER.</span><br>'+
          'LIVE<br>'+
          'STRONG.'+
        '</div>'+

        '<p class="sub">'+
          'A premium performance platform for TheGym members and management. '+
          'Secure access, live progress tracking and an immersive gym atmosphere.'+
        '</p>'+

        '<div class="cta">'+

          '<button class="btn primary" onclick="login()">'+
            'ENTER THEGYM →'+
          '</button>'+

          '<span class="pill">'+
            '4K UI · 3D-STYLE · LIVE DATA'+
          '</span>'+

        '</div>'+

      '</div>'+

      '<div class="stage">'+
        '<div class="orb"></div>'+
      '</div>'+

    '</main>'+

    footer()
  );
}

/* =========================================================
   LOGIN
========================================================= */

function login(){

  shell(

    '<main class="auth">'+

      '<div class="authbox">'+

        '<div class="glass">'+

          LOGO+

          '<div class="eyebrow" style="margin-top:20px">'+
            'THEGYM // SECURE ACCESS'+
          '</div>'+

          '<h1 style="font-size:70px;margin:12px 0">'+
            'ENTER ACCESS'+
          '</h1>'+

          '<p class="sub" style="margin:0 auto 24px">'+
            'Enter your assigned Secret Key. '+
            'TheGym automatically routes you to the correct secure panel.'+
          '</p>'+

          '<input id="key" class="key" '+
            'placeholder="SECRET KEY" '+
            'autocomplete="off">'+

          '<div style="margin-top:16px">'+

            '<button class="btn primary" onclick="doLogin()">'+
              'ACCESS THEGYM →'+
            '</button>'+

          '</div>'+

          '<div id="err" class="mini" '+
            'style="margin-top:15px">'+
          '</div>'+

        '</div>'+

      '</div>'+

    '</main>'+

    footer()
  );

  document
    .getElementById('key')
    .onkeydown=e=>
      e.key==='Enter'&&
      doLogin();
}

/* =========================================================
   LOGIN REQUEST
========================================================= */

async function doLogin(){

  const err=
    document.getElementById('err');

  err.textContent='';

  try{

    const r=
      await fetch(
        '/api/login',
        {
          method:'POST',

          headers:{
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              key:
                document
                .getElementById('key')
                .value
                .trim()
            })
        }
      );

    const d=
      await r.json();

    if(!r.ok)
      throw Error(d.error);

    token=d.token;
    role=d.role;

    localStorage.tg_token=token;
    localStorage.tg_role=role;

    route();

  }catch(e){

    err.textContent=
      e.message;

  }
}

/* =========================================================
   LOGOUT
========================================================= */

function logout(){

  fetch(
    '/api/logout',
    {
      method:'POST',

      headers:{
        Authorization:
          'Bearer '+token
      }
    }
  ).finally(()=>{

    localStorage.clear();

    token='';
    role='';

    landing();

  });
}

/* =========================================================
   ROUTING
========================================================= */

function route(){

  if(!token||!role)
    return landing();

  if(role==='member')
    return memberPage();

  if(role==='supreme')
    return supremePage();

  return adminPage();
}

/* =========================================================
   DATE
========================================================= */

function fmt(x){

  if(!x)return '-';

  return new Date(
    x+'T00:00:00'
  ).toLocaleDateString(
    'en-IN',
    {
      day:'2-digit',
      month:'short',
      year:'numeric'
    }
  );
}

/* =========================================================
   FEE BADGE
========================================================= */

function badge(s){

  return '<span class="badge '+
    s.tone+
    '">'+
    esc(s.status)+
    '</span>';
}

/* =========================================================
   ADMIN PANEL
========================================================= */

function adminPage(){

  shell(

    top('ADMIN PANEL')+

    '<main class="wrap dash">'+

      '<div class="head">'+

        '<div>'+

          '<div class="eyebrow">'+
            'CONTROL CENTER'+
          '</div>'+

          '<h1>ADMIN PANEL</h1>'+

          '<p class="sub">'+
            'Register members and maintain current performance data.'+
          '</p>'+

        '</div>'+

      '</div>'+

      '<div class="cards">'+

        '<div class="glass stat">'+
          '<small>ROLE</small>'+
          '<b>ADMIN</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>MEMBER MANAGEMENT</small>'+
          '<b>LIVE</b>'+
        '</div>'+

      '</div>'+

      '<div class="actions" style="margin:16px 0">'+

        '<button class="btn primary" '+
          'onclick="registerPage()">'+
          '+ MEMBERS REGISTER PAGE'+
        '</button>'+

        '<button class="btn" '+
          'onclick="profilePage()">'+
          'MEMBERS PROFILE PAGE'+
        '</button>'+

      '</div>'+

      '<div id="content"></div>'+

    '</main>'+

    footer()
  );

  loadMembers('content');
}

/* =========================================================
   MEMBER LIST
========================================================= */

async function loadMembers(id){

  const box=
    document.getElementById(id);

  try{

    const d=
      await api('/api/members');

    box.innerHTML=

      '<div class="glass panel">'+

        '<h2>MEMBERS</h2>'+

        '<div class="tablewrap">'+

          '<table class="table">'+

            '<thead>'+
              '<tr>'+
                '<th>Name</th>'+
                '<th>Joining</th>'+
                '<th>Current</th>'+
                '<th>Goal</th>'+
                '<th>Growth</th>'+
                '<th>Fees</th>'+
              '</tr>'+
            '</thead>'+

            '<tbody>'+

              d.members.map(
                m=>
                '<tr>'+
                  '<td>'+esc(m.name)+'</td>'+
                  '<td>'+fmt(m.joiningDate)+'</td>'+
                  '<td>'+m.currentWeight+' kg</td>'+
                  '<td>'+m.goalWeight+' kg</td>'+
                  '<td>'+m.growth+'%</td>'+
                  '<td>₹'+m.fee+'</td>'+
                '</tr>'
              ).join('')+

            '</tbody>'+

          '</table>'+

        '</div>'+

      '</div>';

  }catch(e){

    box.innerHTML=
      '<div class="glass panel">'+
      esc(e.message)+
      '</div>';

  }
}

/* =========================================================
   MEMBER REGISTER
========================================================= */

function registerPage(){

  document.getElementById('content').innerHTML=

    '<div class="glass panel">'+

      '<h2>MEMBERS REGISTER</h2>'+

      '<form id="reg" class="formgrid">'+

        '<div class="field">'+
          '<label>Name</label>'+
          '<input name="name" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Secret Key</label>'+
          '<input name="secretKey" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Joining Date</label>'+
          '<input name="joiningDate" type="date" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Joining Day Weight (kg)</label>'+
          '<input name="joiningWeight" type="number" step="0.1" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Goal Category</label>'+
          '<select name="goalCategory">'+
            '<option>Loss</option>'+
            '<option>Gain</option>'+
          '</select>'+
        '</div>'+

        '<div class="field">'+
          '<label>Goal Weight (kg)</label>'+
          '<input name="goalWeight" type="number" step="0.1" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Members Fees</label>'+
          '<select name="fee">'+
            '<option value="500">₹500</option>'+
            '<option value="700">₹700</option>'+
          '</select>'+
        '</div>'+

        '<div class="field">'+
          '<label>Contact Number</label>'+
          '<input name="contact" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Last Fees Submission Date</label>'+
          '<input name="lastFeeDate" type="date" required>'+
        '</div>'+

        '<div class="full actions">'+

          '<button class="btn primary">'+
            'CREATE MEMBER'+
          '</button>'+

          '<button type="button" class="btn" '+
            'onclick="profilePage()">'+
            'VIEW PROFILES'+
          '</button>'+

        '</div>'+

      '</form>'+

    '</div>';

  document
    .getElementById('reg')
    .onsubmit=async e=>{

      e.preventDefault();

      const o=
        Object.fromEntries(
          new FormData(e).entries()
        );

      try{

        await api(
          '/api/members',
          {
            method:'POST',
            body:
              JSON.stringify(o)
          }
        );

        toast(
          'Member created successfully'
        );

        e.target.reset();

        loadMembers('content');

      }catch(x){

        toast(x.message);

      }
    };
}

/* =========================================================
   MEMBER PROFILE
========================================================= */

async function profilePage(){

  const d=
    await api('/api/members');

  document.getElementById(
    'content'
  ).innerHTML=

    '<div class="glass panel">'+

      '<h2>MEMBERS PROFILE</h2>'+

      '<div class="tablewrap">'+

        '<table class="table">'+

          '<thead>'+
            '<tr>'+
              '<th>Name</th>'+
              '<th>Joining Date</th>'+
              '<th>Current Day Weight</th>'+
              '<th>Joining Weight</th>'+
              '<th>Growth Status</th>'+
              '<th>Update</th>'+
            '</tr>'+
          '</thead>'+

          '<tbody>'+

            d.members.map(
              m=>

              '<tr>'+

                '<td>'+
                  esc(m.name)+
                '</td>'+

                '<td>'+
                  fmt(m.joiningDate)+
                '</td>'+

                '<td>'+
                  '<input id="w_'+m.id+'" '+
                  'value="'+m.currentWeight+'" '+
                  'type="number" step="0.1" '+
                  'style="width:100px">'+
                '</td>'+

                '<td>'+
                  m.joiningWeight+
                  ' kg'+
                '</td>'+

                '<td>'+
                  m.growth+
                  '%'+
                '</td>'+

                '<td>'+
                  '<button class="btn" '+
                  'onclick="updateWeight(\''+
                  m.id+
                  '\')">'+
                  'SAVE'+
                  '</button>'+
                '</td>'+

              '</tr>'
            ).join('')+

          '</tbody>'+

        '</table>'+

      '</div>'+

    '</div>';
}

/* =========================================================
   UPDATE WEIGHT
========================================================= */

async function updateWeight(id){

  const v=
    document.getElementById(
      'w_'+id
    ).value;

  try{

    await api(
      '/api/members/'+id,
      {
        method:'PATCH',

        body:
          JSON.stringify({
            currentWeight:v
          })
      }
    );

    toast(
      'Weight updated'
    );

    profilePage();

  }catch(e){

    toast(e.message);

  }
}

/* =========================================================
   SUPREME ADMIN
========================================================= */

async function supremePage(){

  const d=
    await api('/api/report');

  shell(

    top('SUPREME ADMIN')+

    '<main class="wrap dash">'+

      '<div class="head">'+

        '<div>'+

          '<div class="eyebrow">'+
            'SUPREME CONTROL // DAILY REPORT'+
          '</div>'+

          '<h1>REPORT DASHBOARD</h1>'+

          '<p class="sub">'+
            'Daily-to-monthly member fees and growth overview. '+
            'Date refreshes on every dashboard login.'+
          '</p>'+

        '</div>'+

      '</div>'+

      '<div class="cards">'+

        '<div class="glass stat">'+
          '<small>MEMBERS</small>'+
          '<b>'+
            d.members.length+
          '</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>TODAY</small>'+
          '<b>'+
            fmt(d.today)+
          '</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>TOTAL PLAN VALUE</small>'+
          '<b>₹'+
            d.members.reduce(
              (a,m)=>a+m.fee,
              0
            )+
          '</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>OVERDUE</small>'+
          '<b>'+
            d.members.filter(
              m=>m.feeStatus.daysGone>30
            ).length+
          '</b>'+
        '</div>'+

      '</div>'+

      '<div class="glass panel">'+

        '<div class="tablewrap">'+

          '<table class="table">'+

            '<thead>'+

              '<tr>'+

                '<th>SL No.</th>'+
                '<th>Name</th>'+
                '<th>Date</th>'+
                '<th>Fees</th>'+
                '<th>Status</th>'+
                '<th>Growth</th>'+
                '<th>Contact</th>'+

              '</tr>'+

            '</thead>'+

            '<tbody>'+

              d.members.map(
                (m,i)=>

                '<tr>'+

                  '<td>'+
                    (i+1)+
                  '</td>'+

                  '<td>'+
                    esc(m.name)+
                  '</td>'+

                  '<td>'+
                    fmt(d.today)+
                  '</td>'+

                  '<td>'+
                    '₹'+m.fee+
                  '</td>'+

                  '<td>'+
                    badge(m.feeStatus)+
                  '</td>'+

                  '<td>'+
                    m.growth+
                    '%'+
                  '</td>'+

                  '<td>'+
                    esc(m.contact)+
                  '</td>'+

                '</tr>'

              ).join('')+

            '</tbody>'+

          '</table>'+

        '</div>'+

      '</div>'+

    '</main>'+

    footer()
  );
}

/* =========================================================
   MEMBER PERFORMANCE
========================================================= */

async function memberPage(){

  const d=
    await api('/api/me');

  const m=d.member;

  const p=
    Math.max(
      0,
      Math.min(
        100,
        m.growth
      )
    );

  shell(

    top('MEMBER PERFORMANCE')+

    '<main class="wrap dash">'+

      '<div class="eyebrow">'+
        'PERSONAL PERFORMANCE // LIVE'+
      '</div>'+

      '<div class="memberhero">'+

        '<div class="glass panel">'+

          '<div class="mini">'+
            'WELCOME BACK'+
          '</div>'+

          '<h1 style="font-size:72px;margin:8px 0">'+
            esc(m.name)+
          '</h1>'+

          '<div class="mini">'+
            'GOAL: '+
            m.goalCategory+
            ' · TARGET '+
            m.goalWeight+
            ' KG'+
          '</div>'+

          '<div class="big">'+
            p+
            '%'+
          '</div>'+

          '<div class="mini">'+
            'GROWTH STATUS'+
          '</div>'+

          '<div class="progress" style="margin-top:14px">'+

            '<div class="bar" '+
              'style="width:'+p+'%">'+
            '</div>'+

          '</div>'+

        '</div>'+

        '<div class="glass panel">'+

          '<h2>YOUR STATS</h2>'+

          '<p>'+
            'Joining Weight '+
            '<b style="float:right">'+
              m.joiningWeight+
              ' kg'+
            '</b>'+
          '</p>'+

          '<p>'+
            'Current Weight '+
            '<b style="float:right">'+
              m.currentWeight+
              ' kg'+
            '</b>'+
          '</p>'+

          '<p>'+
            'Goal Weight '+
            '<b style="float:right">'+
              m.goalWeight+
              ' kg'+
            '</b>'+
          '</p>'+

          '<p>'+
            'Plan Fee '+
            '<b style="float:right">'+
              '₹'+
              m.fee+
            '</b>'+
          '</p>'+

          '<p>'+
            'Joining Date '+
            '<b style="float:right">'+
              fmt(m.joiningDate)+
            '</b>'+
          '</p>'+

        '</div>'+

      '</div>'+

    '</main>'+

    footer()
  );
}

/* =========================================================
   INITIAL ROUTE
========================================================= */

if(token)
  route();
else
  landing();

</script>

</body>

</html>`;

/* =========================================================
   SEND FRONTEND
========================================================= */

function sendHTML(res){

  res.writeHead(
    200,
    {
      'Content-Type':
        'text/html; charset=utf-8',

      'Cache-Control':
        'no-cache'
    }
  );

  res.end(html);
}

/* =========================================================
   MONGODB
========================================================= */

async function start(){

  if(!URI){

    console.error(
      'MONGODB_URI is missing'
    );

    process.exit(1);
  }

  const client=
    new MongoClient(
      URI,
      {
        serverSelectionTimeoutMS:
          10000,

        maxPoolSize:
          10
      }
    );

  await client.connect();

  db=
    client.db(DB);

  members=
    db.collection(
      'members'
    );

  await members.createIndex(
    {
      secretKeyHash:1
    },
    {
      unique:true
    }
  );

  console.log(
    'MongoDB connected:',
    DB
  );
}

/* =========================================================
   SERVER
========================================================= */

const server=
  http.createServer(
    async(req,res)=>{

      try{

        const u=
          new URL(
            req.url,
            'http://localhost'
          );

        /* HEALTH */

        if(
          u.pathname===
          '/health'
        ){

          return j(
            res,
            200,
            {
              ok:true,
              name:'TheGym',
              database:!!db
            }
          );
        }

        /* ===================================================
           LOGIN
        =================================================== */

        if(
          u.pathname===
          '/api/login' &&
          req.method===
          'POST'
        ){

          const b=
            await body(req);

          const key=
            String(
              b.key||''
            ).trim();

          let role;
          let identity='';

          if(
            key===
            SUPREME_KEY
          ){

            role='supreme';

          }else if(
            key===
            ADMIN_KEY
          ){

            role='admin';

          }else{

            const m=
              await members.findOne(
                {
                  secretKeyHash:
                    hash(key),

                  active:{
                    $ne:false
                  }
                }
              );

            if(!m){

              return j(
                res,
                401,
                {
                  error:
                    'Invalid Secret Key'
                }
              );
            }

            role='member';

            identity=
              String(
                m._id
              );
          }

          const t=
            crypto
            .randomBytes(32)
            .toString('hex');

          sessions.set(
            t,
            {
              role,
              identity,
              createdAt:
                Date.now()
            }
          );

          return j(
            res,
            200,
            {
              token:t,
              role
            }
          );
        }

        /* ===================================================
           LOGOUT
        =================================================== */

        if(
          u.pathname===
          '/api/logout' &&
          req.method===
          'POST'
        ){

          const t=
            (
              req.headers.authorization||
              ''
            )
            .replace(
              /^Bearer\s+/i,
              ''
            );

          sessions.delete(t);

          return j(
            res,
            200,
            {
              ok:true
            }
          );
        }

        /* ===================================================
           ALL MEMBERS
        =================================================== */

        if(
          u.pathname===
          '/api/members' &&
          req.method===
          'GET'
        ){

          if(
            !guard(
              req,
              res,
              [
                'admin',
                'supreme'
              ]
            )
          )
            return;

          const arr=
            await members
            .find({})
            .sort({
              createdAt:1
            })
            .toArray();

          return j(
            res,
            200,
            {
              members:
                arr.map(clean)
            }
          );
        }

        /* ===================================================
           CREATE MEMBER
        =================================================== */

        if(
          u.pathname===
          '/api/members' &&
          req.method===
          'POST'
        ){

          if(
            !guard(
              req,
              res,
              [
                'admin',
                'supreme'
              ]
            )
          )
            return;

          const b=
            await body(req);

          const reqs=[
            'name',
            'secretKey',
            'joiningDate',
            'joiningWeight',
            'goalCategory',
            'goalWeight',
            'fee',
            'contact',
            'lastFeeDate'
          ];

          for(
            const k of reqs
          ){

            if(
              String(
                b[k]??''
              ).trim()===''
            ){

              return j(
                res,
                400,
                {
                  error:
                    'Missing field: '+
                    k
                }
              );
            }
          }

          const name=
            String(
              b.name
            ).trim();

          const secretKey=
            String(
              b.secretKey
            ).trim();

          const joiningDate=
            String(
              b.joiningDate
            );

          const lastFeeDate=
            String(
              b.lastFeeDate
            );

          const joiningWeight=
            +b.joiningWeight;

          const goalWeight=
            +b.goalWeight;

          const goalCategory=
            b.goalCategory===
            'Gain'
              ?'Gain'
              :'Loss';

          const fee=
            +b.fee===
            700
              ?700
              :500;

          const contact=
            String(
              b.contact
            ).trim();

          /* DATE / WEIGHT VALIDATION */

          if(
            !/^\d{4}-\d{2}-\d{2}$/
              .test(joiningDate) ||

            !/^\d{4}-\d{2}-\d{2}$/
              .test(lastFeeDate) ||

            !Number.isFinite(
              joiningWeight
            ) ||

            joiningWeight<=0 ||

            !Number.isFinite(
              goalWeight
            ) ||

            goalWeight<=0
          ){

            return j(
              res,
              400,
              {
                error:
                  'Please enter valid dates and positive weights.'
              }
            );
          }

          /* REALISTIC LOSS GOAL */

          if(
            goalCategory===
              'Loss' &&
            goalWeight>=
              joiningWeight
          ){

            return j(
              res,
              400,
              {
                error:
                  'For Weight Loss, Goal Weight should be lower than Joining Weight.'
              }
            );
          }

          /* REALISTIC GAIN GOAL */

          if(
            goalCategory===
              'Gain' &&
            goalWeight<=
              joiningWeight
          ){

            return j(
              res,
              400,
              {
                error:
                  'For Weight Gain, Goal Weight should be higher than Joining Weight.'
              }
            );
          }

          /* CONTACT */

          if(
            !/^[0-9+()\-\s]{7,20}$/
              .test(contact)
          ){

            return j(
              res,
              400,
              {
                error:
                  'Please enter a valid contact number.'
              }
            );
          }

          try{

            const m={

              name,

              secretKeyHash:
                hash(secretKey),

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

            const r=
              await members
              .insertOne(m);

            return j(
              res,
              201,
              {
                member:
                  clean({
                    ...m,
                    _id:
                      r.insertedId
                  })
              }
            );

          }catch(e){

            if(
              e.code===
              11000
            ){

              return j(
                res,
                409,
                {
                  error:
                    'Secret Key already assigned to another member.'
                }
              );
            }

            throw e;
          }
        }

        /* ===================================================
           UPDATE MEMBER
        =================================================== */

        const mr=
          u.pathname.match(
            /^\/api\/members\/([^/]+)$/
          );

        if(
          mr &&
          req.method===
          'PATCH'
        ){

          if(
            !guard(
              req,
              res,
              [
                'admin',
                'supreme'
              ]
            )
          )
            return;

          let id;

          try{

            id=
              new ObjectId(
                decodeURIComponent(
                  mr[1]
                )
              );

          }catch{

            return j(
              res,
              400,
              {
                error:
                  'Invalid member ID'
              }
            );
          }

          const b=
            await body(req);

          const set={
            updatedAt:
              new Date()
          };

          /* CURRENT WEIGHT */

          if(
            b.currentWeight!==
            undefined
          ){

            const w=
              +b.currentWeight;

            if(
              !Number.isFinite(w)||
              w<=0
            ){

              return j(
                res,
                400,
                {
                  error:
                    'Invalid current weight'
                }
              );
            }

            set.currentWeight=w;
          }

          /* LAST FEE DATE */

          if(
            b.lastFeeDate!==
            undefined
          ){

            if(
              !/^\d{4}-\d{2}-\d{2}$/
                .test(
                  String(
                    b.lastFeeDate
                  )
                )
            ){

              return j(
                res,
                400,
                {
                  error:
                    'Invalid fee date'
                }
              );
            }

            set.lastFeeDate=
              String(
                b.lastFeeDate
              );
          }

          if(
            b.name!==undefined
          )
            set.name=
              String(
                b.name
              ).trim();

          if(
            b.contact!==undefined
          )
            set.contact=
              String(
                b.contact
              ).trim();

          if(
            b.active!==undefined
          )
            set.active=
              !!b.active;

          const r=
            await members.updateOne(
              {
                _id:id
              },
              {
                $set:set
              }
            );

          if(
            !r.matchedCount
          ){

            return j(
              res,
              404,
              {
                error:
                  'Member not found'
              }
            );
          }

          const updated=
            await members.findOne({
              _id:id
            });

          return j(
            res,
            200,
            {
              member:
                clean(updated)
            }
          );
        }

        /* ===================================================
           SUPREME REPORT
        =================================================== */

        if(
          u.pathname===
          '/api/report' &&
          req.method===
          'GET'
        ){

          if(
            !guard(
              req,
              res,
              ['supreme']
            )
          )
            return;

          const arr=
            await members
            .find({})
            .sort({
              createdAt:1
            })
            .toArray();

          return j(
            res,
            200,
            {
              today:
                new Date()
                .toISOString()
                .slice(0,10),

              members:
                arr.map(
                  m=>({
                    ...clean(m),
                    feeStatus:
                      feeStatus(m)
                  })
                )
            }
          );
        }

        /* ===================================================
           MEMBER PROFILE
        =================================================== */

        if(
          u.pathname===
          '/api/me' &&
          req.method===
          'GET'
        ){

          const s=
            guard(
              req,
              res,
              ['member']
            );

          if(!s)
            return;

          let id;

          try{

            id=
              new ObjectId(
                s.identity
              );

          }catch{

            return j(
              res,
              401,
              {
                error:
                  'Invalid session'
              }
            );
          }

          const m=
            await members.findOne(
              {
                _id:id,

                active:{
                  $ne:false
                }
              }
            );

          if(!m){

            return j(
              res,
              404,
              {
                error:
                  'Member not found'
              }
            );
          }

          return j(
            res,
            200,
            {
              member:
                clean(m)
            }
          );
        }

        /* FRONTEND */

        sendHTML(res);

      }catch(e){

        console.error(e);

        j(
          res,
          500,
          {
            error:
              'Server error'
          }
        );
      }
    }
  );

/* =========================================================
   START
========================================================= */

start()

.then(()=>{

  server.listen(
    PORT,
    ()=>{
      console.log(
        'TheGym running on port '+
        PORT
      );
    }
  );

})

.catch(e=>{

  console.error(
    'MongoDB connection failed:',
    e.message
  );

  process.exit(1);
});
