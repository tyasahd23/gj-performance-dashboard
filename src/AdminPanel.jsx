import { useState, useEffect } from "react"
import { supabase } from "./supabase"

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_BY_LEVEL = {
  1: ["GJ"],
  2: ["GJ"],
  3: ["POD Lead", "ID", "SE", "AGJ Coach", "Practice"],
  4: ["STEM Lead", "ID Lead", "SE Lead", "Science Lead", "Practice Lead", "Design & Marketing"],
}

const LEVEL_STYLE = {
  1: { background: "#fef3c7", color: "#92400e" },
  2: { background: "#fef3c7", color: "#92400e" },
  3: { background: "#dcfce7", color: "#15803d" },
  4: { background: "#dbeafe", color: "#1e40af" },
}

// ─── Badge components ─────────────────────────────────────────────────────────
function LvlBadge({ level }) {
  if (!level) return <span style={emptyBadge}>—</span>
  const s = LEVEL_STYLE[level] ?? {}
  return <span style={{ ...pill, ...s }}>L{level}</span>
}
function RolBadge({ role, level }) {
  if (!role) return <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
  const s = LEVEL_STYLE[level] ?? {}
  return <span style={{ ...pill, ...s }}>{role}</span>
}
function PodBadge({ pod }) {
  if (!pod) return <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
  return <span style={{ ...pill, background: "#eff6ff", color: "#2563eb" }}>{pod}</span>
}
const pill      = { fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 500, display: "inline-block" }
const emptyBadge = { ...pill, background: "#f1f5f9", color: "#94a3b8" }

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 32 }) {
  const [err, setErr] = useState(false)
  const initials = (user.nick_name || user.full_name || "?")
    .replace(/^Kak\s+/i, "").slice(0, 2).toUpperCase()
  const s = LEVEL_STYLE[user.level] ?? { background: "#e2e8f0", color: "#475569" }
  if (user.url_photo && !err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
        <img src={user.url_photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          onError={() => setErr(true)} />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: s.background, color: s.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 600
    }}>{initials}</div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ user, allUsers, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({
    level:         user.level         ?? "",
    role:          user.role          ?? "",
    main_pod:      user.main_pod      ?? "",
    manager_email: user.direct_manager_email ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }
  function handleLevel(v) { set("level", v); if (!ROLE_BY_LEVEL[parseInt(v)]?.includes(form.role)) set("role", "") }

  async function handleSave() {
    if (!form.level || !form.role || !form.main_pod) {
      setError("Level, role, and main pod are required."); return
    }
    setSaving(true); setError(null)
    try {
      // Resolve manager
      let managerId = null
      if (form.manager_email) {
        const { data: mgr } = await supabase.from("v_users_full").select("id").eq("email", form.manager_email).single()
        managerId = mgr?.id ?? null
      }

      // Upsert user_profiles
      const { error: e } = await supabase.from("user_profiles").upsert({
        user_id: user.id, level: parseInt(form.level), role: form.role,
        main_pod: form.main_pod, direct_manager_id: managerId, updated_by: currentUserId
      }, { onConflict: "user_id" })
      if (e) throw e

      onSaved(); onClose()
    } catch (e) {
      setError(e.message || "Failed to save.")
    } finally { setSaving(false) }
  }

  const roleOpts = form.level ? (ROLE_BY_LEVEL[parseInt(form.level)] ?? []) : []
  const managerOpts = allUsers.filter(u => u.id !== user.id)

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={mHeaderStyle}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Edit User — {user.nick_name || user.full_name}</span>
          <button style={xBtn} onClick={onClose}>✕</button>
        </div>
        <div style={mBodyStyle}>
          <div style={row2}>
            <Field label="Nickname">
              <Input value={user.nick_name ?? ""} disabled />
            </Field>
            <Field label="Full Name">
              <Input value={user.full_name ?? ""} disabled />
            </Field>
          </div>
          <Field label="CoLearn Email">
            <Input value={user.email} disabled />
          </Field>
          <div style={row2}>
            <Field label="Level *">
              <select value={form.level} onChange={e => handleLevel(e.target.value)} style={sel}>
                <option value="">Select level...</option>
                {[1,2,3,4].map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </Field>
            <Field label="Role *">
              <select value={form.role} onChange={e => set("role", e.target.value)} style={{ ...sel, opacity: !form.level ? 0.5 : 1 }} disabled={!form.level}>
                <option value="">Select role...</option>
                {roleOpts.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </div>
          <div style={row2}>
            <Field label="Main Pod *">
              <select value={form.main_pod} onChange={e => set("main_pod", e.target.value)} style={sel}>
                <option value="">Select pod...</option>
                <optgroup label="SD">{["Grade 4","Grade 5","Grade 6"].map(p=><option key={p}>{p}</option>)}</optgroup>
                <optgroup label="SMP">{["Grade 7","Grade 8","Grade 9"].map(p=><option key={p}>{p}</option>)}</optgroup>
                <optgroup label="SMA">{["Grade 10","Grade 11","Grade 12"].map(p=><option key={p}>{p}</option>)}</optgroup>
                <optgroup label="Science"><option>Science</option></optgroup>
              </select>
            </Field>
            <Field label="Direct Manager">
              <ManagerCombobox value={form.manager_email} onChange={v => set("manager_email", v)} options={managerOpts} />
            </Field>
          </div>
          {error && <div style={errBox}>{error}</div>}
        </div>
        <div style={mFooterStyle}>
          <button style={btnGhost} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Shared form helpers ──────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "#64748b", textAlign: "left" }}>{label}</label>
      {children}
    </div>
  )
}
function Input({ value, onChange, placeholder, disabled }) {
  return (
    <input
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...sel, cursor: disabled ? "not-allowed" : "text", background: disabled ? "#f8fafc" : "white", color: disabled ? "#94a3b8" : "#1e293b" }}
    />
  )
}
function ManagerCombobox({ value, onChange, options }) {
  const [inputVal, setInputVal] = useState(() => {
    const s = options.find(u => u.email === value)
    return s ? (s.nick_name || s.full_name) : ""
  })
  const [query, setQuery]   = useState("")
  const [open,  setOpen]    = useState(false)

  useEffect(() => {
    const s = options.find(u => u.email === value)
    setInputVal(s ? (s.nick_name || s.full_name) : "")
    setQuery("")
  }, [value, options])

  const filtered = query.trim().length > 0
    ? options.filter(u => {
        const q = query.toLowerCase()
        return (u.nick_name || "").toLowerCase().includes(q)
          || (u.full_name  || "").toLowerCase().includes(q)
          || (u.email      || "").toLowerCase().includes(q)
      }).slice(0, 10)
    : []

  function handleInput(e) {
    const v = e.target.value
    setInputVal(v); setQuery(v); setOpen(v.length > 0)
  }
  function handleSelect(u) {
    onChange(u.email)
    setInputVal(u.nick_name || u.full_name)
    setQuery(""); setOpen(false)
  }
  function handleClear() {
    onChange(""); setInputVal(""); setQuery(""); setOpen(false)
  }
  function handleBlur() {
    setTimeout(() => {
      setOpen(false)
      const s = options.find(u => u.email === value)
      setInputVal(s ? (s.nick_name || s.full_name) : "")
      setQuery("")
    }, 150)
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={inputVal}
          onChange={handleInput}
          onBlur={handleBlur}
          onFocus={() => { if (query.length > 0) setOpen(true) }}
          placeholder="Type name or email..."
          style={{ ...sel, paddingRight: value ? 28 : 10 }}
        />
        {value && (
          <button type="button" onMouseDown={handleClear} style={{
            position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "#94a3b8", fontSize: 11, padding: 2, lineHeight: 1
          }}>✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "white", border: "0.5px solid #e2e8f0", borderRadius: 7,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", marginTop: 2,
          maxHeight: 180, overflowY: "auto"
        }}>
          {filtered.map(u => (
            <div key={u.id} onMouseDown={() => handleSelect(u)}
              style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12, borderBottom: "0.5px solid #f8fafc" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <div style={{ fontWeight: 500, color: "#1e293b" }}>{u.nick_name || u.full_name}</div>
              <div style={{ color: "#94a3b8", fontSize: 11 }}>{u.email}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const sel = {
  width: "100%", padding: "7px 10px", fontSize: 12,
  border: "0.5px solid #e2e8f0", borderRadius: 7,
  background: "white", fontFamily: "inherit", color: "#1e293b",
  outline: "none",
}
const row2        = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }
const backdropStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: 20
}
const modalStyle  = {
  background: "white", borderRadius: 14, width: "100%", maxWidth: 520,
  maxHeight: "85vh", overflowY: "auto",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)"
}
const mHeaderStyle = {
  padding: "16px 18px", borderBottom: "0.5px solid #f1f5f9",
  display: "flex", alignItems: "center", justifyContent: "space-between"
}
const mBodyStyle   = { padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }
const mFooterStyle = {
  padding: "12px 18px", borderTop: "0.5px solid #f1f5f9",
  display: "flex", justifyContent: "flex-end", gap: 8
}
const xBtn        = { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#94a3b8", padding: 4 }
const btnGhost    = { background: "#f1f5f9", color: "#475569", border: "none", padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }
const btnPrimary  = { background: "#2563eb", color: "white", border: "none", padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }
const errBox      = { fontSize: 12, color: "#dc2626", background: "#fee2e2", borderRadius: 6, padding: "8px 10px" }

// ─── Admin Panel (main) ───────────────────────────────────────────────────────
export default function AdminPanel({ currentUser }) {
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [search,      setSearch]      = useState("")
  const [filterLevel, setFilterLevel] = useState("")
  const [filterPod,   setFilterPod]   = useState("")
  const [editUser,    setEditUser]    = useState(null)
  const [page,        setPage]        = useState(1)
  const PAGE_SIZE = 10

  async function fetchUsers() {
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from("v_users_full").select("*").order("full_name")
    if (err) setError("Failed to load: " + err.message)
    else setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (u.full_name  || "").toLowerCase().includes(q) ||
      (u.nick_name  || "").toLowerCase().includes(q) ||
      (u.email      || "").toLowerCase().includes(q) ||
      (u.role       || "").toLowerCase().includes(q)
    const matchLevel = !filterLevel || String(u.level) === filterLevel
    const matchPod   = !filterPod   || (u.main_pod || "") === filterPod
    return matchSearch && matchLevel && matchPod
  })

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const pageRows    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset ke halaman 1 saat filter berubah
  function handleSearch(v)      { setSearch(v);      setPage(1) }
  function handleFilterLevel(v) { setFilterLevel(v); setPage(1) }
  function handleFilterPod(v)   { setFilterPod(v);   setPage(1) }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Modals */}
      {editUser   && <EditModal  user={editUser}  allUsers={users} currentUserId={currentUser?.id} onClose={() => setEditUser(null)}  onSaved={fetchUsers} />}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>User Management</span>
          <span style={{ fontSize: 11, background: "#e2e8f0", color: "#475569", padding: "2px 8px", borderRadius: 20 }}>
            {users.length} users
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div className="sidebar-search-wrap" style={{ width: 220 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "#94a3b8" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input className="sidebar-search" placeholder="Search name or email..."
              value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          {/* Filter level */}
          <select value={filterLevel} onChange={e => handleFilterLevel(e.target.value)}
            style={{ ...sel, width: "auto", padding: "5px 8px", fontSize: 11 }}>
            <option value="">All levels</option>
            {[1,2,3,4].map(l => <option key={l} value={l}>Level {l}</option>)}
          </select>
          {/* Filter pod */}
          <select value={filterPod} onChange={e => handleFilterPod(e.target.value)}
            style={{ ...sel, width: "auto", padding: "5px 8px", fontSize: 11 }}>
            <option value="">All pods</option>
            {["Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12","Science"].map(p =>
              <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="loading" style={{ padding: "40px 0" }}>Loading user data...</div>}
      {error   && <div style={{ fontSize: 12, color: "#dc2626", padding: "12px 0" }}>{error}</div>}

      {!loading && !error && (
        <div style={{ background: "white", border: "0.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left",  padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "22%" }}>USER</th>
                <th style={{ textAlign: "left",  padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "7%"  }}>LEVEL</th>
                <th style={{ textAlign: "left",  padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "12%" }}>ROLE</th>
                <th style={{ textAlign: "left",  padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "10%" }}>POD</th>
                <th style={{ textAlign: "left",  padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "24%" }}>EMAIL</th>
                <th style={{ textAlign: "left",  padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "13%" }}>MANAGER</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 400, borderBottom: "0.5px solid #f1f5f9", width: "12%" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "24px 0" }}>No matching users found.</td></tr>
              )}
              {pageRows.map(u => (
                <tr key={u.id} className="row">
                  <td style={{ textAlign: "left", verticalAlign: "middle", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar user={u} size={30} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{u.nick_name || u.full_name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.full_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "left", verticalAlign: "middle", padding: "10px 12px" }}><LvlBadge level={u.level} /></td>
                  <td style={{ textAlign: "left", verticalAlign: "middle", padding: "10px 12px" }}><RolBadge role={u.role} level={u.level} /></td>
                  <td style={{ textAlign: "left", verticalAlign: "middle", padding: "10px 12px" }}><PodBadge pod={u.main_pod} /></td>
                  <td style={{ textAlign: "left", verticalAlign: "middle", padding: "10px 12px", fontSize: 12, color: "#64748b" }}>{u.email}</td>
                  <td style={{ textAlign: "left", verticalAlign: "middle", padding: "10px 12px", fontSize: 12, color: u.direct_manager_nama ? "#1e293b" : "#94a3b8" }}>
                    {u.direct_manager_nama || "—"}
                  </td>
                  <td style={{ textAlign: "right", verticalAlign: "middle", padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditUser(u)} style={btnEdit}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderTop: "0.5px solid #f1f5f9" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} users
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{ ...btnEdit, opacity: safePage === 1 ? 0.4 : 1, padding: "4px 10px" }}
                >← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...")
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} style={{ padding: "4px 6px", fontSize: 12, color: "#94a3b8" }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{
                          ...btnEdit,
                          padding: "4px 10px",
                          background:  p === safePage ? "#dbeafe" : "#f8fafc",
                          color:       p === safePage ? "#1e40af" : "#475569",
                          fontWeight:  p === safePage ? 600 : 400,
                          border:      p === safePage ? "0.5px solid #bfdbfe" : "0.5px solid #e2e8f0",
                        }}
                      >{p}</button>
                    )
                  )
                }
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{ ...btnEdit, opacity: safePage === totalPages ? 0.4 : 1, padding: "4px 10px" }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const btnEdit  = { background: "#f8fafc", color: "#475569", border: "0.5px solid #e2e8f0", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }
