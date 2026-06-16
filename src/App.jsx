import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { auth } from "./firebase"
import { supabase } from "./supabase"
import Papa from "papaparse"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import Login from "./Login"
import Greeting from "./Greeting"
import AdminPanel from "./AdminPanel"
import "./App.css"

// ─── Access control ───────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAILS = new Set([
  "imam.fachrudin@colearn.id",
  "fatah.abdul@colearn.id",
  "anatasya.ellena@colearn.id",
  "ima.aruan@colearn.id",
  "tyas.ahadriansya@colearn.id",
])

const ADMIN_EMAILS = new Set([
  "tyas.ahadriansya@colearn.id",
  "imam.fachrudin@colearn.id",
  "fatah.abdul@colearn.id",
  "anatasya.ellena@colearn.id",
  "ima.aruan@colearn.id",
])

const CSV_STICKINESS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyJm_AxS2dzNaoV_ztNDX75aZ0h2Q9pws3QcKQQd13gJ-Rh2wd8W_nBAOzCzTLISNZ_uSRB1KBzHHu/pub?gid=0&single=true&output=csv"
const CSV_OBSERVASI =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyJm_AxS2dzNaoV_ztNDX75aZ0h2Q9pws3QcKQQd13gJ-Rh2wd8W_nBAOzCzTLISNZ_uSRB1KBzHHu/pub?gid=497343368&single=true&output=csv"
const CSV_CUTI =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyJm_AxS2dzNaoV_ztNDX75aZ0h2Q9pws3QcKQQd13gJ-Rh2wd8W_nBAOzCzTLISNZ_uSRB1KBzHHu/pub?gid=1751476240&single=true&output=csv"
const CSV_COACHING =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyJm_AxS2dzNaoV_ztNDX75aZ0h2Q9pws3QcKQQd13gJ-Rh2wd8W_nBAOzCzTLISNZ_uSRB1KBzHHu/pub?gid=1523639724&single=true&output=csv"
const CSV_ASSIGNMENT_OBSERVASI =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyJm_AxS2dzNaoV_ztNDX75aZ0h2Q9pws3QcKQQd13gJ-Rh2wd8W_nBAOzCzTLISNZ_uSRB1KBzHHu/pub?gid=1134271417&single=true&output=csv"
const CSV_NAMEMAP =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyJm_AxS2dzNaoV_ztNDX75aZ0h2Q9pws3QcKQQd13gJ-Rh2wd8W_nBAOzCzTLISNZ_uSRB1KBzHHu/pub?gid=1915278661&single=true&output=csv"

const BATAS_MAKS = 4

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatClassName(grade, slotName) {
  const slot = slotName.trim()
  if (slot.startsWith("Matematika")) {
    const num = slot.replace("Matematika ", "").trim()
    return `${grade} Mat ${num}`
  }
  if (slot.startsWith("IPA")) {
    const num = slot.replace("IPA ", "").trim()
    return `${grade} IPA ${num}`
  }
  return `${grade} ${slot}`
}
function classSortKey(name) {
  const match = name.match(/(\d+)\s+Mat\s+(\d+)/)
  if (!match) return 9999
  return parseInt(match[1]) * 1000 + parseInt(match[2])
}
function statusColor(status) {
  const s = status?.toUpperCase()
  if (s === "EXCEPTIONAL")   return "green"
  if (s === "ON AVERAGE")    return "orange"
  if (s === "BELOW AVERAGE") return "red"
  return ""
}
function statusBadge(status) {
  const s = status?.toUpperCase()
  if (s === "EXCEPTIONAL")   return <span className="badge b-ex">Exceptional</span>
  if (s === "ON AVERAGE")    return <span className="badge b-av">On average</span>
  if (s === "BELOW AVERAGE") return <span className="badge b-bw">Below avg</span>
  return                            <span className="badge b-av">{status}</span>
}
function barColor(status) {
  const s = status?.toUpperCase()
  if (s === "EXCEPTIONAL")   return "#16a34a"
  if (s === "ON AVERAGE")    return "#d97706"
  return "#dc2626"
}
function formatDate(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })
}

function computeStreak(history) {
  // history sorted oldest → newest; count consecutive BA from the end
  const reversed = [...history].reverse()
  let streak = 0
  for (const r of reversed) {
    if (r.status?.toUpperCase() === "BELOW AVERAGE") streak++
    else break
  }
  return streak
}

function weekSortKey(label) {
  const m = (label || "").match(/(\d+)/)
  return m ? parseInt(m[1]) : 0
}

// ─── Stickiness frontend filters ───────────────────────────────────────────────
function shouldExcludeSlot(slotName) {
  const s = (slotName || "").toLowerCase()
  return s.includes("matematika lanjut") || s.includes("fisika dan kimia")
}

function getWeekCutoff(courseGrade, slotName) {
  const grade = parseInt(courseGrade)
  const slot  = (slotName || "").toLowerCase()
  switch (grade) {
    case 4: case 5: case 7: case 8: case 10: case 11:
      return 22
    case 6:
      return slot.includes("persiapan smp") ? 22 : 16
    case 9:
      return slot.includes("persiapan sma") ? 22 : 16
    case 12:
      return 14
    default:
      return Infinity
  }
}

function applyStickinesFilters(classes) {
  return classes
    .filter((c) => !shouldExcludeSlot(c.slotName))
    .map((c) => {
      const cutoff = getWeekCutoff(c.courseGrade, c.slotName)
      return { ...c, history: c.history.filter((r) => weekSortKey(r.week) <= cutoff) }
    })
    .filter((c) => c.history.length > 0)
    .map((c) => {
      const last       = c.history[c.history.length - 1]
      const stickiness = Math.round(last.stickiness)
      const avg        = Math.round(last.dynAvg)
      return {
        ...c,
        latest: {
          stickiness,
          avg,
          deviation: stickiness - avg,
          status:    last.status,
        },
      }
    })
}

// ─── Data processors ──────────────────────────────────────────────────────────
function processStickiness(rows) {
  const byTeacher = {}
  rows.forEach((row) => {
    const teacher = (row["teacher_name"] || "").trim()
    if (!teacher) return
    const className = formatClassName(
      (row["course_grade"] || "").trim(),
      (row["slot_name"] || "").trim()
    )
    if (!byTeacher[teacher]) byTeacher[teacher] = {}
    if (!byTeacher[teacher][className]) byTeacher[teacher][className] = []
    byTeacher[teacher][className].push({
      date:        new Date(row["date"]),
      week:        (row["week_label"] || "").trim(),
      courseGrade: (row["course_grade"] || "").trim(),
      slotName:    (row["slot_name"] || "").trim(),
      stickiness:  parseFloat(row["stickiness"]) || 0,
      avg:         parseFloat(row["dynamic_avg"]) || 0,
      deviation:   parseFloat(row["deviation"]) || 0,
      status:      (row["status"] || "").trim(),
      isLatest:    (row["is_latest"] || "").trim() === "TRUE",
    })
  })
  const result = {}
  Object.entries(byTeacher).forEach(([teacher, classes]) => {
    result[teacher] = Object.entries(classes)
      .map(([className, records]) => {
        const sorted = [...records].sort((a, b) => weekSortKey(a.week) - weekSortKey(b.week))
        const latest = sorted.find((r) => r.isLatest) ?? sorted[sorted.length - 1]
        return {
          name:        className,
          courseGrade: records[0].courseGrade,
          slotName:    records[0].slotName,
          latest: {
            stickiness: Math.round(latest.stickiness),
            avg:        Math.round(latest.avg),
            deviation:  Math.round(latest.deviation),
            status:     latest.status,
          },
          history: sorted
            .filter((r) => weekSortKey(r.week) !== 2)
            .map((r) => ({
              week:       r.week,
              stickiness: parseFloat(r.stickiness.toFixed(1)),
              dynAvg:     parseFloat(r.avg.toFixed(1)),
              status:     r.status,
            })),
        }
      })
      .sort((a, b) => classSortKey(a.name) - classSortKey(b.name))
  })
  return result
}

function processObservasi(rows, nameMap = {}) {
  const byTeacher = {}
  rows.forEach((row) => {
    const raw     = (row["teacher_name"] || "").trim()
    const teacher = nameMap[raw] || raw
    if (!teacher) return
    if (!byTeacher[teacher]) byTeacher[teacher] = []
    byTeacher[teacher].push({
      observationDate:      row["observation_date"],
      classDate:            row["class_date"],
      courseGrade:          (row["course_grade"] || "").trim(),
      slotName:             (row["slot_name"] || "").trim(),
      className:            formatClassName(
                              (row["course_grade"] || "").trim(),
                              (row["slot_name"] || "").trim()
                              ),
      observer:             (row["observer_name"] || "").trim(),
      recordingUrl:         (row["recording_url"] || "").trim(),
      criticalScore:        parseInt(row["critical_score"]) || 0,
      importantScore:       parseInt(row["important_score"]) || 0,
      status:               (row["status"] || "").trim(),
      needImproveCritical:  (row["need_improvement_critical"] || "").trim(),
      needImproveImportant: (row["need_improvement_important"] || "").trim(),
      notes:                (row["notes"] || "").trim(),
    })
  })
  Object.keys(byTeacher).forEach((t) => {
    byTeacher[t].sort((a, b) => new Date(b.observationDate) - new Date(a.observationDate))
  })
  return byTeacher
}

function processCuti(rows, nameMap = {}) {
  const byTeacher = {}
  rows.forEach((row) => {
    const raw     = (row["teacher_name"] || "").trim()
    const teacher = nameMap[raw] || raw
    const className = formatClassName(
      (row["course_grade"] || "").trim(),
      (row["slot_name"] || "").trim()
    )
    const reason    = (row["reason"] || "").trim().toLowerCase()
    if (!teacher || !className || reason !== "cuti") return
    if (!byTeacher[teacher]) byTeacher[teacher] = {}
    if (!byTeacher[teacher][className]) byTeacher[teacher][className] = []
    byTeacher[teacher][className].push(row["date"])
  })
  return byTeacher
}

