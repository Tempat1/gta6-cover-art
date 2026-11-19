/* GTA VI Cover Art Maker — all vanilla JS, fully offline.
   The cover is drawn on a 1080x1350 canvas and exported as PNG.
   No network, no randomness in the export path (seeded PRNG only). */
"use strict";

var W = 1080, H = 1350;
var canvas = document.getElementById("cover");
var ctx = canvas.getContext("2d");

/* ---------- deterministic PRNG (mulberry32) ---------- */
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- state ---------- */
var state = {
  preset: "sunset",
  layout: "stacked",
  zoom: 1.30,
  pan: 0.50,          // 0 = left/top, 1 = right/bottom
  grade: 0.80,
  caption: "WELCOME BACK TO VICE CITY",
  subtitle: "LEONIDA \u2022 2026",
  showTitle: true,
  photo: null         // HTMLImageElement or offscreen canvas
};

/* ---------- presets: grade overlays + canvas filter ---------- */
var PRESETS = {
  sunset: {
    filter: "saturate(1.45) contrast(1.12) brightness(1.04)",
    overlays: [
      { type: "linear", x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, "rgba(255,122,24,0.30)"], [0.55, "rgba(255,46,136,0.22)"], [1, "rgba(90,20,140,0.34)"]], blend: "overlay" },
      { type: "linear", x0: 0, y0: 1, x1: 0, y1: 0, stops: [[0, "rgba(255,180,60,0.20)"], [1, "rgba(255,180,60,0)"]], blend: "screen" }
    ]
  },
  neon: {
    filter: "saturate(1.7) contrast(1.18) brightness(0.98)",
    overlays: [
      { type: "linear", x0: 0, y0: 0, x1: 1, y1: 1, stops: [[0, "rgba(25,227,214,0.30)"], [0.5, "rgba(255,46,136,0.24)"], [1, "rgba(123,47,247,0.32)"]], blend: "overlay" },
      { type: "radial", x0: 0.5, y0: 0.42, r: 0.55, stops: [[0, "rgba(255,46,136,0.20)"], [1, "rgba(10,4,30,0.30)"]], blend: "soft-light" }
    ]
  },
  vice: {
    filter: "saturate(1.55) contrast(1.10) brightness(1.02)",
    overlays: [
      { type: "linear", x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, "rgba(255,94,196,0.32)"], [0.5, "rgba(255,179,71,0.18)"], [1, "rgba(25,227,214,0.26)"]], blend: "overlay" },
      { type: "linear", x0: 0, y0: 0, x1: 1, y1: 0, stops: [[0, "rgba(123,47,247,0.18)"], [1, "rgba(25,227,214,0.18)"]], blend: "soft-light" }
    ]
  }
};

