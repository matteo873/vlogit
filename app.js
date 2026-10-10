import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY, JOBS_FUNCTION } from "./config.js";
import { FILTERS, SFX, TRACKS, ac, startMusic, stopMusic, previewSfx, playEdit, stopEdit, playingOn, liveSet, musicReady } from "./audio.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ================= state ================= */
let session = null, me = null;
let view = { name: "welcome" };          // welcome | register | login | home | friends | profile | newgroup | join | group
let gtab = "today";
let groups = [];                          // {id,name,code,start_date,members:[ids]}
const P = {};                             // profielen per id
const VL = new Map();                     // geladen vlogs per id
let homeIds = [], groupIds = {};          // volgorde van vlogs per scherm
let fr = { friends: [], incoming: [], sent: [] };
const signed = {};                        // video-pad -> tijdelijke link
const lb = {};                            // klassement per groep
let loaded = {};                          // welke schermen al data hebben
let draft = null, tool = "trim", sfxAt = 0, publishing = false;
let homeFilter = "all", picked = new Set();
let search = { q: "", results: [], t: 0 };
let jokers = [];                          // {group_id,user_id,day} van deze maand
const winners = {};                       // per groep: [{month,user_id,avg_score}]
let pushOn = false, confirmDelete = false, compressing = null;
const EMOJIS = ["😂", "🔥", "😮", "👏"];
const lib = {};                           // gedeelde geluiden per groep: [{id,user_id,name,kind,path,duration}]
let voiceRec = null, fxRec = null;        // lopende opnames (stem / eigen geluid)
const PSEL = "id,name,handle,avatar_url";

const TEXTSTYLES = { serif: "Sierlijk", bold: "Dik", type: "Typmachine" };
const TEXTPOS = { top: "Boven", mid: "Midden", bot: "Onder" };
const SPEEDS = [0.5, 1, 1.5, 2];
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_REC = 180;
const PALETTE = ["#3f7d5c","#7a5ba8","#2e8a8a","#b0566b","#8a7a2e","#3b6fa8","#b0703a","#5a63b8"];
const GRADS = ["linear-gradient(160deg,#1f4a35,#c7d79a)","linear-gradient(160deg,#2b3d5c,#e0b98a)","linear-gradient(160deg,#173a2b,#7fb59a)","linear-gradient(160deg,#4a2c3c,#e8c68e)","linear-gradient(160deg,#20363f,#8fc0c9)","linear-gradient(160deg,#3d3a1d,#e3d9a6)"];

/* ================= helpers ================= */
const ICON = {
  home:'<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  friends:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  me:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back:'<path d="M15 18l-6-6 6-6"/>', plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  play:'<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  check:'<path d="M20 6L9 17l-5-5"/>', x:'<path d="M18 6L6 18M6 6l12 12"/>',
  cam:'<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M14 9l2 2"/>',
  flip:'<path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.5 9A9 9 0 0 0 5.6 5.6L1 10M23 14l-4.6 4.4A9 9 0 0 1 3.5 15"/>',
  share:'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
  filter:'<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
  text:'<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sound:'<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  speed:'<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>',
  mix:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>'
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const $ = id => document.getElementById(id);
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const color = id => PALETTE[hash(id) % PALETTE.length];
const nameOf = id => P[id]?.name || "Iemand";
const shown = id => (me && id === me.id) ? "Jij" : nameOf(id);
const av = (id, size = "") => P[id]?.avatar_url
  ? `<span class="av ${size}" style="background:${color(id)}"><img src="${esc(P[id].avatar_url)}" alt="" loading="lazy"></span>`
  : `<span class="av ${size}" style="background:${color(id)}">${esc(nameOf(id)[0]?.toUpperCase() || "?")}</span>`;
const monthStart = () => todayStr().slice(0, 8) + "01";
const lastMonthStart = () => addDays(monthStart(), -1).slice(0, 8) + "01";
// de regerende winnaar van een groep: winnaar van vorige maand
const reigning = gid => { const w = (winners[gid] || [])[0]; return w && w.month === lastMonthStart() ? w : null; };
const crown = (id, gid) => { const w = gid ? reigning(gid) : null; return w && w.user_id === id ? `<span class="crown" title="Winnaar van vorige maand">👑</span>` : ""; };
const jokerToday = g => jokers.find(j => j.group_id === g.id && j.day === todayStr());
const jokerUsed = (gid, uid) => jokers.some(j => j.group_id === gid && j.user_id === uid && j.day >= monthStart());
const fmt = n => n == null ? "–" : Number(n).toFixed(1).replace(".", ",");
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const loader = (txt = "Laden…") => `<div class="loading"><div class="spin"></div>${txt}</div>`;

// datums in Belgische tijd
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (s, k) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const niceDate = (s, opt = { weekday: "long", day: "numeric", month: "long" }) => new Date(s + "T12:00:00Z").toLocaleDateString("nl-BE", { ...opt, timeZone: "UTC" });
function secsLeft() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = t => +p.find(x => x.type === t).value;
  return 86400 - (g("hour") * 3600 + g("minute") * 60 + g("second"));
}
const turnOf = (g, s = todayStr()) => { const n = g.members.length; if (!n) return null; return g.members[((diffDays(g.start_date, s) % n) + n) % n]; };
const postedToday = g => [...VL.values()].some(v => v.group_id === g.id && v.vlog_date === todayStr());
const groupById = id => groups.find(g => g.id === id);

function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2800); }
function errMsg(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return "E-mail of wachtwoord klopt niet.";
  if (/already registered|already been registered/i.test(m)) return "Er bestaat al een account met dit e-mailadres. Log in.";
  if (/Email not confirmed/i.test(m)) return "Bevestig eerst je e-mail via de link in je mailbox.";
  if (/rate limit/i.test(m)) return "Even te veel pogingen. Probeer het over een paar minuten opnieuw.";
  if (/vlogs_group_id_vlog_date_key/.test(m)) return "Er staat vandaag al een vlog in deze groep.";
  if (/row-level security.*vlogs/i.test(m)) return "Je kan alleen een vlog plaatsen op de dag dat jij aan de beurt bent.";
  if (/row-level security.*ratings/i.test(m)) return "Bekijk de vlog eerst helemaal voor je scoort.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Geen verbinding. Controleer je internet en probeer opnieuw.";
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return "Deze video is te groot. Het maximum is 50 MB.";
  return m;
}
const val = id => $(id).value.trim();

/* ================= data ================= */
async function loadProfile() {
  const { data, error } = await sb.from("profiles").select(PSEL).eq("id", session.user.id).single();
  if (error) throw error;
  me = data; P[me.id] = me;
}
async function loadGroups() {
  const { data: mine, error } = await sb.from("group_members").select("group_id").eq("user_id", me.id);
  if (error) throw error;
  const ids = mine.map(r => r.group_id);
  if (!ids.length) { groups = []; jokers = []; return; }
  const [r1, r2, r3, ...wins] = await Promise.all([
    sb.from("groups").select("id,name,code,start_date,created_at").in("id", ids).order("created_at"),
    sb.from("group_members").select(`group_id,user_id,position,joined_at,profiles(${PSEL})`).in("group_id", ids),
    sb.from("jokers").select("group_id,user_id,day").in("group_id", ids).gte("day", monthStart()),
    ...ids.map(id => sb.rpc("month_winners", { p_group: id }))
  ]);
  if (r1.error) throw r1.error; if (r2.error) throw r2.error;
  jokers = r3.error ? [] : r3.data;
  ids.forEach((id, i) => { winners[id] = wins[i].error ? [] : wins[i].data; });
  r2.data.forEach(m => { if (m.profiles) P[m.user_id] = m.profiles; });
  groups = r1.data.map((g, i) => ({ ...g, grad: GRADS[hash(g.id) % GRADS.length],
    members: r2.data.filter(m => m.group_id === g.id).sort((a, b) => a.position - b.position || a.joined_at.localeCompare(b.joined_at)).map(m => m.user_id) }));
}
async function loadFriends() {
  const { data, error } = await sb.from("friendships")
    .select(`requester,addressee,status,r:profiles!friendships_requester_fkey(${PSEL}),a:profiles!friendships_addressee_fkey(${PSEL})`);
  if (error) throw error;
  fr = { friends: [], incoming: [], sent: [] };
  data.forEach(f => {
    if (f.r) P[f.r.id] = f.r; if (f.a) P[f.a.id] = f.a;
    const other = f.requester === me.id ? f.addressee : f.requester;
    if (f.status === "accepted") fr.friends.push(other);
    else if (f.addressee === me.id) fr.incoming.push(other);
    else fr.sent.push(other);
  });
}
const VSEL = "id,group_id,author,vlog_date,title,video_path,edit,created_at,ratings(user_id,score),likes(user_id),comments(id,user_id,body,created_at),views(user_id),reactions(user_id,emoji)";
async function loadVlogs(ids, limit) {
  if (!ids.length) return [];
  const { data, error } = await sb.from("vlogs").select(VSEL).in("group_id", ids)
    .order("vlog_date", { ascending: false }).limit(limit);
  if (error) throw error;
  data.forEach(v => { v.comments.sort((a, b) => a.created_at.localeCompare(b.created_at)); VL.set(v.id, v); });
  await signUrls(data.flatMap(v => v.video_path ? [v.video_path, v.edit?.musicPath, v.edit?.voicePath, ...(v.edit?.sfx || []).map(s => s.path)] : []).filter(Boolean));
  return data.map(v => v.id);
}
async function signUrls(paths) {
  const need = paths.filter(p => !signed[p]);
  if (!need.length) return;
  const { data, error } = await sb.storage.from("vlogs").createSignedUrls(need, 6 * 3600);
  if (!error && data) data.forEach(d => { if (d.signedUrl) signed[d.path] = d.signedUrl; });
}
async function loadLibrary(gid) {
  const { data, error } = await sb.from("sounds").select("id,user_id,name,kind,path,duration,created_at").eq("group_id", gid).order("created_at", { ascending: false });
  if (error) { lib[gid] = lib[gid] || []; return; }
  lib[gid] = data; await signUrls(data.map(s => s.path));
}
const soundById = (gid, id) => (lib[gid] || []).find(s => s.id === id);
async function uploadSound(gid, file, kind, name, duration) {
  const path = `${gid}/sounds/${crypto.randomUUID()}.${musicExt(file)}`;
  const up = await sb.storage.from("vlogs").upload(path, file, { contentType: musicType(file), upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await sb.from("sounds").insert({ group_id: gid, user_id: me.id, name: name.slice(0, 60), kind, path, duration }).select("id,user_id,name,kind,path,duration,created_at").single();
  if (error) { await sb.storage.from("vlogs").remove([path]); throw error; }
  (lib[gid] = lib[gid] || []).unshift(data);
  signed[path] = URL.createObjectURL(file);
  return data;
}
async function deleteSound(gid, id) {
  const s = soundById(gid, id); if (!s) return;
  const { error } = await sb.from("sounds").delete().eq("id", id);
  if (error) throw error;
  await sb.storage.from("vlogs").remove([s.path]);
  lib[gid] = lib[gid].filter(x => x.id !== id);
}
const probeDuration = url => new Promise(res => { const a = new Audio(); a.preload = "metadata"; a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 0); a.onerror = () => res(-1); a.src = url; });
const AUDIO_REC_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
async function recordAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = AUDIO_REC_TYPES.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 96_000 } : undefined);
  const chunks = []; mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => { mr.onstop = () => { stream.getTracks().forEach(t => t.stop());
    const base = (mr.mimeType || type || "audio/webm").split(";")[0];
    res(new File(chunks, `opname.${base.includes("mp4") ? "m4a" : base.includes("ogg") ? "ogg" : "webm"}`, { type: base })); }; });
  mr.start(500);
  return { mr, stream, t0: Date.now(), done, stop: () => { if (mr.state !== "inactive") mr.stop(); } };
}
async function loadLeaderboard(id) {
  const { data, error } = await sb.rpc("leaderboard", { p_group: id });
  if (error) throw error;
  lb[id] = data;
}

/* ================= navigation ================= */
async function go(name, extra = {}) {
  stopEdit(); closeRecorder(); stopVoiceRec();
  view = { name, ...extra };
  if (name === "group") gtab = extra.tab || "today";
  draft = null; render();
  await refresh();
}
async function refresh() {
  if (!me) return;
  const v = view.name;
  try {
    if (v === "home") {
      await Promise.all([loadGroups(), loadFriends()]);
      homeIds = await loadVlogs(groups.map(g => g.id), 24);
    } else if (v === "friends" || v === "profile" || v === "newgroup") {
      await Promise.all([loadGroups(), loadFriends()]);
    } else if (v === "group") {
      await Promise.all([loadGroups(), loadFriends()]);
      if (!groupById(view.id)) { toast("Deze groep bestaat niet meer."); return go("home"); }
      groupIds[view.id] = await loadVlogs([view.id], 62);
      await Promise.all([loadLeaderboard(view.id), loadLibrary(view.id)]);
    }
    loaded[v === "group" ? "g:" + view.id : v] = true;
  } catch (e) { toast(errMsg(e)); }
  if (view.name === v && !draft && !rec) render(true);
}