// ─── Kelas Ditinggal ──────────────────────────────────────────────────────────
function processKelasDitinggal(rows, nameMap = {}) {
  const byTeacher = {}
  rows.forEach((row) => {
    const raw     = (row["teacher_name"] || "").trim()
    const teacher = nameMap[raw] || raw
    const className = formatClassName(
      (row["course_grade"] || "").trim(),
      (row["slot_name"] || "").trim()
    )
    const reason    = (row["reason"] || "").trim().toLowerCase()
    const classRule = (row["class_rules"] || "").trim()
    const note = (row["note"] || "").trim()
    if (!teacher || !className) return
    if (!byTeacher[teacher]) byTeacher[teacher] = []
    byTeacher[teacher].push({ className, courseGrade: (row["course_grade"] || "").trim(), slotName: (row["slot_name"] || "").trim(), classRule, reason, note, date: row["date"] })
  })
  return byTeacher
}

// ─── Membantu Piket ───────────────────────────────────────────────────────────
function processMembantuPiket(rows, nameMap = {}) {
  const byTeacher = {}
  rows.forEach((row) => {
    const rawReplace  = (row["replace_by"] || "").trim()
    const replaceBy   = nameMap[rawReplace] || rawReplace
    const rawTeacher  = (row["teacher_name"] || "").trim()
    const teacherName = nameMap[rawTeacher] || rawTeacher
    const className = formatClassName(
      (row["course_grade"] || "").trim(),
      (row["slot_name"] || "").trim()
    )
    const reason      = (row["reason"] || "").trim().toLowerCase()
    const classRule   = (row["class_rules"] || "").trim()
    if (!replaceBy || !className) return
    if (!byTeacher[replaceBy]) byTeacher[replaceBy] = []
    byTeacher[replaceBy].push({ className, courseGrade: (row["course_grade"] || "").trim(), slotName: (row["slot_name"] || "").trim(), classRule, reason, teacherName, date: row["date"] })
  })
  return byTeacher
}

// ─── Coaching ─────────────────────────────────────────────────────────────────
function processCoaching(rows, nameMap = {}) {
  const byTeacher = {}
  rows.forEach((row) => {
    const raw     = (row["teacher_name"] || "").trim()
    const teacher = nameMap[raw] || raw
    if (!teacher) return
    if (!byTeacher[teacher]) byTeacher[teacher] = []
    byTeacher[teacher].push({
      dateCoaching:    row["date_of_coaching"],
      tipeCoaching:    (row["tipe_coaching"] || "").trim(),
      tanggalKelas:    row["tanggal_kelas"],
      courseGrade:     (row["course_grade"] || "").trim(),
      slotName:        (row["slot_name"] || "").trim(),
      className:       formatClassName(
                         (row["course_grade"] || "").trim(),
                         (row["slot_name"] || "").trim()
                       ),
      managerEmail:    (row["direct_manager_email"] || "").trim(),
      coach:           (row["coach"] || "").trim(),
      criticalPoint:   (row["critical_point"] || "").trim(),
      poinPenting:     (row["poin_penting"] || "").trim(),
      langkahTindakan: (row["langkah_tindakan"] || "").trim(),
      komentarCoach:   (row["komentar_coach"] || "").trim(),
      komentarLain:    (row["komentar_lain"] || "").trim(),
      linkRecording:   (row["link_recording"] || "").trim(),
    })
  })
  Object.keys(byTeacher).forEach((t) => {
    byTeacher[t].sort((a, b) => new Date(b.dateCoaching) - new Date(a.dateCoaching))
  })
  return byTeacher
}