/* ---------- built-in sample photo: procedural Vice City sunset ---------- */
function buildSamplePhoto() {
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var g = c.getContext("2d");
  var rnd = mulberry32(20260527);

  // Sky
  var sky = g.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, "#2b0a4a");
  sky.addColorStop(0.30, "#8a1d6e");
  sky.addColorStop(0.55, "#ff2e88");
  sky.addColorStop(0.75, "#ff7a18");
  sky.addColorStop(1, "#ffb347");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H * 0.72);

  // Stars in the upper sky (seeded PRNG: same stars on every export)
  for (var st = 0; st < 110; st++) {
    var sx = rnd() * W, sy = rnd() * 360;
    var sr = 0.6 + rnd() * 1.6;
    g.fillStyle = "rgba(255,255,255," + (0.35 + rnd() * 0.55).toFixed(2) + ")";
    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  }

  // A few distant birds, dark silhouettes high in the sky
  g.strokeStyle = "rgba(30,5,38,0.85)";
  g.lineWidth = 3;
  for (var bd = 0; bd < 7; bd++) {
    var bx = 80 + rnd() * (W - 160), by = 90 + rnd() * 220, bs = 9 + rnd() * 9;
    g.beginPath();
    g.moveTo(bx - bs, by);
    g.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.7, bx, by);
    g.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.7, bx + bs, by);
    g.stroke();
  }

  // Sun with retro scanline gaps
  var sunX = W * 0.5, sunY = H * 0.44, sunR = 190;
  var sun = g.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, "#fff3b0");
  sun.addColorStop(0.55, "#ffd166");
  sun.addColorStop(1, "#ff5e62");
  g.fillStyle = sun;
  g.beginPath(); g.arc(sunX, sunY, sunR, 0, Math.PI * 2); g.fill();
  // Retro scanline gaps, clipped to the sun disc so bars never stick out.
  g.save();
  g.beginPath(); g.arc(sunX, sunY, sunR, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#ff7a18";
  for (var i = 0; i < 6; i++) {
    var y = sunY + 30 + i * 26;
    g.fillRect(sunX - sunR - 4, y, sunR * 2 + 8, 7 + i * 2);
  }
  g.restore();

  // Distant clouds
  g.fillStyle = "rgba(255,190,220,0.28)";
  for (var cl = 0; cl < 7; cl++) {
    var cx = rnd() * W, cy = 90 + rnd() * 300, cw = 120 + rnd() * 220;
    g.beginPath(); g.ellipse(cx, cy, cw, 14 + rnd() * 12, 0, 0, Math.PI * 2); g.fill();
  }

  // Skyline (two depth layers)
  function skyline(baseY, hMin, hMax, color) {
    g.fillStyle = color;
    var x = -20;
    while (x < W + 20) {
      var bw = 46 + rnd() * 90;
      var bh = hMin + rnd() * (hMax - hMin);
      g.fillRect(x, baseY - bh, bw, bh);
      // rooftop antenna on some towers
      if (rnd() > 0.7) { g.fillRect(x + bw / 2 - 2, baseY - bh - 26, 4, 26); }
      x += bw + 4 + rnd() * 18;
    }
  }
  skyline(H * 0.72, 90, 260, "#5a1a63");
  skyline(H * 0.72, 60, 190, "#2c0a3d");

  // Lit windows on the front layer
  g.fillStyle = "rgba(255,214,120,0.9)";
  for (var wnd = 0; wnd < 260; wnd++) {
    var wx = rnd() * W, wy = H * 0.72 - 30 - rnd() * 170;
    if (rnd() > 0.45) g.fillRect(wx, wy, 5, 7);
  }

  // Palm silhouettes
  function palm(px, py, s) {
    g.strokeStyle = "#1c0526"; g.fillStyle = "#1c0526";
    g.lineWidth = 9 * s;
    g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 18 * s, py - 90 * s, px + 42 * s, py - 130 * s); g.stroke();
    var tipX = px + 42 * s, tipY = py - 130 * s;
    for (var f = 0; f < 7; f++) {
      var ang = -Math.PI * 0.12 - f * 0.40;
      g.beginPath(); g.moveTo(tipX, tipY);
      g.quadraticCurveTo(
        tipX + Math.cos(ang) * 78 * s, tipY + Math.sin(ang) * 78 * s - 6 * s,
        tipX + Math.cos(ang) * 108 * s, tipY + Math.sin(ang) * 108 * s + 58 * s);
      g.lineWidth = 5 * s; g.stroke();
    }
  }
  palm(70, H * 0.72, 1.15);
  palm(W - 110, H * 0.72, 0.95);
  palm(W - 260, H * 0.72, 0.7);

  // Ocean + sun reflection
  var sea = g.createLinearGradient(0, H * 0.72, 0, H);
  sea.addColorStop(0, "#ff7a18");
  sea.addColorStop(0.25, "#c22a72");
  sea.addColorStop(1, "#16042e");
  g.fillStyle = sea;
  g.fillRect(0, H * 0.72, W, H * 0.28);
  g.fillStyle = "rgba(255,220,140,0.55)";
  for (var r = 0; r < 46; r++) {
    var rw = 60 + rnd() * 190, rx = sunX - rw / 2 + (rnd() - 0.5) * 60;
    g.fillRect(rx, H * 0.72 + 12 + r * 8, rw, 3);
  }
  // Beach strip
  g.fillStyle = "#3d1547";
  g.fillRect(0, H - 26, W, 26);
  return c;
}