/* ================= render ================= */
function render(keepScroll) {
  const app = $("app"), nav = $("nav");
  const authed = !!me;
  nav.hidden = !authed;
  let html;
  if (!authed) html = view.name === "welcome" ? viewWelcome() : viewAuth();
  else html = ({ home: viewHome, friends: viewFriends, profile: viewProfile, newgroup: viewNewGroup, join: viewJoin, group: viewGroup }[view.name] || viewHome)();
  app.innerHTML = `<div class="screen">${html}</div>`;
  if (authed) {
    const tabs = [["home","Home","home"],["friends","Vrienden","friends"],["profile","Profiel","me"]];
    const active = ["group","newgroup","join"].includes(view.name) ? "home" : view.name;
    $("tabs").innerHTML = tabs.map(([k,l,i]) => `<button data-act="nav" data-to="${k}" ${active===k?'aria-current="page"':""}>${ic(i)}${l}${k==="friends"&&fr.incoming.length?'<span class="dot"></span>':""}</button>`).join("");
  }
  if (view.name === "group" && gtab === "today") bindStudio();
  tick();
  if (!keepScroll) window.scrollTo(0, 0);
}

/* ---------- welcome & auth ---------- */
function viewWelcome() {
  return `<section class="welcome">
    <div class="frames" aria-hidden="true"><div class="frame f1"></div><div class="frame f2"></div><div class="frame f3"></div></div>
    <div class="wel glass">
      <div class="big">Vlogit</div>
      <p class="tag">Eén vriend per dag. Eén vlog. Op het einde van de maand kroon je samen de beste.</p>
      <button class="btn go full" data-act="stage" data-to="register">Aan de slag <span class="arr">${ic("arrow","s")}</span></button>
      <p class="center muted small" style="margin:0">Al een account? <button class="link" data-act="stage" data-to="login">Inloggen</button></p>
    </div></section>`;
}
function viewAuth() {
  const head = (t, sub) => `<div class="top" style="background:none"><button class="iconbtn" data-act="stage" data-to="welcome" aria-label="Terug">${ic("back","s")}</button></div><div><h1 style="font-size:40px">${t}</h1><p class="tag" style="margin-top:8px">${sub}</p></div>`;
  if (view.name === "login") return `<section class="auth">${head("Welkom terug","Log in om de vlogs van je groepen te zien.")}
    <form class="form card" id="loginForm" novalidate>
      <div class="field"><label class="label" for="lEmail">E-mail</label><input id="lEmail" type="email" autocomplete="email"></div>
      <div class="field"><label class="label" for="lPw">Wachtwoord</label><input id="lPw" type="password" autocomplete="current-password"></div>
      <div class="err" id="authErr"></div>
      <button class="btn full" type="submit" id="authBtn">Inloggen</button>
    </form>
    <p class="center muted">Nog geen account? <button class="link" data-act="stage" data-to="register">Registreren</button></p></section>`;
  return `<section class="auth">${head("Account maken","Zo vinden je vrienden je terug.")}
    <form class="form card" id="regForm" novalidate>
      <div class="field"><label class="label" for="rName">Voornaam</label><input id="rName" type="text" autocomplete="given-name" maxlength="30"></div>
      <div class="field"><label class="label" for="rHandle">Gebruikersnaam</label><div class="at"><input id="rHandle" type="text" autocomplete="username" maxlength="20" autocapitalize="none"></div></div>
      <div class="field"><label class="label" for="rEmail">E-mail</label><input id="rEmail" type="email" autocomplete="email" placeholder="jij@voorbeeld.be"></div>
      <div class="field"><label class="label" for="rPw">Wachtwoord</label><input id="rPw" type="password" autocomplete="new-password" placeholder="Minstens 8 tekens"></div>
      <label class="check-row" for="rOk"><input id="rOk" type="checkbox"><span>Ik ben minstens 13 jaar en ga akkoord met de <a href="privacy.html" target="_blank" rel="noopener">privacyregels</a>.</span></label>
      <div class="err" id="authErr"></div>
      <button class="btn full" type="submit" id="authBtn">Account maken</button>
    </form>
    <p class="center muted">Heb je al een account? <button class="link" data-act="stage" data-to="login">Inloggen</button></p></section>`;
}
function fail(msg, id) {
  const e = $("authErr"); if (e) e.textContent = msg; else toast(msg);
  document.querySelectorAll("input[aria-invalid]").forEach(i => i.removeAttribute("aria-invalid"));
  if (id && $(id)) { $(id).setAttribute("aria-invalid", "true"); $(id).focus(); }
}
function busyBtn(id, on, label) { const b = $(id); if (!b) return; b.disabled = on; b.innerHTML = on ? `<span class="spin"></span>` : label; }
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
async function doRegister() {
  const name = val("rName"), handle = val("rHandle").replace(/^@/, "").toLowerCase(), email = val("rEmail"), pw = $("rPw").value;
  if (!name) return fail("Vul je voornaam in.", "rName");
  if (!/^[a-z0-9_.]{3,20}$/.test(handle)) return fail("Gebruikersnaam: 3 tot 20 tekens, alleen letters, cijfers, punt of _.", "rHandle");
  if (!validEmail(email)) return fail("Dit e-mailadres klopt niet. Controleer het nog eens.", "rEmail");
  if (pw.length < 8) return fail("Je wachtwoord moet minstens 8 tekens hebben.", "rPw");
  if (!$("rOk").checked) return fail("Vink aan dat je minstens 13 bent en akkoord gaat met de privacyregels.", "rOk");
  busyBtn("authBtn", true);
  try {
    const { data: free, error: e1 } = await sb.rpc("handle_available", { h: handle });
    if (e1) throw e1;
    if (!free) { busyBtn("authBtn", false, "Account maken"); return fail(`@${handle} is al bezet. Kies een andere gebruikersnaam.`, "rHandle"); }
    const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { name, handle } } });
    if (error) throw error;
    if (!data.session) { busyBtn("authBtn", false, "Account maken"); return fail("Account gemaakt. Bevestig je e-mail via de link in je mailbox en log daarna in."); }
    session = data.session; await afterLogin(true);
  } catch (e) { busyBtn("authBtn", false, "Account maken"); fail(errMsg(e)); }
}
async function doLogin() {
  const email = val("lEmail"), pw = $("lPw").value;
  if (!validEmail(email)) return fail("Dit e-mailadres klopt niet.", "lEmail");
  if (!pw) return fail("Vul je wachtwoord in.", "lPw");
  busyBtn("authBtn", true);
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    session = data.session; await afterLogin();
  } catch (e) { busyBtn("authBtn", false, "Inloggen"); fail(errMsg(e)); }
}
async function afterLogin(isNew) {
  await loadProfile();
  checkPush();
  if (isNew) toast(`Welkom bij Vlogit, ${me.name}`);
  const code = sessionStorage.getItem("vlogit-join");
  if (code) {
    sessionStorage.removeItem("vlogit-join");
    try { const { data, error } = await sb.rpc("join_group", { p_code: code }); if (error) throw error; toast("Je zit nu in de groep."); return go("group", { id: data }); }
    catch (e) { toast(errMsg(e)); }
  }
  return go("home");
}

/* ---------- home ---------- */
function greet() { const h = +new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hourCycle: "h23" }).format(new Date()); return h < 12 ? "Goeiemorgen" : h < 18 ? "Goeiemiddag" : "Goeieavond"; }
function viewHome() {
  let h = `<div class="top"><div class="logo" style="flex:1">Vlogit</div>
    <button class="iconbtn" data-act="nav" data-to="friends" aria-label="Vrienden">${ic("friends","s")}${fr.incoming.length?'<span class="dot"></span>':""}</button></div>`;
  if (!loaded.home) return h + `<section class="hero glass"><h1>${greet()}, ${esc(me.name)}.</h1></section>` + loader();
  const due = groups.filter(g => turnOf(g) === me.id && !postedToday(g) && !jokerToday(g));
  if (due.length) {
    const g = due[0];
    h += `<section class="hero glass"><div class="label">Jij bent aan de beurt in ${esc(g.name)}</div><h1>${greet()}, ${esc(me.name)}.<br>Tijd om te vloggen.</h1>
      <div><div class="clock" data-clock>--:--:--</div><div class="small muted" style="margin-top:4px">tot middernacht om je vlog te plaatsen</div></div>
      <button class="btn go" data-act="open" data-id="${g.id}">Naar de studio <span class="arr">${ic("arrow","s")}</span></button></section>`;
  } else if (groups.length) {
    const g = groups[0], t = turnOf(g);
    h += `<section class="hero glass"><div class="label">${niceDate(todayStr())}</div><h1>${greet()}, ${esc(me.name)}.</h1>
      <p class="muted" style="margin:0">Vandaag vlogt <b style="color:var(--ink)">${esc(shown(t))}</b> in ${esc(g.name)}${postedToday(g) ? ". De vlog staat al online." : "."}</p>
      <button class="btn go" data-act="open" data-id="${g.id}" data-tab="feed">Bekijk vlogs <span class="arr">${ic("arrow","s")}</span></button></section>`;
  } else {
    h += `<section class="hero glass"><h1>${greet()}, ${esc(me.name)}.</h1><p class="muted" style="margin:0">Maak een groep met je vrienden, of join er een met een code.</p></section>`;
  }
  if (+todayStr().slice(8, 10) <= 3) {
    const lm = niceDate(lastMonthStart(), { month: "long" });
    groups.forEach(g => { const w = reigning(g.id); if (w) h += `<div class="winner-card"><span class="em">👑</span>${av(w.user_id)}<div style="flex:1;min-width:0"><div class="label">Winnaar van ${lm} · ${esc(g.name)}</div><h2>${esc(shown(w.user_id))} ${w.user_id===me.id?"hebt":"heeft"} gewonnen</h2><span class="small muted">met een gemiddelde van ${fmt(w.avg_score)}</span></div></div>`; });
  }
  h += pushNotice();
  h += `<div class="sec"><h2>Mijn groepen</h2><button class="link" data-act="nav" data-to="join">Join met code</button></div>
    <div class="hscroll">${groups.map(gTile).join("")}
      <button class="tile new" data-act="nav" data-to="newgroup"><div class="art">${ic("plus")}</div><span class="nm">Nieuwe groep</span><span class="small muted">met je vrienden</span></button>
      <button class="tile new" data-act="nav" data-to="join"><div class="art">${ic("key")}</div><span class="nm">Join</span><span class="small muted">met een code</span></button></div>`;
  if (groups.length) {
    const list = homeIds.map(id => VL.get(id)).filter(v => v && (homeFilter === "all" || v.group_id === homeFilter));
    h += `<div class="sec"><h2>Nieuwste vlogs</h2></div>
      ${groups.length > 1 ? `<div class="cats"><button class="cat" data-act="hfilter" data-id="all" aria-pressed="${homeFilter==="all"}"><span class="sq">${ic("grid")}</span>Alle</button>${groups.map(g => `<button class="cat" data-act="hfilter" data-id="${g.id}" aria-pressed="${homeFilter===g.id}"><span class="sq" style="font-family:var(--display);font-size:22px">${esc(g.name[0].toUpperCase())}</span>${esc(g.name.length>9?g.name.slice(0,8)+"…":g.name)}</button>`).join("")}</div><div style="height:12px"></div>` : ""}
      ${list.length ? list.slice(0, 5).map(v => vlogCard(v, true)).join("") : `<div class="card empty">${ic("cam")}<b>Nog geen vlogs</b><span class="small muted">De eerste vlog verschijnt hier.</span></div>`}
      ${list.length > 5 ? `<button class="btn soft full" data-act="open" data-id="${homeFilter==="all"?list[0].group_id:homeFilter}" data-tab="feed">Alle vlogs bekijken</button>` : ""}`;
  }
  if (fr.incoming.length) h += `<div class="sec"><h2>Vriendschapsverzoeken</h2><button class="link" data-act="nav" data-to="friends">Alles</button></div><div class="card">${fr.incoming.map(reqRow).join("")}</div>`;
  return h;
}
function gTile(g) {
  const t = turnOf(g), done = postedToday(g), jk = jokerToday(g);
  const badge = jk ? `<span class="pill">🃏 Joker van ${esc(shown(t))}</span>`
    : t === me.id ? (done ? `<span class="pill">${ic("check","s")} Geplaatst</span>` : `<span class="pill hot">Jouw beurt</span>`)
    : `<span class="pill">Vandaag: ${esc(nameOf(t))}</span>`;
  return `<button class="tile" data-act="open" data-id="${g.id}"><div class="art" style="background:${g.grad}">${badge}<div class="stack">${g.members.slice(0,4).map(m => av(m,"sm")).join("")}</div></div>
    <span class="nm">${esc(g.name)}</span><span class="small muted">${g.members.length} ${g.members.length===1?"lid":"leden"}</span></button>`;
}
function reqRow(id) {
  return `<div class="req">${av(id)}<div class="t"><b>${esc(nameOf(id))}</b><span class="small muted">@${esc(P[id]?.handle)}</span></div>
    <button class="btn sm" data-act="acceptReq" data-id="${id}">Accepteren</button><button class="x" data-act="declineReq" data-id="${id}" aria-label="Weigeren">${ic("x","s")}</button></div>`;
}

