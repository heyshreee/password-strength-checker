const passwordInput = document.getElementById("password");
const meterBar = document.getElementById("meterBar");
const meterLabel = document.getElementById("meterLabel");
const criteriaList = document.getElementById("criteria");
const entropyEl = document.getElementById("entropy");
const crackTimeEl = document.getElementById("crackTime");
const checkBreaches = document.getElementById("checkBreaches");
const breachWarning = document.getElementById("breachWarning");
const enableViz = document.getElementById("enableViz");
const dnaCanvas = document.getElementById("dnaCanvas");
let dnaCtx = dnaCanvas ? dnaCanvas.getContext("2d") : null;

const togglePassword = document.getElementById("togglePassword");
if (togglePassword) {
  togglePassword.addEventListener("click", function () {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePassword.textContent = type === "password" ? "🙈" : "👁️";
  });
}

const copyPassword = document.getElementById("copyPassword");
if (copyPassword) {
  copyPassword.addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText(passwordInput.value || "");
      const prev = copyPassword.textContent;
      copyPassword.textContent = "✅";
      setTimeout(() => (copyPassword.textContent = prev), 900);
    } catch {}
  });
}

function updateCriteria(pw) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  if (criteriaList) {
    Array.from(criteriaList.querySelectorAll("li")).forEach((li) => {
      const key = li.getAttribute("data-criterion");
      if (key && checks[key]) li.classList.add("pass");
      else li.classList.remove("pass");
    });
  }
  return checks;
}

function computeEntropyBits(pw) {
  if (!pw) return 0;
  let charset = 0;
  if (/[a-z]/.test(pw)) charset += 26;
  if (/[A-Z]/.test(pw)) charset += 26;
  if (/[0-9]/.test(pw)) charset += 10;
  if (/[^A-Za-z0-9]/.test(pw)) charset += 33;
  if (charset < 2) return 0;
  return pw.length * Math.log2(charset);
}

function estimateCrackTime(bits) {
  const guessesPerSec = 1e9;
  const secondsBits = bits - 1 - Math.log2(guessesPerSec);
  if (!isFinite(secondsBits)) return "—";
  if (secondsBits > 60) return "centuries+";
  const seconds = Math.max(0, Math.pow(2, secondsBits));
  if (!isFinite(seconds) || seconds > 1e12) return "thousands of years";
  const units = [
    [31557600, "year"],
    [86400, "day"],
    [3600, "hour"],
    [60, "min"],
    [1, "sec"],
  ];
  let s = seconds;
  const out = [];
  for (const [u, name] of units) {
    if (s >= u) {
      const v = Math.floor(s / u);
      out.push(`${v} ${name}${v > 1 ? "s" : ""}`);
      s -= v * u;
    }
    if (out.length === 2) break;
  }
  return out.length ? out.join(" ") : "instant";
}

function updateStrengthUI(pw) {
  const checks = updateCriteria(pw);
  const score = Object.values(checks).filter(Boolean).length;
  const percent = Math.min(100, Math.max(0, (score / 5) * 100));
  if (meterBar) meterBar.style.width = `${percent}%`;
  let label = "Enter a password";
  if (pw.length > 0) {
    if (score <= 2) label = "Weak";
    else if (score <= 4) label = "Medium";
    else label = "Strong";
  }
  if (meterLabel) meterLabel.textContent = label;
  const bits = computeEntropyBits(pw);
  if (entropyEl) entropyEl.textContent = `${bits.toFixed(1)} bits`;
  if (crackTimeEl) crackTimeEl.textContent = estimateCrackTime(bits);
}

if (passwordInput) {
  passwordInput.addEventListener("input", function () {
    updateStrengthUI(passwordInput.value);
    triggerBreachCheck(passwordInput.value);
    scheduleViz(passwordInput.value);
  });
  updateStrengthUI(passwordInput.value);
}

const lengthRange = document.getElementById("length");
const lengthVal = document.getElementById("lengthVal");
if (lengthRange && lengthVal) {
  const syncLen = () => (lengthVal.textContent = String(lengthRange.value));
  lengthRange.addEventListener("input", syncLen);
  syncLen();
}

