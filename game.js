// Meeting Quota v0.2 — single-player, static, no build step.
// Needs workers.js loaded first (defines WORKERS).
// All tuning is in C. Game state is S (saved to localStorage).

const C = {
  DAY_LEN: 45,
  START_SUPPLY: 100000,
  SUPPLY_DRAIN: 120,
  DRAIN_GROWTH: 1.08,
  DELIVERY: 10000,
  DELIVERY_DECAY: 0.93,
  SUPPLY_PER_LOAF: 0.5,
  QUOTA_START: 12000,
  QUOTA_GROWTH: 1.12,
  HP_MAX: 9,
  STARVE_MULT: 2,
  START_FAVORS: 2,
  FAVOR_PER_MET: 1,
  FAVOR_DEBT_MAX: -3,
  DEBT_INTEREST: 4,
  HEAL_HALF: 1,
  HEAL_FULL_MIN: 2,
  HEAL_FULL_MAX: 3,
  START_STANDING: 50,
  STANDING_MAX: 100,
  MISS_STANDING: 15,
  CARE_PENALTY: 3,
  DISCIPLINE_STANDING: 4,
  DISCIPLINE_FAVOR: 1,
  BRIBE_FAVOR: 1,
  BRIBE_STANDING_ALT: 12,
  BRIBE_QUOTA_PCT: 0.4,
  BRIBE_SUPPLY: 6000,
  BRIBE_EXPOSURE: 0.1,
  INFORMANT_EXPOSURE: 0.05,
  EXPOSURE_CAP: 0.9,
  EXPOSURE_DECAY: 0.03,
  INSPECT_BASE: 0.12,
  INSPECT_PER_STAR: 0.04,
  INSPECT_CAP: 0.5,
  CAUGHT_STANDING: 30,
  CLEAN_STANDING: 3,
  LOG_MAX: 60,
  SAVE_KEY: "mq_save_v2"
};

const MODES = {
  ease: { label: "EASE", rate: 30, drain: 0.006 },
  hold: { label: "HOLD", rate: 45, drain: 0.018 },
  push: { label: "PUSH", rate: 70, drain: 0.045 }
};

const $ = id => document.getElementById(id);
let S = null;
let logDirty = true;

function newState() {
  return {
    v: 2, day: 1, t: C.DAY_LEN, mode: "hold",
    made: 0, target: C.QUOTA_START, supply: C.START_SUPPLY,
    favors: C.START_FAVORS, standing: C.START_STANDING,
    stars: 0, exposure: 0, healSpent: 0, inspected: false, starveWarned: false,
    w: WORKERS.map(() => ({ hp: C.HP_MAX, dead: false, diedDay: 0, warned: false })),
    graves: [], log: [], over: "", paused: false
  };
}

function save() {
  try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(C.SAVE_KEY));
    if (s && s.v === 2 && Array.isArray(s.w) && s.w.length === WORKERS.length) return s;
  } catch (e) {}
  return null;
}

function log(msg, kind) {
  S.log.unshift({ d: S.day, m: msg, k: kind || "" });
  if (S.log.length > C.LOG_MAX) S.log.length = C.LOG_MAX;
  logDirty = true;
}

const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmtF = x => (x % 1 ? x.toFixed(1) : String(x));
const alive = () => S.w.filter(w => !w.dead).length;

function setMode(m) {
  if (S.over || !MODES[m] || S.mode === m) return;
  S.mode = m;
  log("Shift set to " + MODES[m].label + ".", m === "push" ? "warn" : "");
  render(); save();
}

function heal(i, cost) {
  const w = S.w[i];
  if (S.over || !w || w.dead) return;
  if (w.hp >= C.HP_MAX) return;
  if (S.favors - cost < C.FAVOR_DEBT_MAX) { log("No one will lend you another favor.", "warn"); render(); return; }
  S.favors -= cost;
  S.healSpent += cost;
  const add = cost < 1 ? C.HEAL_HALF : rint(C.HEAL_FULL_MIN, C.HEAL_FULL_MAX);
  w.hp = Math.min(C.HP_MAX, w.hp + add);
  log(WORKERS[i].name + " +" + add + " bar (" + fmtF(cost) + " favor). The state noticed.", "");
  render(); save();
}