/* ---------- friends ---------- */
function relation(id) {
  if (fr.friends.includes(id)) return `<span class="pill ghost">${ic("check","s")} Vrienden</span>`;
  if (fr.incoming.includes(id)) return `<button class="btn sm" data-act="acceptReq" data-id="${id}">Accepteren</button>`;
  if (fr.sent.includes(id)) return `<span class="pill ghost">Verstuurd</span>`;
  return `<button class="btn sm soft" data-act="addFriend" data-id="${id}">${ic("plus","s")} Toevoegen</button>`;
}
const personRow = id => `<li>${av(id)}<div class="t"><b>${esc(nameOf(id))}</b><span class="small muted">@${esc(P[id]?.handle)}</span></div>${relation(id)}</li>`;
function viewFriends() {
  let h = `<div class="top"><h1 style="flex:1">Vrienden</h1></div>
    <div class="at"><input id="search" type="search" placeholder="Zoek op gebruikersnaam" aria-label="Vriend zoeken" value="${esc(search.q)}" autocomplete="off" autocapitalize="none"></div>
    <div id="searchRes">${searchHTML()}</div>`;
  if (!loaded.friends && !loaded.home) return h + loader();
  const fromGroups = [...new Set(groups.flatMap(g => g.members))].filter(id => id !== me.id && !fr.friends.includes(id) && !fr.incoming.includes(id));
  if (fr.incoming.length) h += `<div class="sec"><h2>Verzoeken</h2><span class="pill hot">${fr.incoming.length}</span></div><div class="card">${fr.incoming.map(reqRow).join("")}</div>`;
  if (fromGroups.length) h += `<div class="sec"><h2>Uit je groepen</h2></div><div class="card"><ul class="list">${fromGroups.map(personRow).join("")}</ul></div>`;
  h += `<div class="sec"><h2>Mijn vrienden</h2><span class="muted small">${fr.friends.length}</span></div>`;
  h += fr.friends.length ? `<div class="card"><ul class="list">${fr.friends.map(id => `<li>${av(id)}<div class="t"><b>${esc(nameOf(id))}</b><span class="small muted">@${esc(P[id]?.handle)} · ${groups.filter(g => g.members.includes(id)).length} gedeelde groepen</span></div></li>`).join("")}</ul></div>`
    : `<div class="card empty"><b>Nog geen vrienden</b><span class="small muted">Zoek vrienden op gebruikersnaam. Daarna kan je ze in een groep zetten.</span></div>`;
  if (fr.sent.length) h += `<div class="sec"><h2>Verstuurd</h2></div><div class="card"><ul class="list">${fr.sent.map(personRow).join("")}</ul></div>`;
  return h;
}
function searchHTML() {
  const q = search.q.replace(/^@/, "").trim();
  if (!q) return `<p class="small muted" style="margin:10px 6px 0">Vraag je vrienden naar hun gebruikersnaam op Vlogit.</p>`;
  if (q.length < 2) return "";
  if (search.loading) return loader("Zoeken…");
  return `<div class="card" style="margin-top:12px">${search.results.length ? `<ul class="list">${search.results.map(personRow).join("")}</ul>` : `<p class="muted" style="margin:0">Niemand gevonden met "${esc(q)}".</p>`}</div>`;
}
async function runSearch() {
  const q = search.q.replace(/^@/, "").trim().toLowerCase();
  if (q.length < 2) { search.results = []; $("searchRes") && ($("searchRes").innerHTML = searchHTML()); return; }
  const my = ++search.t; search.loading = true; $("searchRes").innerHTML = searchHTML();
  const { data, error } = await sb.from("profiles").select(PSEL).ilike("handle", `%${q.replace(/[%_]/g, "\\$&")}%`).neq("id", me.id).limit(10);
  if (my !== search.t) return;
  search.loading = false;
  if (error) { toast(errMsg(error)); return; }
  data.forEach(p => P[p.id] = p); search.results = data.map(p => p.id);
  if ($("searchRes")) $("searchRes").innerHTML = searchHTML();
}

/* ---------- profile ---------- */
function viewProfile() {
  const posted = [...VL.values()].filter(v => v.author === me.id).length;
  return `<div class="top"><h1 style="flex:1">Profiel</h1></div>
    <div class="card" style="display:grid;justify-items:center;gap:8px;text-align:center;padding:26px 16px">
      <span class="avatar-edit"><span class="ring">${av(me.id,"lg")}</span><label for="avatarFile" aria-label="Profielfoto kiezen">${ic("cam","s")}</label><input id="avatarFile" type="file" accept="image/*" hidden></span>
      <h2 style="font-size:28px">${esc(me.name)}</h2><span class="muted">@${esc(me.handle)}</span><span class="small muted" style="overflow-wrap:anywhere">${esc(session?.user?.email)}</span></div>
    <div class="stats" style="margin-top:12px"><div class="glass"><b>${groups.length}</b><span class="small muted">groepen</span></div><div class="glass"><b>${fr.friends.length}</b><span class="small muted">vrienden</span></div><div class="glass"><b>${posted}</b><span class="small muted">vlogs</span></div></div>
    <div class="sec"><h2>Naam</h2></div>
    <form class="card form" id="nameForm" novalidate><div class="field"><label class="label" for="pName">Naam die je vrienden zien</label><input id="pName" type="text" maxlength="30" value="${esc(me.name)}"></div><div class="err" id="authErr"></div><button class="btn soft" type="submit" id="nameBtn">Naam opslaan</button></form>
    <div class="sec"><h2>Meldingen</h2></div>
    <div class="card" style="display:grid;gap:10px">${pushPanel()}</div>
    <div class="sec"><h2>Privacy</h2></div>
    <div class="card" style="display:grid;gap:12px">
      <p class="small muted" style="margin:0">Video's worden na 35 dagen automatisch gewist. Scores en het klassement blijven bewaard. Lees <a class="link" href="privacy.html" target="_blank" rel="noopener">de privacyregels</a>.</p>
      <button class="btn soft" data-act="logout">Uitloggen</button>
      ${confirmDelete
        ? `<div class="card" style="display:grid;gap:10px;border-color:var(--warn)"><b class="danger">Alles verwijderen?</b><span class="small muted">Je account, je profielfoto, je vlogs met hun scores, je reacties en je vriendschappen worden voorgoed gewist. Dit kan je niet ongedaan maken.</span>
           <div style="display:flex;gap:8px"><button class="btn soft" style="flex:1" data-act="deleteCancel">Annuleren</button><button class="btn" style="flex:1;background:var(--warn);color:#2a1d05" data-act="deleteAccount" id="delBtn">Ja, verwijder alles</button></div></div>`
        : `<button class="link danger" style="justify-self:start" data-act="deleteAsk">Account verwijderen</button>`}
    </div>`;
}

/* ---------- meldingen ---------- */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function checkPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") { pushOn = false; return; }
    const reg = await navigator.serviceWorker.ready;
    pushOn = !!(await reg.pushManager.getSubscription());
  } catch (e) { pushOn = false; }
}
function pushNotice() {
  if (pushOn || localStorageGet("vlogit-push-dismissed")) return "";
  if (!pushSupported()) return isIOS && !standalone() ? `<div class="notice glass">${ic("sound")}<div class="t"><b>Mis je beurt niet</b><span class="small muted">Zet Vlogit eerst op je beginscherm (deelknop, Zet op beginscherm). Daarna kan je meldingen aanzetten.</span></div><button class="x" data-act="pushDismiss" aria-label="Sluiten">${ic("x","s")}</button></div>` : "";
  if (Notification.permission === "denied") return "";
  return `<div class="notice glass">${ic("sound")}<div class="t"><b>Mis je beurt niet</b><span class="small muted">Krijg een melding als jij aan de beurt bent en als er een nieuwe vlog is.</span></div><button class="btn sm" data-act="pushOn">Aanzetten</button></div>`;
}
function pushPanel() {
  if (!pushSupported()) return `<span class="small muted">${isIOS && !standalone() ? "Op iPhone werken meldingen pas als Vlogit op je beginscherm staat. Open de app daarna vanaf je beginscherm." : "Deze browser ondersteunt geen meldingen."}</span>`;
  if (Notification.permission === "denied") return `<span class="small muted">Je hebt meldingen geblokkeerd. Zet ze aan in de instellingen van je browser of gsm voor deze app.</span>`;
  return pushOn
    ? `<span class="small muted">Meldingen staan aan op dit toestel: jouw beurt (9 u), een herinnering (20 u), nieuwe vlogs en de winnaar van de maand.</span><button class="btn soft" data-act="pushOff">Meldingen uitzetten</button>`
    : `<span class="small muted">Krijg een melding als jij aan de beurt bent, als er een nieuwe vlog is en wie de maand wint.</span><button class="btn" data-act="pushOn">Meldingen aanzetten</button>`;
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const b64ToBytes = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Meldingen zijn niet toegestaan."); return; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert({ endpoint: j.endpoint, user_id: me.id, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
  pushOn = true; toast("Meldingen staan aan."); render(true);
}
async function disablePush() {
  const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
  if (sub) { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
  pushOn = false; toast("Meldingen staan uit."); render(true);
}

/* ---------- profielfoto ---------- */
async function uploadAvatar(file) {
  if (!file || !file.type.startsWith("image/")) { toast("Kies een foto."); return; }
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) { toast("Deze foto kan niet geopend worden."); return; }
  const S = 320, c = document.createElement("canvas"); c.width = c.height = S;
  const s = Math.min(img.width, img.height), ctx = c.getContext("2d");
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  const path = `${me.id}/${Date.now()}.jpg`;
  toast("Foto uploaden…");
  const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const old = me.avatar_url;
  const { error } = await sb.from("profiles").update({ avatar_url: url }).eq("id", me.id);
  if (error) throw error;
  me.avatar_url = url; P[me.id] = me;
  if (old && old.includes("/avatars/")) sb.storage.from("avatars").remove([old.split("/avatars/")[1]]);
  toast("Profielfoto aangepast."); render(true);
}

/* ---------- account verwijderen ---------- */
async function deleteAccount() {
  busyBtn("delBtn", true);
  const { data: mine } = await sb.from("vlogs").select("video_path,edit").eq("author", me.id).not("video_path", "is", null);
  const { data: mySounds } = await sb.from("sounds").select("path").eq("user_id", me.id);
  const paths = [...(mine || []).flatMap(v => [v.video_path, v.edit?.voicePath, v.edit?.musicPath && !v.edit.musicPath.includes("/sounds/") ? v.edit.musicPath : null]),
    ...(mySounds || []).map(s => s.path)].filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) await sb.storage.from("vlogs").remove(paths.slice(i, i + 100));
  const { data: av2 } = await sb.storage.from("avatars").list(me.id);
  if (av2?.length) await sb.storage.from("avatars").remove(av2.map(f => `${me.id}/${f.name}`));
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager?.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
  const { error } = await sb.rpc("delete_my_account");
  if (error) { busyBtn("delBtn", false, "Ja, verwijder alles"); throw error; }
  await sb.auth.signOut();
  me = null; session = null; loaded = {}; VL.clear(); confirmDelete = false; view = { name: "welcome" }; render();
  toast("Je account en al je gegevens zijn verwijderd.");
}

/* ---------- new group / join ---------- */
function viewNewGroup() {
  return `<div class="top"><button class="iconbtn" data-act="nav" data-to="home" aria-label="Terug">${ic("back","s")}</button><h1 style="flex:1;font-size:26px">Nieuwe groep</h1></div>
    <form class="form card" id="groupForm" novalidate>
      <div class="field"><label class="label" for="gName">Naam van de groep</label><input id="gName" type="text" maxlength="24" placeholder="bv. Klas 5HB"></div>
      <div class="field"><span class="label">Vrienden toevoegen</span>
        ${fr.friends.length ? `<div class="chips">${fr.friends.map(id => `<button type="button" class="chip" data-act="pick" data-id="${id}" aria-pressed="${picked.has(id)}">${av(id,"sm")}${esc(nameOf(id))}<span class="check">${picked.has(id)?ic("check","s"):""}</span></button>`).join("")}</div>`
          : `<div class="small muted">Je hebt nog geen vrienden. <button type="button" class="link" data-act="nav" data-to="friends">Voeg eerst vrienden toe</button>, of maak de groep nu en deel daarna de code.</div>`}
      </div>
      <div class="err" id="authErr"></div>
      <button class="btn full" type="submit" id="groupBtn">Groep maken${picked.size ? ` met ${picked.size} vriend${picked.size>1?"en":""}` : ""}</button>
      <p class="small muted center" style="margin:0">Jij bent als eerste aan de beurt, vandaag.</p>
    </form>`;
}
function viewJoin() {
  return `<div class="top"><button class="iconbtn" data-act="nav" data-to="home" aria-label="Terug">${ic("back","s")}</button><h1 style="flex:1;font-size:26px">Groep joinen</h1></div>
    <form class="form card" id="joinForm" novalidate>
      <div class="field"><label class="label" for="jCode">Code van de groep</label><input id="jCode" type="text" maxlength="6" placeholder="bv. 3FA9C2" autocapitalize="characters" style="font-family:var(--mono);letter-spacing:.15em;text-transform:uppercase"></div>
      <div class="err" id="authErr"></div>
      <button class="btn full" type="submit" id="joinBtn">Joinen</button>
      <p class="small muted center" style="margin:0">De code staat bij je vriend onder Leden in de groep.</p>
    </form>`;
}

