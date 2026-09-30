const http=require('http');
const crypto=require('crypto');
const {MongoClient,ObjectId}=require('mongodb');

const PORT=Number(process.env.PORT||3000);
const DB=process.env.DB_NAME||'thegym';

const ADMIN_KEY=process.env.ADMIN_KEY||'SKTCB';
const SUPREME_KEY=process.env.SUPREME_KEY||'VAIVAIXXXI';

const URI=process.env.MONGODB_URI||'';
const SESSION_SECRET=
  process.env.SESSION_SECRET||'CHANGE_THIS_SECRET';

if(!URI){
  console.error('MONGODB_URI is missing.');
  process.exit(1);
}

let db;
let members;

const sessions=new Map();

const hash=s=>
  crypto
    .createHash('sha256')
    .update(String(s))
    .digest('hex');

const token=(r,i='')=>
  crypto
    .createHmac('sha256',SESSION_SECRET)
    .update(
      r+'|'+i+'|'+crypto.randomUUID()
    )
    .digest('hex');

const sess=req=>
  sessions.get(
    (req.headers.authorization||'')
      .replace(/^Bearer\s+/i,'')
  );

const send=(res,status,data)=>{
  res.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    }
  );

  res.end(
    JSON.stringify(data)
  );
};

const body=req=>
  new Promise((ok,bad)=>{
    let s='';

    req.on('data',c=>{
      s+=c;

      if(s.length>1e6){
        req.destroy();
      }
    });

    req.on('end',()=>{
      try{
        ok(
          s
            ?JSON.parse(s)
            :{}
        );
      }catch(e){
        bad(e);
      }
    });

    req.on('error',bad);
  });

function guard(req,res,roles){

  const s=sess(req);

  if(
    !s ||
    !roles.includes(s.role)
  ){
    send(
      res,
      401,
      {
        error:'Unauthorized'
      }
    );

    return null;
  }

  return s;
}

function growth(m){

  const a=+m.joiningWeight;
  const c=+m.currentWeight;
  const g=+m.goalWeight;

  if(
    !a ||
    !g ||
    a===g ||
    !Number.isFinite(c)
  ){
    return 0;
  }

  const p=
    m.goalCategory==='Loss'
      ?((a-c)/(a-g))*100
      :((c-a)/(g-a))*100;

  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        p
      )
    )*10
  )/10;
}

function clean(m){

  if(!m){
    return null;
  }

  const x={
    ...m,
    id:String(m._id),
    growth:growth(m)
  };

  delete x._id;
  delete x.secretKeyHash;

  return x;
}

function days(s){

  const d=
    new Date(
      s+'T00:00:00'
    );

  const n=new Date();

  n.setHours(
    0,
    0,
    0,
    0
  );

  return Math.floor(
    (n-d)/86400000
  );
}

function feeStatus(m){

  const gone=
    days(m.lastFeeDate);

  const left=
    30-gone;

  return {
    gone,
    left,

    text:
      gone>30
        ?gone+' DAYS GONE'
        :left+' DAYS BALANCE',

    cls:
      gone>30
        ?'red'
        :left>=20
          ?'green'
          :left>=11
            ?'yellow'
            :'orange'
  };
}

function esc(s){

  return String(
    s??''
  ).replace(
    /[&<>"']/g,
    c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c])
  );
}


/* =========================================================
   TG SVG LOGO
========================================================= */

const logo=
'<svg class="logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+
'<rect x="4" y="4" width="92" height="92" rx="24" fill="#b8ff3d"/>'+
'<path d="M20 27h14v17h32V27h14v46H66V59H34v14H20z" fill="#071006"/>'+
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
TheGym
</title>

<style>

@import url(
'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap'
);

:root{
  --lime:#b8ff3d;
  --cyan:#40e7ff;
  --bg:#05070a;
  --muted:#91a0ad;
  --line:#ffffff15;
  --red:#ff6657;
  --orange:#ff9f43;
  --yellow:#ffd34e;
}

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  background:var(--bg);
  color:#fff;
  font-family:
    Inter,
    system-ui,
    sans-serif;
}

body{
  overflow-x:hidden;
}

.bg{
  position:fixed;
  inset:0;
  z-index:-3;

  background:
    radial-gradient(
      circle at 75% 15%,
      #40e7ff20,
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
      #090d12 55%,
      #040608
    );
}

.noise{
  position:fixed;
  inset:0;
  z-index:-2;
  opacity:.04;
  pointer-events:none;

  background-image:url(
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"
  );
}

.top{
  height:76px;
  padding:12px 4vw;

  display:flex;
  align-items:center;
  justify-content:space-between;

  border-bottom:
    1px solid var(--line);

  background:#030507b8;

  backdrop-filter:
    blur(18px);

  position:sticky;
  top:0;
  z-index:20;
}