/* ---------- photo drawing helpers ---------- */
// Draw `img` cover-fitting rect (x,y,w,h) with a deterministic crop shift.
function drawPhotoCover(g, img, x, y, w, h, shiftX, shiftY, zoom) {
  var iw = img.width, ih = img.height;
  var scale = Math.max(w / iw, h / ih) * zoom;
  var dw = iw * scale, dh = ih * scale;
  var dx = x + (w - dw) * shiftX;
  var dy = y + (h - dh) * shiftY;
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.drawImage(img, dx, dy, dw, dh);
  g.restore();
}

function applyGrade(g, x, y, w, h, strength) {
  var p = PRESETS[state.preset];
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.globalAlpha = strength;
  p.overlays.forEach(function (ov) {
    var grad;
    if (ov.type === "linear") {
      grad = g.createLinearGradient(x + ov.x0 * w, y + ov.y0 * h, x + ov.x1 * w, y + ov.y1 * h);
    } else {
      grad = g.createRadialGradient(
        x + ov.x0 * w, y + ov.y0 * h, 0,
        x + ov.x0 * w, y + ov.y0 * h, ov.r * Math.max(w, h));
    }
    ov.stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    g.globalCompositeOperation = ov.blend;
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
  });
  g.restore();
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

// One framed panel: photo + grade + white frame + soft shadow.
function drawPanel(g, img, x, y, w, h, shiftX, shiftY, zoom, frame) {
  if (frame > 0) {
    g.save();
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = 22;
    g.shadowOffsetY = 10;
    g.fillStyle = "#ffffff";
    g.fillRect(x - frame, y - frame, w + frame * 2, h + frame * 2);
    g.restore();
  }
  var preset = PRESETS[state.preset];
  g.save();
  g.filter = preset.filter;
  drawPhotoCover(g, img, x, y, w, h, shiftX, shiftY, zoom);
  g.restore();
  applyGrade(g, x, y, w, h, state.grade);
}

/* ---------- title / text ---------- */
function drawTitle(g) {
  var cx = W / 2;
  // "GRAND THEFT AUTO" — heavy tracked caps above the VI
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "900 64px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  var topText = "GRAND THEFT AUTO";
  var grad = g.createLinearGradient(0, 850, 0, 920);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#ffd166");
  g.lineWidth = 10; g.strokeStyle = "#14041f"; g.lineJoin = "round";
  g.strokeText(topText, cx, 884);
  g.fillStyle = grad;
  g.fillText(topText, cx, 884);
  g.restore();

  // Giant "VI" with pink->orange gradient and hard black outline
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "900 330px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  var vi = g.createLinearGradient(0, 880, 0, 1200);
  vi.addColorStop(0, "#ff2e88");
  vi.addColorStop(0.55, "#ff7a18");
  vi.addColorStop(1, "#ffb347");
  g.shadowColor = "rgba(0,0,0,0.65)";
  g.shadowBlur = 0;
  g.shadowOffsetY = 14;
  g.lineWidth = 16; g.strokeStyle = "#14041f"; g.lineJoin = "round";
  g.strokeText("VI", cx, 1040);
  g.fillStyle = vi;
  g.fillText("VI", cx, 1040);
  g.restore();

  // Subtitle line under the VI
  if (state.subtitle.trim()) {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 28px 'Arial Black', Arial, sans-serif";
    g.fillStyle = "#19e3d6";
    g.lineWidth = 6; g.strokeStyle = "#14041f"; g.lineJoin = "round";
    g.strokeText(state.subtitle.toUpperCase(), cx, 1232);
    g.fillText(state.subtitle.toUpperCase(), cx, 1232);
    g.restore();
  }
}

function drawCaptionBar(g) {
  var text = state.caption.trim().toUpperCase();
  if (!text) return;
  var barH = 92, barY = H - barH;
  g.save();
  g.fillStyle = "rgba(10,2,20,0.92)";
  g.fillRect(0, barY, W, barH);
  g.fillStyle = "#ff2e88";
  g.fillRect(0, barY, W, 6);
  g.textAlign = "center";
  g.textBaseline = "middle";
  var size = text.length > 30 ? 34 : 44;
  g.font = "900 " + size + "px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  g.fillStyle = "#ffffff";
  // shrink to fit if needed
  var tw = g.measureText(text).width;
  if (tw > W - 80) {
    g.font = "900 " + Math.floor(size * (W - 80) / tw) + "px 'Arial Black', Arial, sans-serif";
  }
  g.fillText(text, W / 2, barY + barH / 2 + 4);
  g.restore();
}

/* ---------- layouts ---------- */
function render() {
  var img = state.photo;
  if (!img) return;
  var g = ctx;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#14041f";
  g.fillRect(0, 0, W, H);

  var z = state.zoom, pan = state.pan;
  var layout = state.layout;

  if (layout === "stacked") {
    // Three stacked panels, GTA key-art style, with white gutters.
    drawPanel(g, img, 36, 36, W - 72, 470, 0.5, 0.28, z, 8);
    drawPanel(g, img, 36, 522, W - 72, 330, pan, 0.45, z * 1.05, 8);
    drawPanel(g, img, 36, 868, W - 72, 330, 1 - pan, 0.75, z * 1.1, 8);
  } else if (layout === "diagonal") {
    // Two big panels sliced on a diagonal. Both are frameless (no shadow):
    // the seam line below is the only divider, so no dark shadow band
    // can appear between them.
    g.save();
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 780); g.lineTo(0, 640); g.closePath();
    g.clip();
    drawPanel(g, img, -30, -30, W + 60, 810, pan, 0.1, z, 0);
    g.restore();
    g.save();
    g.beginPath();
    g.moveTo(0, 640); g.lineTo(W, 780); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.clip();
    drawPanel(g, img, -30, 640, W + 60, H - 610, 1 - pan, 0.8, z * 1.08, 0);
    g.restore();
    // Clean diagonal seam: one crisp white band with a pink hairline,
    // drawn exactly on the shared edge of the two panels.
    g.save();
    g.lineCap = "butt";
    g.strokeStyle = "#ffffff"; g.lineWidth = 14;
    g.beginPath(); g.moveTo(0, 640); g.lineTo(W, 780); g.stroke();
    g.strokeStyle = "#ff2e88"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 640); g.lineTo(W, 780); g.stroke();
    g.restore();
  } else { // grid
    drawPanel(g, img, 36, 36, W - 72, 520, 0.5, 0.12, z, 8);
    drawPanel(g, img, 36, 572, (W - 72 - 16) / 2, 300, pan, 0.5, z * 1.05, 8);
    drawPanel(g, img, 36 + (W - 72 - 16) / 2 + 16, 572, (W - 72 - 16) / 2, 300, 1 - pan, 0.5, z * 1.05, 8);
    drawPanel(g, img, 36, 888, W - 72, 310, 0.5, 0.85, z * 1.1, 8);
  }

  // Soft vignette over everything for a poster finish
  g.save();
  var vig = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(10,2,20,0.42)");
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  g.restore();

  if (state.showTitle) drawTitle(g);
  drawCaptionBar(g);
}