function randomInt(max) {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] % max;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePassword(opts) {
  const pools = [];
  if (opts.upper) pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (opts.lower) pools.push("abcdefghijklmnopqrstuvwxyz");
  if (opts.numbers) pools.push("0123456789");
  if (opts.symbols) pools.push("!@#$%^&*()_+[]{}|;:,.<>?~-=\/`");
  if (!pools.length) return "";
  const all = pools.join("");
  const req = pools.map((p) => p[randomInt(p.length)]);
  const out = [...req];
  for (let i = out.length; i < opts.length; i++) {
    out.push(all[randomInt(all.length)]);
  }
  return shuffle(out).join("");
}

const useUpper = document.getElementById("useUpper");
const useLower = document.getElementById("useLower");
const useNumbers = document.getElementById("useNumbers");
const useSymbols = document.getElementById("useSymbols");
const generateBtn = document.getElementById("generate");

if (generateBtn) {
  generateBtn.addEventListener("click", function () {
    const len = lengthRange ? parseInt(lengthRange.value, 10) : 12;
    const pw = generatePassword({
      length: isNaN(len) ? 12 : len,
      upper: useUpper ? useUpper.checked : true,
      lower: useLower ? useLower.checked : true,
      numbers: useNumbers ? useNumbers.checked : true,
      symbols: useSymbols ? useSymbols.checked : true,
    });
    if (passwordInput) {
      passwordInput.value = pw;
      updateStrengthUI(pw);
      triggerBreachCheck(pw);
      scheduleViz(pw);
    }
  });
}

