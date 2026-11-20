// GTA VI Cover Art Maker — offline canvas poster maker (classic script, no modules).
// Draws a photo onto a 1080x1350 canvas with colour grading, panel layouts, a
// GTA VI title treatment and a caption bar, then exports it as a PNG.
// Deterministic: the sample photo uses a seeded PRNG only — no Math.random,
// no Date in the render path — so the same inputs always produce the same PNG.
(function () {
  'use strict';

  var W = 1080;
  var H = 1350;
  var HORIZON = Math.round(H * 0.72); // 972

  var canvas = document.getElementById('cover');
  var ctx = canvas.getContext('2d');

  var state = {
    preset: 'sunset',
    layout: 'stacked',
    zoom: 1.30,
    pan: 0.50,
    grade: 0.80,
    caption: 'WELCOME BACK TO VICE CITY',
    subtitle: 'LEONIDA • 2026',
    showTitle: true,
    photo: null // Image or offscreen canvas
  };

  // ---------- Deterministic PRNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Built-in sample photo (procedural Vice City sunset) ----------
  var sampleCache = null;
  function buildSample() {
    if (sampleCache) return sampleCache;
    var rnd = mulberry32(20260527);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var i, x, y, w, h, bw, bh;

    // Sky: vertical gradient over the top 72%.
    var sky = g.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#2b0a4a');
    sky.addColorStop(0.30, '#8a1d6e');
    sky.addColorStop(0.55, '#ff2e88');
    sky.addColorStop(0.75, '#ff7a18');
    sky.addColorStop(1, '#ffb347');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, HORIZON + 1);

    // 110 stars in the upper sky.
    for (i = 0; i < 110; i++) {
      x = rnd() * W;
      y = rnd() * 360;
      var r = 0.6 + rnd() * 1.6;
      g.globalAlpha = 0.35 + rnd() * 0.55;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // 7 distant bird silhouettes, high in the sky.
    g.strokeStyle = '#1e0526';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (i = 0; i < 7; i++) {
      x = 80 + rnd() * (W - 160);
      y = 60 + rnd() * 240;
      var s = 0.7 + rnd() * 0.8;
      g.beginPath();
      g.moveTo(x - 14 * s, y);
      g.quadraticCurveTo(x - 7 * s, y - 10 * s, x, y);
      g.quadraticCurveTo(x + 7 * s, y - 10 * s, x + 14 * s, y);
      g.stroke();
    }

    // Sun: disc with a warm gradient, plus 6 retro scanline gaps.
    var sunY = 0.44 * H;
    var sunR = 190;
    var sunGrad = g.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#fff3b0');
    sunGrad.addColorStop(0.55, '#ffd166');
    sunGrad.addColorStop(1, '#ff5e62');
    g.fillStyle = sunGrad;
    g.beginPath();
    g.arc(W / 2, sunY, sunR, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(W / 2, sunY, sunR, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#ff7a18';
    var gapY = sunY + 40;
    var gapH = 6;
    for (i = 0; i < 6; i++) {
      g.fillRect(W / 2 - sunR, gapY, sunR * 2, gapH);
      gapY += 26 + i * 4;
      gapH += 4;
    }
    g.restore();

    // 7 distant clouds: pale pink ellipses.
    g.fillStyle = '#ffb9d9';
    for (i = 0; i < 7; i++) {
      x = rnd() * W;
      y = 120 + rnd() * 420;
      var cw = 90 + rnd() * 160;
      var chh = 14 + rnd() * 18;
      g.globalAlpha = 0.28;
      g.beginPath();
      g.ellipse(x, y, cw / 2, chh / 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Ocean: bottom 28%.
    var sea = g.createLinearGradient(0, HORIZON, 0, H);
    sea.addColorStop(0, '#ff7a18');
    sea.addColorStop(0.25, '#c22a72');
    sea.addColorStop(1, '#16042e');
    g.fillStyle = sea;
    g.fillRect(0, HORIZON, W, H - HORIZON);

    // Skyline: two depth layers sitting on the horizon.
    function skyline(color, minH, maxH) {
      var buildings = [];
      var bx = -10;
      while (bx < W + 10) {
        bw = 46 + rnd() * 90;
        bh = minH + rnd() * (maxH - minH);
        buildings.push({ x: bx, y: HORIZON - bh, w: bw, h: bh });
        bx += bw + 4 + rnd() * 10;
      }
      g.fillStyle = color;
      buildings.forEach(function (b) {
        g.fillRect(b.x, b.y, b.w, b.h);
        // Some buildings get a rooftop antenna.
        if (rnd() < 0.35) {
          g.fillRect(b.x + b.w / 2 - 2, b.y - 22, 4, 22);
          g.beginPath();
          g.arc(b.x + b.w / 2, b.y - 24, 3, 0, Math.PI * 2);
          g.fill();
        }
      });
      return buildings;
    }
    skyline('#5a1a63', 90, 260);
    var front = skyline('#2c0a3d', 60, 190);

    // 260 lit windows scattered on the front skyline.
    g.fillStyle = '#ffd678';
    for (i = 0; i < 260; i++) {
      var b = front[Math.floor(rnd() * front.length)];
      var wx = b.x + 6 + rnd() * Math.max(1, b.w - 12);
      var wy = b.y + 8 + rnd() * Math.max(1, b.h - 16);
      if (wy > HORIZON - 8) continue;
      g.globalAlpha = 0.9;
      g.fillRect(wx, wy, 5, 7);
    }
    g.globalAlpha = 1;

    // 3 palm silhouettes at the horizon.
    function palm(px, scale) {
      var topY = HORIZON - 150 * scale;
      g.strokeStyle = '#1c0526';
      g.fillStyle = '#1c0526';
      g.lineWidth = 9 * scale;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(px, HORIZON + 2);
      g.quadraticCurveTo(px + 18 * scale, HORIZON - 80 * scale, px + 6 * scale, topY);
      g.stroke();
      var tx = px + 6 * scale;
      for (var f = 0; f < 7; f++) {
        var ang = (-Math.PI * 0.95) + (f / 6) * Math.PI * 0.9;
        var len = (58 + rnd() * 22) * scale;
        var ex = tx + Math.cos(ang) * len;
        var ey = topY + Math.sin(ang) * len * 0.55 + 14 * scale;
        g.lineWidth = 5 * scale;
        g.beginPath();
        g.moveTo(tx, topY);
        g.quadraticCurveTo(tx + Math.cos(ang) * len * 0.5, topY + Math.sin(ang) * len * 0.5 - 12 * scale, ex, ey);
        g.stroke();
      }
    }
    palm(70, 1.15);
    palm(W - 110, 0.95);
    palm(W - 260, 0.7);

    // 46 sun-reflection streaks on the water, below the sun.
    g.fillStyle = '#ffe9a8';
    for (i = 0; i < 46; i++) {
      var sw = 20 + rnd() * 90;
      var sx = W / 2 - 160 + rnd() * 320 - sw / 2;
      var sy = HORIZON + 8 + rnd() * (H - HORIZON - 40);
      g.globalAlpha = 0.55 * (1 - (sy - HORIZON) / (H - HORIZON) * 0.6);
      g.fillRect(sx, sy, sw, 3 + rnd() * 3);
    }
    g.globalAlpha = 1;

    // Dark beach strip along the very bottom.
    g.fillStyle = '#3d1547';
    g.fillRect(0, H - 26, W, 26);

    sampleCache = c;
    return c;
  }

  // ---------- Colour grades ----------
  var GRADES = {
    sunset: {
      filter: 'saturate(1.45) contrast(1.12) brightness(1.04)',
      overlays: [
        { kind: 'v', stops: [[0, 'rgba(255,122,24,0.30)'], [0.55, 'rgba(255,46,136,0.22)'], [1, 'rgba(90,20,140,0.34)']], blend: 'overlay' },
        { kind: 'v-bottom', stops: [[0, 'rgba(255,180,60,0.20)'], [1, 'rgba(255,180,60,0)']], blend: 'screen' }
      ]
    },
    neon: {
      filter: 'saturate(1.7) contrast(1.18) brightness(0.98)',
      overlays: [
        { kind: 'd', stops: [[0, 'rgba(25,227,214,0.30)'], [0.5, 'rgba(255,46,136,0.24)'], [1, 'rgba(123,47,247,0.32)']], blend: 'overlay' },
        { kind: 'r', stops: [[0, 'rgba(255,46,136,0.20)'], [1, 'rgba(10,4,30,0.30)']], blend: 'soft-light' }
      ]
    },
    vice: {
      filter: 'saturate(1.55) contrast(1.10) brightness(1.02)',
      overlays: [
        { kind: 'v', stops: [[0, 'rgba(255,94,196,0.32)'], [0.5, 'rgba(255,179,71,0.18)'], [1, 'rgba(25,227,214,0.26)']], blend: 'overlay' },
        { kind: 'h', stops: [[0, 'rgba(123,47,247,0.18)'], [1, 'rgba(25,227,214,0.18)']], blend: 'soft-light' }
      ]
    }
  };

  function overlayGradient(o, x, y, w, h) {
    var grad;
    if (o.kind === 'v') grad = ctx.createLinearGradient(x, y, x, y + h);
    else if (o.kind === 'v-bottom') grad = ctx.createLinearGradient(x, y + h, x, y);
    else if (o.kind === 'h') grad = ctx.createLinearGradient(x, y, x + w, y);
    else if (o.kind === 'd') grad = ctx.createLinearGradient(x, y, x + w, y + h);
    else if (o.kind === 'r') grad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.42, 0, x + w * 0.5, y + h * 0.42, Math.max(w, h) * 0.55);
    o.stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    return grad;
  }

  // Cover-fit the photo into a rect, with a deterministic crop shift.
  function drawPhotoInto(img, x, y, w, h, shiftX, shiftY, zoom) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var scale = Math.max(w / iw, h / ih) * zoom;
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = x + (w - dw) * shiftX;
    var dy = y + (h - dh) * shiftY;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // One panel: photo + grade, optionally with a white frame + soft shadow.
  function drawPanel(x, y, w, h, shiftX, shiftY, zoom, framed) {
    var ix = x, iy = y, iw = w, ih = h;
    if (framed) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      ix = x + 8; iy = y + 8; iw = w - 16; ih = h - 16;
    }
    var img = state.photo;
    if (!img) return;
    var grade = GRADES[state.preset];
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    ctx.filter = grade.filter;
    drawPhotoInto(img, ix, iy, iw, ih, shiftX, shiftY, zoom);
    ctx.filter = 'none';
    grade.overlays.forEach(function (o) {
      ctx.save();
      ctx.globalAlpha = state.grade;
      ctx.globalCompositeOperation = o.blend;
      ctx.fillStyle = overlayGradient(o, ix, iy, iw, ih);
      ctx.fillRect(ix, iy, iw, ih);
      ctx.restore();
    });
    ctx.restore();
  }

  // Diagonal layout: two frameless panels clipped on a diagonal seam.
  function drawDiagonal() {
    var img = state.photo;
    if (!img) return;
    var grade = GRADES[state.preset];
    var z = state.zoom;

    function clipPanel(path) {
      ctx.save();
      ctx.beginPath();
      path();
      ctx.clip();
      ctx.filter = grade.filter;
      return true;
    }
    function gradeOverlays(x, y, w, h) {
      ctx.filter = 'none';
      grade.overlays.forEach(function (o) {
        ctx.save();
        ctx.globalAlpha = state.grade;
        ctx.globalCompositeOperation = o.blend;
        ctx.fillStyle = overlayGradient(o, x, y, w, h);
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      });
      ctx.restore();
    }

    // Top panel: (0,0)-(W,780), seam from (0,640) to (W,780).
    clipPanel(function () {
      ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 780); ctx.lineTo(0, 640); ctx.closePath();
    });
    drawPhotoInto(img, 0, 0, W, 780, 0.5, 0.25, z);
    gradeOverlays(0, 0, W, 780);

    // Bottom panel: (0,640)-(W,H).
    clipPanel(function () {
      ctx.moveTo(0, 640); ctx.lineTo(W, 780); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    });
    drawPhotoInto(img, 0, 640, W, H - 640, state.pan, 0.7, z * 1.05);
    gradeOverlays(0, 640, W, H - 640);

    // Crisp seam: 14px white line + 4px pink hairline on the same diagonal.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(0, 640); ctx.lineTo(W, 780); ctx.stroke();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 640); ctx.lineTo(W, 780); ctx.stroke();
    ctx.restore();
  }

  // ---------- Render ----------
  function render() {
    var z = state.zoom;
    var pan = state.pan;

    ctx.save();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#16042e';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    if (state.layout === 'stacked') {
      drawPanel(36, 36, 1008, 470, 0.5, 0.28, z, true);
      drawPanel(36, 522, 1008, 330, pan, 0.45, z * 1.05, true);
      drawPanel(36, 868, 1008, 330, 1 - pan, 0.75, z * 1.1, true);
    } else if (state.layout === 'diagonal') {
      drawDiagonal();
    } else if (state.layout === 'grid') {
      drawPanel(36, 36, 1008, 520, 0.5, 0.12, z, true);
      drawPanel(36, 572, 496, 300, pan, 0.5, z * 1.05, true);
      drawPanel(548, 572, 496, 300, 1 - pan, 0.5, z * 1.05, true);
      drawPanel(36, 888, 1008, 310, 0.5, 0.85, z * 1.1, true);
    }

    // Soft radial vignette over everything.
    var vig = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 950);
    vig.addColorStop(0, 'rgba(10,2,20,0)');
    vig.addColorStop(1, 'rgba(10,2,20,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Title treatment.
    if (state.showTitle) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';

      // "GRAND THEFT AUTO"
      ctx.font = "900 64px 'Arial Black', Arial, sans-serif";
      var gtaGrad = ctx.createLinearGradient(0, 884 - 32, 0, 884 + 32);
      gtaGrad.addColorStop(0, '#ffffff');
      gtaGrad.addColorStop(1, '#ffd166');
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(10,2,20,0.9)';
      ctx.strokeText('GRAND THEFT AUTO', W / 2, 884);
      ctx.fillStyle = gtaGrad;
      ctx.fillText('GRAND THEFT AUTO', W / 2, 884);

      // Giant "VI"
      ctx.font = "900 330px 'Arial Black', Arial, sans-serif";
      var viGrad = ctx.createLinearGradient(0, 1040 - 165, 0, 1040 + 165);
      viGrad.addColorStop(0, '#ff2e88');
      viGrad.addColorStop(0.55, '#ff7a18');
      viGrad.addColorStop(1, '#ffd166');
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(10,2,20,0.9)';
      ctx.strokeText('VI', W / 2, 1040);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = viGrad;
      ctx.fillText('VI', W / 2, 1040);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Subtitle
      if (state.subtitle.trim() !== '') {
        ctx.font = "700 28px 'Arial Black', Arial, sans-serif";
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(10,2,20,0.9)';
        ctx.strokeText(state.subtitle.toUpperCase(), W / 2, 1232);
        ctx.fillStyle = '#19e3d6';
        ctx.fillText(state.subtitle.toUpperCase(), W / 2, 1232);
      }
      ctx.restore();
    }

    // Caption bar (bottom 92px strip).
    if (state.caption.trim() !== '') {
      var text = state.caption.toUpperCase();
      var size = text.length > 30 ? 34 : 44;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "900 " + size + "px 'Arial Black', Arial, sans-serif";
      while (ctx.measureText(text).width > W - 80 && size > 18) {
        size -= 2;
        ctx.font = "900 " + size + "px 'Arial Black', Arial, sans-serif";
      }
      ctx.fillStyle = 'rgba(10,2,20,0.92)';
      ctx.fillRect(0, H - 92, W, 92);
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(0, H - 92, W, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, W / 2, H - 43);
      ctx.restore();
    }
  }

  // ---------- Export ----------
  var exportBtn = document.getElementById('exportBtn');
  var exportBtn2 = document.getElementById('exportBtn2');
  var statusEl = document.getElementById('status');
  var restoreTimer = null;

  function doExport() {
    var label1 = exportBtn.textContent;
    var label2 = exportBtn2.textContent;
    exportBtn.disabled = true;
    exportBtn2.disabled = true;
    exportBtn.textContent = 'Rendering…';
    exportBtn2.textContent = 'Rendering…';
    if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
    function restore() {
      exportBtn.disabled = false;
      exportBtn2.disabled = false;
      exportBtn.textContent = label1;
      exportBtn2.textContent = label2;
    }
    try {
      canvas.toBlob(function (blob) {
        if (!blob) {
          statusEl.textContent = 'Export failed: could not render PNG';
          restore();
          return;
        }
        var kb = Math.round(blob.size / 1024);
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'gta6-cover-art.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        exportBtn.textContent = 'Saved ✓';
        exportBtn2.textContent = 'Saved ✓';
        statusEl.textContent = 'Exported ' + kb + ' KB PNG — 1080×1350.';
        restoreTimer = setTimeout(restore, 2200);
      }, 'image/png');
    } catch (err) {
      statusEl.textContent = 'Export failed: ' + (err && err.message ? err.message : err);
      restore();
    }
  }

  exportBtn.addEventListener('click', doExport);
  exportBtn2.addEventListener('click', doExport);

  // Test hook: returns the poster as a PNG data URL.
  window.coverExport = function () { return canvas.toDataURL('image/png'); };

  // ---------- Photo loading ----------
  var fileInput = document.getElementById('fileInput');
  var dropZone = document.getElementById('dropZone');

  function loadFile(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      state.photo = img;
      URL.revokeObjectURL(url);
      render();
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  function useSample() {
    state.photo = buildSample();
    render();
  }

  function openPicker() { fileInput.click(); }

  document.getElementById('sampleBtn').addEventListener('click', useSample);
  document.getElementById('sampleBtn2').addEventListener('click', useSample);
  document.getElementById('uploadBtn').addEventListener('click', openPicker);
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) loadFile(fileInput.files[0]);
    fileInput.value = '';
  });

  dropZone.addEventListener('click', function (e) {
    if (e.target === fileInput) return;
    openPicker();
  });
  dropZone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  });
  dropZone.addEventListener('dragenter', function (e) { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragging'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  // ---------- Controls wiring ----------
  function bindSlider(id, valId, apply) {
    var el = document.getElementById(id);
    var val = document.getElementById(valId);
    el.addEventListener('input', function () {
      var v = Number(el.value);
      val.textContent = v + '%';
      apply(v);
      render();
    });
  }
  bindSlider('zoom', 'zoomVal', function (v) { state.zoom = v / 100; });
  bindSlider('pan', 'panVal', function (v) { state.pan = v / 100; });
  bindSlider('grade', 'gradeVal', function (v) { state.grade = v / 100; });

  var captionEl = document.getElementById('caption');
  var subtitleEl = document.getElementById('subtitle');
  captionEl.addEventListener('input', function () { state.caption = captionEl.value; render(); });
  subtitleEl.addEventListener('input', function () { state.subtitle = subtitleEl.value; render(); });
  document.getElementById('showTitle').addEventListener('change', function (e) {
    state.showTitle = e.target.checked;
    render();
  });

  function bindGroup(selector, attr, apply) {
    var btns = Array.prototype.slice.call(document.querySelectorAll(selector));
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
        apply(btn.getAttribute(attr));
        render();
      });
    });
    return btns;
  }
  var presetBtns = bindGroup('.preset', 'data-preset', function (v) { state.preset = v; });
  var layoutBtns = bindGroup('.layout-btn', 'data-layout', function (v) { state.layout = v; });

  function setGroup(btns, value, attr) {
    btns.forEach(function (b) {
      var on = b.getAttribute(attr) === value;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // ---------- Screenshot query params ----------
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (params.get('preset') && GRADES[params.get('preset')]) {
    state.preset = params.get('preset');
    setGroup(presetBtns, state.preset, 'data-preset');
  }
  if (params.get('layout') && ['stacked', 'diagonal', 'grid'].indexOf(params.get('layout')) !== -1) {
    state.layout = params.get('layout');
    setGroup(layoutBtns, state.layout, 'data-layout');
  }
  if (params.get('caption') !== null) {
    state.caption = params.get('caption');
    captionEl.value = state.caption;
  }
  if (params.get('subtitle') !== null) {
    state.subtitle = params.get('subtitle');
    subtitleEl.value = state.subtitle;
  }
  function clampNum(v, min, max, fallback) {
    var n = Number(v);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }
  if (params.get('zoom') !== null) {
    var zv = clampNum(params.get('zoom'), 100, 220, 130);
    state.zoom = zv / 100;
    document.getElementById('zoom').value = String(zv);
    document.getElementById('zoomVal').textContent = zv + '%';
  }
  if (params.get('pan') !== null) {
    var pv = clampNum(params.get('pan'), 0, 100, 50);
    state.pan = pv / 100;
    document.getElementById('pan').value = String(pv);
    document.getElementById('panVal').textContent = pv + '%';
  }
  if (params.get('grade') !== null) {
    var gv = clampNum(params.get('grade'), 0, 100, 80);
    state.grade = gv / 100;
    document.getElementById('grade').value = String(gv);
    document.getElementById('gradeVal').textContent = gv + '%';
  }

  // ---------- First paint ----------
  state.photo = buildSample();
  render();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      window.__shotReady = true;
    });
  });
})();