/* ---------- group ---------- */
function viewGroup() {
  const g = groupById(view.id);
  const T = [["today","Vandaag"],["feed","Vlogs"],["rank","Klassement"],["members","Leden"]];
  const head = `<div class="top" style="flex-wrap:wrap"><button class="iconbtn" data-act="nav" data-to="home" aria-label="Terug naar home">${ic("back","s")}</button>
    <div style="flex:1;min-width:0"><h1 style="font-size:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g?.name || "Groep")}</h1><div class="small muted">${g ? g.members.length + (g.members.length===1?" lid":" leden") : ""}</div></div>
    <div class="tabs" style="flex-basis:100%">${T.map(([k,l]) => `<button data-act="gtab" data-to="${k}" ${gtab===k?'aria-current="page"':""}>${l}</button>`).join("")}</div></div>`;
  if (!g || !loaded["g:" + view.id]) return head + loader();
  return head + ({ today: gToday, feed: gFeed, rank: gRank, members: gMembers }[gtab])(g);
}
function gToday(g) {
  const today = todayStr(), who = turnOf(g), done = postedToday(g), n = g.members.length;
  const rot = [...Array(Math.min(5, n)).keys()].map(k => turnOf(g, addDays(today, k)));
  let h = `<section class="turn glass"><div class="who"><span class="ring">${av(who)}</span><div><div class="label">${niceDate(today)}</div><div class="turn-name">${who===me.id?"Jij bent aan de beurt":esc(nameOf(who))+" is aan de beurt"}</div></div></div>
    <div><div class="label">${done?"Vlog is binnen":"Tijd over"}</div><div class="clock" data-clock>--:--:--</div></div>
    <div class="bar"><i data-clockbar></i></div>
    ${n > 1 ? `<div><div class="label" style="margin-bottom:6px">Volgende beurten</div><div class="rot">${rot.map((m,k) => `<div>${k===0?`<span class="ring">${av(m,"sm")}</span>`:av(m,"sm")}<span>${k===0?"vandaag":esc(shown(m))}</span></div>`).join("")}</div></div>` : ""}
  </section>`;
  if (jokerToday(g)) return h + `<div class="card empty" style="margin-top:14px"><span style="font-size:34px">🃏</span><b>${who===me.id?"Je hebt je joker ingezet":esc(nameOf(who))+" zet vandaag een joker in"}</b><span class="small muted">Vandaag is er geen vlog, en deze dag telt voor niemand mee.</span></div>`;
  if (who !== me.id) {
    const tv = [...VL.values()].find(v => v.group_id === g.id && v.vlog_date === today);
    if (tv) return h + `<div class="sec"><h2>Vlog van vandaag</h2></div>${vlogCard(tv)}`;
    let next = "binnenkort"; for (let k = 1; k <= n; k++) if (turnOf(g, addDays(today, k)) === me.id) { next = niceDate(addDays(today, k)); break; }
    return h + `<p class="muted" style="margin-top:14px">${esc(nameOf(who))} heeft nog niets geplaatst. Jij bent aan de beurt op ${next}.</p>${n===1?`<div class="card small muted" style="margin-top:12px">Je zit nog alleen in deze groep. Ga naar <button class="link" data-act="gtab" data-to="members">Leden</button> om vrienden toe te voegen.</div>`:""}`;
  }
  if (done) return h + `<div class="card empty" style="margin-top:14px"><b>Je vlog staat online</b><span class="small muted">Je vrienden kunnen hem nu bekijken en scoren.</span><button class="btn soft" data-act="gtab" data-to="feed">Bekijk in Vlogs</button></div>`;
  if (!draft) return h + `<div class="drop glass">${ic("cam")}<h2>Maak je vlog</h2><span class="small muted">Film meteen in de app, of kies een video uit je galerij. Daarna bewerk je hem in de studio.</span>
    <div class="row2"><button class="btn full" data-act="camera">${ic("cam","s")} Filmen</button>
    <label class="btn soft full" for="file">${ic("upload","s")} Uit galerij kiezen</label><input id="file" type="file" accept="video/*" hidden></div>
    <span class="small muted">Grote video's worden bij het plaatsen automatisch verkleind.</span></div>
    <div class="card" style="margin-top:12px;display:grid;gap:10px">
      <div style="display:flex;align-items:center;gap:10px"><span style="font-size:24px">🃏</span><div style="flex:1"><b>Joker</b><div class="small muted">${jokerUsed(g.id, me.id) ? "Je joker van deze maand is al op. Plaats je vlog voor middernacht, anders krijg je een 0." : "Geen tijd vandaag? Zet je joker in: je slaat je beurt over en deze dag telt niet mee. Je hebt 1 joker per maand."}</div></div></div>
      ${jokerUsed(g.id, me.id) ? "" : `<button class="btn soft" data-act="joker" data-id="${g.id}">Joker inzetten</button>`}
    </div>`;
  return h + `<section class="studio glass" aria-label="Studio">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Studio</h2><span class="small muted mono" id="lenTxt"></span></div>
    <div class="stage" id="stage"><video id="pv" src="${draft.url}" playsinline preload="auto"></video><div id="capPrev"></div></div>
    <div class="transport"><button class="pbtn" id="pvPlay" aria-label="Voorbeeld afspelen">${ic("play")}</button><div class="timeline" id="tl"></div></div>
    <div class="tools" role="tablist" aria-label="Bewerkingen" id="toolRow"></div>
    <div class="panel" id="toolPanel"></div>
    <div class="field"><label class="label" for="ttl">Titel</label><input id="ttl" type="text" maxlength="50" value="${esc(draft.title)}" placeholder="Waar gaat je dag over?"></div>
    <div style="display:flex;gap:8px"><button class="btn soft" id="cancel" type="button" style="flex:1">Opnieuw</button><button class="btn" id="publish" type="button" style="flex:2">Plaatsen</button></div>
  </section>`;
}
function gFeed(g) {
  const ids = (groupIds[g.id] || []).filter(id => VL.has(id));
  if (!ids.length) return `<div class="card empty" style="margin-top:6px">${ic("cam")}<b>Nog geen vlogs</b><span class="small muted">De eerste vlog van deze groep verschijnt hier.</span></div>`;
  return `<div style="margin-top:6px">${ids.map(id => vlogCard(VL.get(id))).join("")}</div>`;
}
const capHTML = c => c && c.caption ? `<div class="cap pos-${c.textPos||"bot"} st-${c.textStyle||"serif"}">${c.textStyle==="type"?`<span>${esc(c.caption)}</span>`:esc(c.caption)}</div>` : "";
function vlogCard(v, showGroup) {
  const g = groupById(v.group_id), e = v.edit || {};
  const mine = v.author === me.id, myR = v.ratings.find(r => r.user_id === me.id)?.score;
  const scores = v.ratings.map(r => r.score), avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null;
  const watched = v.views.some(x => x.user_id === me.id) || mine, liked = v.likes.some(l => l.user_id === me.id);
  const url = v.video_path ? signed[v.video_path] : null;
  const len = e.end != null ? mmss((e.end - e.start) / (e.speed || 1)) : "";
  const isToday = v.vlog_date === todayStr();
  const avgTxt = isToday ? "na 00:00" : scores.length < 3 ? (scores.length ? "?" : "–") : fmt(avg);
  const avgSub = isToday ? "scores verschijnen na middernacht" : scores.length < 3 ? `min. 3 scores nodig · ${scores.length}` : `/10 · ${scores.length} scores`;
  const rx = EMOJIS.map(em => { const list = (v.reactions || []).filter(r => r.emoji === em), mineR = list.some(r => r.user_id === me.id);
    return `<button data-act="emoji" data-id="${v.id}" data-e="${em}" aria-pressed="${mineR}" aria-label="Reageer met ${em}">${em}${list.length ? `<span>${list.length}</span>` : ""}</button>`; }).join("");
  return `<article class="vlog glass" id="card-${v.id}">
    <div class="vlog-head">${av(v.author,"sm")}<div class="t"><b>${esc(shown(v.author))}${crown(v.author, v.group_id)}</b><span class="small muted">${showGroup&&g?esc(g.name)+" · ":""}${niceDate(v.vlog_date,{day:"numeric",month:"long"})} · ${esc(v.title)}</span></div></div>
    <div class="poster" id="stage-${v.id}" style="background:${GRADS[hash(v.id)%GRADS.length]}">
      ${url ? `<video id="vid-${v.id}" src="${url}#t=${(e.start||0)+0.1}" playsinline preload="metadata" style="filter:${FILTERS[e.filter]||"none"}"></video>${capHTML(e)}` : `<div class="ttl">${esc(v.title)}${v.video_path ? "" : `<div class="small" style="font-family:var(--body);margin-top:8px;opacity:.85">Video gewist na 35 dagen</div>`}</div>`}
      ${len ? `<span class="tc">${len}</span>` : ""}${(e.music === "custom" || e.music === "sound") && e.musicName ? `<span class="pill mus">${ic("music","s")} ${esc(e.musicName.length > 22 ? e.musicName.slice(0, 21) + "…" : e.musicName)}</span>` : e.music && TRACKS[e.music] ? `<span class="pill mus">${ic("music","s")} ${TRACKS[e.music].label}</span>` : ""}
      ${url ? `<button class="play" data-act="play" data-id="${v.id}" aria-label="Vlog van ${esc(shown(v.author))} afspelen">${ic("play")}</button>` : ""}
      <div class="prog"><i id="prog-${v.id}" style="width:${watched?100:0}%"></i></div></div>
    <div class="vlog-body">
      <div class="actions">
        <button class="act" data-act="like" data-id="${v.id}" aria-pressed="${liked}">${ic("heart")}<span>${v.likes.length}</span></button>
        <span class="act">${ic("chat")}<span>${v.comments.length}</span></span>
        <div class="avg" title="${avgSub}"><span class="small muted">gem.</span><b>${avgTxt}</b></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div class="emojis">${rx}</div><span class="small muted">${avgSub}</span></div>
      ${mine ? `<div class="lock">Je eigen vlog kan je niet scoren.</div>` :
      `<div class="field"><span class="label">${myR!=null?"Jouw score":"Geef een score"}</span>
        <div class="rate" role="group" aria-label="Score van 1 tot 10">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button data-act="rate" data-id="${v.id}" data-n="${n}" aria-pressed="${myR===n}" ${watched?"":"disabled"}>${n}</button>`).join("")}</div>
        ${watched ? "" : `<div class="lock">${ic("lock","s")} ${v.video_path ? "Bekijk de vlog eerst helemaal om te scoren." : "Deze video is niet meer beschikbaar."}</div>`}</div>`}
      ${v.comments.length ? `<div class="comments">${v.comments.map(c => `<p><b>${esc(shown(c.user_id))}</b>${esc(c.body)}</p>`).join("")}</div>` : ""}
      <form class="cform" data-comment="${v.id}"><input id="c-${v.id}" type="text" maxlength="500" placeholder="Reageer…" aria-label="Reactie"><button type="submit">Plaats</button></form>
    </div></article>`;
}
function refreshCard(id) {
  const v = VL.get(id);
  document.querySelectorAll("#card-" + CSS.escape(id)).forEach(el => { el.outerHTML = vlogCard(v, view.name === "home"); });
}
function gRank(g) {
  const rows = (lb[g.id] || []).map(r => ({ n: r.user_id, count: r.vlogs, votes: r.votes, missed: r.missed || 0, avg: r.avg_score == null ? null : Number(r.avg_score) }));
  const hof = winners[g.id] || [];
  const today = todayStr(), last = new Date(Date.UTC(+today.slice(0,4), +today.slice(5,7), 0)).getUTCDate(), left = last - +today.slice(8,10);
  const mon = niceDate(today, { month: "long" });
  const top = rows.slice(0, 3), order = [top[1], top[0], top[2]];
  const pod = top.length >= 3 && top[2].avg != null ? `<div class="podium">${order.map((r,k) => { const p = [2,1,3][k]; return `<div class="pod p${p}">${p===1?`<span class="ring">${av(r.n)}</span>`:av(r.n,"sm")}<span class="n">${esc(shown(r.n))}</span><div class="blk"><b>${fmt(r.avg)}</b><span class="small" style="opacity:.75">#${p}</span></div></div>`; }).join("")}</div>` : "";
  return `<div class="card" style="display:grid;gap:14px;margin-top:6px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><h2 style="text-transform:capitalize">${mon}</h2><span class="small muted">nog ${left} ${left===1?"dag":"dagen"}</span></div>${pod}</div>
    <div class="card" style="margin-top:12px"><ol class="rank">${rows.map((r,k) => `<li><span class="pos">${k+1}</span>${av(r.n,"sm")}<div><b>${esc(shown(r.n))}${crown(r.n, g.id)}</b><small>${r.count} vlog${r.count===1?"":"s"} · ${r.votes} scores${r.missed?` · <span class="danger">${r.missed} gemist</span>`:""}${jokerUsed(g.id, r.n)?" · 🃏 gebruikt":""}</small><div class="meter"><i style="width:${(r.avg??0)*10}%"></i></div></div><span class="sc">${fmt(r.avg)}</span></li>`).join("")}</ol></div>
    <p class="small muted">Je score is het gemiddelde van alle scores die je deze maand kreeg. Een gemiste beurt telt als een 0. Scores van vandaag tellen pas mee na middernacht. De winnaar wordt bekend op 1 ${niceDate(addDays(today, last - +today.slice(8,10) + 1), { month: "long" })}.</p>
    <div class="sec"><h2>Hall of fame</h2><span class="small muted">👑</span></div>
    ${hof.length ? `<div class="card"><ul class="hof">${hof.map(w => `<li>${av(w.user_id,"sm")}<div class="t"><b>${niceDate(w.month,{month:"long",year:"numeric"})}</b><span class="small muted">${esc(shown(w.user_id))}</span></div><span class="sc mono" style="font-weight:700">${fmt(w.avg_score)}</span></li>`).join("")}</ul></div>`
      : `<div class="card small muted">Hier komen de winnaars van elke maand. De eerste kroon wordt uitgedeeld op 1 ${niceDate(addDays(today, last - +today.slice(8,10) + 1), { month: "long" })}.</div>`}`;
}
function gMembers(g) {
  const today = todayStr(), n = g.members.length;
  const addable = fr.friends.filter(id => !g.members.includes(id));
  const rows = [...Array(n).keys()].map(k => { const id = turnOf(g, addDays(today, k));
    return `<li>${k===0?`<span class="ring">${av(id,"sm")}</span>`:av(id,"sm")}<div class="t"><b>${esc(shown(id))}</b><span class="small muted">${k===0?"vandaag":niceDate(addDays(today,k),{weekday:"short",day:"numeric",month:"short"})}</span></div>${id!==me.id&&!fr.friends.includes(id)?relation(id):""}</li>`; }).join("");
  return `<div class="card" style="margin-top:6px"><div class="label">Volgorde van de beurten</div><ul class="list">${rows}</ul></div>
    <div class="sec"><h2>Vrienden toevoegen</h2></div>
    ${addable.length ? `<div class="chips">${addable.map(id => `<button class="chip" data-act="addToGroup" data-id="${id}">${av(id,"sm")}${esc(nameOf(id))}<span class="check">${ic("plus","s")}</span></button>`).join("")}</div>`
      : `<div class="card small muted">${fr.friends.length ? "Al je vrienden zitten in deze groep." : "Je hebt nog geen vrienden om toe te voegen."} <button class="link" data-act="nav" data-to="friends">Vrienden zoeken</button></div>`}
    <div class="card" style="margin-top:12px;display:grid;gap:10px"><span class="label">Of deel de code</span><div class="code">${esc(g.code)}</div>
      <div style="display:flex;gap:8px"><button class="btn soft" style="flex:1" data-act="copy" data-id="${esc(g.code)}">Code kopiëren</button><button class="btn" style="flex:1" data-act="share" data-id="${esc(g.code)}">${ic("share","s")} Link delen</button></div></div>
    <div class="sec"><h2>Spelregels</h2></div>
    <div class="card"><ol class="rules">
      <li>Elke dag is één iemand aan de beurt, in vaste volgorde.</li>
      <li>Je hebt tot middernacht om je vlog te plaatsen. Mis je je beurt, dan krijg je een 0.</li>
      <li>Je hebt 1 joker per maand om je beurt over te slaan. Die dag telt dan niet mee.</li>
      <li>Pas na het volledig bekijken kan je scoren van 1 tot 10. Je eigen vlog scoren kan niet.</li>
      <li>Scores blijven geheim tot middernacht. Het gemiddelde verschijnt vanaf 3 scores.</li>
      <li>Op het einde van de maand wint het hoogste gemiddelde en krijgt een 👑.</li>
      <li>Video's worden na 35 dagen gewist. Scores blijven bewaard.</li></ol></div>
    <button class="btn soft full" style="margin-top:16px" data-act="leave" data-id="${g.id}">Groep verlaten</button>`;
}

/* ---------- clock ---------- */
function tick() {
  const left = secsLeft(), txt = [Math.floor(left/3600), Math.floor(left%3600/60), left%60].map(x => String(x).padStart(2,"0")).join(":");
  document.querySelectorAll("[data-clock]").forEach(e => e.textContent = txt);
  document.querySelectorAll("[data-clockbar]").forEach(e => e.style.width = (100 - left/864) + "%");
}
setInterval(tick, 1000);

/* ---------- camera ---------- */
let rec = null;
const REC_TYPES = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
async function openRecorder() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("Filmen in de app lukt niet in deze browser. Kies een video uit je galerij."); return; }
  rec = { facing: "user", chunks: [], mr: null, stream: null, t0: 0, iv: 0, music: null };
  const box = document.createElement("div"); box.className = "rec"; box.id = "rec";
  box.innerHTML = `<video id="camv" playsinline muted autoplay></video>
    <div class="bar-top"><button class="round" id="camClose" aria-label="Sluiten">${ic("x")}</button><span class="time" id="camTime">0:00 / ${mmss(MAX_REC)}</span><button class="round" id="camMusic" aria-label="Muziek tijdens filmen">${ic("music")}</button></div>
    <div class="cam-sheet" id="camSheet" hidden></div>
    <div class="hint" id="camHint">Tik op de rode knop om te filmen</div>
    <div class="ctl"><span style="width:52px"></span><button class="shutter" id="camShut" aria-label="Opnemen"><i></i></button><button class="round" id="camFlip" aria-label="Andere camera">${ic("flip")}</button></div>`;
  document.body.appendChild(box); document.body.style.overflow = "hidden";
  $("camClose").onclick = () => closeRecorder();
  $("camFlip").onclick = () => { if (!rec.mr) startCam(rec.facing === "user" ? "environment" : "user"); };
  $("camShut").onclick = () => rec.mr ? stopRec() : startRec();
  $("camMusic").onclick = () => { if (rec.mr) return; const s = $("camSheet"); s.hidden = !s.hidden; if (!s.hidden) drawCamSheet(); };
  try { await startCam("user"); }
  catch (e) { closeRecorder(); toast("Geen toegang tot je camera. Sta het toe in je browser, of kies een video uit je galerij."); }
}
async function startCam(facing) {
  if (rec.stream) rec.stream.getTracks().forEach(t => t.stop());
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true });
  if (!rec) { stream.getTracks().forEach(t => t.stop()); return; }
  rec.stream = stream; rec.facing = facing;
  const v = $("camv"); v.srcObject = stream; v.style.transform = facing === "user" ? "scaleX(-1)" : "";
  try { await v.play(); } catch (e) {}
}
// Kies muziek die meespeelt terwijl je filmt
function drawCamSheet() {
  const gid = view.id, songs = (lib[gid] || []).filter(s => s.kind === "music");
  const opt = (key, label, sub, on) => `<button class="track" data-cm="${key}" aria-pressed="${on}"><span class="art" style="background:var(--raise)">${ic("music","s")}</span><span class="t"><b>${esc(label)}</b><span class="small muted">${esc(sub)}</span></span>${on ? ic("check","s") : ""}</button>`;
  const cur = rec.music ? rec.music.key : "";
  $("camSheet").innerHTML = `<div class="label">Muziek tijdens het filmen</div>
    <div class="tracks">${opt("", "Geen muziek", "Alleen het geluid van je camera", !cur)}
    ${songs.map(s => opt("s:" + s.id, s.name, `van ${shown(s.user_id)} · ${mmss(s.duration || 0)}`, cur === "s:" + s.id)).join("")}
    ${Object.entries(TRACKS).map(([k, t]) => opt("b:" + k, t.label, "Ingebouwd deuntje", cur === "b:" + k)).join("")}</div>
    <span class="small muted">Tip: met oortjes hoor je de muziek, en neemt je microfoon ze niet mee op. In de studio voeg je de muziek dan zuiver toe.</span>`;
  $("camSheet").querySelectorAll("[data-cm]").forEach(b => b.onclick = () => {
    const k = b.dataset.cm;
    rec.music = !k ? null : k.startsWith("s:") ? { key: k, sound: soundById(gid, k.slice(2)) } : { key: k, builtin: k.slice(2) };
    stopMusic();
    if (rec.music) startMusic(rec.music.sound ? { url: signed[rec.music.sound.path], offset: 0 } : rec.music.builtin, .6);
    setTimeout(() => { if (rec && !rec.mr) stopMusic(); }, 3000);
    drawCamSheet();
    const btn = $("camMusic"); if (btn) btn.classList.toggle("on", !!rec.music);
  });
}
function startRec() {
  const type = REC_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || "";
  $("camSheet").hidden = true; $("camMusic").disabled = true;
  if (rec.music) { ac(); startMusic(rec.music.sound ? { url: signed[rec.music.sound.path], offset: 0 } : rec.music.builtin, .6); }
  try { rec.mr = new MediaRecorder(rec.stream, { mimeType: type || undefined, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 96_000 }); }
  catch (e) { rec.mr = new MediaRecorder(rec.stream); }
  rec.chunks = [];
  rec.mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
  rec.mr.onstop = () => {
    const secs = (Date.now() - rec.t0) / 1000;
    const blob = new Blob(rec.chunks, { type: (rec.mr.mimeType || type || "video/webm").split(";")[0] });
    const m = rec.music;
    // de muziek die tijdens het filmen speelde, staat meteen klaar in de studio en loopt gelijk met je beelden
    const preset = !m ? null : m.sound
      ? { music: "sound", soundId: m.sound.id, musicPath: m.sound.path, musicName: m.sound.name, musicOffset: 0, musicSync: true, origVol: .6 }
      : { music: m.builtin, origVol: .6 };
    stopMusic(); closeRecorder(); loadDraft(blob, secs, preset);
  };
  rec.mr.start(1000); rec.t0 = Date.now();
  $("camShut").classList.add("on"); $("camShut").setAttribute("aria-label", "Stoppen");
  $("camHint").textContent = "Tik nog eens om te stoppen"; $("camFlip").disabled = true;
  rec.iv = setInterval(() => { const s = (Date.now() - rec.t0) / 1000; const t = $("camTime"); if (t) { t.textContent = `${mmss(s)} / ${mmss(MAX_REC)}`; t.classList.add("on"); } if (s >= MAX_REC) stopRec(); }, 250);
}
function stopRec() { if (rec?.mr && rec.mr.state !== "inactive") { clearInterval(rec.iv); rec.mr.stop(); } }
function closeRecorder() {
  if (!rec) return;
  clearInterval(rec.iv);
  if (!rec.mr) stopMusic();
  if (rec.stream) rec.stream.getTracks().forEach(t => t.stop());
  $("rec")?.remove(); document.body.style.overflow = ""; rec = null;
}

/* ---------- studio ---------- */
const TOOLS = [["trim","Knippen","cut"],["filter","Filters","filter"],["text","Tekst","text"],["music","Muziek","music"],["sfx","Geluidjes","sound"],["voice","Stem","mic"],["speed","Snelheid","speed"],["mix","Volume","mix"]];
function loadDraft(blob, knownDur, preset) {
  if (!blob || !blob.size) { toast("De opname is leeg. Probeer opnieuw."); return; }
  if (blob.size > 1500 * 1048576) { toast(`Deze video is ${Math.round(blob.size/1048576)} MB, dat is te groot om te verkleinen. Kies een kortere video.`); return; }
  if (blob.size > MAX_BYTES) toast(`Deze video is ${Math.round(blob.size/1048576)} MB. Hij wordt bij het plaatsen automatisch verkleind.`);
  const url = URL.createObjectURL(blob), probe = document.createElement("video");
  probe.preload = "metadata"; probe.muted = true; probe.src = url;
  const ready = dur => {
    draft = { blob, url, type: blob.type || "video/mp4", dur, start: 0, end: dur, filter: "Geen", caption: "", textStyle: "serif", textPos: "bot", title: "",
      music: null, musicVol: .5, musicOffset: 0, musicSync: false, origVol: 1, sfxVol: .9, voice: null, voiceVol: 1, speed: 1, sfx: [], ...(preset || {}) };
    tool = preset ? "music" : "trim"; sfxAt = 0; render(true);
    if (preset) toast("De muziek van tijdens het filmen staat klaar. Druk op afspelen.");
  };
  probe.onloadedmetadata = () => {
    if (isFinite(probe.duration) && probe.duration > 0) return ready(probe.duration);
    if (knownDur) return ready(knownDur);
    probe.currentTime = 1e7; probe.ontimeupdate = () => { probe.ontimeupdate = null; ready(isFinite(probe.duration) ? probe.duration : 60); };
  };
  probe.onerror = () => { if (knownDur) ready(knownDur); else toast("Deze video kan niet geopend worden. Probeer een MP4- of MOV-bestand."); };
}
function bindStudio() {
  const f = $("file");
  if (f) f.addEventListener("change", e => { const file = e.target.files[0]; if (file) loadDraft(file); });
  if (!draft) return;
  const pv = $("pv");
  pv.addEventListener("loadedmetadata", () => { pv.currentTime = draft.start; }, { once: true });
  applyLook(); drawTimeline(); drawTools(); drawPanel();
  $("pvPlay").onclick = () => {
    if (playingOn(pv)) { stopEdit(); setPlayIcon(false); return; }
    setPlayIcon(true);
    playEdit(pv, draftCfg(), $("stage"), t => drawHead(t), () => { setPlayIcon(false); pv.currentTime = draft.start; drawHead(draft.start); }, () => { setPlayIcon(false); toast("Afspelen lukte niet. Tik nog eens op afspelen."); });
  };
  $("ttl").oninput = e => draft.title = e.target.value;
  $("cancel").onclick = () => { stopEdit(); stopVoiceRec(true); URL.revokeObjectURL(draft.url); draft = null; render(true); };
  $("publish").onclick = publish;
}
async function publish() {
  if (publishing) return;
  stopEdit(); const g = groupById(view.id); if (!g || !draft) return;
  publishing = true; const btn = $("publish"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Uploaden…`;
  let { blob, url, ...rest } = draft;
  let type = (draft.type || "video/mp4").split(";")[0];
  let start = rest.start, end = rest.end, dur = rest.dur, sfx = rest.sfx.map(s => ({ ...s })), shift = 0;
  try {
    if (blob.size > MAX_BYTES) {
      // Verklein alleen het stuk dat je hebt gehouden, op ongeveer 720p
      btn.innerHTML = `<span class="spin"></span> Verkleinen… 0%`;
      const out = await compressRange(url, start, end, p => { btn.innerHTML = `<span class="spin"></span> Verkleinen… ${Math.round(p * 100)}%`; });
      if (out.blob.size > MAX_BYTES) throw new Error("Ook verkleind is deze video groter dan 50 MB. Knip hem korter.");
      blob = out.blob; type = out.blob.type || "video/webm";
      sfx = sfx.map(s => ({ ...s, t: Math.max(0, s.t - start) })); shift = start; dur = out.dur; start = 0; end = out.dur;
      url = URL.createObjectURL(blob);
      btn.innerHTML = `<span class="spin"></span> Uploaden…`;
    }
  } catch (e) { publishing = false; btn.disabled = false; btn.textContent = "Plaatsen"; toast(errMsg(e)); return; }
  const ext = type.includes("webm") ? "webm" : type.includes("quicktime") ? "mov" : "mp4";
  const path = `${g.id}/${crypto.randomUUID()}.${ext}`;
  const edit = { start, end, dur, filter: rest.filter, caption: rest.caption.trim(), textStyle: rest.textStyle, textPos: rest.textPos,
    music: rest.music, musicVol: rest.musicVol, musicOffset: (rest.musicOffset || 0) + (rest.musicSync ? shift : 0), musicSync: !!rest.musicSync,
    origVol: rest.origVol, sfxVol: rest.sfxVol, voiceVol: rest.voiceVol, speed: rest.speed,
    sfx: sfx.map(s => s.path ? { type: "sound", t: s.t, path: s.path, name: s.name, soundId: s.soundId } : { type: s.type, t: s.t }) };
  if (rest.music === "sound") Object.assign(edit, { musicPath: rest.musicPath, musicName: rest.musicName, soundId: rest.soundId });
  let voicePath = null;
  try {
    const up = await sb.storage.from("vlogs").upload(path, blob, { contentType: type, upsert: false });
    if (up.error) throw up.error;
    if (rest.voice) {
      btn.innerHTML = `<span class="spin"></span> Stem uploaden…`;
      voicePath = `${g.id}/${crypto.randomUUID()}.${musicExt(rest.voice.file)}`;
      const uv = await sb.storage.from("vlogs").upload(voicePath, rest.voice.file, { contentType: musicType(rest.voice.file), upsert: false });
      if (uv.error) { await sb.storage.from("vlogs").remove([path]); voicePath = null; throw uv.error; }
      edit.voicePath = voicePath;
    }
    const ins = await sb.from("vlogs").insert({ group_id: g.id, author: me.id, vlog_date: todayStr(), title: rest.title.trim() || "Mijn dag", video_path: path, edit }).select(VSEL).single();
    if (ins.error) { await sb.storage.from("vlogs").remove([path, voicePath].filter(Boolean)); throw ins.error; }
    VL.set(ins.data.id, ins.data); signed[path] = url;
    if (voicePath) signed[voicePath] = rest.voice.url;
    const musicPath = voicePath;
    groupIds[g.id] = [ins.data.id, ...(groupIds[g.id] || [])];
    draft = null; publishing = false; gtab = "feed"; render();
    toast("Geplaatst. Je vrienden kunnen nu kijken en scoren.");
    sb.functions.invoke(JOBS_FUNCTION, { body: { type: "new_vlog", vlog_id: ins.data.id } }).catch(() => {});
    signed[path] = undefined; if (musicPath) signed[musicPath] = undefined;
    await signUrls([path, musicPath].filter(Boolean));
  } catch (e) {
    publishing = false; btn.disabled = false; btn.textContent = "Plaatsen"; toast(errMsg(e));
  }
}
// Speelt het gekozen stuk af in een onzichtbare speler en neemt het opnieuw op, kleiner
function compressRange(srcUrl, start, end, onProg) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.playsInline = true; v.preload = "auto"; v.src = srcUrl;
    const c = document.createElement("canvas"), ctx = c.getContext("2d");
    const actx = ac();
    let mr, chunks = [], t0 = 0, done = false, raf = 0;
    const fail = msg => { if (done) return; done = true; cancelAnimationFrame(raf); try { v.pause(); } catch (e) {} reject(new Error(msg)); };
    v.onerror = () => fail("Deze video kan niet verkleind worden in deze browser. Kies een kortere video of film in de app.");
    v.onloadedmetadata = () => {
      const scale = Math.min(1, 1280 / Math.max(v.videoWidth || 720, v.videoHeight || 1280));
      c.width = Math.round((v.videoWidth || 720) * scale / 2) * 2; c.height = Math.round((v.videoHeight || 1280) * scale / 2) * 2;
      let stream;
      try {
        stream = c.captureStream(30);
        const src = actx.createMediaElementSource(v), dest = actx.createMediaStreamDestination();
        src.connect(dest);
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        const type = REC_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || "";
        mr = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: 1_800_000, audioBitsPerSecond: 96_000 });
      } catch (e) { return fail("Verkleinen lukt niet in deze browser. Kies een kortere video of film in de app."); }
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => { const blob = new Blob(chunks, { type: (mr.mimeType || "video/webm").split(";")[0] }); resolve({ blob, dur: (performance.now() - t0) / 1000 }); };
      if (start < 0.05) v.onseeked(); else v.currentTime = start;
    };
    v.onseeked = () => {
      if (mr.state !== "inactive" || done) return;
      v.play().then(() => {
        mr.start(1000); t0 = performance.now();
        const draw = () => {
          if (done) return;
          ctx.drawImage(v, 0, 0, c.width, c.height);
          onProg(Math.min(1, (v.currentTime - start) / (end - start)));
          if (v.currentTime >= end || v.ended) { done = true; v.pause(); mr.stop(); return; }
          raf = requestAnimationFrame(draw);
        };
        draw();
      }).catch(() => fail("Afspelen voor het verkleinen lukte niet. Probeer opnieuw en laat je scherm aan."));
    };
  });
}
function setPlayIcon(on) { const b = $("pvPlay"); if (b) { b.innerHTML = ic(on ? "stop" : "play"); b.setAttribute("aria-label", on ? "Stoppen" : "Voorbeeld afspelen"); } }
function applyLook() {
  const pv = $("pv"); if (!pv) return;
  pv.style.filter = FILTERS[draft.filter];
  $("capPrev").innerHTML = capHTML(draft);
  $("lenTxt").textContent = `${mmss((draft.end - draft.start) / draft.speed)} na bewerken`;
}
function drawTimeline() {
  const tl = $("tl"); if (!tl) return; const D = draft.dur, p = x => (x / D * 100) + "%";
  tl.innerHTML = `<div class="keep" style="left:${p(draft.start)};width:${(draft.end-draft.start)/D*100}%"></div>${draft.music?`<div class="musicband" style="left:${p(draft.start)};right:${100-draft.end/D*100}%"></div>`:""}${draft.sfx.map(s => `<span class="mk" style="left:${p(s.t)}" title="${esc(s.path ? s.name : SFX[s.type].label)}">${s.path ? "🔊" : SFX[s.type].emo}</span>`).join("")}<div class="head" id="head" style="left:${p($("pv")?.currentTime || draft.start)}"></div>`;
}
function drawHead(t) { const h = $("head"); if (h) h.style.left = (t / draft.dur * 100) + "%"; }
function drawTools() {
  $("toolRow").innerHTML = TOOLS.map(([k,l,i]) => { const badge = k==="sfx"&&draft.sfx.length ? `<b>${draft.sfx.length}</b>` : k==="music"&&draft.music ? "<b>1</b>" : k==="voice"&&draft.voice ? "<b>1</b>" : "";
    return `<button class="tool" role="tab" data-tool="${k}" aria-pressed="${tool===k}"><span class="sq">${ic(i)}${badge}</span>${l}</button>`; }).join("");
  document.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { tool = b.dataset.tool; drawTools(); drawPanel(); });
}
// Hoe de studio de vlog afspeelt: met de tijdelijke links naar muziek, stem en eigen geluiden
function draftCfg() {
  const d = draft;
  return { ...d,
    musicUrl: d.music === "sound" && d.musicPath ? signed[d.musicPath] : null,
    voiceUrl: d.voice ? d.voice.url : null,
    sfx: d.sfx.map(s => s.path ? { ...s, url: signed[s.path] } : s) };
}
const MAX_MUSIC = 15 * 1024 * 1024;
const MAX_FX = 10;
const sfxLabel = s => s.path ? `🔊 ${esc(s.name || "Geluid")}` : `${SFX[s.type].emo} ${SFX[s.type].label}`;
function soundRow(s, on) {
  const mine = s.user_id === me.id;
  return `<div class="track" data-song="${s.id}" aria-pressed="${on}" role="button" tabindex="0"><span class="art" style="background:linear-gradient(160deg,var(--amber),var(--hot))">${ic("music","s")}</span><span class="t"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.name)}</b><span class="small muted">van ${esc(shown(s.user_id))} · ${mmss(s.duration || 0)}</span></span>${on ? ic("check","s") : ""}${mine ? `<button class="x" data-snd-del="${s.id}" aria-label="${esc(s.name)} uit de groep verwijderen">${ic("x","s")}</button>` : ""}</div>`;
}
function drawPanel() {
  const P2 = $("toolPanel"), d = draft, pv = $("pv"), gid = view.id;
  if (!P2 || !d) return;
  const R = (id, label, min, max, step, v, show) => `<div class="field"><span class="label">${label}</span><div class="range-row"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label}"><span class="mono" id="${id}v">${show}</span></div></div>`;
  const pct = x => Math.round(x * 100) + "%";
  const at = Math.min(Math.max(sfxAt, d.start), d.end);
  const songs = (lib[gid] || []).filter(s => s.kind === "music"), effects = (lib[gid] || []).filter(s => s.kind === "effect");
  const cur = d.music === "sound" ? (soundById(gid, d.soundId) || { name: d.musicName, duration: 0 }) : null;
  const html = {
    trim: () => R("rs","Begin",0,d.dur,.1,d.start,mmss(d.start)) + R("re","Einde",0,d.dur,.1,d.end,mmss(d.end)),
    filter: () => `<div class="swatches">${Object.keys(FILTERS).map(f => `<button class="sw" data-v="${f}" aria-pressed="${d.filter===f}"><i style="filter:${FILTERS[f]}"></i>${f}</button>`).join("")}</div>`,
    text: () => `<div class="field"><label class="label" for="cap">Tekst op de video</label><input id="cap" type="text" maxlength="40" value="${esc(d.caption)}" placeholder="bv. Maandag in de werkplaats"></div>
      <div class="field"><span class="label">Stijl</span><div class="opts" data-group="textStyle">${Object.entries(TEXTSTYLES).map(([k,l]) => `<button data-v="${k}" aria-pressed="${d.textStyle===k}">${l}</button>`).join("")}</div></div>
      <div class="field"><span class="label">Plaats</span><div class="opts" data-group="textPos">${Object.entries(TEXTPOS).map(([k,l]) => `<button data-v="${k}" aria-pressed="${d.textPos===k}">${l}</button>`).join("")}</div></div>`,
    music: () => `<div class="field"><span class="label">Geluiden van je groep</span>
        ${songs.length ? `<div class="tracks">${songs.map(s => soundRow(s, d.music === "sound" && d.soundId === s.id)).join("")}</div>` : `<span class="small muted">Nog geen nummers in je groep. Importeer het eerste!</span>`}
        <label class="btn soft full" for="musicFile">${ic("upload","s")} Muziek importeren</label>
        <input id="musicFile" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" hidden>
        <span class="small muted" id="musicStatus">Een mp3, m4a of wav, max. 15 MB. Wat je importeert, kan je hele groep ook gebruiken. Gebruik alleen muziek die je mag gebruiken.</span></div>
      ${cur ? (d.musicSync ? `<span class="small muted">🎬 Deze muziek speelde tijdens het filmen en loopt gelijk met je beelden, ook als je knipt.</span>`
        : cur.duration > 5 ? R("mo","Begin van het nummer",0,Math.max(0, Math.floor(cur.duration - 5)),1,d.musicOffset || 0,mmss(d.musicOffset || 0)) : "") : ""}
      <div class="label" style="margin-top:4px">Ingebouwde deuntjes</div>
      <div class="tracks"><button class="track" data-v="" aria-pressed="${!d.music}"><span class="art" style="background:var(--raise)">${ic("x","s")}</span><span class="t"><b>Geen muziek</b><span class="small muted">Alleen het geluid van je video</span></span></button>
      ${Object.entries(TRACKS).map(([k,t]) => `<button class="track" data-v="${k}" aria-pressed="${d.music===k}"><span class="art" style="background:${t.art}">${ic("music","s")}</span><span class="t"><b>${t.label}</b><span class="small muted">${t.sub}</span></span>${d.music===k?ic("check","s"):""}</button>`).join("")}</div>`,
    sfx: () => R("at","Moment in je video",d.start,d.end,.1,at,mmss(at)) +
      `<div class="sfxgrid">${Object.entries(SFX).map(([k,s]) => `<button class="sfx" data-v="${k}"><span>${s.emo}</span>${s.label}</button>`).join("")}
        ${effects.map(s => `<button class="sfx" data-fx="${s.id}" title="van ${esc(shown(s.user_id))}"><span>🔊</span>${esc(s.name.length > 10 ? s.name.slice(0, 9) + "…" : s.name)}</button>`).join("")}</div>
      <p class="small muted" style="margin:0">Kies een moment en tik op een geluidje om het daar te plaatsen.</p>
      ${d.sfx.length ? `<div class="placed">${d.sfx.map((s,i) => `<div><b style="flex:1">${sfxLabel(s)}</b><span class="mono">${mmss(s.t)}</span><button class="x" data-del="${i}" aria-label="Geluid verwijderen">${ic("x","s")}</button></div>`).join("")}</div>` : ""}
      <div class="field" style="border-top:1px solid var(--line);padding-top:12px"><span class="label">Eigen geluid maken</span>
        <input id="fxName" type="text" maxlength="30" placeholder="Naam, bv. Lars zijn lach">
        <div style="display:flex;gap:8px"><button class="btn soft sm" style="flex:1" id="fxRec">${fxRec ? ic("stop","s") + " Stoppen" : ic("mic","s") + " Opnemen"}</button><label class="btn soft sm" style="flex:1" for="fxFile">${ic("upload","s")} Importeren</label></div>
        <input id="fxFile" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" hidden>
        <span class="small muted" id="fxStatus">${fxRec ? "Opnemen…" : `Max. ${MAX_FX} seconden. Je groep kan het daarna ook gebruiken.`}</span></div>
      ${effects.some(s => s.user_id === me.id) ? `<div class="field"><span class="label">Jouw geluiden in de groep</span><div class="placed">${effects.filter(s => s.user_id === me.id).map(s => `<div><b style="flex:1">🔊 ${esc(s.name)}</b><button class="x" data-snd-del="${s.id}" aria-label="${esc(s.name)} verwijderen">${ic("x","s")}</button></div>`).join("")}</div></div>` : ""}`,
    voice: () => voiceRec
      ? `<p style="margin:0"><b>🔴 Je stem wordt opgenomen…</b></p><span class="small muted">Praat terwijl je video speelt. De opname stopt vanzelf op het einde.</span><button class="btn" id="voiceRec">${ic("stop","s")} Stoppen</button>`
      : d.voice
        ? `<div class="track" style="cursor:default"><span class="art" style="background:linear-gradient(160deg,var(--amber),var(--hot))">${ic("mic","s")}</span><span class="t"><b>Je stem</b><span class="small muted">${mmss(d.voice.dur)} ingesproken</span></span><button class="x" id="voiceDel" aria-label="Stem verwijderen">${ic("x","s")}</button></div>
           <button class="btn soft" id="voiceRec">${ic("mic","s")} Opnieuw inspreken</button>`
        : `<p class="small muted" style="margin:0">Spreek iets in over je video, zoals een verteller. Je video speelt af zonder geluid terwijl je praat.</p><button class="btn" id="voiceRec">${ic("mic","s")} Start met inspreken</button>`,
    speed: () => `<div class="opts" data-group="speed">${SPEEDS.map(s => `<button data-v="${s}" aria-pressed="${d.speed===s}">${String(s).replace(".",",")}×</button>`).join("")}</div><p class="small muted" style="margin:0">0,5× is slow-motion, 2× maakt saaie stukken snel.</p>`,
    mix: () => R("vo","Geluid van je video",0,1,.05,d.origVol,pct(d.origVol)) + R("vm","Muziek",0,1,.05,d.musicVol,pct(d.musicVol)) + R("vs","Geluidjes",0,1,.05,d.sfxVol,pct(d.sfxVol)) + (d.voice ? R("vv","Je stem",0,1,.05,d.voiceVol,pct(d.voiceVol)) : "")
  }[tool]();
  P2.innerHTML = html;

  const on = (id, fn) => { const el = $(id); if (el) el.oninput = fn; };
  const setv = (id, txt) => { const e = $(id + "v"); if (e) e.textContent = txt; };
  const redraw = () => { drawTimeline(); drawTools(); drawPanel(); };
  on("rs", e => { d.start = Math.min(+e.target.value, d.end - .5); e.target.value = d.start; pv.currentTime = d.start; setv("rs", mmss(d.start)); d.sfx = d.sfx.filter(s => s.t >= d.start); drawTimeline(); applyLook(); });
  on("re", e => { d.end = Math.max(+e.target.value, d.start + .5); e.target.value = d.end; pv.currentTime = d.end; setv("re", mmss(d.end)); d.sfx = d.sfx.filter(s => s.t <= d.end); drawTimeline(); applyLook(); });
  on("cap", e => { d.caption = e.target.value; applyLook(); });
  on("at", e => { sfxAt = +e.target.value; pv.currentTime = sfxAt; drawHead(sfxAt); setv("at", mmss(sfxAt)); });
  on("vo", e => { d.origVol = +e.target.value; setv("vo", pct(d.origVol)); liveSet({ origVol: d.origVol }); });
  on("vm", e => { d.musicVol = +e.target.value; setv("vm", pct(d.musicVol)); liveSet({ musicVol: d.musicVol }); });
  on("vs", e => { d.sfxVol = +e.target.value; setv("vs", pct(d.sfxVol)); liveSet({ sfxVol: d.sfxVol }); });
  on("vv", e => { d.voiceVol = +e.target.value; setv("vv", pct(d.voiceVol)); liveSet({ voiceVol: d.voiceVol }); });
  on("mo", e => { d.musicOffset = +e.target.value; setv("mo", mmss(d.musicOffset)); });
  const mo = $("mo"); if (mo) mo.onchange = () => previewMusic();
  P2.querySelectorAll(".sw").forEach(b => b.onclick = () => { d.filter = b.dataset.v; applyLook(); drawPanel(); });
  P2.querySelectorAll(".opts").forEach(grp => grp.querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = grp.dataset.group; d[k] = k === "speed" ? +b.dataset.v : b.dataset.v;
    if (k === "speed") liveSet({ speed: d.speed }); applyLook(); drawPanel(); }));
  // ingebouwde deuntjes
  P2.querySelectorAll(".track[data-v]").forEach(b => b.onclick = () => { d.music = b.dataset.v || null; d.musicSync = false; previewMusic(); redraw(); });
  // nummers uit de groep
  P2.querySelectorAll("[data-song]").forEach(b => b.onclick = ev => {
    if (ev.target.closest("[data-snd-del]")) return;
    const s = soundById(gid, b.dataset.song); if (!s) return;
    Object.assign(d, { music: "sound", soundId: s.id, musicPath: s.path, musicName: s.name, musicOffset: 0, musicSync: false });
    previewMusic(); redraw(); });
  P2.querySelectorAll("[data-snd-del]").forEach(b => b.onclick = async ev => {
    ev.stopPropagation();
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.style.color = "var(--warn)"; toast("Tik nog eens op het kruisje om dit geluid voor iedereen in de groep te verwijderen."); return; }
    try {
      const s = soundById(gid, b.dataset.sndDel); await deleteSound(gid, b.dataset.sndDel);
      if (s && d.soundId === s.id) { d.music = null; stopMusic(); }
      if (s) d.sfx = d.sfx.filter(x => x.path !== s.path);
      toast("Geluid verwijderd."); redraw();
    } catch (e) { toast(errMsg(e)); }
  });
  const mf = $("musicFile"); if (mf) mf.onchange = ev => { const f = ev.target.files[0]; if (f) importSong(f); };
  // geluidseffecten
  P2.querySelectorAll(".sfx[data-v]").forEach(b => b.onclick = () => {
    const t = Math.min(Math.max(sfxAt, d.start), d.end);
    d.sfx.push({ type: b.dataset.v, t }); d.sfx.sort((a, b) => a.t - b.t); previewSfx(b.dataset.v); redraw(); });
  P2.querySelectorAll("[data-fx]").forEach(b => b.onclick = () => {
    const s = soundById(gid, b.dataset.fx); if (!s) return;
    const t = Math.min(Math.max(sfxAt, d.start), d.end);
    d.sfx.push({ type: "sound", t, path: s.path, name: s.name, soundId: s.id }); d.sfx.sort((a, b) => a.t - b.t);
    playOnce(signed[s.path]); redraw(); });
  P2.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { d.sfx.splice(+b.dataset.del, 1); redraw(); });
  const fr2 = $("fxRec"); if (fr2) fr2.onclick = () => toggleFxRec();
  const ff = $("fxFile"); if (ff) ff.onchange = ev => { const f = ev.target.files[0]; if (f) importEffect(f, ($("fxName")?.value.trim()) || f.name.replace(/\.[^.]+$/, "")); };
  // stem
  const vr = $("voiceRec"); if (vr) vr.onclick = () => toggleVoiceRec();
  const vd = $("voiceDel"); if (vd) vd.onclick = () => { if (d.voice) URL.revokeObjectURL(d.voice.url); d.voice = null; redraw(); };
}
function previewMusic() {
  const d = draft, pv = $("pv"); if (!d || playingOn(pv)) return;
  const src = d.music === "sound" ? (signed[d.musicPath] ? { url: signed[d.musicPath], offset: d.musicSync ? 0 : (d.musicOffset || 0) } : null) : d.music;
  clearTimeout(previewMusic.t);
  if (src) { startMusic(src, d.musicVol); previewMusic.t = setTimeout(() => { if (!playingOn($("pv"))) stopMusic(); }, 4000); } else stopMusic();
}
function playOnce(url) { if (!url) return; const a = new Audio(url); a.volume = .9; a.play().catch(() => {}); }
function audioOk(file) { return (file.type || "").startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|flac|webm)$/i.test(file.name || ""); }