// Breach checking (HaveIBeenPwned k-anonymity)
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function sha1HexUpper(message) {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hash = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (let b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex.toUpperCase();
}

async function checkHIBP(pw) {
  if (!pw) return false;
  try {
    const sha1 = await sha1HexUpper(pw);
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const text = await res.text();
    const lines = text.split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (!hashSuffix) continue;
      if (hashSuffix.toUpperCase() === suffix) {
        const count = parseInt(countStr || "0", 10);
        return count > 0;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const debouncedBreach = debounce(async (pw) => {
  if (!checkBreaches || !breachWarning) return;
  if (!checkBreaches.checked || !pw) {
    breachWarning.hidden = true;
    return;
  }
  const found = await checkHIBP(pw);
  breachWarning.hidden = !found;
}, 500);

function triggerBreachCheck(pw) {
  debouncedBreach(pw);
}

if (checkBreaches) {
  checkBreaches.addEventListener("change", () => {
    triggerBreachCheck(passwordInput ? passwordInput.value : "");
  });
}

// ===== Password DNA Visualization =====
function resizeCanvas() {
  if (!dnaCanvas || !dnaCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  dnaCanvas.width = Math.max(1, Math.floor(w * dpr));
  dnaCanvas.height = Math.max(1, Math.floor(h * dpr));
  dnaCanvas.style.width = w + "px";
  dnaCanvas.style.height = h + "px";
  dnaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  scheduleViz(passwordInput ? passwordInput.value : "");
});

function seededRNGFromHex(hex) {
  // Use first 8 chars as 32-bit seed; if too short, pad
  const s = (parseInt((hex || "00000000").slice(0, 8), 16) >>> 0) || 0x9e3779b9;
  let x = s;
  return function () {
    // xorshift32
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 0xFFFFFFFF;
  };
}

function colorFromHash(hex, alpha = 1) {
  const h = parseInt(hex.slice(0, 6) || "0", 16) % 360;
  const s = 65 + (parseInt(hex.slice(6, 8) || "0", 16) % 25); // 65-89
  const l = 45 + (parseInt(hex.slice(8, 10) || "0", 16) % 15); // 45-59
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

function drawConstellation(ctx, rng, w, h, strengthScore) {
  ctx.clearRect(0, 0, w, h);

  // Number of nodes based on strength (weak fewer)
  const base = 20;
  const nodes = base + Math.floor(strengthScore * 8); // up to ~60
  const pts = [];
  for (let i = 0; i < nodes; i++) {
    pts.push({ x: rng() * w, y: rng() * h, r: 1 + rng() * 2 });
  }
  const hueBase = Math.floor(rng() * 360);
  // Draw edges between nearby nodes
  for (let i = 0; i < nodes; i++) {
    for (let j = i + 1; j < nodes; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const dist = Math.hypot(dx, dy);
      const maxDist = 80 + strengthScore * 40; // stronger = denser
      if (dist < maxDist) {
        const alpha = 1 - dist / maxDist;
        ctx.strokeStyle = `hsla(${hueBase + (i % 40)}, 80%, 70%, ${0.22 * alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
  }
  // Draw stars
  for (let i = 0; i < nodes; i++) {
    ctx.fillStyle = `hsla(${hueBase + (i % 60)}, 95%, ${75 + rng() * 10}%, 0.95)`;
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDNA(ctx, rng, w, h, strengthScore) {
  ctx.clearRect(0, 0, w, h);
  const turns = 2 + strengthScore; // more turns with strength
  const amp = Math.min(h * 0.35, 40 + strengthScore * 10);
  const freq = (Math.PI * 2 * turns) / w;
  const color1 = `hsla(${Math.floor(rng() * 360)}, 85%, 70%, 0.9)`;
  const color2 = `hsla(${Math.floor(rng() * 360)}, 85%, 70%, 0.9)`;
  ctx.lineWidth = 2;
  // Two helices
  for (let phase = 0; phase < 2; phase++) {
    ctx.strokeStyle = phase === 0 ? color1 : color2;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = h / 2 + Math.sin(freq * x + phase * Math.PI) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // rungs
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40 + strengthScore * 30; i++) {
    const x = (i / (40 + strengthScore * 30)) * w;
    const y1 = h / 2 + Math.sin(freq * x) * amp;
    const y2 = h / 2 + Math.sin(freq * x + Math.PI) * amp;
    ctx.strokeStyle = `hsla(${Math.floor(rng() * 360)}, 80%, 70%, 0.6)`;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }
}

function drawFingerprint(ctx, rng, w, h, strengthScore) {
  ctx.clearRect(0, 0, w, h);
  const cols = 12 + strengthScore * 4;
  const rows = 8 + strengthScore * 3;
  const cw = w / cols;
  const ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = rng();
      const hue = Math.floor(v * 360);
      const sat = 80 + (rng() * 15);
      const light = 70 + (rng() * 15);
      const alpha = 0.45 + rng() * 0.4;
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
      const r = (rng() * Math.min(cw, ch)) / 2;
      const cx = x * cw + cw / 2;
      const cy = y * ch + ch / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // overlay rings to mimic fingerprint ridges
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  for (let i = 1; i <= 6 + strengthScore; i++) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, (w / 8) * i, (h / 12) * i, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const renderVizDebounced = debounce(async (pw) => {
  if (!dnaCanvas || !dnaCtx || !enableViz) return;
  if (!enableViz.checked || !pw) {
    // Clear canvas
    resizeCanvas();
    dnaCtx.clearRect(0, 0, dnaCanvas.width, dnaCanvas.height);
    return;
  }
  resizeCanvas();
  const hash = await sha1HexUpper(pw);
  const rng = seededRNGFromHex(hash);
  const w = dnaCanvas.clientWidth;
  const h = dnaCanvas.clientHeight;
  // Derive a simple strength score 0-5 from criteria
  const checks = updateCriteria(pw);
  const score = Object.values(checks).filter(Boolean).length; // 0..5
  drawConstellation(dnaCtx, rng, w, h, score);
}, 80);

function scheduleViz(pw) {
  renderVizDebounced(pw);
}

if (enableViz) enableViz.addEventListener("change", () => scheduleViz(passwordInput ? passwordInput.value : ""));

// Initial setup
resizeCanvas();
scheduleViz(passwordInput ? passwordInput.value : "");
