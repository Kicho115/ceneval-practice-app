import { useCallback, useMemo, useState } from 'react'
import examBank from '../../data/questions.json'
import type { ExamBank, QuestionItem } from './types'
import './App.css'

const bank = examBank as ExamBank

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function optionKeys(item: QuestionItem): string[] {
  return Object.keys(item.options).sort((a, b) => a.localeCompare(b, 'es'))
}

export default function App() {
  const items = bank.items

  const [order, setOrder] = useState<number[]>(() =>
    items.map((_, i) => i),
  )
  const [cursor, setCursor] = useState(0)
  /** question id -> user's choice once submitted */
  const [attempts, setAttempts] = useState<
    Record<number, { choice: string; correct: boolean }>
  >({})

  const pos = Math.min(cursor, Math.max(0, order.length - 1))
  const itemIndex = order[pos] ?? 0
  const current = items[itemIndex]
  const answered = current ? attempts[current.id] !== undefined : false

  const stats = useMemo(() => {
    const vals = Object.values(attempts)
    const correct = vals.filter((v) => v.correct).length
    const wrong = vals.filter((v) => !v.correct).length
    return { correct, wrong, answered: vals.length }
  }, [attempts])

  const handlePick = useCallback(
    (letter: string) => {
      if (!current?.answer) return
      if (attempts[current.id] !== undefined) return
      const ok = letter === current.answer
      setAttempts((a) => ({
        ...a,
        [current.id]: { choice: letter, correct: ok },
      }))
    },
    [attempts, current],
  )

  const goNext = useCallback(() => {
    setCursor((c) => Math.min(c + 1, order.length - 1))
  }, [order.length])

  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(c - 1, 0))
  }, [])

  const resetSession = useCallback((reshuffle: boolean) => {
    setCursor(0)
    setAttempts({})
    if (reshuffle) {
      setOrder(shuffle(items.map((_, i) => i)))
    } else {
      setOrder(items.map((_, i) => i))
    }
  }, [items])

  if (!current) {
    return (
      <div className="app">
        <p>No hay preguntas en el banco.</p>
      </div>
    )
  }

  const keys = optionKeys(current)
  const attempt = attempts[current.id]
  const progress = ((pos + 1) / order.length) * 100

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">{bank.exam}</h1>
          <p className="subtitle">Modo práctica</p>
        </div>
        <div className="stats">
          <span>Aciertos: {stats.correct}</span>
          <span>Errores: {stats.wrong}</span>
          <span>Respondidas: {stats.answered}</span>
        </div>
      </header>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pos + 1}
        aria-valuemin={1}
        aria-valuemax={order.length}
      >
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-label">
        Pregunta {pos + 1} de {order.length} (ID {current.id})
      </p>

      <article className="card">
        <p className="prompt">{current.prompt}</p>
        <ul className="options">
          {keys.map((key) => {
            const text = current.options[key]
            const isPicked = attempt?.choice === key
            const show = attempt !== undefined
            const isCorrectKey = current.answer === key
            let cls = 'opt'
            if (show) {
              if (isCorrectKey) cls += ' opt-correct'
              else if (isPicked) cls += ' opt-wrong'
            }
            return (
              <li key={key}>
                <button
                  type="button"
                  className={cls}
                  disabled={answered}
                  onClick={() => handlePick(key)}
                >
                  <span className="opt-key">{key}</span>
                  <span className="opt-text">{text}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {!current.answer && (
          <p className="warn">Esta pregunta no tiene respuesta en el banco.</p>
        )}
      </article>

      <nav className="nav">
        <button type="button" className="btn secondary" onClick={goPrev} disabled={pos <= 0}>
          Anterior
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={goNext}
          disabled={pos >= order.length - 1}
        >
          Siguiente
        </button>
      </nav>

      <footer className="footer">
        <button
          type="button"
          className="btn"
          onClick={() => resetSession(false)}
        >
          Reiniciar (mismo orden)
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => resetSession(true)}
        >
          Reiniciar y mezclar
        </button>
      </footer>
    </div>
  )
}