/* ---------- export ---------- */
function exportPNG() {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (!blob) { reject(new Error("canvas.toBlob returned null")); return; }
      resolve(blob);
    }, "image/png");
  });
}

/* Both Export buttons show in-place feedback: "Rendering…" while the
   PNG renders, then "Saved ✓", restoring the original label after 2.2s.
   Buttons are disabled while rendering. The status line is kept too. */
var exportBtns = [document.getElementById("exportBtn"), document.getElementById("exportBtn2")];
var exportLabels = exportBtns.map(function (b) { return b.textContent; });

function setExportState(label, disabled) {
  exportBtns.forEach(function (b) { b.textContent = label; b.disabled = disabled; });
}

function downloadExport() {
  var status = document.getElementById("status");
  setExportState("Rendering\u2026", true);
  status.textContent = "Rendering PNG\u2026";
  exportPNG().then(function (blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "gta6-cover-art.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setExportState("Saved \u2713", true);
    status.textContent = "Exported " + (blob.size / 1024).toFixed(0) + " KB PNG \u2014 1080\u00d71350.";
    setTimeout(function () {
      exportBtns.forEach(function (b, i) { b.textContent = exportLabels[i]; b.disabled = false; });
    }, 2200);
  }).catch(function (err) {
    exportBtns.forEach(function (b, i) { b.textContent = exportLabels[i]; b.disabled = false; });
    status.textContent = "Export failed: " + err.message;
  });
}