// Een nummer importeren: het komt meteen in de geluiden van je groep
async function importSong(file) {
  if (!audioOk(file)) { toast("Kies een muziekbestand, zoals een mp3."); return; }
  if (file.size > MAX_MUSIC) { toast(`Dit nummer is ${Math.round(file.size/1048576)} MB. Het maximum is 15 MB.`); return; }
  const url = URL.createObjectURL(file), dur = await probeDuration(url); URL.revokeObjectURL(url);
  if (dur < 0) { toast("Dit bestand kan niet afgespeeld worden. Probeer een mp3."); return; }
  const st = $("musicStatus"); if (st) st.innerHTML = `<span class="spin" style="display:inline-block;width:14px;height:14px;vertical-align:middle"></span> Uploaden naar je groep…`;
  try {
    const s = await uploadSound(view.id, file, "music", file.name.replace(/\.[^.]+$/, "") || "Nummer", dur);
    if (!draft) return;
    Object.assign(draft, { music: "sound", soundId: s.id, musicPath: s.path, musicName: s.name, musicOffset: 0, musicSync: false });
    toast("Toegevoegd aan de geluiden van je groep."); drawTimeline(); drawTools(); drawPanel(); previewMusic();
  } catch (e) { toast(errMsg(e)); drawPanel(); }
}
// Een kort geluidseffect importeren of opnemen
async function importEffect(file, name) {
  if (!audioOk(file)) { toast("Kies een geluidsbestand, zoals een mp3."); return; }
  if (file.size > 3 * 1048576) { toast("Dit geluid is te groot. Een effect mag maximaal 3 MB zijn."); return; }
  const url = URL.createObjectURL(file), dur = await probeDuration(url); URL.revokeObjectURL(url);
  if (dur < 0) { toast("Dit bestand kan niet afgespeeld worden. Probeer een mp3."); return; }
  if (dur > MAX_FX + 1) { toast(`Dit geluid duurt ${Math.round(dur)} seconden. Een effect mag maximaal ${MAX_FX} seconden duren.`); return; }
  const st = $("fxStatus"); if (st) st.textContent = "Uploaden naar je groep…";
  try {
    const s = await uploadSound(view.id, file, "effect", name.slice(0, 30) || "Mijn geluid", dur > 0 ? dur : null);
    toast(`"${s.name}" staat nu bij de geluidjes van je groep.`); playOnce(signed[s.path]);
    const n = $("fxName"); if (n) n.value = "";
    drawPanel();
  } catch (e) { toast(errMsg(e)); drawPanel(); }
}
async function toggleFxRec() {
  if (fxRec) { fxRec.stop(); return; }
  try { fxRec = await recordAudio(); } catch (e) { fxRec = null; toast("Geen toegang tot je microfoon. Sta het toe in je browser."); return; }
  const r = fxRec; drawPanel();
  const iv = setInterval(() => { const s = (Date.now() - r.t0) / 1000, st = $("fxStatus"); if (st) st.textContent = `🔴 Opnemen… ${s.toFixed(1)} / ${MAX_FX} s`; if (s >= MAX_FX) r.stop(); }, 100);
  const file = await r.done; clearInterval(iv); fxRec = null;
  if (!draft) return;
  await importEffect(file, ($("fxName")?.value.trim()) || "Mijn geluid");
}
// Je stem inspreken terwijl de video (zonder geluid) afspeelt
async function toggleVoiceRec() {
  if (voiceRec) { voiceRec.stop(); return; }
  const pv = $("pv"); stopEdit();
  try { voiceRec = await recordAudio(); } catch (e) { voiceRec = null; toast("Geen toegang tot je microfoon. Sta het toe in je browser."); return; }
  const r = voiceRec; drawPanel(); setPlayIcon(true);
  playEdit(pv, { ...draftCfg(), origVol: 0, music: null, voiceUrl: null, sfx: [] }, $("stage"), t => drawHead(t), () => r.stop(), () => r.stop());
  const file = await r.done; const secs = (Date.now() - r.t0) / 1000;
  voiceRec = null; stopEdit(); setPlayIcon(false);
  if (!draft) return;
  pv.currentTime = draft.start;
  if (draft.voice) URL.revokeObjectURL(draft.voice.url);
  draft.voice = { file, url: URL.createObjectURL(file), dur: secs };
  toast("Stem opgenomen. Druk op afspelen om alles samen te horen."); drawTools(); drawPanel();
}
function stopVoiceRec() { if (voiceRec) voiceRec.stop(); if (fxRec) fxRec.stop(); }
function musicExt(f) {
  const m = /\.([a-z0-9]+)$/i.exec(f.name || ""); if (m) return m[1].toLowerCase();
  return (f.type || "").includes("mp4") ? "m4a" : (f.type || "").includes("wav") ? "wav" : (f.type || "").includes("webm") ? "webm" : "mp3";
}
function musicType(f) {
  if (f.type && f.type.startsWith("audio/")) return f.type.split(";")[0];
  return { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac", webm: "audio/webm" }[musicExt(f)] || "audio/mpeg";
}

/* ---------- playback in the feed ---------- */
function playVlog(id) {
  const v = VL.get(id), el = $("vid-" + id); if (!v || !el) return;
  const e = { start: 0, end: 1e9, speed: 1, origVol: 1, sfxVol: .9, musicVol: .5, sfx: [], ...(v.edit || {}) };
  if (e.music === "custom" || e.music === "sound") e.musicUrl = e.musicPath ? signed[e.musicPath] : null;
  if (e.voicePath) e.voiceUrl = signed[e.voicePath];
  e.sfx = (e.sfx || []).map(s => s.path ? { ...s, url: signed[s.path] } : s).filter(s => s.url || SFX[s.type]);
  const btn = document.querySelector(`[data-act="play"][data-id="${CSS.escape(id)}"]`); if (btn) btn.hidden = true;
  const p = $("prog-" + id);
  playEdit(el, e, $("stage-" + id),
    t => { if (p) p.style.width = Math.min(100, (t - e.start) / ((e.end > 1e8 ? el.duration : e.end) - e.start) * 100) + "%"; },
    () => markWatched(v),
    () => { if (btn) btn.hidden = false; toast("Afspelen lukte niet. Tik nog eens."); });
}
async function markWatched(v) {
  if (v.author !== me.id && !v.views.some(x => x.user_id === me.id)) {
    const { error } = await sb.from("views").upsert({ vlog_id: v.id, user_id: me.id }, { onConflict: "vlog_id,user_id", ignoreDuplicates: true });
    if (error) toast(errMsg(error)); else v.views.push({ user_id: me.id });
  }
  refreshCard(v.id);
}

/* ================= events ================= */
document.addEventListener("click", async ev => {
  const t = ev.target.closest("[data-act]"); if (!t) return;
  const id = t.dataset.id, A = t.dataset.act;
  try {
    if (A === "stage") { view = { name: t.dataset.to }; render(); }
    else if (A === "nav") { if (t.dataset.to === "newgroup") picked = new Set(); await go(t.dataset.to); }
    else if (A === "open") await go("group", { id, tab: t.dataset.tab });
    else if (A === "gtab") { stopEdit(); gtab = t.dataset.to; draft = null; render(); }
    else if (A === "hfilter") { homeFilter = id; render(true); }
    else if (A === "camera") { ac(); openRecorder(); }
    else if (A === "acceptReq") {
      const { error } = await sb.from("friendships").update({ status: "accepted" }).eq("requester", id).eq("addressee", me.id);
      if (error) throw error;
      fr.incoming = fr.incoming.filter(x => x !== id); fr.friends.push(id); toast(`${nameOf(id)} is nu je vriend.`); render(true);
    }
    else if (A === "declineReq") {
      const { error } = await sb.from("friendships").delete().eq("requester", id).eq("addressee", me.id);
      if (error) throw error;
      fr.incoming = fr.incoming.filter(x => x !== id); render(true);
    }
    else if (A === "addFriend") {
      const { error } = await sb.from("friendships").insert({ requester: me.id, addressee: id });
      if (error && !/duplicate key/.test(error.message)) throw error;
      fr.sent.push(id); toast(`Verzoek verstuurd naar ${nameOf(id)}.`);
      if ($("searchRes")) $("searchRes").innerHTML = searchHTML(); else render(true);
    }
    else if (A === "pick") { picked.has(id) ? picked.delete(id) : picked.add(id); const s = $("gName").value; render(true); $("gName").value = s; }
    else if (A === "addToGroup") {
      const { error } = await sb.rpc("add_member", { p_group: view.id, p_user: id });
      if (error) throw error;
      toast(`${nameOf(id)} zit nu in de groep.`); await refresh();
    }
    else if (A === "leave") {
      if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Tik nog eens om de groep te verlaten"; return; }
      const { error } = await sb.from("group_members").delete().eq("group_id", id).eq("user_id", me.id);
      if (error) throw error;
      toast("Je hebt de groep verlaten."); await go("home");
    }
    else if (A === "play") { ac(); playVlog(id); }
    else if (A === "like") {
      const v = VL.get(id), liked = v.likes.some(l => l.user_id === me.id);
      if (liked) { const { error } = await sb.from("likes").delete().eq("vlog_id", id).eq("user_id", me.id); if (error) throw error; v.likes = v.likes.filter(l => l.user_id !== me.id); }
      else { const { error } = await sb.from("likes").insert({ vlog_id: id, user_id: me.id }); if (error) throw error; v.likes.push({ user_id: me.id }); }
      refreshCard(id);
    }
    else if (A === "rate") {
      const v = VL.get(id), n = +t.dataset.n;
      const { error } = await sb.from("ratings").upsert({ vlog_id: id, user_id: me.id, score: n }, { onConflict: "vlog_id,user_id" });
      if (error) throw error;
      v.ratings = v.ratings.filter(r => r.user_id !== me.id).concat({ user_id: me.id, score: n });
      refreshCard(id); toast(`Je gaf ${nameOf(v.author)} een ${n}.`);
    }
    else if (A === "copy") {
      try { await navigator.clipboard.writeText(id); toast("Code gekopieerd"); } catch (e) { toast("Kopiëren lukte niet. Selecteer de code zelf."); }
    }
    else if (A === "share") {
      const link = `${location.origin}${location.pathname}?join=${encodeURIComponent(id)}`;
      const text = `Doe mee met mijn groep op Vlogit! ${link}`;
      if (navigator.share) { try { await navigator.share({ title: "Vlogit", text, url: link }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(text); toast("Uitnodigingslink gekopieerd"); } catch (e) { toast(link); } }
    }
    else if (A === "joker") {
      if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Zeker? Tik nog eens om je joker in te zetten"; return; }
      const { error } = await sb.rpc("use_joker", { p_group: id });
      if (error) throw error;
      jokers.push({ group_id: id, user_id: me.id, day: todayStr() }); toast("Joker ingezet. Vandaag telt niet mee."); render(true);
    }
    else if (A === "emoji") {
      const v = VL.get(id), em = t.dataset.e, has = (v.reactions || []).some(r => r.user_id === me.id && r.emoji === em);
      if (has) { const { error } = await sb.from("reactions").delete().eq("vlog_id", id).eq("user_id", me.id).eq("emoji", em); if (error) throw error; v.reactions = v.reactions.filter(r => !(r.user_id === me.id && r.emoji === em)); }
      else { const { error } = await sb.from("reactions").insert({ vlog_id: id, user_id: me.id, emoji: em }); if (error) throw error; (v.reactions = v.reactions || []).push({ user_id: me.id, emoji: em }); }
      refreshCard(id);
    }
    else if (A === "pushOn") await enablePush();
    else if (A === "pushOff") await disablePush();
    else if (A === "pushDismiss") { localStorageSet("vlogit-push-dismissed", "1"); render(true); }
    else if (A === "deleteAsk") { confirmDelete = true; render(true); }
    else if (A === "deleteCancel") { confirmDelete = false; render(true); }
    else if (A === "deleteAccount") await deleteAccount();
    else if (A === "logout") { stopEdit(); await sb.auth.signOut(); me = null; session = null; loaded = {}; VL.clear(); view = { name: "welcome" }; render(); }
  } catch (e) { toast(errMsg(e)); }
});
document.addEventListener("submit", async ev => {
  ev.preventDefault(); const f = ev.target;
  try {
    if (f.id === "regForm") await doRegister();
    else if (f.id === "loginForm") await doLogin();
    else if (f.id === "groupForm") {
      const name = val("gName"); if (!name) return fail("Geef je groep een naam.", "gName");
      busyBtn("groupBtn", true);
      const { data: gid, error } = await sb.rpc("create_group", { p_name: name });
      if (error) { busyBtn("groupBtn", false, "Groep maken"); throw error; }
      for (const u of picked) { const r = await sb.rpc("add_member", { p_group: gid, p_user: u }); if (r.error) toast(errMsg(r.error)); }
      picked = new Set(); toast(`${name} is gemaakt.`); await go("group", { id: gid });
    }
    else if (f.id === "joinForm") {
      const code = val("jCode").toUpperCase(); if (code.length < 4) return fail("Vul de code van de groep in.", "jCode");
      busyBtn("joinBtn", true);
      const { data: gid, error } = await sb.rpc("join_group", { p_code: code });
      if (error) { busyBtn("joinBtn", false, "Joinen"); return fail(/bestaat niet/.test(error.message) ? "Deze code bestaat niet. Vraag de code opnieuw aan je vriend." : errMsg(error), "jCode"); }
      toast("Je zit nu in de groep."); await go("group", { id: gid });
    }
    else if (f.id === "nameForm") {
      const name = val("pName"); if (!name) return fail("Vul een naam in.", "pName");
      busyBtn("nameBtn", true);
      const { error } = await sb.from("profiles").update({ name }).eq("id", me.id);
      busyBtn("nameBtn", false, "Naam opslaan");
      if (error) throw error;
      me.name = name; P[me.id] = me; toast("Naam opgeslagen."); render(true);
    }
    else if (f.dataset.comment) {
      const id = f.dataset.comment, inp = $("c-" + id), body = inp.value.trim(); if (!body) return;
      const { data, error } = await sb.from("comments").insert({ vlog_id: id, user_id: me.id, body }).select("id,user_id,body,created_at").single();
      if (error) throw error;
      VL.get(id).comments.push(data); refreshCard(id);
    }
  } catch (e) { toast(errMsg(e)); }
});
document.addEventListener("change", ev => {
  if (ev.target.id === "avatarFile" && ev.target.files[0]) uploadAvatar(ev.target.files[0]).catch(e => toast(errMsg(e)));
});
document.addEventListener("input", ev => {
  if (ev.target.id === "search") { search.q = ev.target.value; clearTimeout(search.d); search.d = setTimeout(runSearch, 250); }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && me && !draft && !rec && !publishing) refresh(); });

/* ================= start ================= */
(async function boot() {
  const qp = new URLSearchParams(location.search);
  if (qp.get("join")) { sessionStorage.setItem("vlogit-join", qp.get("join").toUpperCase()); history.replaceState(null, "", location.pathname); }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  render();
  musicReady.then(() => { if (draft && tool === "music") drawPanel(); });
  try {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (session) await afterLogin();
    else if (sessionStorage.getItem("vlogit-join")) { view = { name: "register" }; render(); toast("Maak een account of log in om de groep te joinen."); }
  } catch (e) { toast(errMsg(e)); }
  sb.auth.onAuthStateChange((event, s) => {
    session = s;
    if (event === "SIGNED_OUT" && me) { me = null; view = { name: "welcome" }; render(); }
  });
})();
