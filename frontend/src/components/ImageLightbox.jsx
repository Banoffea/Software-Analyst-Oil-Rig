// frontend/src/components/ImageLightbox.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ImageLightbox({ images = [], index = 0, onIndex, onClose }) {
  const [i, setI] = useState(index);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => setI(index), [index]);
  useEffect(() => onIndex?.(i), [i]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") setI((p) => (p + 1) % images.length);
      if (e.key === "ArrowLeft")  setI((p) => (p - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  // Mouse/zoom handlers
  function wheel(e) {
    e.preventDefault();
    const next = Math.min(5, Math.max(1, scale + (e.deltaY < 0 ? 0.2 : -0.2)));
    setScale(next);
  }
  function onDown(e) {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }
  function onMove(e) {
    if (!dragging.current || scale === 1) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }
  function onUp() { dragging.current = false; }
  function resetView() { setScale(1); setOffset({ x: 0, y: 0 }); }

  // Styles (ไม่ใช้ Tailwind เพื่อเลี่ยงปัญหาคลาส)
  const S = {
    wrap: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,                 // สูงกว่าทุกชั้นแน่นอน
      pointerEvents: "auto",
    },
    backdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.92)",
    },
    stage: {
      position: "fixed",
      inset: 0,
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
    },
    img: {
      maxWidth: "95vw",
      maxHeight: "85vh",
      userSelect: "none",
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
      cursor: scale > 1 ? "grab" : "auto",
    },
    // Controls (ใช้ position:fixed เพื่อหลุดจาก stacking context ใดๆ)
    close: {
      position: "fixed",
      top: 16,
      right: 16,
      background: "#fff",
      color: "#000",
      border: "none",
      borderRadius: 10,
      padding: "6px 10px",
      cursor: "pointer",
      zIndex: 10001,
    },
    left: {
      position: "fixed",
      top: "50%",
      left: 16,
      transform: "translateY(-50%)",
      background: "rgba(255,255,255,.14)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 12px",
      cursor: "pointer",
      zIndex: 10001,
    },
    right: {
      position: "fixed",
      top: "50%",
      right: 16,
      transform: "translateY(-50%)",
      background: "rgba(255,255,255,.14)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 12px",
      cursor: "pointer",
      zIndex: 10001,
    },
    toolbar: {
      position: "fixed",
      left: "50%",
      bottom: 16,
      transform: "translateX(-50%)",
      display: "flex",
      gap: 8,
      alignItems: "center",
      color: "#fff",
      zIndex: 10001,
    },
    toolBtn: {
      background: "rgba(255,255,255,.14)",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "6px 10px",
      cursor: "pointer",
    },
    hint: { opacity: 0.85, fontSize: 12, marginLeft: 6 },
  };

  const node = (
    <div style={S.wrap}>
      {/* คลิกพื้นดำเพื่อปิด */}
      <div style={S.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} />

      {/* ปุ่มควบคุม (fixed + zIndex สูง) */}
      <button type="button" style={S.close} onClick={onClose}>Close</button>
      <button type="button" style={S.left}  onClick={() => setI((p)=> (p-1+images.length)%images.length)}>&larr;</button>
      <button type="button" style={S.right} onClick={() => setI((p)=> (p+1)%images.length)}>&rarr;</button>

      {/* เวทีแสดงภาพ (รับ drag/zoom) */}
      <div style={S.stage} onWheel={wheel}>
        <img
          src={images[i]}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          style={S.img}
          alt=""
        />
      </div>

      {/* แถบเครื่องมือ */}
      <div style={S.toolbar}>
        <button type="button" style={S.toolBtn} onClick={()=> setScale((s)=> Math.min(5, s+0.2))}>Zoom +</button>
        <button type="button" style={S.toolBtn} onClick={()=> setScale((s)=> Math.max(1, s-0.2))}>Zoom -</button>
        <button type="button" style={S.toolBtn} onClick={resetView}>Reset</button>
        <span style={S.hint}>Scroll = zoom, drag = pan, Esc = close</span>
      </div>
    </div>
  );

  // เรนเดอร์เข้า document.body เพื่อหลุดจาก modal/overflow/stacking เดิมทั้งหมด
  return createPortal(node, document.body);
}
