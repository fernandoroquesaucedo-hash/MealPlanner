import { useState, useEffect, useCallback } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

/* ─── Constants ─── */
const GROUPS = ["Granos", "Proteína", "Verdura", "Fruta", "Lácteos", "Oleaginosa"];
const GROUP_COLORS = {
  Granos: { bg: "#FFF3E0", text: "#E65100", dot: "#FF9800" },
  Proteína: { bg: "#FFEBEE", text: "#C62828", dot: "#EF5350" },
  Verdura: { bg: "#E8F5E9", text: "#2E7D32", dot: "#4CAF50" },
  Fruta: { bg: "#FCE4EC", text: "#AD1457", dot: "#E91E63" },
  Lácteos: { bg: "#E8EAF6", text: "#283593", dot: "#5C6BC0" },
  Oleaginosa: { bg: "#FFF8E1", text: "#F57F17", dot: "#FFC107" },
};
const MEAL_LABELS = { desayuno: "🌅 Desayuno", colAM: "🍎 Col. AM", comida: "🍽️ Comida", colPM: "🥒 Col. PM", cena: "🌙 Cena" };
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const EMPTY_MENU = {
  A_desayuno: null, A_colAM: null, A_colPM: null, A_cena: null,
  B_desayuno: null, B_colAM: null, B_colPM: null, B_cena: null,
  D_desayuno: null, D_colAM: null, D_colPM: null, D_cena: null,
  comida_0: null, comida_1: null, comida_2: null, comida_3: null, comida_4: null, comida_5: null, comida_6: null,
};

function getDayMealKeys(dayIdx) {
  const block = dayIdx < 3 ? "A" : dayIdx < 6 ? "B" : "D";
  return { desayuno: `${block}_desayuno`, colAM: `${block}_colAM`, comida: `comida_${dayIdx}`, colPM: `${block}_colPM`, cena: `${block}_cena` };
}

function calcDayTotals(dayIdx, menu, platillos) {
  const keys = getDayMealKeys(dayIdx);
  const totals = { Granos: 0, Fruta: 0, Proteína: 0, Lácteos: 0, Verdura: 0, Oleaginosa: 0 };
  Object.values(keys).forEach((slotKey) => {
    const pId = menu[slotKey];
    const p = platillos.find((x) => x.id === pId);
    if (!p) return;
    p.items.forEach((it) => { if (totals[it.grupo] !== undefined) totals[it.grupo] += it.porciones; });
  });
  return totals;
}

/* ─── Small Components ─── */
function Badge({ grupo }) {
  const c = GROUP_COLORS[grupo] || { bg: "#F5F5F5", text: "#666", dot: "#999" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: c.bg, color: c.text, whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />{grupo}
    </span>
  );
}