.brand{
  display:flex;
  align-items:center;
  gap:12px;

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

.eyebrow{
  font-size:12px;
  letter-spacing:.22em;
  color:var(--lime);
  font-weight:900;
}

.title,
h1,
h2,
h3{
  font-family:
    'Barlow Condensed',
    sans-serif;

  text-transform:uppercase;
}

.title{
  font-size:
    clamp(72px,10vw,160px);

  line-height:.78;

  font-weight:900;

  letter-spacing:-.04em;

  margin:
    18px 0 25px;
}

.title span{
  color:var(--lime);

  text-shadow:
    0 0 40px
    #b8ff3d44;
}

.sub{
  color:var(--muted);
  line-height:1.7;
  max-width:680px;
}

.btn{
  border:
    1px solid var(--line);

  background:#0b1016;
  color:#fff;

  padding:
    12px 17px;

  border-radius:11px;

  cursor:pointer;

  font-weight:800;

  transition:.2s;
}

.btn:hover{
  transform:
    translateY(-2px);

  border-color:
    #ffffff44;
}

.primary{
  background:
    var(--lime);

  color:#071006;

  border-color:
    var(--lime);

  box-shadow:
    0 0 28px
    #b8ff3d33;
}

.pill,
.tag{
  display:inline-flex;
  align-items:center;

  border:
    1px solid var(--line);

  border-radius:999px;

  padding:
    7px 11px;

  font-size:11px;

  font-weight:900;

  letter-spacing:.08em;

  color:#cbd3da;

  background:#ffffff08;
}

.hero{
  min-height:
    calc(100vh - 76px);

  display:grid;

  grid-template-columns:
    1fr 1fr;

  align-items:center;

  gap:30px;

  padding:5vh 0;
}

.cta{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  margin-top:28px;
}

.stage{
  height:620px;
  position:relative;

  display:grid;
  place-items:center;

  perspective:1000px;
}

.orb{
  width:min(410px,70vw);

  aspect-ratio:1;

  border-radius:50%;

  background:
    radial-gradient(
      circle at 35% 28%,
      #fff,
      #b8ff3d 8%,
      #17300a 25%,
      #060b0d 58%,
      #000
    );

  box-shadow:
    0 0 100px #b8ff3d33,
    inset -40px -30px 80px #000;

  animation:
    float 5s ease-in-out infinite;

  position:relative;
}

.orb:before,
.orb:after{
  content:'';

  position:absolute;

  border:
    1px solid #b8ff3d55;

  border-radius:50%;

  inset:8%;

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

.glass{
  background:
    linear-gradient(
      145deg,
      #11161dbd,
      #05080ca8
    );

  border:
    1px solid var(--line);

  border-radius:20px;

  padding:22px;

  box-shadow:
    0 25px 70px #0008,
    inset 0 1px #ffffff08;

  backdrop-filter:
    blur(18px);
}

.auth{
  min-height:
    calc(100vh - 76px);

  display:grid;
  place-items:center;

  padding:30px;
}

.authbox{
  width:min(540px,94vw);
  text-align:center;
}

.authbox .glass{
  padding:42px;
}

.key,
.field input,
.field select{
  width:100%;

  padding:14px;

  border-radius:11px;

  border:
    1px solid var(--line);

  background:#070b10;

  color:#fff;

  outline:none;
}

.key{
  text-align:center;
  letter-spacing:.18em;
  font-weight:800;
}

.key:focus,
.field input:focus,
.field select:focus{
  border-color:
    #b8ff3d88;

  box-shadow:
    0 0 0 4px
    #b8ff3d10;
}

.dash{
  padding:
    30px 0 60px;
}

.head{
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:20px;

  margin-bottom:20px;
}

.head h1{
  font-size:68px;
  line-height:.9;
  margin:8px 0;
}

.cards,
.grid{
  display:grid;

  grid-template-columns:
    repeat(4,1fr);

  gap:14px;
}

.stat small,
.mini{
  color:var(--muted);
  font-size:11px;
}

.stat b{
  display:block;

  font-family:
    'Barlow Condensed';

  font-size:48px;

  margin-top:7px;
}

.panel{
  margin-top:16px;
}

.actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.formgrid{
  display:grid;

  grid-template-columns:
    repeat(2,1fr);

  gap:13px;
}

.field{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.field label{
  font-size:11px;
  color:var(--muted);

  text-transform:
    uppercase;

  letter-spacing:.12em;
}

.full{
  grid-column:1/-1;
}

.tablewrap{
  overflow:auto;
  border-radius:14px;
}

.table{
  width:100%;
  border-collapse:collapse;

  min-width:950px;
}

.table th,
.table td{
  padding:
    13px 11px;

  border-bottom:
    1px solid #ffffff0d;

  text-align:left;

  white-space:
    nowrap;
}

.table th{
  font-size:10px;
  color:#83909b;

  text-transform:
    uppercase;

  letter-spacing:.1em;
}

.tag.green{
  background:#b8ff3d20;
  color:var(--lime);
}

.tag.yellow{
  background:#ffd34e22;
  color:var(--yellow);
}

.tag.orange{
  background:#ff9f4322;
  color:var(--orange);
}

.tag.red{
  background:#ff665722;
  color:#ff8a7f;
}

.memberhero{
  display:grid;

  grid-template-columns:
    1.2fr .8fr;

  gap:16px;
}

.bigstat{
  font-family:
    'Barlow Condensed';

  font-size:130px;

  line-height:.75;

  color:var(--lime);

  text-shadow:
    0 0 50px
    #b8ff3d25;
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
      var(--lime),
      var(--cyan)
    );

  transition:1s;
}

.footer{
  text-align:center;

  padding:
    25px 15px 40px;

  color:#687580;

  font-size:11px;

  border-top:
    1px solid var(--line);
}

.toast{
  position:fixed;

  right:18px;
  bottom:18px;

  background:#111820;

  border:
    1px solid var(--line);

  padding:
    14px 17px;

  border-radius:12px;

  z-index:100;

  box-shadow:
    0 20px 60px #0008;
}

.sticker{
  position:absolute;

  width:55px;
  height:55px;

  border:
    1px solid #ffffff18;

  border-radius:15px;

  background:#ffffff08;

  backdrop-filter:
    blur(8px);

  display:grid;
  place-items:center;

  font-size:25px;

  animation:
    float 4s ease-in-out infinite;
}

.s1{
  top:12%;
  right:10%;
}

.s2{
  bottom:18%;
  left:8%;
  animation-delay:1s;
}

.s3{
  top:48%;
  right:2%;
  animation-delay:2s;
}

@keyframes float{

  50%{
    transform:
      translateY(-18px)
      rotateY(12deg);
  }

}

@keyframes spin{

  to{
    transform:
      rotate(360deg);
  }

}

@media(max-width:900px){

  .hero,
  .memberhero{
    grid-template-columns:1fr;
  }

  .stage{
    height:420px;
    order:-1;
  }

  .cards,
  .grid,
  .formgrid{
    grid-template-columns:
      1fr 1fr;
  }

  .head{
    align-items:start;
    flex-direction:column;
  }

  .title{
    font-size:80px;
  }

  .bigstat{
    font-size:90px;
  }

}

@media(max-width:560px){

  .cards,
  .grid,
  .formgrid{
    grid-template-columns:1fr;
  }

  .top{
    height:auto;
    min-height:70px;
  }

  .title{
    font-size:68px;
  }

  .authbox .glass{
    padding:25px;
  }

  .head h1{
    font-size:52px;
  }

}

</style>

</head>

<body>

<div id="app"></div>

<script>

var token=
  localStorage.getItem('tg_token')||'';

var role=
  localStorage.getItem('tg_role')||'';

var APP=
  document.getElementById('app');


function shell(x){

  APP.innerHTML=
    '<div class="bg"></div>'+
    '<div class="noise"></div>'+
    x;
}


function foot(){

  return '<div class="footer">'+
    'TheGym +91 70079 47859 · '+
    'WhatsApp +91 78958 32442 · '+
    '®CareerBoot ©2026'+
    '</div>';
}


function top(t){

  return '<header class="top">'+

    '<div class="brand">'+
      '${LOGO}'+
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
}


function toast(x){

  var d=
    document.createElement('div');

  d.className='toast';

  d.textContent=x;

  document.body.appendChild(d);

  setTimeout(
    function(){
      d.remove();
    },
    2600
  );
}


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


function api(url,opt){

  opt=opt||{};

  opt.headers=
    Object.assign(
      {},
      opt.headers||{},
      {
        Authorization:
          'Bearer '+token,

        'Content-Type':
          'application/json'
      }
    );

  return fetch(
    url,
    opt
  ).then(
    function(r){

      return r.json()
        .then(
          function(d){

            if(!r.ok){

              if(
                r.status===401
              ){

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
        );

    }
  );
}


/* =========================================================
   LANDING
========================================================= */

function landing(){

  shell(

    '<header class="top">'+

      '<div class="brand">'+
        '${LOGO}'+
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
            '4K UI · 4D-STYLE · LIVE DATA'+
          '</span>'+

        '</div>'+

      '</div>'+

      '<div class="stage">'+

        '<div class="orb"></div>'+

        '<div class="sticker s1">🏋️</div>'+
        '<div class="sticker s2">🔥</div>'+
        '<div class="sticker s3">⚡</div>'+

      '</div>'+

    '</main>'+

    foot()

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

          '${LOGO}'+

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

          '<input '+
            'id="key" '+
            'class="key" '+
            'placeholder="SECRET KEY" '+
            'autocomplete="off">'+

          '<div style="margin-top:16px">'+

            '<button '+
              'class="btn primary" '+
              'onclick="doLogin()">'+
              'ACCESS THEGYM →'+
            '</button>'+

          '</div>'+

          '<div '+
            'id="err" '+
            'class="mini" '+
            'style="margin-top:15px">'+
          '</div>'+

        '</div>'+

      '</div>'+

    '</main>'+

    foot()

  );

  document
    .getElementById('key')
    .onkeydown=
      function(e){

        if(
          e.key==='Enter'
        ){
          doLogin();
        }

      };
}


/* =========================================================
   LOGIN REQUEST
========================================================= */

function doLogin(){

  var e=
    document.getElementById(
      'err'
    );

  e.textContent='';

  fetch(
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
  )
  .then(
    function(r){

      return r.json()
        .then(
          function(d){

            if(!r.ok)
              throw Error(
                d.error
              );

            token=d.token;
            role=d.role;

            localStorage.setItem(
              'tg_token',
              token
            );

            localStorage.setItem(
              'tg_role',
              role
            );

            route();

          }
        );

    }
  )
  .catch(
    function(x){
      e.textContent=
        x.message;
    }
  );
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
  )
  .finally(
    function(){

      localStorage.clear();

      token='';
      role='';

      landing();

    }
  );
}


/* =========================================================
   ROUTER
========================================================= */

function route(){

  if(!token){
    return landing();
  }

  if(role==='admin'){
    return admin();
  }

  if(role==='supreme'){
    return supreme();
  }

  if(role==='member'){
    return member();
  }

  localStorage.clear();

  landing();
}


/* =========================================================
   ADMIN
========================================================= */

function admin(){

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
            'Create members, manage their records and maintain live performance data.'+
          '</p>'+

        '</div>'+

      '</div>'+

      '<div class="cards">'+

        '<div class="glass stat">'+
          '<small>ROLE</small>'+
          '<b>ADMIN</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>MEMBER SYSTEM</small>'+
          '<b>LIVE</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>FEES</small>'+
          '<b>₹500 / ₹700</b>'+
        '</div>'+

        '<div class="glass stat">'+
          '<small>GROWTH</small>'+
          '<b>LIVE %</b>'+
        '</div>'+

      '</div>'+

      '<div class="actions">'+

        '<button '+
          'class="btn primary" '+
          'onclick="registerPage()">'+
          '+ MEMBERS REGISTER PAGE'+
        '</button>'+

        '<button '+
          'class="btn" '+
          'onclick="profilePage()">'+
          'MEMBERS PROFILE PAGE'+
        '</button>'+

      '</div>'+

      '<div id="content"></div>'+

    '</main>'+

    foot()

  );

  loadMembers(
    'content'
  );
}


/* =========================================================
   REGISTER PAGE
========================================================= */

function registerPage(){

  document.getElementById(
    'content'
  ).innerHTML=

    '<div class="glass panel">'+

      '<h2>'+
        'MEMBERS REGISTER PAGE'+
      '</h2>'+

      '<p class="mini">'+
        'Create a member and assign their individual Secret Key.'+
      '</p>'+

      '<form id="reg" class="formgrid">'+

        '<div class="field">'+
          '<label>Name</label>'+
          '<input name="name" required>'+
        '</div>'+

        '<div class="field">'+
          '<label>Assign Secret Key</label>'+
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
            '<option value="Loss">'+
              'Weight Loss'+
            '</option>'+
            '<option value="Gain">'+
              'Weight Gain'+
            '</option>'+
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

        '<div class="field full">'+
          '<label>Last Fees Submission Date</label>'+
          '<input name="lastFeeDate" type="date" required>'+
        '</div>'+

        '<div class="full actions">'+

          '<button class="btn primary">'+
            'CREATE MEMBER'+
          '</button>'+

          '<button '+
            'type="button" '+
            'class="btn" '+
            'onclick="profilePage()">'+
            'VIEW PROFILES'+
          '</button>'+

        '</div>'+

      '</form>'+

    '</div>';

  document.getElementById(
    'reg'
  ).onsubmit=
    function(e){

      e.preventDefault();

      var o=
        Object.fromEntries(
          new FormData(e).entries()
        );

      api(
        '/api/members',
        {
          method:'POST',

          body:
            JSON.stringify(o)
        }
      )
      .then(
        function(){

          toast(
            'Member created successfully'
          );

          e.target.reset();

          loadMembers(
            'content'
          );

        }
      )
      .catch(
        function(x){
          toast(x.message);
        }
      );

    };
}


/* =========================================================
   MEMBER LIST
========================================================= */

function loadMembers(id){

  api(
    '/api/members'
  )
  .then(
    function(d){

      document.getElementById(
        id
      ).innerHTML=

        '<div class="glass panel">'+

          '<h2>MEMBERS</h2>'+

          '<div class="tablewrap">'+

            '<table class="table">'+

              '<thead>'+

                '<tr>'+

                  '<th>Name</th>'+
                  '<th>Joining Date</th>'+
                  '<th>Current Weight</th>'+
                  '<th>Goal</th>'+
                  '<th>Growth</th>'+
                  '<th>Fees</th>'+

                '</tr>'+

              '</thead>'+

              '<tbody>'+

                d.members
                  .map(
                    function(m){

                      return '<tr>'+

                        '<td>'+
                          esc(m.name)+
                        '</td>'+

                        '<td>'+
                          fmt(m.joiningDate)+
                        '</td>'+

                        '<td>'+
                          m.currentWeight+
                          ' kg'+
                        '</td>'+

                        '<td>'+
                          m.goalCategory+
                          ' · '+
                          m.goalWeight+
                          ' kg'+
                        '</td>'+

                        '<td>'+
                          m.growth+
                          '%'+
                        '</td>'+

                        '<td>'+
                          '₹'+
                          m.fee+
                        '</td>'+

                      '</tr>';

                    }
                  )
                  .join('')+

              '</tbody>'+

            '</table>'+

          '</div>'+

        '</div>';

    }
  )
  .catch(
    function(x){

      document.getElementById(
        id
      ).innerHTML=

        '<div class="glass panel">'+
          esc(x.message)+
        '</div>';

    }
  );
}


/* =========================================================
   MEMBER PROFILE
========================================================= */

function profilePage(){

  api(
    '/api/members'
  )
  .then(
    function(d){

      document.getElementById(
        'content'
      ).innerHTML=

        '<div class="glass panel">'+

          '<h2>'+
            'MEMBERS PROFILE PAGE'+
          '</h2>'+

          '<div class="tablewrap">'+

            '<table class="table">'+

              '<thead>'+

                '<tr>'+

                  '<th>Name</th>'+
                  '<th>Joining Date</th>'+
                  '<th>Current Day Weight</th>'+
                  '<th>Joining Date Weight</th>'+
                  '<th>Goal</th>'+
                  '<th>Growth Status</th>'+
                  '<th>Last Fee Date</th>'+
                  '<th>Update</th>'+

                '</tr>'+

              '</thead>'+

              '<tbody>'+

                d.members
                  .map(
                    function(m){

                      return '<tr>'+

                        '<td>'+
                          esc(m.name)+
                        '</td>'+

                        '<td>'+
                          fmt(m.joiningDate)+
                        '</td>'+

                        '<td>'+

                          '<input '+
                            'id="w_'+m.id+'" '+
                            'value="'+m.currentWeight+'" '+
                            'type="number" '+
                            'step="0.1" '+
                            'style="width:100px">'+

                        '</td>'+

                        '<td>'+
                          m.joiningWeight+
                          ' kg'+
                        '</td>'+

                        '<td>'+
                          m.goalCategory+
                          ' · '+
                          m.goalWeight+
                          ' kg'+
                        '</td>'+

                        '<td>'+
                          m.growth+
                          '%'+
                        '</td>'+

                        '<td>'+

                          '<input '+
                            'id="f_'+m.id+'" '+
                            'value="'+m.lastFeeDate+'" '+
                            'type="date" '+
                            'style="width:145px">'+

                        '</td>'+

                        '<td>'+

                          '<button '+
                            'class="btn" '+
                            'onclick="updateMember(\''+
                              m.id+
                            '\')">'+
                            'SAVE'+
                          '</button>'+

                        '</td>'+

                      '</tr>';

                    }
                  )
                  .join('')+

              '</tbody>'+

            '</table>'+

          '</div>'+

        '</div>';

    }
  );
}


/* =========================================================
   UPDATE MEMBER
========================================================= */

function updateMember(id){

  api(
    '/api/members/'+id,
    {
      method:'PATCH',

      body:
        JSON.stringify({
          currentWeight:
            document.getElementById(
              'w_'+id
            ).value,

          lastFeeDate:
            document.getElementById(
              'f_'+id
            ).value
        })
    }
  )
  .then(
    function(){

      toast(
        'Member profile updated'
      );

      profilePage();

    }
  )
  .catch(
    function(x){
      toast(x.message);
    }
  );
}


/* =========================================================
   FEE BADGE
========================================================= */

function badge(s){

  return '<span class="tag '+
    s.cls+
    '">'+
    esc(s.text)+
    '</span>';
}


/* =========================================================
   SUPREME ADMIN
========================================================= */

function supreme(){

  api(
    '/api/report'
  )
  .then(
    function(d){

      var overdue=
        d.members.filter(
          function(m){
            return m.feeStatus.gone>30;
          }
        ).length;

      var avg=
        d.members.length
          ?Math.round(
            d.members.reduce(
              function(a,m){
                return a+m.growth;
              },
              0
            )/
            d.members.length*
            10
          )/10
          :0;

      var rows=
        d.members
          .map(
            function(m,i){

              return '<tr>'+

                '<td>'+
                  (i+1)+
                '</td>'+

                '<td>'+
                  '<b>'+
                    esc(m.name)+
                  '</b>'+
                '</td>'+

                '<td>'+
                  fmt(d.today)+
                '</td>'+

                '<td>'+
                  '₹'+
                  m.fee+
                '</td>'+

                '<td>'+
                  badge(
                    m.feeStatus
                  )+
                '</td>'+

                '<td>'+
                  m.growth+
                  '%'+
                '</td>'+

                '<td>'+
                  esc(m.contact)+
                '</td>'+

              '</tr>';

            }
          )
          .join('');

      shell(

        top(
          'SUPREME ADMIN'
        )+

        '<main class="wrap dash">'+

          '<div class="head">'+

            '<div>'+

              '<div class="eyebrow">'+
                'SUPREME COMMAND // '+
                fmt(d.today)+
              '</div>'+

              '<h1>'+
                'REPORT DASHBOARD'+
              '</h1>'+

              '<p class="sub">'+
                'Daily-to-monthly member report. '+
                'Date refreshes with every login.'+
              '</p>'+

            '</div>'+

          '</div>'+

          '<div class="cards">'+

            '<div class="glass stat">'+
              '<small>ACTIVE MEMBERS</small>'+
              '<b>'+
                d.members.length+
              '</b>'+
            '</div>'+

            '<div class="glass stat">'+
              '<small>AVERAGE GROWTH</small>'+
              '<b>'+
                avg+
                '%'+
              '</b>'+
            '</div>'+

            '<div class="glass stat">'+
              '<small>OVERDUE</small>'+
              '<b>'+
                overdue+
              '</b>'+
            '</div>'+

            '<div class="glass stat">'+
              '<small>FEE OPTIONS</small>'+
              '<b>'+
                '₹500 / ₹700'+
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
                    '<th>Contact Number</th>'+

                  '</tr>'+

                '</thead>'+

                '<tbody>'+

                  (
                    rows||
                    '<tr>'+
                      '<td colspan="7">'+
                        'No members yet.'+
                      '</td>'+
                    '</tr>'
                  )+

                '</tbody>'+

              '</table>'+

            '</div>'+

          '</div>'+

        '</main>'+

        foot()

      );

    }
  )
  .catch(
    function(x){
      toast(x.message);
    }
  );
}


/* =========================================================
   MEMBER PERFORMANCE
========================================================= */

function member(){

  api(
    '/api/me'
  )
  .then(
    function(d){

      var m=
        d.member;

      var p=
        Math.max(
          0,
          Math.min(
            100,
            m.growth
          )
        );

      shell(

        top(
          'MEMBER PERFORMANCE'
        )+

        '<main class="wrap dash">'+

          '<div class="memberhero">'+

            '<div class="glass">'+

              '<div class="eyebrow">'+
                'YOUR PERFORMANCE // LIVE'+
              '</div>'+

              '<h1 style="font-size:72px;margin:10px 0">'+
                esc(m.name)+
              '</h1>'+

              '<p class="mini">'+
                'Goal: '+
                esc(m.goalCategory)+
                ' · Target '+
                m.goalWeight+
                ' kg'+
              '</p>'+

              '<div style="margin:50px 0 14px">'+

                '<div class="mini">'+
                  'GROWTH STATUS'+
                '</div>'+

                '<div class="bigstat">'+
                  m.growth+
                  '%'+
                '</div>'+

              '</div>'+

              '<div class="progress">'+

                '<div '+
                  'class="bar" '+
                  'style="width:'+
                  p+
                  '%">'+
                '</div>'+

              '</div>'+

              '<p class="mini" style="margin-top:14px">'+

                'Current: '+
                '<b style="color:white">'+
                  m.currentWeight+
                  ' kg'+
                '</b>'+

                ' · Joined: '+
                m.joiningWeight+
                ' kg'+

                ' · Target: '+
                m.goalWeight+
                ' kg'+

              '</p>'+

            '</div>'+

            '<div '+
              'class="glass" '+
              'style="position:relative;overflow:hidden">'+

              '<div class="eyebrow">'+
                'THEGYM ENERGY'+
              '</div>'+

              '<h2 style="font-size:46px;margin:10px 0">'+
                'TRAIN.<br>'+
                'TRACK.<br>'+
                'TRANSFORM.'+
              '</h2>'+

              '<p class="sub">'+
                'Your dashboard updates from the latest weight recorded by TheGym administration.'+
              '</p>'+

              '<div '+
                'id="miniCanvas" '+
                'style="height:270px">'+
              '</div>'+

              '<div class="sticker s1">🏋️</div>'+
              '<div class="sticker s2">🔥</div>'+
              '<div class="sticker s3">⚡</div>'+

            '</div>'+

          '</div>'+

        '</main>'+

        foot()

      );

      animateMini();

    }
  )
  .catch(
    function(x){
      toast(x.message);
    }
  );
}


/* =========================================================
   MEMBER ANIMATION
========================================================= */

function animateMini(){

  var el=
    document.getElementById(
      'miniCanvas'
    );

  if(!el){
    return;
  }

  var c=
    document.createElement(
      'canvas'
    );

  el.appendChild(c);

  var x=
    c.getContext('2d');

  var pts=[];

  function size(){

    c.width=
      el.clientWidth*
      devicePixelRatio;

    c.height=
      el.clientHeight*
      devicePixelRatio;

    x.setTransform(
      devicePixelRatio,
      0,
      0,
      devicePixelRatio,
      0,
      0
    );
  }

  size();

  addEventListener(
    'resize',
    size
  );

  for(
    var i=0;
    i<110;
    i++
  ){

    pts.push({

      a:
        Math.random()*
        Math.PI*
        2,

      r:
        20+
        Math.random()*
        110,

      v:
        .002+
        Math.random()*
        .004

    });

  }

  function frame(t){

    x.clearRect(
      0,
      0,
      el.clientWidth,
      el.clientHeight
    );

    var cx=
      el.clientWidth/2;

    var cy=
      el.clientHeight/2;

    pts.forEach(
      function(p){

        p.a+=p.v;

        var r=
          p.r+
          Math.sin(
            t*.002+
            p.a*4
          )*
          15;

        var px=
          cx+
          Math.cos(
            p.a+
            t*.0004
          )*
          r;

        var py=
          cy+
          Math.sin(
            p.a*1.4+
            t*.0003
          )*
          r*
          .7;

        x.fillStyle=
          p.a%2<1
            ?'#b8ff3d'
            :'#40e7ff';

        x.globalAlpha=.55;

        x.beginPath();

        x.arc(
          px,
          py,
          1.7,
          0,
          Math.PI*2
        );

        x.fill();

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


/* =========================================================
   START
========================================================= */

route();

</script>

</body>

</html>`;


/*
  IMPORTANT FIX

  The logo is inserted AFTER the HTML template has been
  created. This prevents nested JavaScript template literals
  from breaking server.js.
*/

const frontend=
  html.replaceAll(
    '${LOGO}',
    logo
  );


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

  res.end(
    frontend
  );
}


/* =========================================================
   MONGODB
========================================================= */

async function start(){

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

  await members.createIndex(
    {
      createdAt:1
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

        const url=
          new URL(
            req.url,
            'http://localhost'
          );


        /* =====================================================
           HEALTH
        ===================================================== */

        if(
          url.pathname===
          '/health'
        ){

          return send(
            res,
            200,
            {
              ok:true,
              name:'TheGym',
              database:!!db
            }
          );
        }


        /* =====================================================
           LOGIN
        ===================================================== */

        if(
          url.pathname===
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

            role=
              'supreme';

          }

          else if(
            key===
            ADMIN_KEY
          ){

            role=
              'admin';

          }

          else{

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

              return send(
                res,
                401,
                {
                  error:
                    'Invalid Secret Key'
                }
              );

            }


            role=
              'member';

            identity=
              String(
                m._id
              );

          }


          const t=
            token(
              role,
              identity
            );


          sessions.set(
            t,
            {
              role,
              identity,
              createdAt:
                Date.now()
            }
          );


          return send(
            res,
            200,
            {
              token:t,
              role
            }
          );

        }


        /* =====================================================
           LOGOUT
        ===================================================== */

        if(
          url.pathname===
            '/api/logout' &&
          req.method===
            'POST'
        ){

          sessions.delete(
            (
              req.headers.authorization||
              ''
            ).replace(
              /^Bearer\s+/i,
              ''
            )
          );

          return send(
            res,
            200,
            {
              ok:true
            }
          );
        }


        /* =====================================================
           GET MEMBERS
        ===================================================== */

        if(
          url.pathname===
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
          ){
            return;
          }


          const arr=
            await members
              .find({})
              .sort({
                createdAt:1
              })
              .toArray();


          return send(
            res,
            200,
            {
              members:
                arr.map(
                  clean
                )
            }
          );

        }


        /* =====================================================
           CREATE MEMBER
        ===================================================== */

        if(
          url.pathname===
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
          ){
            return;
          }


          const b=
            await body(req);


          const required=[
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
            const k of required
          ){

            if(
              String(
                b[k]??''
              ).trim()===''
            ){

              return send(
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

            return send(
              res,
              400,
              {
                error:
                  'Please enter valid dates and positive weights.'
              }
            );

          }


          /* ===================================================
             REALISTIC GOAL VALIDATION
          =================================================== */

          if(
            goalCategory===
              'Loss' &&
            goalWeight>=
              joiningWeight
          ){

            return send(
              res,
              400,
              {
                error:
                  'For Weight Loss, Goal Weight should be lower than Joining Weight.'
              }
            );

          }


          if(
            goalCategory===
              'Gain' &&
            goalWeight<=
              joiningWeight
          ){

            return send(
              res,
              400,
              {
                error:
                  'For Weight Gain, Goal Weight should be higher than Joining Weight.'
              }
            );

          }


          if(
            !/^[0-9+()\-\s]{7,20}$/
              .test(contact)
          ){

            return send(
              res,
              400,
              {
                error:
                  'Please enter a valid contact number.'
              }
            );

          }


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


          try{

            const r=
              await members.insertOne(
                m
              );


            return send(
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

          }

          catch(e){

            if(
              e.code===
                11000
            ){

              return send(
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


        /* =====================================================
           UPDATE MEMBER
        ===================================================== */

        const mr=
          url.pathname.match(
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
          ){
            return;
          }


          let id;


          try{

            id=
              new ObjectId(
                decodeURIComponent(
                  mr[1]
                )
              );

          }

          catch{

            return send(
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

          const u={
            updatedAt:
              new Date()
          };


          if(
            b.currentWeight!==
            undefined
          ){

            const w=
              +b.currentWeight;


            if(
              !Number.isFinite(w) ||
              w<=0
            ){

              return send(
                res,
                400,
                {
                  error:
                    'Invalid current weight'
                }
              );

            }


            u.currentWeight=
              w;

          }


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

              return send(
                res,
                400,
                {
                  error:
                    'Invalid fee date'
                }
              );

            }


            u.lastFeeDate=
              String(
                b.lastFeeDate
              );

          }


          if(
            b.name!==
            undefined
          ){

            u.name=
              String(
                b.name
              ).trim();

          }


          if(
            b.contact!==
            undefined
          ){

            u.contact=
              String(
                b.contact
              ).trim();

          }


          if(
            b.active!==
            undefined
          ){

            u.active=
              !!b.active;

          }


          const r=
            await members.findOneAndUpdate(
              {
                _id:id
              },

              {
                $set:u
              },

              {
                returnDocument:
                  'after'
              }
            );


          if(!r){

            return send(
              res,
              404,
              {
                error:
                  'Member not found'
              }
            );

          }


          return send(
            res,
            200,
            {
              member:
                clean(r)
            }
          );

        }


        /* =====================================================
           SUPREME REPORT
        ===================================================== */

        if(
          url.pathname===
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
          ){
            return;
          }


          const arr=
            await members
              .find({})
              .sort({
                createdAt:1
              })
              .toArray();


          return send(
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


        /* =====================================================
           CURRENT MEMBER
        ===================================================== */

        if(
          url.pathname===
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


          if(!s){
            return;
          }


          let id;


          try{

            id=
              new ObjectId(
                s.identity
              );

          }

          catch{

            return send(
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

            return send(
              res,
              404,
              {
                error:
                  'Member not found'
              }
            );

          }


          return send(
            res,
            200,
            {
              member:
                clean(m)
            }
          );

        }


        /* =====================================================
           FRONTEND
        ===================================================== */

        sendHTML(res);

      }

      catch(e){

        console.error(e);

        send(
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

  .then(
    function(){

      server.listen(
        PORT,
        function(){

          console.log(
            'TheGym running on port '+
            PORT
          );

        }
      );

    }
  )

  .catch(
    function(e){

      console.error(
        'MongoDB connection failed:',
        e.message
      );

      process.exit(1);

    }
  );