// Test hook: deterministic data-URL export for automated checks.
window.coverExport = function () { return canvas.toDataURL("image/png"); };

/* ---------- wiring ---------- */
function bind(id, fn) { document.getElementById(id).addEventListener("click", fn); }

function loadPhotoFile(file) {
  if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
  var reader = new FileReader();
  reader.onload = function () {
    var im = new Image();
    im.onload = function () { state.photo = im; render(); };
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function useSample() {
  state.photo = buildSamplePhoto();
  render();
}

bind("uploadBtn", function () { document.getElementById("fileInput").click(); });
bind("sampleBtn", useSample);
bind("sampleBtn2", useSample);
bind("exportBtn", downloadExport);
bind("exportBtn2", downloadExport);

var dropZone = document.getElementById("dropZone");
dropZone.addEventListener("click", function (e) {
  if (e.target.id !== "fileInput") document.getElementById("fileInput").click();
});
dropZone.addEventListener("keydown", function (e) {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("fileInput").click(); }
});
["dragenter", "dragover"].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add("dragging"); });
});
["dragleave", "drop"].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove("dragging"); });
});
dropZone.addEventListener("drop", function (e) {
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  loadPhotoFile(f);
});
document.getElementById("fileInput").addEventListener("change", function (e) {
  loadPhotoFile(e.target.files[0]);
  e.target.value = "";
});

function syncRange(id, valId, fmt, apply) {
  var el = document.getElementById(id);
  el.addEventListener("input", function () {
    document.getElementById(valId).textContent = fmt(el.value);
    apply(el.value);
    render();
  });
}
syncRange("zoom", "zoomVal", function (v) { return v + "%"; }, function (v) { state.zoom = v / 100; });
syncRange("pan", "panVal", function (v) { return v + "%"; }, function (v) { state.pan = v / 100; });
syncRange("grade", "gradeVal", function (v) { return v + "%"; }, function (v) { state.grade = v / 100; });

document.getElementById("caption").addEventListener("input", function (e) {
  state.caption = e.target.value; render();
});
document.getElementById("subtitle").addEventListener("input", function (e) {
  state.subtitle = e.target.value; render();
});
document.getElementById("showTitle").addEventListener("change", function (e) {
  state.showTitle = e.target.checked; render();
});

document.querySelectorAll(".preset").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".preset").forEach(function (b) { b.classList.remove("is-active"); });
    btn.classList.add("is-active");
    state.preset = btn.getAttribute("data-preset");
    render();
  });
});
document.querySelectorAll(".layout-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".layout-btn").forEach(function (b) { b.classList.remove("is-active"); });
    btn.classList.add("is-active");
    state.layout = btn.getAttribute("data-layout");
    render();
  });
});

// First paint: built-in sample so the app is demoable with zero input.
useSample();
