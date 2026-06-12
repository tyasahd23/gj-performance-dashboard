import { useEffect, useState } from "react"

export default function Greeting({ name, onDone }) {
  const [phase, setPhase] = useState("in")

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 2000)
    const t2 = setTimeout(() => onDone(), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={`greeting-page ${phase === "out" ? "greeting-out" : "greeting-in"}`}>
      <div className="greeting-content">
        <div className="greeting-wave">👋</div>
        <div className="greeting-text">
          Hi, <span className="greeting-name">{name}!</span>
        </div>
        <div className="greeting-sub">Selamat datang di Guru Juara Performance Dashboard</div>
      </div>
    </div>
  )
}