function Btn({ children, onClick, variant = "primary", style: s = {}, disabled }) {
  const base = { border: "none", borderRadius: 10, cursor: disabled ? "default" : "pointer", fontWeight: 600, fontSize: 13, transition: "all .15s", opacity: disabled ? 0.4 : 1 };
  const vars = {
    primary: { background: "#5D4037", color: "#fff", padding: "10px 18px" },
    secondary: { background: "#EFEBE9", color: "#5D4037", padding: "8px 14px" },
    danger: { background: "#FFEBEE", color: "#C62828", padding: "8px 14px" },
    ghost: { background: "transparent", color: "#8D6E63", padding: "6px 10px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...vars[variant], ...s }}>{children}</button>;
}

/* ─── Login Screen ─── */
function LoginScreen({ onLogin, loading }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #5D4037 0%, #795548 50%, #FAF6F1 100%)", padding: 24 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🥑</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 4 }}>NutriLiz</div>
      <div style={{ fontSize: 14, color: "#D7CCC8", marginBottom: 40, textAlign: "center" }}>Planificador de menú semanal</div>
      <button
        onClick={onLogin} disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 28px", border: "none", borderRadius: 14,
          background: "#fff", color: "#3E2723", fontSize: 15, fontWeight: 600,
          cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 20px rgba(0,0,0,.15)",
          opacity: loading ? 0.7 : 1, transition: "all .15s",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        {loading ? "Conectando..." : "Entrar con Google"}
      </button>
      <div style={{ fontSize: 12, color: "#BCAAA4", marginTop: 16, textAlign: "center", maxWidth: 280 }}>
        Tus datos se sincronizan entre todos tus dispositivos
      </div>
    </div>
  );
}

/* ─── Create/Edit Platillo Modal ─── */
function PlatilloForm({ initial, onSave, onCancel }) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [items, setItems] = useState(initial?.items || [{ nombre: "", grupo: "Granos", porciones: 1 }]);

  const updateItem = (i, field, val) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [field]: field === "porciones" ? Math.max(0, Number(val) || 0) : val };
    setItems(copy);
  };
  const addItem = () => setItems([...items, { nombre: "", grupo: "Granos", porciones: 1 }]);
  const removeItem = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));
  const canSave = nombre.trim() && items.some((it) => it.nombre.trim());

  const handleSave = () => {
    const cleaned = items.filter((it) => it.nombre.trim());
    if (!nombre.trim() || cleaned.length === 0) return;
    onSave({ nombre: nombre.trim(), items: cleaned.map((it) => ({ ...it, porciones: it.grupo === "Verdura" ? 0 : it.porciones })) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} onClick={onCancel} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto", padding: "20px 20px env(safe-area-inset-bottom, 20px)", WebkitOverflowScrolling: "touch" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#D7CCC8", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#3E2723", marginBottom: 16 }}>
          {initial ? "✏️ Editar platillo" : "🍳 Nuevo platillo"}
        </div>
        <input
          placeholder="Nombre del platillo (ej: Huevo con nopales)"
          value={nombre} onChange={(e) => setNombre(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", border: "2px solid #E8E0D8", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#3E2723", outline: "none", boxSizing: "border-box", marginBottom: 16, WebkitAppearance: "none" }}
        />
        <div style={{ fontSize: 12, fontWeight: 600, color: "#8D6E63", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Ingredientes</div>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            <input placeholder="Ingrediente..." value={it.nombre} onChange={(e) => updateItem(i, "nombre", e.target.value)}
              style={{ flex: 1, padding: "8px 10px", border: "1px solid #E8E0D8", borderRadius: 8, fontSize: 13, color: "#4E342E", outline: "none", minWidth: 0, WebkitAppearance: "none" }} />
            <select value={it.grupo} onChange={(e) => updateItem(i, "grupo", e.target.value)}
              style={{ padding: "8px 4px", border: "1px solid #E8E0D8", borderRadius: 8, fontSize: 12, color: "#5D4037", background: GROUP_COLORS[it.grupo]?.bg || "#fff", fontWeight: 600, outline: "none" }}>
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {it.grupo !== "Verdura" ? (
              <input type="number" inputMode="decimal" min="0" step="0.5" value={it.porciones} onChange={(e) => updateItem(i, "porciones", e.target.value)}
                style={{ width: 48, padding: "8px 4px", border: "1px solid #E8E0D8", borderRadius: 8, fontSize: 13, textAlign: "center", color: "#5D4037", outline: "none", WebkitAppearance: "none" }} />
            ) : (
              <span style={{ width: 48, textAlign: "center", fontSize: 11, color: "#A5D6A7", fontWeight: 600 }}>libre</span>
            )}
            <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#BCAAA4", padding: "2px 4px" }}>×</button>
          </div>
        ))}
        <button onClick={addItem} style={{ background: "none", border: "1px dashed #D7CCC8", borderRadius: 8, padding: "10px 12px", width: "100%", fontSize: 13, color: "#8D6E63", cursor: "pointer", marginBottom: 20 }}>
          + Agregar ingrediente
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={onCancel} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={!canSave} style={{ flex: 1 }}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── Platillo Picker Modal ─── */
function PlatilloPicker({ platillos, currentId, onSelect, onClear, onClose, slotLabel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "70vh", overflow: "auto", padding: "20px 20px env(safe-area-inset-bottom, 20px)", WebkitOverflowScrolling: "touch" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#D7CCC8", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#3E2723", marginBottom: 4 }}>Asignar platillo</div>
        <div style={{ fontSize: 12, color: "#8D6E63", marginBottom: 16 }}>{slotLabel}</div>
        {currentId && (
          <button onClick={onClear} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", marginBottom: 8, border: "1px solid #FFCDD2", borderRadius: 10, background: "#FFF5F5", cursor: "pointer", fontSize: 13, color: "#C62828", fontWeight: 600, textAlign: "left" }}>
            ✕ Vaciar este espacio
          </button>
        )}
        {platillos.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, color: "#BCAAA4", fontSize: 13 }}>Aún no tienes platillos. Créalos en la pestaña "Platillos".</div>
        )}
        {platillos.map((p) => {
          const isCurrent = p.id === currentId;
          const summary = p.items.filter((it) => it.grupo !== "Verdura").map((it) => `${it.porciones} ${it.grupo}`).join(" · ");
          return (
            <button key={p.id} onClick={() => onSelect(p.id)} style={{
              display: "block", width: "100%", padding: "12px 14px", marginBottom: 6,
              border: isCurrent ? "2px solid #5D4037" : "1px solid #E8E0D8",
              borderRadius: 10, background: isCurrent ? "#EFEBE9" : "#fff", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#3E2723" }}>{p.nombre}</div>
              <div style={{ fontSize: 11, color: "#A1887F", marginTop: 3 }}>{summary || "Solo verduras"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Menu Slot ─── */
function MenuSlot({ slotKey, label, platillo, onDrop, onClick, dragOver, setDragOver }) {
  const isOver = dragOver === slotKey;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(slotKey); }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) onDrop(slotKey, id); }}
      onClick={() => onClick(slotKey)}
      style={{
        padding: platillo ? "10px 12px" : "14px 12px",
        border: isOver ? "2px dashed #FF9800" : platillo ? "1px solid #E8E0D8" : "2px dashed #D7CCC8",
        borderRadius: 10, cursor: "pointer",
        background: isOver ? "#FFF8E1" : platillo ? "#fff" : "#FAFAFA",
        transition: "all .15s", minHeight: 44,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#A1887F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: platillo ? 4 : 0 }}>{label}</div>
      {platillo ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#3E2723" }}>{platillo.nombre}</div>
      ) : (
        <div style={{ fontSize: 12, color: "#BCAAA4", fontStyle: "italic" }}>Toca para asignar</div>
      )}
    </div>
  );
}

/* ─── Draggable Chip ─── */
function DragChip({ platillo }) {
  return (
    <div draggable="true" onDragStart={(e) => { e.dataTransfer.setData("text/plain", platillo.id); e.dataTransfer.effectAllowed = "copy"; }}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1px solid #E8E0D8", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#3E2723", cursor: "grab", whiteSpace: "nowrap", userSelect: "none", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <span style={{ fontSize: 14, color: "#BCAAA4" }}>≡</span>
      {platillo.nombre}
    </div>
  );
}

/* ─── Validation Bar ─── */
function ValidationBar({ totals }) {
  const entries = [
    { key: "Granos", label: "Granos", target: 6, color: "#FF9800" },
    { key: "Fruta", label: "Frutas", target: 3, color: "#E91E63" },
    { key: "Proteína", label: "Proteínas", target: 6, color: "#EF5350" },
    { key: "Lácteos", label: "Lácteos", target: 0.5, color: "#5C6BC0" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
      {entries.map((e) => {
        const val = totals[e.key] || 0;
        const ok = val >= e.target;
        const over = val > e.target;
        return (
          <div key={e.key} style={{ textAlign: "center", padding: "8px 4px", background: ok ? (over ? "#FFF3E0" : "#F1F8E9") : "#FAFAFA", borderRadius: 10, border: `1px solid ${ok ? (over ? "#FFE0B2" : "#C8E6C9") : "#EEEEEE"}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ok ? (over ? "#E65100" : "#2E7D32") : "#BCAAA4" }}>
              {val}<span style={{ fontSize: 11, fontWeight: 500 }}>/{e.target}</span>
            </div>
            <div style={{ fontSize: 10, color: "#8D6E63" }}>{e.label}</div>
            {ok && !over && <span style={{ fontSize: 9, color: "#4CAF50" }}>✓</span>}
            {over && <span style={{ fontSize: 9, color: "#E65100" }}>⚠ extra</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sync indicator ─── */
function SyncBadge({ status }) {
  const map = {
    synced: { color: "#4CAF50", bg: "#E8F5E9", text: "Sincronizado ✓" },
    saving: { color: "#FF9800", bg: "#FFF3E0", text: "Guardando..." },
    offline: { color: "#9E9E9E", bg: "#F5F5F5", text: "Sin conexión" },
    error: { color: "#C62828", bg: "#FFEBEE", text: "Error de sync" },
  };
  const s = map[status] || map.synced;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, padding: "2px 8px", borderRadius: 10 }}>
      {s.text}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ─── MAIN APP ─── */
/* ═══════════════════════════════════════════════════════════ */
export default function App() {
  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  // Data
  const [tab, setTab] = useState("platillos");
  const [platillos, setPlatillos] = useState([]);
  const [menu, setMenu] = useState({ ...EMPTY_MENU });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingPlatillo, setEditingPlatillo] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [viewDay, setViewDay] = useState(0);

  // Save timer ref
  const [saveTimer, setSaveTimer] = useState(null);

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Load data from Firestore when user logs in ──
  useEffect(() => {
    if (!user) { setDataLoaded(false); return; }

    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.platillos) setPlatillos(data.platillos);
        if (data.menu) setMenu((prev) => ({ ...EMPTY_MENU, ...data.menu }));
      }
      setDataLoaded(true);
      setSyncStatus("synced");
    }, (err) => {
      console.error("Firestore listen error:", err);
      setSyncStatus("error");
      setDataLoaded(true);
    });

    return unsub;
  }, [user]);

  // ── Save to Firestore (debounced) ──
  const saveToFirestore = useCallback((newPlatillos, newMenu) => {
    if (!user || !dataLoaded) return;
    setSyncStatus("saving");

    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "users", user.uid), {
          platillos: newPlatillos,
          menu: newMenu,
          updatedAt: new Date().toISOString(),
          email: user.email,
        }, { merge: true });
        setSyncStatus("synced");
      } catch (err) {
        console.error("Save error:", err);
        setSyncStatus("error");
      }
    }, 800);
    setSaveTimer(timer);
  }, [user, dataLoaded, saveTimer]);

  // ── Wrapped setters that also sync ──
  const updatePlatillos = (updater) => {
    setPlatillos((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToFirestore(next, menu);
      return next;
    });
  };

  const updateMenu = (updater) => {
    setMenu((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToFirestore(platillos, next);
      return next;
    });
  };

  // ── Auth actions ──
  const handleLogin = async () => {
    setLoginLoading(true);
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { console.error("Login error:", err); }
    setLoginLoading(false);
  };
  const handleLogout = async () => {
    await signOut(auth);
    setPlatillos([]);
    setMenu({ ...EMPTY_MENU });
  };

  const getPlatillo = useCallback((id) => platillos.find((p) => p.id === id) || null, [platillos]);

  // ── Platillo CRUD ──
  const savePlatillo = (data) => {
    if (editingPlatillo) {
      updatePlatillos((prev) => prev.map((p) => p.id === editingPlatillo.id ? { ...p, ...data } : p));
    } else {
      updatePlatillos((prev) => [...prev, { id: `p_${Date.now()}`, ...data }]);
    }
    setShowForm(false);
    setEditingPlatillo(null);
  };

  const deletePlatillo = (id) => {
    updatePlatillos((prev) => prev.filter((p) => p.id !== id));
    updateMenu((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((k) => { if (copy[k] === id) copy[k] = null; });
      return copy;
    });
  };

  const assignSlot = (slotKey, platilloId) => updateMenu((prev) => ({ ...prev, [slotKey]: platilloId }));
  const clearSlot = (slotKey) => updateMenu((prev) => ({ ...prev, [slotKey]: null }));

  const getSlotLabel = (slotKey) => {
    const map = {
      A_desayuno: "🌅 Desayuno (Bloque A)", A_colAM: "🍎 Col. AM (Bloque A)", A_colPM: "🥒 Col. PM (Bloque A)", A_cena: "🌙 Cena (Bloque A)",
      B_desayuno: "🌅 Desayuno (Bloque B)", B_colAM: "🍎 Col. AM (Bloque B)", B_colPM: "🥒 Col. PM (Bloque B)", B_cena: "🌙 Cena (Bloque B)",
      D_desayuno: "🌅 Desayuno (Domingo)", D_colAM: "🍎 Col. AM (Domingo)", D_colPM: "🥒 Col. PM (Domingo)", D_cena: "🌙 Cena (Domingo)",
    };
    if (map[slotKey]) return map[slotKey];
    if (slotKey.startsWith("comida_")) return `🍽️ Comida — ${DAYS_FULL[parseInt(slotKey.split("_")[1])]}`;
    return slotKey;
  };

  const renderSlot = (key, label) => (
    <MenuSlot key={key} slotKey={key} label={label} platillo={getPlatillo(menu[key])} onDrop={assignSlot} onClick={(k) => setPickerSlot(k)} dragOver={dragOver} setDragOver={setDragOver} />
  );

  // ── Loading / Login screens ──
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF6F1" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🥑</div>
          <div style={{ fontSize: 14, color: "#8D6E63" }}>Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={loginLoading} />;
  }

  if (!dataLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF6F1" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🥑</div>
          <div style={{ fontSize: 14, color: "#8D6E63" }}>Cargando tus datos...</div>
        </div>
      </div>
    );
  }

  // ═══ MAIN RENDER ═══
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #FAF6F1 0%, #FFF 40%)", fontFamily: "'Segoe UI', -apple-system, system-ui, sans-serif", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #5D4037 0%, #795548 100%)", padding: "env(safe-area-inset-top, 12px) 16px 14px", color: "#fff" }}>
        <div style={{ paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>🥑 NutriLiz</div>
            <div style={{ fontSize: 11, color: "#D7CCC8", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
              {user.displayName || user.email}
              <SyncBadge status={syncStatus} />
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, color: "#D7CCC8", cursor: "pointer", fontWeight: 600 }}>
            Salir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #E8E0D8", padding: "0 8px", position: "sticky", top: 0, zIndex: 50 }}>
        {[{ k: "platillos", l: "🍳 Platillos" }, { k: "menu", l: "📋 Menú" }, { k: "semana", l: "📅 Semana" }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, padding: "12px 8px", border: "none", background: "transparent",
            borderBottom: tab === t.k ? "3px solid #5D4037" : "3px solid transparent",
            fontSize: 14, fontWeight: tab === t.k ? 700 : 500,
            color: tab === t.k ? "#5D4037" : "#A1887F", cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>

        {/* PLATILLOS TAB */}
        {tab === "platillos" && (
          <>
            <Btn onClick={() => { setEditingPlatillo(null); setShowForm(true); }} style={{ width: "100%", marginBottom: 16 }}>+ Crear nuevo platillo</Btn>
            {platillos.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#BCAAA4" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aún no tienes platillos</div>
                <div style={{ fontSize: 13 }}>Crea tu primer platillo con nombre e ingredientes</div>
              </div>
            )}
            {platillos.map((p) => (
              <div key={p.id} style={{ background: "#fff", border: "1px solid #E8E0D8", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#3E2723" }}>{p.nombre}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Btn variant="ghost" onClick={() => { setEditingPlatillo(p); setShowForm(true); }}>✏️</Btn>
                    <Btn variant="ghost" onClick={() => { if (confirm(`¿Eliminar "${p.nombre}"?`)) deletePlatillo(p.id); }}>🗑️</Btn>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {p.items.map((it, i) => <Badge key={i} grupo={it.grupo} />)}
                </div>
                {p.items.map((it, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#5D4037", padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
                    <span>{it.nombre}</span>
                    <span style={{ color: "#A1887F", fontSize: 12 }}>{it.grupo === "Verdura" ? "libre" : `${it.porciones} porc.`}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {/* MENÚ TAB */}
        {tab === "menu" && (
          <>
            {platillos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A1887F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Arrastra o toca un espacio para asignar</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
                  {platillos.map((p) => <DragChip key={p.id} platillo={p} />)}
                </div>
              </div>
            )}
            {platillos.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", background: "#FFF8E1", borderRadius: 12, border: "1px solid #FFE082", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#F57F17", fontWeight: 600 }}>Primero crea tus platillos en la pestaña "Platillos"</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1565C0" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1565C0" }}>Bloque A</span>
                <span style={{ fontSize: 11, color: "#90CAF9" }}>Lun – Mié</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {renderSlot("A_desayuno", "🌅 Desayuno")}{renderSlot("A_cena", "🌙 Cena")}
                {renderSlot("A_colAM", "🍎 Col. AM")}{renderSlot("A_colPM", "🥒 Col. PM")}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2E7D32" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#2E7D32" }}>Bloque B</span>
                <span style={{ fontSize: 11, color: "#A5D6A7" }}>Jue – Sáb</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {renderSlot("B_desayuno", "🌅 Desayuno")}{renderSlot("B_cena", "🌙 Cena")}
                {renderSlot("B_colAM", "🍎 Col. AM")}{renderSlot("B_colPM", "🥒 Col. PM")}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF8F00" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#FF8F00" }}>Domingo</span>
                <span style={{ fontSize: 11, color: "#FFE082" }}>Día flexible</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {renderSlot("D_desayuno", "🌅 Desayuno")}{renderSlot("D_cena", "🌙 Cena")}
                {renderSlot("D_colAM", "🍎 Col. AM")}{renderSlot("D_colPM", "🥒 Col. PM")}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#5D4037", marginBottom: 10 }}>
                🍽️ Comidas <span style={{ fontWeight: 400, fontSize: 12, color: "#A1887F" }}>una diferente cada día</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                {DAYS.map((d, i) => renderSlot(`comida_${i}`, `${DAYS_FULL[i]}`))}
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 8, paddingBottom: 20 }}>
              <Btn variant="danger" onClick={() => { if (confirm("¿Vaciar todo el menú?")) updateMenu({ ...EMPTY_MENU }); }}>Vaciar menú completo</Btn>
            </div>
          </>
        )}

        {/* SEMANA TAB */}
        {tab === "semana" && (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {DAYS.map((d, i) => {
                const sel = i === viewDay;
                const block = i < 3 ? "A" : i < 6 ? "B" : "D";
                const bc = block === "A" ? "#1565C0" : block === "B" ? "#2E7D32" : "#FF8F00";
                return (
                  <button key={d} onClick={() => setViewDay(i)} style={{
                    flex: 1, padding: "10px 2px", border: sel ? `2px solid ${bc}` : "2px solid transparent",
                    borderRadius: 12, cursor: "pointer", background: sel ? `${bc}11` : "#FAF6F1",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sel ? bc : "#8D6E63" }}>{d}</span>
                    <span style={{ fontSize: 9, color: sel ? bc : "#BCAAA4", fontWeight: 600 }}>{block === "A" ? "A" : block === "B" ? "B" : "🌟"}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom: 16 }}><ValidationBar totals={calcDayTotals(viewDay, menu, platillos)} /></div>
            {(() => {
              const keys = getDayMealKeys(viewDay);
              return ["desayuno", "colAM", "comida", "colPM", "cena"].map((mealType) => {
                const slotKey = keys[mealType];
                const p = getPlatillo(menu[slotKey]);
                return (
                  <div key={mealType} style={{ background: "#fff", borderRadius: 14, marginBottom: 10, border: "1px solid #E8E0D8", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#A1887F", marginBottom: 2 }}>{MEAL_LABELS[mealType]}</div>
                      {p ? (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#3E2723", marginBottom: 8 }}>{p.nombre}</div>
                          {p.items.map((it, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#4E342E", borderBottom: i < p.items.length - 1 ? "1px solid #FAF6F1" : "none" }}>
                              <span>{it.nombre}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11, color: "#A1887F" }}>{it.grupo === "Verdura" ? "libre" : `${it.porciones}`}</span>
                                <Badge grupo={it.grupo} />
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: "#BCAAA4", fontStyle: "italic", padding: "8px 0" }}>Sin asignar — ve a la pestaña Menú</div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
            <div style={{ background: "#E3F2FD", borderRadius: 12, padding: 14, marginTop: 4, display: "flex", gap: 10, alignItems: "center", border: "1px solid #BBDEFB" }}>
              <span style={{ fontSize: 24 }}>💧</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1565C0" }}>Hidratación</div>
                <div style={{ fontSize: 12, color: "#42A5F5" }}>Meta: 2–2.5 L de agua · 1–2 vasos con cada comida</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showForm && <PlatilloForm initial={editingPlatillo} onSave={savePlatillo} onCancel={() => { setShowForm(false); setEditingPlatillo(null); }} />}
      {pickerSlot && <PlatilloPicker platillos={platillos} currentId={menu[pickerSlot]} slotLabel={getSlotLabel(pickerSlot)} onSelect={(id) => { assignSlot(pickerSlot, id); setPickerSlot(null); }} onClear={() => { clearSlot(pickerSlot); setPickerSlot(null); }} onClose={() => setPickerSlot(null)} />}
    </div>
  );
}