function bribe() {
  if (S.over) return;
  let cost;
  if (S.favors - C.BRIBE_FAVOR >= C.FAVOR_DEBT_MAX) {
    S.favors -= C.BRIBE_FAVOR;
    cost = "-" + C.BRIBE_FAVOR + " favor";
  } else {
    S.standing -= C.BRIBE_STANDING_ALT;
    cost = "-" + C.BRIBE_STANDING_ALT + " standing";
  }
  const add = Math.round(S.target * C.BRIBE_QUOTA_PCT);
  S.made += add;
  S.supply += C.BRIBE_SUPPLY;
  S.stars++;
  const inf = WORKERS.findIndex((wk, i) => wk.informant && !S.w[i].dead);
  S.exposure = Math.min(C.EXPOSURE_CAP, S.exposure + C.BRIBE_EXPOSURE + (inf >= 0 ? C.INFORMANT_EXPOSURE : 0));
  log("BRIBE: +" + add + " loaves on paper, +" + C.BRIBE_SUPPLY + " flour from District 7. " + cost + ". ★ recorded.", "warn");
  if (inf >= 0) log(WORKERS[inf].name + " saw the truck.", "warn");
  checkOver(); render(); save();
}

function inspect(voluntary) {
  if (S.over) return;
  if (voluntary) {
    if (S.inspected) { log("The inspector already came today.", ""); render(); return; }
    S.inspected = true;
    log("You invited the inspector. Brave or stupid.", "warn");
  } else {
    log("SURPRISE INSPECTION.", "warn");
  }
  if (S.exposure > 0 && Math.random() < S.exposure) {
    const lost = S.made;
    S.made = 0;
    S.standing -= C.CAUGHT_STANDING;
    S.favors = Math.min(S.favors, 0) - 1;
    S.exposure = 0;
    log("CAUGHT. Ledger found. -" + C.CAUGHT_STANDING + " standing, favors seized, " + lost + " loaves confiscated.", "bad");
  } else if (S.exposure > 0) {
    S.exposure = S.exposure / 2;
    log("Inspector signed off. Nothing found. This time.", "");
  } else {
    if (voluntary) S.standing = Math.min(C.STANDING_MAX, S.standing + C.CLEAN_STANDING);
    log("Inspection clean." + (voluntary ? " Loyalty noted: +" + C.CLEAN_STANDING + " standing." : ""), "good");
  }
  checkOver(); render(); save();
}

function reassign(i) {
  const w = S.w[i];
  w.dead = true; w.hp = 0; w.diedDay = S.day;
  S.graves.push({ i: i, d: S.day });
  log(WORKERS[i].name + " reassigned. Quota unchanged.", "bad");
}

function updateTicker() {
  const messages = [
    "Frost expected in northern districts. Delivery delayed. No quota adjustment.",
    "District 7 reports 12% short on flour. State does not renegotiate.",
    (S.graves.length + Math.floor(Math.random() * 8 + 5)) + " reassignments District " + rint(2, 9) + ", zero deaths statewide.",
    "Iron discipline is loyalty. Sentiment is sabotage.",
    "Harvest outlook stable. Supplies remain allocated by plan.",
    "Extra grain diverted to capital. Your delivery reduced."
  ];
  const el = $("ticker-text");
  if (el) el.textContent = messages[S.day % messages.length];
}

function checkOver() {
  if (S.over) return;
  if (S.standing <= 0) S.over = "POSITION REVOKED";
  else if (alive() === 0) S.over = "FACTORY CLOSED";
  if (S.over) { log(S.over + ".", "bad"); S.paused = true; }
}

function tick() {
  if (S.over || S.paused) return;
  const m = MODES[S.mode];
  S.supply = Math.max(0, S.supply - Math.round(C.SUPPLY_DRAIN * Math.pow(C.DRAIN_GROWTH, S.day - 1)));
  const starving = S.supply <= 0;
  if (starving && !S.starveWarned) { S.starveWarned = true; log("SUPPLY EMPTY. Ovens cold. Workers starving.", "bad"); }
  if (!starving) S.starveWarned = false;

  let out = 0;
  S.w.forEach((w, i) => {
    if (w.dead) return;
    w.hp -= m.drain * (WORKERS[i].drain || 1) * (starving ? C.STARVE_MULT : 1);
    if (w.hp <= 0) { reassign(i); return; }
    out += m.rate * (w.hp > 6 ? 1 : w.hp > 3 ? 0.85 : 0.6);
    if (w.hp < 3 && !w.warned) { w.warned = true; log(WORKERS[i].name + " is in the red.", "bad"); }
    if (w.hp >= 3) w.warned = false;
  });
  const flour = Math.min(S.supply, Math.round(out * C.SUPPLY_PER_LOAF));
  S.supply -= flour;
  S.made += Math.round(flour / C.SUPPLY_PER_LOAF);

  checkOver();
  if (!S.over) {
    S.t--;
    if (S.t <= 0) endDay();
  }
  render(); save();
}

