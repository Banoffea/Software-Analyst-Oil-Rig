// backend/src/routes/sim_all_day.js
const express = require('express');
const router = express.Router();

const db = require('../db');
const { ensureLotFor } = require('../services/lots');

/* ============== Helpers (time) ============== */
const pad2 = (n) => String(n).padStart(2, '0');
// ต่อสตริงเวลา “ไทย” ตรง ๆ (ไม่เขยื้อนเขตเวลา)
function makeThaiTS(dateStr, h, m, s) {
  return `${dateStr} ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/* ============== Volatile model ============== */
/**
 * AR(1) (random walk กลับสู่ mean) + white noise + spike + คลื่นสั้น/กลาง
 * แล้ว clamp ให้อยู่ในกรอบค่า (range) ที่เรากำหนด
 */

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const r3 = (x) => +x.toFixed(3);

// Gaussian โดย Box–Muller
function gauss(mu = 0, sigma = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mu + z * sigma;
}

// spike แบบสุ่ม
function spike(prob, amp) {
  return Math.random() < prob ? gauss(0, amp) : 0;
}

/**
 * ปรับค่าตามคำขอ:
 * - Humidity: กรอบกว้างขึ้นมาก + ความดุสูง
 * - Pressure: กลางๆ
 * - H2S/Temp/Water: เพิ่มช่วง & noise เล็กน้อย
 */
// ปรับพารามิเตอร์ความผันผวน (แรงขึ้นทุกตัว โดย Humidity แรงมากสุด)
// ปรับพารามิเตอร์ความผันผวน (แรงขึ้นทุกตัว โดย Humidity แรงมากสุด)
const CFG = {
// Qty: ให้แกว่งน้อยลง (ลด noise/spike และแอมป์)
qty:  { mean: 9.0,  lo: 5.5,  hi: 13.0, walk: 0.68, noise: 0.80, spikeP: 0.03, spikeAmp: 1.20 },

// Temp: ขยายกรอบให้กว้างขึ้นมาก + เพิ่มความผันผวนภายในกรอบ
temp: { mean: 32.3, lo: 24.0, hi: 42.5, walk: 0.56, noise: 1.60, spikeP: 0.08, spikeAmp: 2.40 },

// Pressure: กลางๆ แต่มากกว่าเดิม
pressure:  { mean:103.0, lo: 95.0, hi: 112.0, walk: 0.60, noise: 2.00, spikeP: 0.08, spikeAmp: 3.0 },

// Humidity: กรอบกว้างมาก + ดุสุด
humidity:  { mean: 66.0, lo: 40.0, hi: 88.0, walk: 0.55, noise: 6.00, spikeP: 0.12, spikeAmp: 10.0 },

  // CO2: ขยับขึ้นเล็กน้อย
  co2:       { mean: 0.44, lo: 0.37, hi: 0.53, walk: 0.55, noise: 0.018, spikeP: 0.04,  spikeAmp: 0.035 },

  // H2S: เพิ่มขึ้นพอเห็นชัด
  h2s:       { mean:  7.9, lo:  6.0, hi: 10.5, walk: 0.58, noise: 0.55,  spikeP: 0.07,  spikeAmp: 0.90 },

  // Water: เพิ่มช่วงและ noise เล็กน้อย
  water:     { mean: 0.11, lo: 0.12, hi: 0.10,  walk: 0.60, noise: 0.010, spikeP: 0.03, spikeAmp: 0.020 },
};



// สร้าง series แบบวันเดียวทั้งวัน (ทุก 5 วินาที) — ไม่มีเทอม day/night
function* volatileDaySeries(seedShift = 0) {
  // สถานะเริ่มใกล้ค่าเฉลี่ย (mean)
  let q  = CFG.qty.mean       + gauss(0, 0.8);
  let pr = CFG.pressure.mean  + gauss(0, 0.7);
  let hm = CFG.humidity.mean  + gauss(0, 1.2);
  let tp = CFG.temp.mean      + gauss(0, 0.35);
  let c2 = CFG.co2.mean       + gauss(0, 0.008);
  let h2 = CFG.h2s.mean       + gauss(0, 0.25);
  let wt = CFG.water.mean     + gauss(0, 0.007);

  // กลไก “ช่วงผิดปกติ” (rare burst) — เกิดน้อยมาก 0.1% ของเวลา
  let burstLeft = 0; // นับถอยหลังจำนวนสเต็ปที่ยังผิดปกติอยู่

  for (let i = 0; i < 24 * 60 * 60; i += 5) {
    const t = (i + seedShift) / 5;       // หนึ่งสเต็ป = 5 วินาที

    // คลื่นสั้น/กลางเท่านั้น (ไม่มี day/night)
    const saw = ((t % 36) / 36) * 2 - 1;            // ~3 นาที คลื่นฟันเลื่อย [-1..1]
    const tri = Math.abs(((t % 120) / 60) - 1);     // ~10 นาที สามเหลี่ยม [0..1..0]

    // โอกาสเริ่มระยะ “ผิดปกติ” ต่ำมาก (ประมาณ 0.1%)
    if (burstLeft <= 0 && Math.random() < 0.001) {
      // ความยาวช่วงผิดปกติ 2–8 นาที (นับเป็นสเต็ป 5 วิ)
      const secs = 120 + Math.floor(Math.random() * 360); // 120..480 วินาที
      burstLeft = Math.ceil(secs / 5);
    }

    // ----------------- อัปเดตค่าหลัก (ไม่มี day term) -----------------

    // Qty — ให้แกว่ง “น้อยลง” (ไม่มี day) ด้วยคลื่นสั้น/กลาง + noise + spike
    q  = CFG.qty.mean
        + CFG.qty.walk * (q - CFG.qty.mean)
        + gauss(0, CFG.qty.noise)
        + spike(CFG.qty.spikeP, CFG.qty.spikeAmp)
        + 0.65 * saw + 0.30 * (tri - 0.5);

    // Pressure — กลาง ๆ แต่ชัดขึ้น
    pr = CFG.pressure.mean
        + CFG.pressure.walk * (pr - CFG.pressure.mean)
        + gauss(0, CFG.pressure.noise)
        + spike(CFG.pressure.spikeP, CFG.pressure.spikeAmp)
        + 0.65 * saw + 0.35 * (tri - 0.5);

    // Humidity — ผันผวนแรงสุดตามที่ต้องการ
    hm = CFG.humidity.mean
        + CFG.humidity.walk * (hm - CFG.humidity.mean)
        + gauss(0, CFG.humidity.noise)
        + spike(CFG.humidity.spikeP, CFG.humidity.spikeAmp)
        + 1.80 * saw + 2.20 * (tri - 0.5);

    // Temperature — กว้างขึ้นจาก tri (แต่ไม่มี day)
    tp = CFG.temp.mean
        + CFG.temp.walk * (tp - CFG.temp.mean)
        + gauss(0, CFG.temp.noise)
        + spike(CFG.temp.spikeP, CFG.temp.spikeAmp)
        + 0.65 * (tri - 0.5);

    // CO2 — เล็กน้อยพอเห็น
    c2 = CFG.co2.mean
        + CFG.co2.walk * (c2 - CFG.co2.mean)
        + gauss(0, CFG.co2.noise)
        + spike(CFG.co2.spikeP, CFG.co2.spikeAmp)
        + 0.010 * saw;

    // H2S — ขยับปานกลาง
    h2 = CFG.h2s.mean
        + CFG.h2s.walk * (h2 - CFG.h2s.mean)
        + gauss(0, CFG.h2s.noise)
        + spike(CFG.h2s.spikeP, CFG.h2s.spikeAmp)
        + 0.25 * (tri - 0.5);

    // Water — ผันผวนน้อย (ตามที่กำหนดให้ต่ำกว่าอย่างอื่น)
    wt = CFG.water.mean
        + CFG.water.walk * (wt - CFG.water.mean)
        + gauss(0, CFG.water.noise)
        + spike(CFG.water.spikeP, CFG.water.spikeAmp)
        + 0.018 * saw + 0.020 * (tri - 0.5);

    // ----------------- ปรับช่วงผิดปกติเล็กน้อย (ถ้ามี) -----------------
    if (burstLeft > 0) {
      // ความผิดปกติเล็กน้อย: เพิ่ม/ลดพอให้เห็นต่าง แต่ยังอยู่ในกรอบ clamp
      hm += gauss(0, 3.5) + 6.0;                 // ความชื้นพุ่งขึ้นเด่น
      pr += (Math.random() < 0.5 ? -1.8 : 1.8);  // ความดันแกว่งขึ้น/ลงชัดเจน
      h2 += gauss(0, 0.35) + 0.7;
      tp += gauss(0, 0.35) + 0.6;
      q  += gauss(0, 0.4) - 0.8;                 // ปริมาณตกลงเล็กน้อย
      wt += gauss(0, 0.004) + 0.008;

      burstLeft -= 1;
    }

    // ส่งค่า (ถูก clamp และปัดทศนิยม 3 ตำแหน่ง)
    yield {
      Quantity:    r3(clamp(q,  CFG.qty.lo,      CFG.qty.hi)),
      Pressure:    r3(clamp(pr, CFG.pressure.lo, CFG.pressure.hi)),
      Temperature: r3(clamp(tp, CFG.temp.lo,     CFG.temp.hi)),
      Humidity:    r3(clamp(hm, CFG.humidity.lo, CFG.humidity.hi)),
      CO2:         r3(clamp(c2, CFG.co2.lo,      CFG.co2.hi)),
      H2S:         r3(clamp(h2, CFG.h2s.lo,      CFG.h2s.hi)),
      Water:       r3(clamp(wt, CFG.water.lo,    CFG.water.hi)),
      ProductStatus: 'normal',
    };
  }
}

/* ============== Public page ============== */
router.get('/oil-all-day', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Oil Simulator — All Day (5s, TH time)</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial;background:#0f172a;color:#e5e7eb;margin:0;padding:24px}
    .card{max-width:860px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .lbl{color:#9ca3af;margin:10px 0 4px}
    .input,.select{width:100%;padding:10px;border-radius:10px;border:1px solid #374151;background:#0b1220;color:#e5e7eb}
    .btn{margin-top:14px;padding:10px 14px;border:none;border-radius:999px;background:#3b82f6;color:#fff;cursor:pointer}
    .btn[disabled]{opacity:.6;cursor:default}
    .btn-ghost{background:#0b1220;border:1px solid #374151}
    .muted{color:#9ca3af}
    pre{background:#0b1220;border:1px solid #374151;border-radius:10px;padding:12px;overflow:auto;white-space:pre-wrap}
    .hr{height:1px;background:#1f2937;margin:18px 0}
    .row2{display:flex;gap:10px;align-items:flex-end}
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0">Oil Simulator — All Day (every 5 seconds)</h2>
    <p class="muted">สาธารณะ • เวลาไทยตรง • Humidity แกว่งมาก | Pressure กลางๆ | H₂S/Temp/Water เพิ่มเล็กน้อย</p>

    <div class="row">
      <div>
        <div class="lbl">Rig (online)</div>
        <select id="rig" class="select"></select>
      </div>
      <div>
        <div class="lbl">Date (YYYY-MM-DD)</div>
        <input id="date" class="input" type="date" />
      </div>
    </div>

    <div class="hr"></div>

    <div class="row2">
      <button id="run5s" class="btn">Create whole day (5s)</button>
      <label style="display:flex;gap:8px;align-items:center">
        <input id="overwrite" type="checkbox" />
        <span class="muted">Overwrite existing day</span>
      </label>
      <button id="clearLog" class="btn btn-ghost">Clear log</button>
      <span id="status" class="muted" style="margin-left:auto">Ready</span>
    </div>

    <pre id="log" style="display:none"></pre>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);
    const rigSel = $('rig');
    const dateEl = $('date');
    const run5s = $('run5s');
    const overwrite = $('overwrite');
    const status = $('status');
    const clearLogBtn = $('clearLog');
    const log = $('log');

    function setLog(v) { log.style.display = 'block'; log.textContent = v; }
    function setStatus(msg, color) { status.textContent = msg; status.style.color = color || '#9ca3af'; }
    dateEl.valueAsDate = new Date();

    async function loadRigs() {
      const res = await fetch('/api/sim/rigs');
      const rigs = await res.json();
      rigSel.innerHTML = rigs.map(r =>
        '<option value="'+r.id+'">#'+r.id+' — '+(r.rig_code || 'RIG')+' — '+(r.name || '-')+'</option>'
      ).join('');
    }

    run5s.addEventListener('click', async () => {
      const rig_id = Number(rigSel.value);
      const date = dateEl.value;
      if (!rig_id || !date) { setStatus('Please select rig & date', '#ef4444'); return; }
      run5s.disabled = true; setStatus('Working…', '#f59e0b');
      try {
        const res = await fetch('/api/sim/bulk-add-5s', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ rig_id, date, overwrite: overwrite.checked })
        });
        const data = await res.json().catch(()=>null);
        if (!res.ok) { setStatus('Error: ' + (data?.message || res.status), '#ef4444'); setLog(JSON.stringify(data, null, 2)); }
        else { setStatus('OK! created: ' + (data?.created ?? 0), '#10b981'); setLog(JSON.stringify(data, null, 2)); }
      } catch (e) {
        setStatus('Network error', '#ef4444');
      } finally { run5s.disabled = false; }
    });

    clearLogBtn.addEventListener('click', () => { log.textContent = ''; log.style.display = 'none'; });
    loadRigs();
  </script>
</body>
</html>`);
});

/* ============== APIs ============== */

// list rigs (online only)
router.get('/api/sim/rigs', async (_req, res) => {
  const [rows] = await db.query(
    `SELECT id, rig_code, name, status
       FROM oil_rigs
      WHERE status='online'
      ORDER BY id`
  );
  res.json(rows);
});

// Create a whole day every 5 seconds (ผันผวนตามสเปค)
router.post('/api/sim/bulk-add-5s', async (req, res) => {
  const rigId   = Number(req.body?.rig_id);
  const dateStr = String(req.body?.date || '').trim();
  const overwrite = !!(req.body?.overwrite) || String(req.query?.overwrite||'').match(/^(1|true|yes)$/i);

  if (!rigId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ message: 'rig_id and date (YYYY-MM-DD) required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[rig]] = await conn.query(`SELECT id, status FROM oil_rigs WHERE id=? LIMIT 1`, [rigId]);
    if (!rig || rig.status !== 'online') {
      await conn.rollback();
      return res.status(400).json({ message: 'rig not online or not found' });
    }

    const lotId = await ensureLotFor(conn, rigId, `${dateStr} 00:00:00`);

    if (overwrite) {
      await conn.query(
        `DELETE FROM product_readings
          WHERE lot_id=? AND rig_id=? AND recorded_at BETWEEN ? AND ?`,
        [lotId, rigId, `${dateStr} 00:00:00`, `${dateStr} 23:59:59`]
      );
    }

    const totalPoints = 24 * 60 * 60 / 5; // 17,280
    const CHUNK = 1200;
    const rows = [];

    const seedShift = (rigId % 13) * 7;
    const gen = volatileDaySeries(seedShift);

    const insertChunk = async (chunkRows) => {
      if (!chunkRows.length) return;
      await conn.query(
        `INSERT INTO product_readings
           (lot_id, rig_id, recorded_at,
            Quantity, Pressure, Temperature, Humidity, CO2, H2S, Water, ProductStatus)
         VALUES ?`,
        [chunkRows]
      );
    };

    for (let i = 0; i < totalPoints; i++) {
      const secs = i * 5;
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      const tsStr = makeThaiTS(dateStr, h, m, s);

      const smp = gen.next().value;
      rows.push([
        lotId, rigId, tsStr,
        smp.Quantity, smp.Pressure, smp.Temperature, smp.Humidity,
        smp.CO2, smp.H2S, smp.Water, smp.ProductStatus
      ]);

      if (rows.length >= CHUNK) {
        await insertChunk(rows.splice(0, rows.length));
      }
    }

    if (rows.length) await insertChunk(rows);

    const [[tot]] = await conn.query(
      `SELECT COALESCE(SUM(Quantity),0) AS sum_qty FROM product_readings WHERE lot_id=?`,
      [lotId]
    );
    await conn.query(`UPDATE product_lots SET total_qty=? WHERE id=?`, [+Number(tot.sum_qty).toFixed(3), lotId]);

    await conn.commit();
    res.json({
      ok: true,
      created: totalPoints,
      rig_id: rigId,
      date: dateStr,
      lot_id: lotId,
      overwrote: !!overwrite,
      lot_total_qty: +Number(tot.sum_qty).toFixed(3)
    });
  } catch (e) {
    await conn.rollback();
    console.error('sim bulk-add-5s error:', e);
    if (String(e?.code) === 'ER_NET_PACKET_TOO_LARGE') {
      return res.status(500).json({ message: "Packet too large. Increase 'max_allowed_packet' (e.g. 64M+) in my.ini and restart MySQL." });
    }
    res.status(500).json({ message: 'DB error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
