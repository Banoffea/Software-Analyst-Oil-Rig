// src/components/RealtimeDailyChart.jsx
import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid, ReferenceArea
} from 'recharts';
import { getDailySeries, getHistory } from '../api/readings'; // ปรับ path ให้ตรงโปรเจคคุณ

const POLL_MS = 60000; // รีเฟรชทุก 1 นาที

function labelFromMinute(m) {
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${h}:${mm}`;
}
function buildMinuteTimeline() {
  return Array.from({ length: 1440 }, (_, i) => ({ t: labelFromMinute(i) }));
}
function msUntilNextMidnight() {
  const now = new Date(); const next = new Date(); next.setHours(24,0,0,0);
  return next - now;
}
// YYYY-MM-DD (เวลาไทย)
function todayBKK() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

// แปลงผลลัพธ์ daily-series (object) -> array สำหรับ Recharts
function toPointsFromDaily(dailyObj) {
  if (!dailyObj || !dailyObj.labels || !dailyObj.series) return [];
  const { labels, series } = dailyObj; // series: { quantity, temperature, ... } (ตัวพิมพ์เล็ก)
  // map เป็นคีย์ตัวพิมพ์ใหญ่ให้ตรงกับ legend/Line ของกราฟ
  return labels.map((t, i) => ({
    t,
    Quantity:    series.quantity?.[i]    ?? null,
    Temperature: series.temperature?.[i] ?? null,
    Pressure:    series.pressure?.[i]    ?? null,
    Humidity:    series.humidity?.[i]    ?? null,
    H2S:         series.h2s?.[i]         ?? null,
    CO2:         series.co2?.[i]         ?? null,
    Water:       series.water?.[i]       ?? null,
  }));
}

export default function RealtimeDailyChart({ rigId, date, height = 380 }) {
  const [data, setData] = useState([]);
  const wantedDate = date || todayBKK();

  const load = async () => {
    if (!rigId) return;

    try {
      // ✅ พยายามใช้ endpoint รายวันก่อน (object { date, labels, series })
      const daily = await getDailySeries({ rigId, date: wantedDate });
      const points = Array.isArray(daily) ? [] : toPointsFromDaily(daily);

      if (points.length) {
        setData(points);
        return;
      }

      // ถ้า daily ไม่ได้ข้อมูล → fallback ใช้ history (array raw)
      const hist = await getHistory({ rigId, date: wantedDate, limit: 200000 });
      if (Array.isArray(hist)) {
        // บัคเก็ตเฉลี่ยเป็นต่อนาที
        const buckets = Array.from({ length: 1440 }, () => ({
          c:0, Quantity:0, Temperature:0, Pressure:0, Humidity:0, H2S:0, CO2:0, Water:0
        }));
        hist.forEach(r => {
          const dt = new Date(r.recorded_at);
          const i = dt.getHours() * 60 + dt.getMinutes();
          const b = buckets[i]; b.c++;
          ['Quantity','Temperature','Pressure','Humidity','H2S','CO2','Water']
            .forEach(k => { if (r[k] != null) b[k] += Number(r[k]); });
        });
        const merged = buildMinuteTimeline().map((row, i) => {
          const b = buckets[i]; const out = { t: row.t };
          ['Quantity','Temperature','Pressure','Humidity','H2S','CO2','Water']
            .forEach(k => { out[k] = b.c ? b[k] / b.c : null; });
          return out;
        });
        setData(merged);
      } else {
        setData([]);
      }
    } catch (e) {
      // เกิด error ก็ fallback แบบ history เช่นกัน
      try {
        const hist = await getHistory({ rigId, date: wantedDate, limit: 200000 });
        if (Array.isArray(hist)) {
          const buckets = Array.from({ length: 1440 }, () => ({
            c:0, Quantity:0, Temperature:0, Pressure:0, Humidity:0, H2S:0, CO2:0, Water:0
          }));
          hist.forEach(r => {
            const dt = new Date(r.recorded_at);
            const i = dt.getHours() * 60 + dt.getMinutes();
            const b = buckets[i]; b.c++;
            ['Quantity','Temperature','Pressure','Humidity','H2S','CO2','Water']
              .forEach(k => { if (r[k] != null) b[k] += Number(r[k]); });
          });
          const merged = buildMinuteTimeline().map((row, i) => {
            const b = buckets[i]; const out = { t: row.t };
            ['Quantity','Temperature','Pressure','Humidity','H2S','CO2','Water']
              .forEach(k => { out[k] = b.c ? b[k] / b.c : null; });
            return out;
          });
          setData(merged);
        } else {
          setData([]);
        }
      } catch {
        setData([]);
      }
    }
  };

  // โหลดครั้งแรก + โพลทุก 1 นาที (sync ต้นนาที)
  useEffect(() => {
    load();
    const now = Date.now();
    const firstDelay = Math.ceil(now / POLL_MS) * POLL_MS - now;
    const t1 = setTimeout(() => {
      load();
      const t2 = setInterval(load, POLL_MS);
      (window.__rtIds ||= []).push(t2);
    }, firstDelay);
    return () => {
      clearTimeout(t1);
      (window.__rtIds||[]).forEach(clearInterval);
      window.__rtIds = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rigId, wantedDate]);

  // รีเซ็ตเที่ยงคืน (เพื่อให้วันที่ใหม่เริ่มนับถูก)
  useEffect(() => {
    const t = setTimeout(load, msUntilNextMidnight());
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rigId, wantedDate]);

  // === สีแยกต่อซีรีส์ (Color-blind friendly palette) ===
  const series = [
    { key: 'Quantity',    name: 'Qty (bbl)',      y: 'left',  color: '#1f77b4' }, // blue
    { key: 'Temperature', name: 'Temp (°C)',      y: 'right', color: '#ff7f0e' }, // orange
    { key: 'Pressure',    name: 'Pressure (bar)', y: 'right', color: '#2ca02c' }, // green
    { key: 'Humidity',    name: 'Humidity (%)',   y: 'right', color: '#9467bd' }, // purple
    { key: 'H2S',         name: 'H₂S (ppm)',      y: 'right', color: '#d62728' }, // red
    { key: 'CO2',         name: 'CO₂ (%vol)',     y: 'right', color: '#8c564b' }, // brown
    { key: 'Water',       name: 'Water (%)',      y: 'right', color: '#17becf' }, // teal
  ];

  // เงาเทาช่วง 1 ชั่วโมงสลับลาย
  const stripes = Array.from({ length: 12 }, (_, i) => {
    const startM = i * 120;
    return { x1: labelFromMinute(startM), x2: labelFromMinute(startM + 60) };
  });

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          {stripes.map((s, idx) => (
            <ReferenceArea
              key={idx}
              x1={s.x1}
              x2={s.x2}
              y1={0}
              y2="auto"
              fill="#f7f9fc"
              fillOpacity={1}
              strokeOpacity={0}
            />
          ))}

          <XAxis dataKey="t" minTickGap={30} />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />

          {series.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              yAxisId={s.y}
              dot={false}
              strokeWidth={1.5}
              connectNulls={false}
              stroke={s.color}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