function endDay() {
  const chance = Math.min(C.INSPECT_CAP, C.INSPECT_BASE + C.INSPECT_PER_STAR * S.stars);
  if (Math.random() < chance) inspect(false);
  if (S.over) return;

  if (S.made >= S.target) {
    S.favors += C.FAVOR_PER_MET;
    log("QUOTA MET " + S.made + "/" + S.target + ". +" + C.FAVOR_PER_MET + " favor. The line is still short.", "good");
    if (S.healSpent === 0) {
      S.favors += C.DISCIPLINE_FAVOR;
      S.standing += C.DISCIPLINE_STANDING;
      log("Iron discipline commended: +" + C.DISCIPLINE_FAVOR + " favor, +" + C.DISCIPLINE_STANDING + " standing.", "good");
    }
  } else if (S.favors >= 1) {
    S.favors -= 1;
    log("QUOTA MISSED " + S.made + "/" + S.target + ". Incentives withdrawn: -1 favor. The state does not ask why.", "bad");
  } else {
    S.standing -= C.MISS_STANDING;
    log("QUOTA MISSED " + S.made + "/" + S.target + ". Nothing left to withdraw: -" + C.MISS_STANDING + " standing.", "bad");
  }
  if (S.healSpent > 0) {
    const p = Math.round(S.healSpent * C.CARE_PENALTY);
    S.standing -= p;
    log("Favors diverted to sentiment (" + fmtF(S.healSpent) + "). -" + p + " standing.", "bad");
  }
  if (S.favors < 0) {
    const p = Math.round(-S.favors * C.DEBT_INTEREST);
    S.standing -= p;
    log("You owe " + fmtF(-S.favors) + " favor(s). Interest: -" + p + " standing.", "warn");
  }
  S.standing = Math.min(C.STANDING_MAX, S.standing);
  S.exposure = Math.max(0, S.exposure - C.EXPOSURE_DECAY);
  checkOver();
  if (S.over) return;

  S.day++;
  S.t = C.DAY_LEN;
  S.made = 0; S.healSpent = 0; S.inspected = false;
  S.target = Math.round(C.QUOTA_START * Math.pow(C.QUOTA_GROWTH, S.day - 1));
  const del = Math.round(C.DELIVERY * Math.pow(C.DELIVERY_DECAY, S.day - 2));
  S.supply += del;
  updateTicker();
  log("DAY " + S.day + ". Quota: " + S.target + ". Delivery: " + del + " flour. Not negotiable.", "");
}

function buildWorkers() {
  const box = $("workers");
  box.innerHTML = "";
  WORKERS.forEach((wk, i) => {
    let segs = "";
    for (let s = 0; s < C.HP_MAX; s++) segs += '<i class="seg ' + (s < 3 ? "r" : s < 6 ? "y" : "g") + '"></i>';
    const d = document.createElement("div");
    d.className = "worker";
    d.id = "w" + i;
    d.innerHTML =
      '<div class="wn">' + wk.name + "</div>" +
      '<div class="wd">' + wk.detail + "</div>" +
      '<div class="hp">' + segs + "</div>" +
      '<div class="wb"><button data-i="' + i + '" data-c="0.5">½F +1</button>' +
      '<button data-i="' + i + '" data-c="1">1F +2-3</button></div>';
    box.appendChild(d);
  });
}

function setBar(el, frac, cls) {
  el.style.width = Math.max(0, Math.min(1, frac)) * 100 + "%";
  el.className = cls || "";
}

function render() {
  const sec = Math.max(0, S.t);
  $("clock").textContent = "DAY " + S.day + " · " + Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") + (S.paused && !S.over ? " II" : "");
  $("stars").textContent = S.stars > 8 ? "★x" + S.stars : "★".repeat(S.stars);
  $("standing").textContent = S.standing;
  $("standing").className = S.standing < 20 ? "bad" : S.standing < 35 ? "warn" : "";
  $("favors").textContent = fmtF(S.favors);
  $("favors").className = S.favors < 0 ? "bad" : S.favors < 1 ? "warn" : "";

  const pace = (C.DAY_LEN - S.t) / C.DAY_LEN;
  const q = S.made / S.target;
  $("quota-txt").textContent = S.made + " / " + S.target;
  setBar($("quota-fill"), q, q >= 1 ? "" : q < pace * 0.75 ? "bad" : q < pace ? "warn" : "");
  const sp = S.supply / C.START_SUPPLY;
  $("supply-txt").textContent = S.supply;
  setBar($("supply-fill"), sp, sp < 0.15 ? "bad" : sp < 0.35 ? "warn" : "");

  $("exposure").textContent = Math.round(S.exposure * 100) + "%";
  $("exposure").className = S.exposure >= 0.3 ? "bad" : S.exposure > 0 ? "warn" : "";
  $("reassigned").textContent = S.graves.length;
  $("reassigned").className = S.graves.length ? "bad" : "";

  document.querySelectorAll("#modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === S.mode));
  $("inspect-btn").disabled = S.inspected || !!S.over;
  $("bribe-btn").disabled = !!S.over;
  $("pause-btn").textContent = S.paused ? "RESUME" : "PAUSE";
  $("pause-btn").disabled = !!S.over;

  S.w.forEach((w, i) => {
    const card = $("w" + i);
    const n = Math.ceil(w.hp);
    card.querySelectorAll(".seg").forEach((seg, s) => seg.classList.toggle("on", s < n));
    card.classList.toggle("dead", w.dead);
    card.classList.toggle("red", !w.dead && w.hp < 3);
    card.querySelector(".wd").textContent = w.dead ? "status: closed" : WORKERS[i].detail;
    card.querySelectorAll("button").forEach(b => { b.disabled = w.dead || !!S.over || w.hp >= C.HP_MAX; });
  });

  if (logDirty) {
    $("log").innerHTML = "";
    S.log.forEach(e => {
      const p = document.createElement("div");
      p.textContent = "D" + e.d + " " + e.m;
      if (e.k) p.className = e.k;
      $("log").appendChild(p);
    });
    logDirty = false;
  }

  if (S.over) {
    $("go-title").textContent = S.over;
    $("go-text").textContent =
      (S.over === "FACTORY CLOSED" ? "No workers left. The quota is unchanged." : "You have been reassigned.") +
      "\nDays served: " + S.day + "\nWorkers reassigned: " + S.graves.length + "\nStars: " + S.stars;
    $("gameover").hidden = false;
  } else {
    $("gameover").hidden = true;
  }
}

function openCemetery() {
  const box = $("stones");
  box.innerHTML = "";
  if (!S.graves.length) box.textContent = "empty. for now.";
  S.graves.forEach((g) => {
    const b = document.createElement("button");
    b.className = "stone";
    b.setAttribute("aria-label", WORKERS[g.i].name);
    b.onclick = () => {
      box.querySelectorAll(".stone").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      $("epitaph").textContent = WORKERS[g.i].name + " · day " + g.d + "\n" + WORKERS[g.i].detail;
    };
    box.appendChild(b);
  });
  $("epitaph").textContent = S.graves.length ? "tap a stone" : "";
  $("cemetery").hidden = false;
}

function resetGame() {
  try { localStorage.removeItem(C.SAVE_KEY); } catch (e) {}
  S = newState();
  log("DAY 1. Quota: " + S.target + ". The state has spoken.", "");
  logDirty = true;
  updateTicker();
  render(); save();
}

function init() {
  buildWorkers();
  S = load();
  if (!S) { S = newState(); log("DAY 1. Quota: " + S.target + ". The state has spoken.", ""); }
  else if (!S.over) { S.paused = true; log("Save loaded. Paused.", ""); }

  $("workers").onclick = e => {
    const b = e.target.closest("button");
    if (b) heal(+b.dataset.i, +b.dataset.c);
  };
  $("modes").onclick = e => {
    const b = e.target.closest("button");
    if (b) setMode(b.dataset.mode);
  };
  $("bribe-btn").onclick = bribe;
  $("inspect-btn").onclick = () => inspect(true);
  $("pause-btn").onclick = () => { if (S.over) return; S.paused = !S.paused; render(); save(); };
  $("reset-btn").onclick = () => { if (confirm("Wipe save and start over?")) resetGame(); };
  $("go-restart").onclick = resetGame;
  $("reassigned-btn").onclick = openCemetery;
  $("cem-close").onclick = () => { $("cemetery").hidden = true; };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S && !S.over && !S.paused) { S.paused = true; log("Paused.", ""); render(); save(); }
  });

  updateTicker();
  render(); save();
  setInterval(tick, 1000);
}

init();