// ─── Observation Assignment ───────────────────────────────────────────────────
function processObservationAssignment(rows, nameMap = {}) {
  const byObserver = {}
  rows.forEach((row) => {
    const rawObserver = (row["observer"] || "").trim()
    const normalizedObserver = rawObserver.replace(/'/g, "")
    const observer = nameMap[normalizedObserver] || nameMap[rawObserver] || rawObserver
    if (!observer) return
    if (!byObserver[observer]) byObserver[observer] = []
    byObserver[observer].push({
      assignedDate:   (row["assigned_date"]  || "").trim(),
      deadline:       (row["deadline"]        || "").trim(),
      dateSubmission: (row["date_submission"] || "").trim(),
      status:         (row["status"]          || "").trim(),
      month:          (row["month"]           || "").trim(),
      period:         (row["period"]          || "").trim(),
      teacher:        (row["teacher"]         || "").trim(),
      slot:           (row["slot"]            || "").trim(),
      dateOfClass:    (row["date_of_class"]   || "").trim(),
      link:           (row["link"]            || "").trim(),
    })
  })
  Object.keys(byObserver).forEach((t) => {
    byObserver[t].sort((a, b) => new Date(b.deadline) - new Date(a.deadline))
  })
  return byObserver
}

// ─── Sub components ───────────────────────────────────────────────────────────
function ChartLegend() {
  return (
    <div className="legend">
      <div className="legend-item">
        <div className="legend-line" style={{ background: "#2563eb" }} />
        <span>Stickiness</span>
      </div>
      <div className="legend-item">
        <div className="legend-dashed" />
        <span>Dynamic Average Stickiness</span>
      </div>
    </div>
  )
}

function CutiBar({ count, dates, maks }) {
  const [show, setShow] = useState(false)
  const safeCount = typeof count === "number" ? count : 0
  const pct    = Math.min(100, (safeCount / maks) * 100)
  const hampir = safeCount / maks >= 0.75
  const color  = safeCount >= maks ? "#dc2626" : hampir ? "#d97706" : "#16a34a"
  return (
    <div className="cuti-bar-wrap" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div className="cuti-bar">
        <div className="cuti-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="cuti-count">{safeCount}/{maks}</span>
      {safeCount >= maks && <span className="badge b-bw" style={{ fontSize: 10 }}>Batas tercapai</span>}
      {safeCount < maks && hampir && <span className="badge b-need" style={{ fontSize: 10 }}>Hampir batas</span>}
      {show && dates.length > 0 && (
        <div className="cuti-tooltip">
          <div className="cuti-tooltip-title">Tanggal ditinggalkan</div>
          {dates.map((d, i) => <div key={i} className="cuti-tooltip-date">{formatDate(d)}</div>)}
        </div>
      )}
    </div>
  )
}

function ObsModal({ obs, onClose }) {
  if (!obs) return null
  const isPassed = obs.status?.toLowerCase() === "passed"
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-meta">
            <div className="modal-class">{obs.className}</div>
            <div className="modal-sub">
              <span>Observer: {obs.observer}</span>
            </div>
          </div>
          <span className={`badge ${isPassed ? "b-pass" : "b-need"}`}>{obs.status}</span>
        </div>
        <div className="va-meta-strip obs-meta-strip">
          <div className="va-meta-cell">
            <div className="va-meta-label">Tanggal Observasi</div>
            <div className="va-meta-value">{formatDate(obs.observationDate)}</div>
          </div>
          <div className="va-meta-cell">
            <div className="va-meta-label">Tanggal Kelas</div>
            <div className="va-meta-value">{formatDate(obs.classDate)}</div>
          </div>
        </div>
        <div className="modal-scores">
          <div className="score-box">
            <div className="score-label">Critical score</div>
            <div className="score-val">{obs.criticalScore}<span>/5</span></div>
          </div>
          <div className="score-box">
            <div className="score-label">Important score</div>
            <div className="score-val">{obs.importantScore}<span>/10</span></div>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-block">
            <div className="modal-block-title"><div className="dot dot-red" />Need improvement — Critical</div>
            {obs.needImproveCritical ? <p className="modal-text" style={{ whiteSpace: "pre-wrap" }}>{obs.needImproveCritical}</p> : <p className="modal-empty">Tidak ada poin critical yang perlu diperbaiki.</p>}
          </div>
          <div className="modal-block">
            <div className="modal-block-title"><div className="dot dot-amber" />Need improvement — Important</div>
            {obs.needImproveImportant ? <p className="modal-text" style={{ whiteSpace: "pre-wrap" }}>{obs.needImproveImportant}</p> : <p className="modal-empty">Tidak ada poin important yang perlu diperbaiki.</p>}
          </div>
          <div className="modal-block">
            <div className="modal-block-title"><div className="dot dot-blue" />Catatan observer</div>
            {obs.notes ? <p className="modal-text" style={{ whiteSpace: "pre-wrap" }}>{obs.notes}</p> : <p className="modal-empty">Tidak ada catatan tambahan.</p>}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          {obs.recordingUrl
            ? <a className="va-meta-link" href={obs.recordingUrl} target="_blank" rel="noopener noreferrer">Buka recording →</a>
            : <span />
          }
          <button className="btn-close" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

function tipeBadge(tipe) {
  const t = (tipe || "").toLowerCase()
  const s = { fontSize: 10 }
  if (t === "spontaneous") return <span className="badge b-av" style={s}>Spontaneous</span>
  if (t === "scheduled")   return <span className="badge b-info" style={s}>Scheduled</span>
  if (t === "follow-up")   return <span className="badge b-need" style={s}>Follow-up</span>
  return <span className="badge b-av" style={s}>{tipe}</span>
}

function CoachingModal({ coaching, onClose }) {
  if (!coaching) return null

  const tipe       = coaching.tipeCoaching || ""
  const isObs      = tipe.includes("Observasi")
  const isTemuan   = tipe.includes("Temuan")
  const badgeClass = isObs ? "b-obs" : isTemuan ? "b-tem" : "b-av"
  const critLabel  = isTemuan ? "Department Pemohon" : "Critical point"

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        {/* Header: nama kelas + badge tipe, sub-info coach & direct leader */}
        <div className="va-header">
          <div className="va-header-row1">
            <div className="va-class-name">{coaching.className}</div>
            <span className={`badge ${badgeClass}`}>{tipe || "—"}</span>
          </div>
          <div className="va-sub">
            <span className="va-sub-text">Coach: {coaching.coach || "—"}</span>
            <span className="va-sep-dot" />
            <span className="va-sub-text">Direct leader: {coaching.managerEmail || "—"}</span>
          </div>
        </div>

        {/* Meta strip: 3 kolom — tanggal kelas · tanggal coaching · rekaman */}
        <div className="va-meta-strip">
          <div className="va-meta-cell">
            <div className="va-meta-label">Tanggal Kelas</div>
            <div className="va-meta-value">{formatDate(coaching.tanggalKelas)}</div>
          </div>
          <div className="va-meta-cell">
            <div className="va-meta-label">Tanggal Coaching</div>
            <div className="va-meta-value">{formatDate(coaching.dateCoaching)}</div>
          </div>
          <div className="va-meta-cell">
            <div className="va-meta-label">Rekaman Sesi</div>
            {coaching.linkRecording
              ? <a className="va-meta-link" href={coaching.linkRecording} target="_blank" rel="noopener noreferrer">Buka recording →</a>
              : <span className="va-block-empty">Tidak ada</span>
            }
          </div>
        </div>

        {/* Body: blok konten dengan dot berwarna */}
        <div className="va-body">
          <div className="va-block">
            <div className="va-block-title"><span className="va-dot" style={{ background: "#ef4444" }} />{critLabel}</div>
            {coaching.criticalPoint
              ? <div className="va-block-text" style={{ whiteSpace: "pre-wrap" }}>{coaching.criticalPoint}</div>
              : <div className="va-block-empty">Tidak ada data.</div>
            }
          </div>
          <div className="va-block">
            <div className="va-block-title"><span className="va-dot" style={{ background: "#f59e0b" }} />Poin penting</div>
            {coaching.poinPenting
              ? <div className="va-block-text" style={{ whiteSpace: "pre-wrap" }}>{coaching.poinPenting}</div>
              : <div className="va-block-empty">Tidak ada poin penting.</div>
            }
          </div>
          <div className="va-block">
            <div className="va-block-title"><span className="va-dot" style={{ background: "#3b82f6" }} />Langkah tindakan</div>
            {coaching.langkahTindakan
              ? <div className="va-block-text" style={{ whiteSpace: "pre-wrap" }}>{coaching.langkahTindakan}</div>
              : <div className="va-block-empty">Tidak ada langkah tindakan.</div>
            }
          </div>
          <div className="va-block">
            <div className="va-block-title"><span className="va-dot" style={{ background: "#16a34a" }} />Komentar coach</div>
            {coaching.komentarCoach
              ? <div className="va-block-text" style={{ whiteSpace: "pre-wrap" }}>{coaching.komentarCoach}</div>
              : <div className="va-block-empty">Tidak ada komentar.</div>
            }
          </div>
          <div className="va-block">
            <div className="va-block-title"><span className="va-dot" style={{ background: "#8b5cf6" }} />Komentar lain</div>
            {coaching.komentarLain
              ? <div className="va-block-text" style={{ whiteSpace: "pre-wrap" }}>{coaching.komentarLain}</div>
              : <div className="va-block-empty">Tidak ada komentar lain.</div>
            }
          </div>
        </div>

        <div className="va-footer">
          <button className="btn-close" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

function KelasDitinggalRow({ d }) {
  const badgeClass = d.reason === "cuti" ? "b-bw" : d.reason === "sakit" ? "b-info" : "b-av"
  return (
    <div className="obs-item">
      <div className="obs-top">
        <div className="obs-left">
          <div className="obs-date">{formatDate(d.date)}</div>
          {d.classRule && <span className="badge b-pass">{d.classRule}</span>}
          <div className="obs-class">{d.className}</div>
        </div>
        <span className={`badge ${badgeClass}`}>{d.reason}</span>
      </div>
      {d.note && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{d.note}</div>
      )}
    </div>
  )
}

function KelasDitinggalModal({ data, onClose }) {
  if (!data) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-meta">
            <div className="modal-class">Kelas Ditinggal</div>
          </div>
        </div>
        <div className="modal-body">
          {data.length === 0 ? (
            <p className="modal-empty">Tidak ada data kelas ditinggal.</p>
          ) : (
            data.map((d, i) => <KelasDitinggalRow key={i} d={d} />)
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

function MembantuPiketModal({ data, onClose }) {
  if (!data) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-meta">
            <div className="modal-class">Membantu Piket</div>
          </div>
        </div>
        <div className="modal-body">
          {data.length === 0 ? (
            <p className="modal-empty">Tidak ada data membantu piket.</p>
          ) : (
            data.map((d, i) => (
              <div key={i} className="obs-item">
                <div className="obs-top">
                  <div className="obs-left">
                    <div className="obs-date">{formatDate(d.date)}</div>
                    {d.classRule && <span className="badge b-pass">{d.classRule}</span>}
                    <div className="obs-class">{d.className}</div>
                    <div className="obs-observer">Ganti {d.teacherName}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className={`badge ${d.reason === "cuti" ? "b-bw" : d.reason === "sakit" ? "b-info" : "b-av"}`}>
                      {d.reason}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

function ObservationAssignmentModal({ data, onClose }) {
  if (!data) return null
  function statusStyle(s) {
    const v = (s || "").toLowerCase()
    if (v === "on time") return { background: "#EAF3DE", color: "#27500A" }
    if (v === "late")    return { background: "#FCEBEB", color: "#791F1F" }
    return                      { background: "#F1EFE8", color: "#5F5E5A" }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-meta">
            <div className="modal-class">Observation Assignment</div>
          </div>
        </div>
        <div className="modal-body">
          {data.length === 0 ? (
            <p className="modal-empty">Belum ada penugasan.</p>
          ) : (
            data.map((d, i) => (
              <div key={i} className="obs-item">
                <div className="obs-top">
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{d.teacher}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{d.slot}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 1 }}>
                      <span>Tanggal kelas: {formatDate(d.dateOfClass)}</span>
                      <span>Ditugaskan: {formatDate(d.assignedDate)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ ...statusStyle(d.status), fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 500 }}>
                      {d.status || "—"}
                    </span>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Deadline: {formatDate(d.deadline)}</div>
                    {d.link
                      ? <a className="va-meta-link" href={d.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>Class recording →</a>
                      : <span style={{ fontSize: 11, color: "#94a3b8" }}>Belum tersedia</span>
                    }
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

// ─── Access helpers ───────────────────────────────────────────────────────────
function classifySubject(slotName) {
  const s = (slotName || "").toLowerCase().trim()
  if (s.startsWith("matematika") || s.startsWith("persiapan") || s === "matematika lanjut") return "matematika"
  if (s.startsWith("ipa") || s.startsWith("fisika") || s.startsWith("kimia")) return "science"
  return "other"
}
function getJenjang(grade) {
  const g = parseInt(grade)
  if (g >= 4  && g <= 6)  return "SD"
  if (g >= 7  && g <= 9)  return "SMP"
  if (g >= 10 && g <= 12) return "SMA"
  return null
}

// ─── Guru Aman Banner ─────────────────────────────────────────────────────────
function GuruAmanBanner({ teachers, onSelectTeacher }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="gab-wrap" style={{ marginTop: 8 }}>
      {/* Header — always visible */}
      <div className="gab-header" onClick={() => setOpen((v) => !v)}>
        <div className="gab-header-left">
          {/* users-group icon */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9"  cy="7"  r="3" />
            <circle cx="17" cy="7"  r="3" />
            <path d="M1 21v-1a7 7 0 0 1 7-7h4" />
            <path d="M23 21v-1a5 5 0 0 0-5-5h-2a5 5 0 0 0-5 5v1" />
          </svg>
          <div className="gab-text">
            <span className="gab-title">{teachers.length} Guru Juara — semua kelas aman</span>
            <span className="gab-sub">Tidak ada kelas below average</span>
          </div>
        </div>
        {/* chevron */}
        <svg
          className={`gab-chevron ${open ? "gab-chevron-open" : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Pills — visible when open */}
      {open && (
        <div className="gab-pills">
          {teachers.map((t) => (
            <span
              key={t.teacher}
              className="gab-pill"
              onClick={() => onSelectTeacher(t.teacher)}
            >
              {t.teacher}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Heatmap cell with tooltip ───────────────────────────────────────────────
function HeatmapCell({ w, h, streak, history }) {
  const [pos, setPos] = useState(null)

  if (!h) return <div className="ov-hm-cell ov-hm-empty" />

  const s = h.status?.toUpperCase()
  const inStreak = s === "BELOW AVERAGE" &&
    history.slice(history.length - streak).some((x) => x.week === w)
  let cls = "ov-hm-cell "
  if (s === "EXCEPTIONAL")        cls += "ov-hm-ex"
  else if (s === "ON AVERAGE")    cls += "ov-hm-av"
  else if (s === "BELOW AVERAGE") cls += inStreak && streak >= 3 ? "ov-hm-bw-dark" : "ov-hm-bw"
  else                            cls += "ov-hm-empty"

  return (
    <div
      className={cls}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setPos({ x: r.left + r.width / 2, y: r.top })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {pos && createPortal(
        <div className="hm-tooltip" style={{ left: pos.x, top: pos.y - 6 }}>
          <div className="hm-tooltip-week">{h.week}</div>
          <div className="hm-tooltip-val">{h.stickiness}</div>
          <div className="hm-tooltip-status">{h.status}</div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Overview (POD Leader) ────────────────────────────────────────────────────
function Overview({ stickinessData, observasiData, teachers, onSelectTeacher, filterClasses }) {
  const teacherSummaries = teachers.map((teacher) => {
    const classes    = filterClasses(teacher, stickinessData?.[teacher] ?? [])
    const obsHistory = observasiData?.[teacher]  ?? []
    const latestObs  = obsHistory[0] ?? null

    const classesWithStreak = classes.map((c) => ({
      ...c,
      streak: computeStreak(c.history),
    }))
    const belowAvgClasses = classesWithStreak.filter(
      (c) => c.latest.status?.toUpperCase() === "BELOW AVERAGE"
    )

    return { teacher, classes: classesWithStreak, belowAvgClasses, latestObs }
  }).sort((a, b) => {
    const maxStreakA = a.belowAvgClasses.reduce((m, c) => Math.max(m, c.streak), 0)
    const maxStreakB = b.belowAvgClasses.reduce((m, c) => Math.max(m, c.streak), 0)
    if (maxStreakB !== maxStreakA) return maxStreakB - maxStreakA
    return b.belowAvgClasses.length - a.belowAvgClasses.length
  })

  const totalBelowAvg    = teacherSummaries.reduce((s, t) => s + t.belowAvgClasses.length, 0)
  const totalLongStreak  = teacherSummaries.reduce(
    (s, t) => s + t.belowAvgClasses.filter((c) => c.streak >= 3).length, 0
  )
  const totalNeedImprove = teacherSummaries.filter(
    (t) => t.latestObs && t.latestObs.status?.toLowerCase() !== "passed"
  ).length
  const totalClasses = teacherSummaries.reduce((s, t) => s + t.classes.length, 0)

  const withIssue    = teacherSummaries.filter((t) => t.belowAvgClasses.length > 0)
  const withoutIssue = teacherSummaries.filter((t) => t.belowAvgClasses.length === 0)

  const pctWithIssue    = teachers.length > 0 ? Math.round(withIssue.length / teachers.length * 100) : 0
  const badgeWithIssue  = pctWithIssue >= 30 ? "bb-red" : pctWithIssue >= 10 ? "bb-orange" : "bb-green"
  const colorWithIssue  = pctWithIssue >= 30 ? "red" : pctWithIssue >= 10 ? "orange" : "green"

  const pctBelowAvg     = totalClasses > 0 ? Math.round(totalBelowAvg / totalClasses * 100) : 0
  const badgeBelowAvg   = pctBelowAvg >= 20 ? "bb-red" : pctBelowAvg >= 5 ? "bb-orange" : "bb-green"
  const colorBelowAvg   = pctBelowAvg >= 20 ? "red" : pctBelowAvg >= 5 ? "orange" : "green"

  const pctLongStreak   = totalBelowAvg > 0 ? Math.round(totalLongStreak / totalBelowAvg * 100) : 0
  const badgeLongStreak = totalBelowAvg === 0 ? "bb-green" : pctLongStreak >= 50 ? "bb-red" : pctLongStreak >= 20 ? "bb-orange" : "bb-green"
  const colorLongStreak = totalBelowAvg === 0 ? "green" : pctLongStreak >= 50 ? "red" : pctLongStreak >= 20 ? "orange" : "green"

  const pctNeedImprove  = teachers.length > 0 ? Math.round(totalNeedImprove / teachers.length * 100) : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI */}
      <div className="cards-row">
        <div className="card">
          <div className="card-label">Guru Juara perlu perhatian</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={`card-value ${colorWithIssue}`}>{withIssue.length}</div>
            <span className={`badge card-badge ${badgeWithIssue}`}>{pctWithIssue}%</span>
          </div>
          <div className="card-sub">dari {teachers.length} Guru Juara aktif</div>
        </div>
        <div className="card">
          <div className="card-label">Kelas below average</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={`card-value ${colorBelowAvg}`}>{totalBelowAvg}</div>
            <span className={`badge card-badge ${badgeBelowAvg}`}>{pctBelowAvg}% dari total</span>
          </div>
          <div className="card-sub">dari {totalClasses} kelas</div>
        </div>
        <div className="card">
          <div className="card-label">Below average ≥ 3 minggu</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={`card-value ${colorLongStreak}`}>{totalLongStreak}</div>
            {totalBelowAvg === 0 ? (
              <span className="badge card-badge bb-green">Tidak ada</span>
            ) : (
              <span className={`badge card-badge ${badgeLongStreak}`}>{pctLongStreak}% dari {totalBelowAvg} kelas</span>
            )}
          </div>
          <div className="card-sub">kelas below average</div>
        </div>
        <div className="card">
          <div className="card-label">Observasi need coaching</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={`card-value ${totalNeedImprove > 0 ? "orange" : "green"}`}>{totalNeedImprove}</div>
            {totalNeedImprove > 0 ? (
              <span className="badge card-badge bb-orange">{pctNeedImprove}% dari total</span>
            ) : (
              <span className="badge card-badge bb-green">Semua passed</span>
            )}
          </div>
          <div className="card-sub">dari {teachers.length} Guru Juara</div>
        </div>
      </div>

      {/* Heatmap per guru bermasalah */}
      <div className="section">
        <div className="sec-head">
          <span className="sec-title">Guru Juara dengan kelas below average</span>
          <span className="ov-safe-note">{withIssue.length} dari {teachers.length} Guru Juara perlu perhatian</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {withIssue.map(({ teacher, classes, belowAvgClasses, latestObs }) => {
            const obsNeedImprove = latestObs && latestObs.status?.toLowerCase() !== "passed"

            // collect all week labels in order
            const weekSet = new Map()
            classes.forEach((c) =>
              c.history.forEach((h) => {
                if (!weekSet.has(h.week)) weekSet.set(h.week, h.week)
              })
            )
            const allWeeks = Array.from(weekSet.keys()).sort((a, b) => {
              const na = parseInt(a.replace(/\D/g, "")) || 0
              const nb = parseInt(b.replace(/\D/g, "")) || 0
              return na - nb
            })

            return (
              <div key={teacher} className="ov-heatmap-card" onClick={() => onSelectTeacher(teacher)}>
                {/* card header */}
                <div className="ov-teacher-head">
                  <span className="ov-teacher-name">{teacher}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="ov-count" style={{ color: "#dc2626", fontWeight: 500 }}>
                      {belowAvgClasses.length}/{classes.length} kelas below avg
                    </span>
                    {latestObs
                      ? <span className={`badge ${obsNeedImprove ? "b-need" : "b-pass"}`}>
                          Obs: {obsNeedImprove ? "Need improve" : "Passed"}
                        </span>
                      : <span className="badge b-info">Obs: belum ada</span>
                    }
                  </div>
                </div>

                {/* heatmap */}
                <div className="ov-heatmap-wrap" onClick={(e) => e.stopPropagation()}>
                  {/* week header */}
                  <div className="ov-hm-row">
                    <div className="ov-hm-label" />
                    {allWeeks.map((w) => (
                      <div key={w} className="ov-hm-week">{w}</div>
                    ))}
                  </div>
                  {/* class rows */}
                  {classes.map((c) => {
                    const histByWeek = {}
                    c.history.forEach((h) => { histByWeek[h.week] = h })
                    return (
                      <div key={c.name} className="ov-hm-row">
                        <div className="ov-hm-label">{c.name}</div>
                        {allWeeks.map((w) => (
                          <HeatmapCell key={w} w={w} h={histByWeek[w]} streak={c.streak} history={c.history} />
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* legend */}
                <div className="ov-hm-legend">
                  <div className="ov-hm-legend-item"><div className="ov-hm-legend-box" style={{ background: "#dcfce7" }} />Exceptional</div>
                  <div className="ov-hm-legend-item"><div className="ov-hm-legend-box" style={{ background: "#fef3c7" }} />On average</div>
                  <div className="ov-hm-legend-item"><div className="ov-hm-legend-box" style={{ background: "#fca5a5" }} />Below avg</div>
                  <div className="ov-hm-legend-item"><div className="ov-hm-legend-box" style={{ background: "#dc2626" }} />Below avg ≥ 3 minggu</div>
                  <div className="ov-hm-legend-item"><div className="ov-hm-legend-box" style={{ background: "#f1f5f9", border: "0.5px solid #e2e8f0" }} />Not Available</div>
                </div>
              </div>
            )
          })}
        </div>

        {withoutIssue.length > 0 && (
          <GuruAmanBanner teachers={withoutIssue} onSelectTeacher={onSelectTeacher} />
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, accessProfile }) {
  const [stickinessData,     setStickinessData]       = useState(null)
  const [observasiData,      setObservasiData]        = useState(null)
  const [cutiData,           setCutiData]             = useState(null)
  const [coachingData,       setCoachingData]         = useState(null)
  const [loading,            setLoading]              = useState(true)
  const [selTeacher,         setSelTeacher]           = useState(null)
  const [selClass,           setSelClass]             = useState(null)
  const [activeObs,          setActiveObs]            = useState(null)
  const [activeCoaching,     setActiveCoaching]       = useState(null)
  const [kelasDitinggalData, setKelasDitinggalData]   = useState(null)
  const [membantuPiketData,  setMembantuPiketData]    = useState(null)
  const [activeKDModal,      setActiveKDModal]        = useState(false)
  const [activeKPModal,      setActiveKPModal]        = useState(false)
  const [activeView,         setActiveView]           = useState("overview")
  const [sidebarSearch,      setSidebarSearch]        = useState("")
  const [photoMapData,       setPhotoMapData]         = useState({})
  const [teacherProfiles,            setTeacherProfiles]            = useState({})
  const [observationAssignmentData,  setObservationAssignmentData]  = useState(null)
  const [activeObsAssignmentModal,   setActiveObsAssignmentModal]   = useState(false)

  const hasTeamToManage = (accessProfile.directReportNickNames?.size ?? 0) > 0
    || ["POD Lead", "Science Lead", "STEM Lead"].includes(accessProfile.role)

  const isManagerView = accessProfile.isSuperAdmin || (!accessProfile.isGJ && hasTeamToManage)

  useEffect(() => {
    async function loadAll() {
      const nameMap  = {}
      const photoMap = {}

      // Load nameMap first — CSV_OBSERVASI, CSV_CUTI, CSV_COACHING depend on it.
      // Running all parsers in parallel causes a race: if nameMap CSV arrives last,
      // those processors see an empty map and store full names instead of nicknames,
      // producing duplicate sidebar entries.
      await new Promise((resolve) => {
        Papa.parse(CSV_NAMEMAP, {
          download: true, header: true, skipEmptyLines: true,
          complete: (r) => {
            r.data.forEach(row => {
              const full = (row["full_name"] || "").trim()
              const nick = (row["nick_name"] || "").trim()
              if (full && nick) nameMap[full] = nick
            })
            resolve()
          },
          error: resolve,
        })
      })

      // Remaining CSVs + Supabase run in parallel now that nameMap is ready
      let done = 0
      const tryFinish = () => { done++; if (done === 5) setLoading(false) }

      supabase.from("v_users_full")
        .select("nick_name, full_name, url_photo, role, main_pod, direct_manager_nama, level")
        .then(({ data }) => {
          if (data) {
            const profileMap = {}
            data.forEach(u => {
              if (u.nick_name && u.url_photo) photoMap[u.nick_name.trim()] = u.url_photo.trim()
              if (u.nick_name) profileMap[u.nick_name.trim()] = {
                fullName: u.full_name           || "",
                role:     u.role                || "",
                pod:      u.main_pod            || "",
                manager:  u.direct_manager_nama || "",
                level:    u.level               ?? null,
              }
            })
            setTeacherProfiles(profileMap)
          }
          setPhotoMapData(photoMap)
        })
        .catch(() => {})


      Papa.parse(CSV_STICKINESS, {
        download: true, header: true, skipEmptyLines: true,
        complete: (r) => { setStickinessData(processStickiness(r.data)); tryFinish() },
        error: () => tryFinish(),
      })
      Papa.parse(CSV_OBSERVASI, {
        download: true, header: true, skipEmptyLines: true,
        complete: (r) => { setObservasiData(processObservasi(r.data, nameMap)); tryFinish() },
        error: () => tryFinish(),
      })
      Papa.parse(CSV_CUTI, {
        download: true, header: true, skipEmptyLines: true,
        complete: (r) => {
          setCutiData(processCuti(r.data, nameMap))
          setKelasDitinggalData(processKelasDitinggal(r.data, nameMap))
          setMembantuPiketData(processMembantuPiket(r.data, nameMap))
          tryFinish()
        },
        error: () => tryFinish(),
      })
      Papa.parse(CSV_COACHING, {
        download: true, header: true, skipEmptyLines: true,
        complete: (r) => { setCoachingData(processCoaching(r.data, nameMap)); tryFinish() },
        error: () => tryFinish(),
      })
      Papa.parse(CSV_ASSIGNMENT_OBSERVASI, {
        download: true, header: true, skipEmptyLines: true,
        complete: (r) => { setObservationAssignmentData(processObservationAssignment(r.data, nameMap)); tryFinish() },
        error: () => tryFinish(),
      })
    }

    loadAll()
  }, [])

  // Set selTeacher setelah semua data selesai load
  useEffect(() => {
    if (!loading && !selTeacher) {
      const allTeachers = Array.from(new Set([
        ...Object.keys(stickinessData ?? {}),
        ...Object.keys(observasiData ?? {}),
        ...Object.keys(cutiData ?? {}),
      ])).sort()
      if (isManagerView) {
        setSelTeacher(allTeachers[0] ?? null)
      } else {
        setSelTeacher(accessProfile.nickName ?? allTeachers[0] ?? null)
      }
    }
  }, [loading])

  if (loading) return <div className="loading">Memuat data...</div>

  // ── Access filter ────────────────────────────────────────────────────────────
  // Apakah kelas ini termasuk cakupan POD/jenjang/subject milik role saat ini,
  // terlepas dari apakah pengajarnya direct report atau bukan.
  function isInPodScope(courseGrade, slotName) {
    const subject  = classifySubject(slotName)
    const grade    = parseInt(courseGrade)
    const { role, mainPod } = accessProfile
    if (role === "POD Lead") {
      const podGrade = parseInt((mainPod || "").replace("Grade ", ""))
      return subject === "matematika" && grade === podGrade
    }
    if (role === "Science Lead") return subject === "science"
    if (role === "STEM Lead") {
      const myJenjang    = getJenjang(parseInt((mainPod || "").replace("Grade ", "")))
      const classJenjang = getJenjang(grade)
      return subject === "matematika" && myJenjang === classJenjang
    }
    return false
  }

  function canSeeClassForTeacher(teacherNick, courseGrade, slotName) {
    if (accessProfile.isSuperAdmin) return true
    if (accessProfile.isGJ) return teacherNick === accessProfile.nickName
    if (accessProfile.directReportNickNames?.has(teacherNick)) return true
    return isInPodScope(courseGrade, slotName)
  }

  function isDirectReport(teacherNick) {
    return accessProfile.directReportNickNames?.has(teacherNick) ?? false
  }

  function canSeeObservationAssignment(teacherNick) {
    if (accessProfile.isSuperAdmin) return true
    if (teacherNick === accessProfile.nickName) return true
    if (isDirectReport(teacherNick)) return true
    return false
  }

  // ── Teachers list ─────────────────────────────────────────────────────────
  const allPossibleTeachers = Array.from(new Set([
    ...Object.keys(stickinessData ?? {}),
    ...Object.keys(observasiData ?? {}),
    ...Object.keys(cutiData ?? {}),
  ])).sort()

  const teachers = accessProfile.isSuperAdmin
    ? allPossibleTeachers
    : accessProfile.isGJ
      ? [accessProfile.nickName].filter(Boolean)
      : allPossibleTeachers.filter(t => {
          if (isDirectReport(t)) return true
          return (stickinessData?.[t] ?? []).some(c =>
            canSeeClassForTeacher(t, c.courseGrade, c.slotName)
          )
        })

  // ── Overview groups (Tim vs POD/Jenjang) ──────────────────────────────────
  const directReportTeachers = allPossibleTeachers.filter(t => isDirectReport(t))
  const podScopeTeachers = ["POD Lead", "Science Lead", "STEM Lead"].includes(accessProfile.role)
    ? allPossibleTeachers.filter(t => (stickinessData?.[t] ?? []).some(c =>
        isInPodScope(c.courseGrade, c.slotName)
      ))
    : []

  const showSplitOverview = directReportTeachers.length > 0 && podScopeTeachers.length > 0

  const primaryOverviewTeachers   = directReportTeachers.length > 0 ? directReportTeachers : podScopeTeachers
  const secondaryOverviewTeachers = showSplitOverview ? podScopeTeachers : []

  const primaryOverviewLabel = showSplitOverview ? "Overview Tim" : "Overview"
  const secondaryOverviewLabel =
    accessProfile.role === "POD Lead"     ? "Overview POD" :
    accessProfile.role === "Science Lead" ? "Overview Science" :
    accessProfile.role === "STEM Lead"    ? "Overview Jenjang" :
    "Overview Wilayah"

  // ── Per-teacher filtered data ─────────────────────────────────────────────
  const noFilter = accessProfile.isSuperAdmin || accessProfile.isGJ || isDirectReport(selTeacher) || selTeacher === accessProfile.nickName

  const allClasses      = applyStickinesFilters(stickinessData?.[selTeacher] ?? [])
  const classes         = noFilter ? allClasses
    : allClasses.filter(c => canSeeClassForTeacher(selTeacher, c.courseGrade, c.slotName))

  const allObsHistory   = observasiData?.[selTeacher] ?? []
  const obsHistory      = noFilter ? allObsHistory
    : allObsHistory.filter(o => canSeeClassForTeacher(selTeacher, o.courseGrade, o.slotName))

  const allCoaching     = coachingData?.[selTeacher] ?? []
  const coachingHistory = noFilter ? allCoaching
    : allCoaching.filter(c => canSeeClassForTeacher(selTeacher, c.courseGrade, c.slotName))

  const allCutiKelas    = cutiData?.[selTeacher] ?? {}
  const cutiKelas       = noFilter ? allCutiKelas
    : Object.fromEntries(
        Object.entries(allCutiKelas).filter(([className]) => {
          const match = allClasses.find(c => c.name === className)
          return match ? canSeeClassForTeacher(selTeacher, match.courseGrade, match.slotName) : false
        })
      )

  const allDitinggal    = kelasDitinggalData?.[selTeacher] ?? []
  const ditinggal       = noFilter ? allDitinggal
    : allDitinggal.filter(d => canSeeClassForTeacher(selTeacher, d.courseGrade, d.slotName))

  const allPiket        = membantuPiketData?.[selTeacher] ?? []
  const piket           = noFilter ? allPiket
    : allPiket.filter(d => canSeeClassForTeacher(selTeacher, d.courseGrade, d.slotName))

  const observationAssignment = observationAssignmentData?.[selTeacher] ?? []

  const latestObs  = obsHistory[0] ?? null
  const belowAvg   = classes.filter((c) => c.latest.status?.toUpperCase() === "BELOW AVERAGE").length
  const sortedByS  = [...classes].sort((a, b) => b.latest.deviation - a.latest.deviation)
  const highest    = sortedByS[0]
  const lowest     = sortedByS[sortedByS.length - 1]
  const onTrackCount = classes.filter((c) => {
    const s = c.latest.status?.toUpperCase()
    return s === "ON AVERAGE" || s === "EXCEPTIONAL"
  }).length
  const pctOnTrack = classes.length > 0
    ? Math.round(onTrackCount / classes.length * 100)
    : null
  const obsPassedCount = obsHistory.filter((o) => o.status?.toLowerCase() === "passed").length
  const chartData  = selClass ? classes.find((c) => c.name === selClass)?.history ?? [] : []
  const allClassNames = Array.from(
    new Set([...classes.map((c) => c.name), ...Object.keys(cutiKelas)])
  ).sort((a, b) => classSortKey(a) - classSortKey(b))

  function handleTeacher(t) { setSelTeacher(t); setSelClass(null); setActiveView("teacher") }
  function handleClass(n)   { setSelClass((p) => (p === n ? null : n)) }

  // ── Sidebar teacher summaries ──────────────────────────────────────────────
  function getVisibleClasses(teacher) {
    const cls = applyStickinesFilters(stickinessData?.[teacher] ?? [])
    if (accessProfile.isSuperAdmin || isDirectReport(teacher)) return cls
    return cls.filter(c => canSeeClassForTeacher(teacher, c.courseGrade, c.slotName))
  }

  // Khusus Overview POD/Jenjang: filter berdasarkan cakupan POD, terlepas dari direct report
  function getPodScopeClasses(teacher) {
    const cls = applyStickinesFilters(stickinessData?.[teacher] ?? [])
    if (accessProfile.isSuperAdmin) return cls
    return cls.filter(c => isInPodScope(c.courseGrade, c.slotName))
  }

  const teacherStatusMap = {}
  if (isManagerView && stickinessData) {
    teachers.forEach((t) => {
      const cls = getVisibleClasses(t)
      const ba  = cls.filter((c) => c.latest.status?.toUpperCase() === "BELOW AVERAGE").length
      const obs = (observasiData?.[t] ?? [])[0]
      const obsNeed = obs && obs.status?.toLowerCase() !== "passed"
      teacherStatusMap[t] = ba > 0 ? "red" : obsNeed ? "orange" : "green"
    })
  }

  const filteredTeachers = teachers.filter((t) =>
    t.toLowerCase().includes(sidebarSearch.toLowerCase())
  )

  return (
    <div className="app">
      <ObsModal obs={activeObs} onClose={() => setActiveObs(null)} />
      <CoachingModal coaching={activeCoaching} onClose={() => setActiveCoaching(null)} />
      <KelasDitinggalModal data={activeKDModal ? ditinggal : null} onClose={() => setActiveKDModal(false)} />
      <MembantuPiketModal data={activeKPModal ? piket : null} onClose={() => setActiveKPModal(false)} />
      <ObservationAssignmentModal data={activeObsAssignmentModal ? observationAssignment : null} onClose={() => setActiveObsAssignmentModal(false)} />

      {/* ── Header ── */}
      <div className="header">
        <div className="header-top">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/favicon.png" alt="CoLearn" style={{ width: 38, height: 38, borderRadius: 6 }} />
            <div>
              <div className="header-title">Performance Dashboard</div>
              {isManagerView ? (
                <div className="header-sub">
                  {activeView === "overview" ? primaryOverviewLabel : activeView === "overview2" ? secondaryOverviewLabel : activeView === "admin" ? "Admin Panel" : (teacherProfiles[selTeacher]?.fullName || selTeacher)}
                </div>
              ) : (
                <div className="header-sub">{selTeacher}</div>
              )}
            </div>
          </div>
          <button className="logout-btn" onClick={() => signOut(auth)} title="Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
        {isManagerView && (
          <div className={`header-v3-bottom${activeView === "teacher" ? " visible" : ""}`}>
            {selTeacher && (() => {
              const p = teacherProfiles[selTeacher]
              return (
                <>
                  <span className="hb-text">{selTeacher}</span>
                  {p?.role    && <><span className="hb-sep">·</span><span className="hb-role-badge">{p.role}</span></>}
                  {p?.pod     && <><span className="hb-sep">·</span><span className="hb-text">{p.pod}</span></>}
                  {p?.manager && <><span className="hb-sep">·</span><span className="hb-text">Reports to: {p.manager}</span></>}
                </>
              )
            })()}
          </div>
        )}
      </div>

      {isManagerView ? (
        /* ── POD Leader: sidebar + content ── */
        <div className="dashboard-shell">

          {/* Sidebar */}
          <div className="sidebar">
            <div className="sidebar-head">
              <button
                className={`sidebar-ov-btn ${activeView === "overview" ? "active" : ""}`}
                onClick={() => setActiveView("overview")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                {primaryOverviewLabel}
              </button>
              {showSplitOverview && (
                <button
                  className={`sidebar-ov-btn ${activeView === "overview2" ? "active" : ""}`}
                  onClick={() => setActiveView("overview2")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  {secondaryOverviewLabel}
                </button>
              )}
              {ADMIN_EMAILS.has(user.email) && (
                <button
                  className={`sidebar-ov-btn ${activeView === "admin" ? "active" : ""}`}
                  onClick={() => setActiveView("admin")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  Admin Panel
                </button>
              )}
              <div className="sidebar-search-wrap">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "#94a3b8" }}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  className="sidebar-search"
                  placeholder="Cari guru..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="sidebar-list">
              {filteredTeachers.map((t) => {
                const cls   = getVisibleClasses(t)
                const ba    = cls.filter((c) => c.latest.status?.toUpperCase() === "BELOW AVERAGE").length
                const color = teacherStatusMap[t] ?? "green"
                const initials = t.replace("Kak ", "").slice(0, 2).toUpperCase()
                return (
                  <button
                    key={t}
                    className={`sidebar-item ${activeView === "teacher" && selTeacher === t ? "active" : ""}`}
                    onClick={() => handleTeacher(t)}
                  >
                    <div className={`sidebar-avatar av-${color}`}>
                      {photoMapData[t]
                        ? <img
                            src={photoMapData[t]}
                            alt={t}
                            className="sidebar-avatar-img"
                            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex" }}
                          />
                        : null}
                      <span className="sidebar-avatar-initials" style={{ display: photoMapData[t] ? "none" : "flex" }}>{initials}</span>
                    </div>
                    <div className="sidebar-item-info">
                      <div className="sidebar-item-name">{t}</div>
                      <div className="sidebar-item-sub">
                        {ba > 0 ? `${ba} kelas below avg` : "Semua kelas aman"}
                      </div>
                    </div>
                    <div className={`sidebar-dot dot-${color}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main content */}
          <div className="sidebar-main">
            {activeView === "overview" ? (
              <Overview
                stickinessData={stickinessData}
                observasiData={observasiData}
                teachers={primaryOverviewTeachers}
                onSelectTeacher={handleTeacher}
                filterClasses={getVisibleClasses}
              />
            ) : activeView === "overview2" ? (
              <Overview
                stickinessData={stickinessData}
                observasiData={observasiData}
                teachers={secondaryOverviewTeachers}
                onSelectTeacher={handleTeacher}
                filterClasses={getPodScopeClasses}
              />
            ) : activeView === "admin" ? (
              <AdminPanel currentUser={user} />
            ) : (
              <div key={selTeacher} className="view-fade">
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>Slot Performance</div>
          <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center" }}>
            <svg width="75" height="75" viewBox="0 0 62 62">
              <circle cx="31" cy="31" r="23" fill="none" stroke="#e2e8f0" strokeWidth="7" />
              <circle cx="31" cy="31" r="23" fill="none" stroke="#2563eb" strokeWidth="7"
                strokeDasharray={`${classes.length > 0 ? (onTrackCount / classes.length * 144.51).toFixed(2) : 0} 144.51`}
                strokeLinecap="round" transform="rotate(-90 31 31)" />
              <text x="31" y="35" textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e293b">
                {classes.length > 0 ? `${Math.round(onTrackCount / classes.length * 100)}%` : "–"}
              </text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ fontSize: 30, fontWeight: 500, color: "#1e293b", lineHeight: 1 }}>{onTrackCount}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>kelas on avg/exceptional</div>
            </div>
          </div>
          <div style={{ borderTop: "0.5px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b" }}>
            <span style={{ color: belowAvg > 0 ? "#dc2626" : "#16a34a" }}>
              {belowAvg > 0 ? `${belowAvg} kelas below avg` : "Semua kelas on avg/exceptional"}
            </span>
            {" · "}{classes.length} total kelas
          </div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>Observation Result</div>
          <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center" }}>
            <svg width="75" height="75" viewBox="0 0 62 62">
              <circle cx="31" cy="31" r="23" fill="none" stroke="#e2e8f0" strokeWidth="7" />
              <circle cx="31" cy="31" r="23" fill="none" stroke="#16a34a" strokeWidth="7"
                strokeDasharray={`${obsHistory.length > 0 ? (obsPassedCount / obsHistory.length * 144.51).toFixed(2) : 0} 144.51`}
                strokeLinecap="round" transform="rotate(-90 31 31)" />
              <text x="31" y="35" textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e293b">
                {obsHistory.length > 0 ? `${Math.round(obsPassedCount / obsHistory.length * 100)}%` : "–"}
              </text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ fontSize: 30, fontWeight: 500, color: "#1e293b", lineHeight: 1 }}>{obsPassedCount}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>observasi passed</div>
            </div>
          </div>
          <div style={{ borderTop: "0.5px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b" }}>
            <span style={{ color: (obsHistory.length - obsPassedCount) > 0 ? "#d97706" : "#16a34a" }}>
              {(obsHistory.length - obsPassedCount) > 0 ? `${obsHistory.length - obsPassedCount} need improvement` : "Semua observasi passed"}
            </span>
            {" · "}{obsHistory.length} total obs
          </div>
        </div>
        {canSeeObservationAssignment(selTeacher) && (() => {
          const total = observationAssignment.length
          const onTimeCount = observationAssignment.filter(a => (a.status || "").toLowerCase() === "on time").length
          const lateCount = observationAssignment.filter(a => (a.status || "").toLowerCase() === "late").length
          const notYetCount = total - onTimeCount - lateCount
          const circ = 144.51
          const onTimeLen = total > 0 ? (onTimeCount / total) * circ : 0
          const lateLen = total > 0 ? (lateCount / total) * circ : 0
          const notYetLen = total > 0 ? (notYetCount / total) * circ : 0
          const pctOnTime = total > 0 ? Math.round(onTimeCount / total * 100) : 0
          const teacherLevel = teacherProfiles[selTeacher]?.level ?? null
          const emptyText = teacherLevel !== null && teacherLevel <= 2 ? "Tidak ada assignment" : "Belum ada assignment"
          return (
            <div
              style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, cursor: total > 0 ? "pointer" : "default" }}
              onClick={total > 0 ? () => setActiveObsAssignmentModal(true) : undefined}
            >
              <div style={{ fontSize: 11, color: "#64748b" }}>Observation Assignment</div>
              {total === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>{emptyText}</div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center" }}>
                    <svg width="75" height="75" viewBox="0 0 62 62">
                      <circle cx="31" cy="31" r="23" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                      <circle cx="31" cy="31" r="23" fill="none" stroke="#639922" strokeWidth="7"
                        strokeDasharray={`${onTimeLen.toFixed(2)} ${(circ - onTimeLen).toFixed(2)}`}
                        strokeLinecap="butt" transform="rotate(-90 31 31)" />
                      <circle cx="31" cy="31" r="23" fill="none" stroke="#E24B4A" strokeWidth="7"
                        strokeDasharray={`${lateLen.toFixed(2)} ${(circ - lateLen).toFixed(2)}`}
                        strokeLinecap="butt" transform="rotate(-90 31 31)"
                        strokeDashoffset={-onTimeLen} />
                      <circle cx="31" cy="31" r="23" fill="none" stroke="#B4B2A9" strokeWidth="7"
                        strokeDasharray={`${notYetLen.toFixed(2)} ${(circ - notYetLen).toFixed(2)}`}
                        strokeLinecap="butt" transform="rotate(-90 31 31)"
                        strokeDashoffset={-(onTimeLen + lateLen)} />
                      <text x="31" y="30" textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e293b">{pctOnTime}%</text>
                      <text x="31" y="41" textAnchor="middle" fontSize="7.5" fill="#94a3b8">on time</text>
                    </svg>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, minWidth: 80 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#639922", display: "inline-block", flexShrink: 0 }} />On Time</span>
                        <span style={{ fontWeight: 500 }}>{onTimeCount}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E24B4A", display: "inline-block", flexShrink: 0 }} />Late</span>
                        <span style={{ fontWeight: 500 }}>{lateCount}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#B4B2A9", display: "inline-block", flexShrink: 0 }} />Not Yet</span>
                        <span style={{ fontWeight: 500 }}>{notYetCount}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: "0.5px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b" }}>
                    {total} penugasan total
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </div>
      <div className="two-col">
        <div className="left-col">
          <div className="section">
            <div className="sec-head">
              <span className="sec-title">Stickiness index per kelas</span>
              <span className="week-pill">Weekly</span>
            </div>
            <table>
              <thead><tr><th>Kelas</th><th>Stickiness</th><th>Deviasi</th><th>Status</th></tr></thead>
              <tbody>
                {classes.map((c) => {
                  const pct       = Math.min(100, Math.max(-100, c.latest.stickiness))
                  const fillWidth = (Math.abs(pct) / 100) * 50
                  const fillLeft  = pct >= 0 ? 50 : 50 - fillWidth
                  const devStr    = c.latest.deviation >= 0 ? `+${c.latest.deviation}` : `${c.latest.deviation}`
                  const devColor  = c.latest.deviation >= 0 ? "#15803d" : "#dc2626"
                  const streak    = computeStreak(c.history)
                  return (
                    <tr key={c.name} className={`row ${selClass === c.name ? "selected" : ""}`} onClick={() => handleClass(c.name)}>
                      <td>{c.name}</td>
                      <td>
                        <div className="bar-wrap">
                          <div className="bar" style={{ position: "relative" }}>
                            <div style={{ position:"absolute", left:"50%", top:0, width:"1px", height:"100%", background:"rgba(0,0,0,0.15)" }} />
                            <div className="bar-fill" style={{ position:"absolute", left:`${fillLeft}%`, width:`${fillWidth}%`, height:"100%", background: barColor(c.latest.status) }} />
                          </div>
                          {c.latest.stickiness}
                        </div>
                      </td>
                      <td style={{ color: devColor }}>{devStr}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {statusBadge(c.latest.status)}
                          {streak >= 2 && (
                            <span className="streak-badge" style={{ background: streak >= 3 ? "#fee2e2" : "#fef3c7", color: streak >= 3 ? "#dc2626" : "#d97706" }}>
                              {streak}W
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="section">
            <div className="sec-head">
              <span className="sec-title">{selClass ? `Tren stickiness — ${selClass}` : "Tren stickiness"}</span>
              {selClass && <ChartLegend />}
            </div>
            {!selClass ? (
              <div className="empty-state">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>Klik baris kelas untuk melihat tren</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: "#888" }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e5e7eb" }}
                    formatter={(v, n) => [v, n === "dynAvg" ? "Dynamic Average Stickiness" : "Stickiness"]}
                  />
                  <Line type="monotone" dataKey="stickiness" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} name="stickiness" />
                  <Line type="monotone" dataKey="dynAvg" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="dynAvg" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="right-col">
          <div className="section" style={{ marginBottom: 14 }}>
            <div className="sec-head">
              <span className="sec-title">Riwayat observasi kelas</span>
              <span className="obs-pill">Monthly</span>
            </div>
            {obsHistory.length === 0 ? (
              <div className="empty-state">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Belum ada data observasi</span>
              </div>
            ) : (
              <div className="obs-scroll">
                {obsHistory.map((obs, i) => (
                  <div key={i} className="obs-item" onClick={() => setActiveObs(obs)} style={{ cursor: "pointer" }}>
                    <div className="obs-top">
                      <div className="obs-left">
                        <div className="obs-date">{formatDate(obs.observationDate)}</div>
                        <div>
                          <div className="obs-class">{obs.className}</div>
                          <div className="obs-scores">
                            <span className="obs-crit">Critical: {obs.criticalScore}/5</span>
                            <span className="obs-imp">Important: {obs.importantScore}/10</span>
                          </div>
                          <div className="obs-observer">{obs.observer}</div>
                        </div>
                      </div>
                      <span className={`badge ${obs.status?.toLowerCase() === "passed" ? "b-pass" : "b-need"}`} style={{ fontSize: 10 }}>{obs.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="section" style={{ marginBottom: 14 }}>
            <div className="sec-head">
              <span className="sec-title">Riwayat coaching</span>
              <span className="coaching-pill">Semua sesi</span>
            </div>
            {coachingHistory.length === 0 ? (
              <div className="empty-state">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <span>Belum ada data coaching</span>
              </div>
            ) : (
              <div className="obs-scroll">
                {coachingHistory.map((c, i) => (
                  <div key={i} className="obs-item" onClick={() => setActiveCoaching(c)} style={{ cursor: "pointer" }}>
                    <div className="obs-top">
                      <div className="obs-left">
                        <div className="obs-date">{formatDate(c.dateCoaching)}</div>
                        <div>
                          <div className="obs-class">{c.className}</div>
                          <div className="obs-scores">
                            <span className="obs-crit">Kelas: {formatDate(c.tanggalKelas)}</span>
                          </div>
                          <div className="obs-observer">{c.coach}</div>
                        </div>
                      </div>
                      {tipeBadge(c.tipeCoaching)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section" style={{ marginBottom: 14 }}>
            <div className="sec-head">
              <span className="sec-title">Kehadiran kelas</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="card" style={{ cursor: "pointer" }} onClick={() => setActiveKDModal(true)}>
                <div className="card-label">Kelas Ditinggal</div>
                <div className={`card-value ${ditinggal.length > 0 ? "red" : "green"}`}>{ditinggal.length}</div>
                <div className="card-sub">pertemuan ditinggalkan</div>
              </div>
              <div className="card" style={{ cursor: "pointer" }} onClick={() => setActiveKPModal(true)}>
                <div className="card-label">Membantu Piket</div>
                <div className="card-value green">{piket.length}</div>
                <div className="card-sub">kelas dibantu</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="sec-head">
              <span className="sec-title">Cuti per kelas</span>
              <span className="cuti-pill">Semester berjalan</span>
            </div>
            {allClassNames.length === 0 ? (
              <div className="empty-state"><span>Belum ada data cuti</span></div>
            ) : (
              <>
                <table>
                  <thead><tr><th>Kelas</th><th>Pertemuan ditinggalkan</th></tr></thead>
                  <tbody>
                    {allClassNames.map((name) => {
                      const dates = Array.isArray(cutiKelas[name]) ? cutiKelas[name] : []
                      return (
                        <tr key={name}>
                          <td>{name}</td>
                          <td><CutiBar count={dates.length} dates={dates} maks={BATAS_MAKS} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="cuti-note">Batas maks: {BATAS_MAKS} pertemuan/kelas per semester</div>
              </>
            )}
          </div>
        </div>
      </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Guru biasa: layout tanpa sidebar ── */
        <div className="app-body">
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>Slot Performance</div>
              <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center" }}>
                <svg width="75" height="75" viewBox="0 0 62 62">
                  <circle cx="31" cy="31" r="23" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                  <circle cx="31" cy="31" r="23" fill="none" stroke="#2563eb" strokeWidth="7"
                    strokeDasharray={`${classes.length > 0 ? (onTrackCount / classes.length * 144.51).toFixed(2) : 0} 144.51`}
                    strokeLinecap="round" transform="rotate(-90 31 31)" />
                  <text x="31" y="35" textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e293b">
                    {classes.length > 0 ? `${Math.round(onTrackCount / classes.length * 100)}%` : "–"}
                  </text>
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={{ fontSize: 30, fontWeight: 500, color: "#1e293b", lineHeight: 1 }}>{onTrackCount}</div>
                  <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.4 }}>kelas on avg/exceptional</div>
                </div>
              </div>
              <div style={{ borderTop: "0.5px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b" }}>
                <span style={{ color: belowAvg > 0 ? "#dc2626" : "#16a34a" }}>
                  {belowAvg > 0 ? `${belowAvg} kelas below avg` : "Semua kelas on avg/exceptional"}
                </span>
                {" · "}{classes.length} total kelas
              </div>
            </div>
            <div style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>Observation Result</div>
              <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center" }}>
                <svg width="75" height="75" viewBox="0 0 62 62">
                  <circle cx="31" cy="31" r="23" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                  <circle cx="31" cy="31" r="23" fill="none" stroke="#16a34a" strokeWidth="7"
                    strokeDasharray={`${obsHistory.length > 0 ? (obsPassedCount / obsHistory.length * 144.51).toFixed(2) : 0} 144.51`}
                    strokeLinecap="round" transform="rotate(-90 31 31)" />
                  <text x="31" y="35" textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e293b">
                    {obsHistory.length > 0 ? `${Math.round(obsPassedCount / obsHistory.length * 100)}%` : "–"}
                  </text>
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={{ fontSize: 30, fontWeight: 500, color: "#1e293b", lineHeight: 1 }}>{obsPassedCount}</div>
                  <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.4 }}>observasi passed</div>
                </div>
              </div>
              <div style={{ borderTop: "0.5px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b" }}>
                <span style={{ color: (obsHistory.length - obsPassedCount) > 0 ? "#d97706" : "#16a34a" }}>
                  {(obsHistory.length - obsPassedCount) > 0 ? `${obsHistory.length - obsPassedCount} need improvement` : "Semua observasi passed"}
                </span>
                {" · "}{obsHistory.length} total obs
              </div>
            </div>
            {canSeeObservationAssignment(selTeacher) && (() => {
              const total = observationAssignment.length
              const onTimeCount = observationAssignment.filter(a => (a.status || "").toLowerCase() === "on time").length
              const lateCount = observationAssignment.filter(a => (a.status || "").toLowerCase() === "late").length
              const notYetCount = total - onTimeCount - lateCount
              const circ = 144.51
              const onTimeLen = total > 0 ? (onTimeCount / total) * circ : 0
              const lateLen = total > 0 ? (lateCount / total) * circ : 0
              const notYetLen = total > 0 ? (notYetCount / total) * circ : 0
              const pctOnTime = total > 0 ? Math.round(onTimeCount / total * 100) : 0
              const teacherLevel = teacherProfiles[selTeacher]?.level ?? null
              const emptyText = teacherLevel !== null && teacherLevel <= 2 ? "Tidak ada assignment" : "Belum ada assignment"
              return (
                <div
                  style={{ flex: 1, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, cursor: total > 0 ? "pointer" : "default" }}
                  onClick={total > 0 ? () => setActiveObsAssignmentModal(true) : undefined}
                >
                  <div style={{ fontSize: 11, color: "#64748b" }}>Observation Assignment</div>
                  {total === 0 ? (
                    <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>{emptyText}</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center" }}>
                        <svg width="75" height="75" viewBox="0 0 62 62">
                          <circle cx="31" cy="31" r="23" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                          <circle cx="31" cy="31" r="23" fill="none" stroke="#639922" strokeWidth="7"
                            strokeDasharray={`${onTimeLen.toFixed(2)} ${(circ - onTimeLen).toFixed(2)}`}
                            strokeLinecap="butt" transform="rotate(-90 31 31)" />
                          <circle cx="31" cy="31" r="23" fill="none" stroke="#E24B4A" strokeWidth="7"
                            strokeDasharray={`${lateLen.toFixed(2)} ${(circ - lateLen).toFixed(2)}`}
                            strokeLinecap="butt" transform="rotate(-90 31 31)"
                            strokeDashoffset={-onTimeLen} />
                          <circle cx="31" cy="31" r="23" fill="none" stroke="#B4B2A9" strokeWidth="7"
                            strokeDasharray={`${notYetLen.toFixed(2)} ${(circ - notYetLen).toFixed(2)}`}
                            strokeLinecap="butt" transform="rotate(-90 31 31)"
                            strokeDashoffset={-(onTimeLen + lateLen)} />
                          <text x="31" y="30" textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e293b">{pctOnTime}%</text>
                          <text x="31" y="41" textAnchor="middle" fontSize="7.5" fill="#94a3b8">on time</text>
                        </svg>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, minWidth: 80 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#639922", display: "inline-block", flexShrink: 0 }} />On Time</span>
                            <span style={{ fontWeight: 500 }}>{onTimeCount}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E24B4A", display: "inline-block", flexShrink: 0 }} />Late</span>
                            <span style={{ fontWeight: 500 }}>{lateCount}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#B4B2A9", display: "inline-block", flexShrink: 0 }} />Not Yet</span>
                            <span style={{ fontWeight: 500 }}>{notYetCount}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ borderTop: "0.5px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b" }}>
                        {total} penugasan total
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
          <div className="two-col">
            <div className="left-col">
              <div className="section">
                <div className="sec-head">
                  <span className="sec-title">Stickiness index per kelas</span>
                  <span className="week-pill">Weekly</span>
                </div>
                <table>
                  <thead><tr><th>Kelas</th><th>Stickiness</th><th>Deviasi</th><th>Status</th></tr></thead>
                  <tbody>
                    {classes.map((c) => {
                      const pct       = Math.min(100, Math.max(-100, c.latest.stickiness))
                      const fillWidth = (Math.abs(pct) / 100) * 50
                      const fillLeft  = pct >= 0 ? 50 : 50 - fillWidth
                      const devStr    = c.latest.deviation >= 0 ? `+${c.latest.deviation}` : `${c.latest.deviation}`
                      const devColor  = c.latest.deviation >= 0 ? "#15803d" : "#dc2626"
                      return (
                        <tr key={c.name} className={`row ${selClass === c.name ? "selected" : ""}`} onClick={() => handleClass(c.name)}>
                          <td>{c.name}</td>
                          <td>
                            <div className="bar-wrap">
                              <div className="bar" style={{ position: "relative" }}>
                                <div style={{ position:"absolute", left:"50%", top:0, width:"1px", height:"100%", background:"rgba(0,0,0,0.15)" }} />
                                <div className="bar-fill" style={{ position:"absolute", left:`${fillLeft}%`, width:`${fillWidth}%`, height:"100%", background: barColor(c.latest.status) }} />
                              </div>
                              {c.latest.stickiness}
                            </div>
                          </td>
                          <td style={{ color: devColor }}>{devStr}</td>
                          <td>{statusBadge(c.latest.status)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="section">
                <div className="sec-head">
                  <span className="sec-title">{selClass ? `Tren stickiness — ${selClass}` : "Tren stickiness"}</span>
                  {selClass && <ChartLegend />}
                </div>
                {!selClass ? (
                  <div className="empty-state">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <span>Klik baris kelas untuk melihat tren</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888" }} />
                      <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: "#888" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e5e7eb" }}
                        formatter={(v, n) => [v, n === "dynAvg" ? "Dynamic Average Stickiness" : "Stickiness"]}
                      />
                      <Line type="monotone" dataKey="stickiness" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} name="stickiness" />
                      <Line type="monotone" dataKey="dynAvg" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="dynAvg" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="right-col">
              <div className="section" style={{ marginBottom: 14 }}>
                <div className="sec-head">
                  <span className="sec-title">Riwayat observasi kelas</span>
                  <span className="obs-pill">Monthly</span>
                </div>
                {obsHistory.length === 0 ? (
                  <div className="empty-state">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Belum ada data observasi</span>
                  </div>
                ) : (
                  <div className="obs-scroll">
                    {obsHistory.map((obs, i) => (
                      <div key={i} className="obs-item" onClick={() => setActiveObs(obs)} style={{ cursor: "pointer" }}>
                        <div className="obs-top">
                          <div className="obs-left">
                            <div className="obs-date">{formatDate(obs.observationDate)}</div>
                            <div>
                              <div className="obs-class">{obs.className}</div>
                              <div className="obs-scores">
                                <span className="obs-crit">Critical: {obs.criticalScore}/5</span>
                                <span className="obs-imp">Important: {obs.importantScore}/10</span>
                              </div>
                              <div className="obs-observer">{obs.observer}</div>
                            </div>
                          </div>
                          <span className={`badge ${obs.status?.toLowerCase() === "passed" ? "b-pass" : "b-need"}`} style={{ fontSize: 10 }}>{obs.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="section" style={{ marginBottom: 14 }}>
                <div className="sec-head">
                  <span className="sec-title">Riwayat coaching</span>
                  <span className="coaching-pill">Semua sesi</span>
                </div>
                {coachingHistory.length === 0 ? (
                  <div className="empty-state">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                    <span>Belum ada data coaching</span>
                  </div>
                ) : (
                  <div className="obs-scroll">
                    {coachingHistory.map((c, i) => (
                      <div key={i} className="obs-item" onClick={() => setActiveCoaching(c)} style={{ cursor: "pointer" }}>
                        <div className="obs-top">
                          <div className="obs-left">
                            <div className="obs-date">{formatDate(c.dateCoaching)}</div>
                            <div>
                              <div className="obs-class">{c.className}</div>
                              <div className="obs-scores">
                                <span className="obs-crit">Kelas: {formatDate(c.tanggalKelas)}</span>
                              </div>
                              <div className="obs-observer">{c.coach}</div>
                            </div>
                          </div>
                          {tipeBadge(c.tipeCoaching)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="section" style={{ marginBottom: 14 }}>
                <div className="sec-head">
                  <span className="sec-title">Kehadiran kelas</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="card" style={{ cursor: "pointer" }} onClick={() => setActiveKDModal(true)}>
                    <div className="card-label">Kelas Ditinggal</div>
                    <div className={`card-value ${ditinggal.length > 0 ? "red" : "green"}`}>{ditinggal.length}</div>
                    <div className="card-sub">pertemuan ditinggalkan</div>
                  </div>
                  <div className="card" style={{ cursor: "pointer" }} onClick={() => setActiveKPModal(true)}>
                    <div className="card-label">Membantu Piket</div>
                    <div className="card-value green">{piket.length}</div>
                    <div className="card-sub">kelas dibantu</div>
                  </div>
                </div>
              </div>
              <div className="section">
                <div className="sec-head">
                  <span className="sec-title">Cuti per kelas</span>
                  <span className="cuti-pill">Semester berjalan</span>
                </div>
                {allClassNames.length === 0 ? (
                  <div className="empty-state"><span>Belum ada data cuti</span></div>
                ) : (
                  <>
                    <table>
                      <thead><tr><th>Kelas</th><th>Pertemuan ditinggalkan</th></tr></thead>
                      <tbody>
                        {allClassNames.map((name) => {
                          const dates = Array.isArray(cutiKelas[name]) ? cutiKelas[name] : []
                          return (
                            <tr key={name}>
                              <td>{name}</td>
                              <td><CutiBar count={dates.length} dates={dates} maks={BATAS_MAKS} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="cuti-note">Batas maks: {BATAS_MAKS} pertemuan/kelas per semester</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default function App() {
  const [user,          setUser]          = useState(undefined)
  const [accessProfile, setAccessProfile] = useState(undefined)
  const [showGreeting,  setShowGreeting]  = useState(false)
  const [prevUser,      setPrevUser]      = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !prevUser) setShowGreeting(true)
      setUser(u)
      setPrevUser(u)

      if (u) {
        const isSuperAdmin = SUPER_ADMIN_EMAILS.has(u.email)
        try {
          const { data: profileData } = await supabase
            .from("v_users_full")
            .select("nick_name, role, level, main_pod")
            .eq("email", u.email)
            .single()

          let directReportNickNames = new Set()
          if (!isSuperAdmin && (profileData?.level ?? 0) >= 3) {
            const { data: reportsData } = await supabase
              .from("v_users_full")
              .select("nick_name")
              .eq("direct_manager_email", u.email)
            directReportNickNames = new Set(
              (reportsData ?? []).map(r => r.nick_name).filter(Boolean)
            )
          }

          setAccessProfile({
            nickName:              profileData?.nick_name ?? null,
            role:                  profileData?.role      ?? null,
            level:                 profileData?.level     ?? null,
            mainPod:               profileData?.main_pod  ?? null,
            email:                 u.email,
            isSuperAdmin,
            isGJ:                  !isSuperAdmin && (profileData?.level ?? 0) <= 2,
            directReportNickNames,
          })
        } catch (_) {
          setAccessProfile(null)
        }
      } else {
        setAccessProfile(null)
      }
    })
    return unsub
  }, [prevUser])

  // Loading awal
  if (user === undefined) return <div className="loading">Memuat...</div>

  // Belum login
  if (!user) return <Login />

  // Tunggu profile selesai di-fetch
  if (user && accessProfile === undefined) return <div className="loading">Memuat profil...</div>

  // Email tidak terdaftar di Supabase dan bukan super admin
  if (!accessProfile) return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title" style={{ color: "#dc2626" }}>Akses Ditolak</div>
        <div className="login-sub">Email <strong>{user.email}</strong> tidak terdaftar.</div>
        <button className="login-btn" style={{ marginTop: 16 }} onClick={() => signOut(auth)}>
          Kembali ke Login
        </button>
      </div>
    </div>
  )

  const displayName = accessProfile.nickName || user.displayName?.split(" ")[0] || "Kak"

  // Animasi greeting
  if (showGreeting) return <Greeting name={displayName} onDone={() => setShowGreeting(false)} />

  return <Dashboard user={user} accessProfile={accessProfile} />
}