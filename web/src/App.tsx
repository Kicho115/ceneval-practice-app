import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import examBank from "../../data/questions.json";
import type { ExamBank, QuestionItem } from "./types";
import "./App.css";

const bank = examBank as ExamBank;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function optionKeys(item: QuestionItem): string[] {
  return Object.keys(item.options).sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * 1–9 = select option by position (first option = 1). Enter confirms. Esc clears selection.
 */
function useAnswerHotkeys(
  optionKeys: string[],
  questionId: number,
  enabled: boolean,
  onPick: (letter: string) => void,
): number | null {
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const keysRef = useRef(optionKeys);
  keysRef.current = optionKeys;
  pendingRef.current = pendingIdx;

  useEffect(() => {
    setPendingIdx(null);
  }, [questionId]);

  useEffect(() => {
    if (!enabled) setPendingIdx(null);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    /** Capture phase so Enter confirma antes de activar botones (p. ej. Siguiente). */
    const handle = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = keysRef.current;

      if (e.key === "Escape") {
        e.preventDefault();
        setPendingIdx(null);
        return;
      }

      if (e.key === "Enter") {
        const idx = pendingRef.current;
        if (idx !== null && idx >= 0 && idx < k.length) {
          e.preventDefault();
          e.stopPropagation();
          onPick(k[idx]);
        }
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (n <= k.length) {
          e.preventDefault();
          setPendingIdx(n - 1);
        }
      }
    };

    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [enabled, onPick, questionId]);

  return pendingIdx;
}

function useQuizArrowNav(
  goPrev: () => void,
  goNext: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [enabled, goPrev, goNext]);
}

/**
 * Tras responder la pregunta actual, Enter avanza a la siguiente (misma acción que «Siguiente»).
 */
function useEnterGoesNextAfterAnswer(
  answered: boolean,
  goNext: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const h = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.repeat) return;
      if (!answered) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      goNext();
    };

    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [answered, goNext, enabled]);
}

/** Evita que Enter/Espacio activen Siguiente sin haber respondido (el clic con ratón sigue permitido). */
function blockEnterAdvance(
  e: ReactKeyboardEvent<HTMLButtonElement>,
  answered: boolean,
) {
  if (answered) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
  }
}

function OptionsList({
  keys,
  current,
  attempt,
  answered,
  onPick,
  questionId,
  hotkeysEnabled,
  optionDisabled,
}: {
  keys: string[];
  current: QuestionItem;
  attempt: { choice: string; correct: boolean } | undefined;
  answered: boolean;
  onPick: (letter: string) => void;
  questionId: number;
  hotkeysEnabled: boolean;
  optionDisabled: boolean;
}) {
  const canHotkey = hotkeysEnabled && !answered && !optionDisabled;
  const pendingIdx = useAnswerHotkeys(keys, questionId, canHotkey, onPick);

  return (
    <>
      <ul className="options">
        {keys.map((key, index) => {
          const text = current.options[key];
          const isPicked = attempt?.choice === key;
          const show = attempt !== undefined;
          const isCorrectKey = current.answer === key;
          let cls = "opt";
          if (show) {
            if (isCorrectKey) cls += " opt-correct";
            else if (isPicked) cls += " opt-wrong";
          } else if (pendingIdx === index) {
            cls += " opt-pending";
          }
          return (
            <li key={key}>
              <button
                type="button"
                className={cls}
                disabled={answered || optionDisabled}
                onClick={() => onPick(key)}
              >
                <span className="opt-key">{key}</span>
                <span className="opt-text">{text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {canHotkey && (
        <p className="kbd-hint">
          Teclado: <kbd>1</kbd>–<kbd>{keys.length}</kbd> elige, <kbd>Enter</kbd>{" "}
          confirma, <kbd>Esc</kbd> cancela. <kbd>←</kbd> <kbd>→</kbd> cambian de
          pregunta. Sin respuesta, <kbd>Enter</kbd> no avanza.
        </p>
      )}
    </>
  );
}

type Route = "home" | "practice" | "study";

export default function App() {
  const [route, setRoute] = useState<Route>("home");

  return (
    <div className="app">
      {route === "home" && (
        <Home
          examName={bank.exam}
          totalQuestions={bank.items.length}
          onPractice={() => setRoute("practice")}
          onStudy={() => setRoute("study")}
        />
      )}
      {route === "practice" && (
        <PracticeSession
          examName={bank.exam}
          items={bank.items}
          onBack={() => setRoute("home")}
        />
      )}
      {route === "study" && (
        <StudySession
          examName={bank.exam}
          items={bank.items}
          onBack={() => setRoute("home")}
        />
      )}
    </div>
  );
}

function Home({
  examName,
  totalQuestions,
  onPractice,
  onStudy,
}: {
  examName: string;
  totalQuestions: number;
  onPractice: () => void;
  onStudy: () => void;
}) {
  return (
    <div className="home">
      <h1 className="title">{examName}</h1>
      <p className="home-lead">
        Banco con {totalQuestions} preguntas. Elige cómo quieres practicar.
      </p>
      <div className="home-actions">
        <button type="button" className="btn btn-large" onClick={onPractice}>
          Práctica libre
        </button>
        <p className="home-hint">
          Todas las preguntas, orden secuencial o mezclado, sin límite de
          tiempo.
        </p>
        <button type="button" className="btn btn-large" onClick={onStudy}>
          Sesión de estudio
        </button>
        <p className="home-hint">
          Elige cuántas preguntas incluir y, si quieres, un tiempo límite para
          la sesión.
        </p>
      </div>
    </div>
  );
}

function PracticeSession({
  examName,
  items,
  onBack,
}: {
  examName: string;
  items: QuestionItem[];
  onBack: () => void;
}) {
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i));
  const [cursor, setCursor] = useState(0);
  const [attempts, setAttempts] = useState<
    Record<number, { choice: string; correct: boolean }>
  >({});

  const pos = Math.min(cursor, Math.max(0, order.length - 1));
  const itemIndex = order[pos] ?? 0;
  const current = items[itemIndex];
  const answered = current ? attempts[current.id] !== undefined : false;

  const stats = useMemo(() => {
    const vals = Object.values(attempts);
    const correct = vals.filter((v) => v.correct).length;
    const wrong = vals.filter((v) => !v.correct).length;
    return { correct, wrong, answered: vals.length };
  }, [attempts]);

  const handlePick = useCallback(
    (letter: string) => {
      if (!current?.answer) return;
      if (attempts[current.id] !== undefined) return;
      const ok = letter === current.answer;
      setAttempts((a) => ({
        ...a,
        [current.id]: { choice: letter, correct: ok },
      }));
    },
    [attempts, current],
  );

  const goNext = useCallback(() => {
    setCursor((c) => Math.min(c + 1, order.length - 1));
  }, [order.length]);

  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(c - 1, 0));
  }, []);

  const resetSession = useCallback(
    (reshuffle: boolean) => {
      setCursor(0);
      setAttempts({});
      if (reshuffle) {
        setOrder(shuffle(items.map((_, i) => i)));
      } else {
        setOrder(items.map((_, i) => i));
      }
    },
    [items],
  );

  useQuizArrowNav(goPrev, goNext, true);
  useEnterGoesNextAfterAnswer(answered, goNext, items.length > 0);

  if (!current) {
    return (
      <>
        <button type="button" className="btn link back-btn" onClick={onBack}>
          ← Inicio
        </button>
        <p>No hay preguntas en el banco.</p>
      </>
    );
  }

  const keys = optionKeys(current);
  const attempt = attempts[current.id];
  const progress = ((pos + 1) / order.length) * 100;

  return (
    <>
      <header className="header">
        <div>
          <button type="button" className="btn link" onClick={onBack}>
            ← Inicio
          </button>
          <h1 className="title">{examName}</h1>
          <p className="subtitle">Práctica libre</p>
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
        <OptionsList
          keys={keys}
          current={current}
          attempt={attempt}
          answered={answered}
          onPick={handlePick}
          questionId={current.id}
          hotkeysEnabled
          optionDisabled={false}
        />
        {!current.answer && (
          <p className="warn">Esta pregunta no tiene respuesta en el banco.</p>
        )}
        {answered && pos < order.length - 1 && (
          <p className="kbd-hint kbd-hint-after">
            <kbd>Enter</kbd> pasa a la siguiente pregunta.
          </p>
        )}
        {answered && pos >= order.length - 1 && (
          <p className="kbd-hint kbd-hint-after">
            Última pregunta del banco.
          </p>
        )}
      </article>

      <nav className="nav">
        <button
          type="button"
          className="btn secondary"
          onClick={goPrev}
          disabled={pos <= 0}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={goNext}
          disabled={pos >= order.length - 1}
          onKeyDown={(e) => blockEnterAdvance(e, answered)}
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
    </>
  );
}

type StudyPhase = "config" | "active" | "done";

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StudySession({
  examName,
  items,
  onBack,
}: {
  examName: string;
  items: QuestionItem[];
  onBack: () => void;
}) {
  const maxN = items.length;
  const [phase, setPhase] = useState<StudyPhase>("config");
  const [countInput, setCountInput] = useState(() =>
    String(Math.min(20, maxN)),
  );
  const [useTimer, setUseTimer] = useState(false);
  const [minutesInput, setMinutesInput] = useState("15");

  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [attempts, setAttempts] = useState<
    Record<number, { choice: string; correct: boolean }>
  >({});

  /** wall-clock ms when session must end; null = no limit or paused */
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  /** when paused: seconds left (deadlineMs is null) */
  const [pausedSec, setPausedSec] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [finishReason, setFinishReason] = useState<"time" | "complete" | null>(
    null,
  );
  const [hasTimeLimit, setHasTimeLimit] = useState(false);

  useEffect(() => {
    if (phase !== "active" || deadlineMs === null) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setRemainingSec(r);
      if (r <= 0) {
        setFinishReason("time");
        setPhase("done");
      }
    };
    tick();
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, [phase, deadlineMs]);

  const startStudy = useCallback(() => {
    const n = Math.min(maxN, Math.max(1, parseInt(countInput, 10) || 0));
    const allIdx = shuffle(items.map((_, i) => i));
    setOrder(allIdx.slice(0, n));
    setCursor(0);
    setAttempts({});
    setFinishReason(null);
    setHasTimeLimit(useTimer);
    if (useTimer) {
      const min = Math.max(1, parseInt(minutesInput, 10) || 1);
      const sec = min * 60;
      setDeadlineMs(Date.now() + sec * 1000);
      setPausedSec(null);
      setRemainingSec(sec);
    } else {
      setDeadlineMs(null);
      setPausedSec(null);
      setRemainingSec(0);
    }
    setPhase("active");
  }, [countInput, items, maxN, minutesInput, useTimer]);

  const togglePause = useCallback(() => {
    if (pausedSec === null) {
      if (deadlineMs === null) return;
      const r = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setPausedSec(r);
      setRemainingSec(r);
      setDeadlineMs(null);
    } else {
      setDeadlineMs(Date.now() + pausedSec * 1000);
      setPausedSec(null);
    }
  }, [deadlineMs, pausedSec]);

  const pos = Math.min(cursor, Math.max(0, order.length - 1));
  const itemIndex = order[pos] ?? 0;
  const current = order.length ? items[itemIndex] : undefined;
  const answered = current ? attempts[current.id] !== undefined : false;

  const stats = useMemo(() => {
    const vals = Object.values(attempts);
    const correct = vals.filter((v) => v.correct).length;
    const wrong = vals.filter((v) => !v.correct).length;
    return { correct, wrong, answered: vals.length };
  }, [attempts]);

  const handlePick = useCallback(
    (letter: string) => {
      if (phase !== "active") return;
      if (!current?.answer) return;
      if (attempts[current.id] !== undefined) return;
      const ok = letter === current.answer;
      setAttempts((a) => ({
        ...a,
        [current.id]: { choice: letter, correct: ok },
      }));
    },
    [attempts, current, phase],
  );

  const goNext = useCallback(() => {
    if (pos >= order.length - 1) {
      setFinishReason("complete");
      setPhase("done");
      return;
    }
    setCursor((c) => c + 1);
  }, [order.length, pos]);

  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(c - 1, 0));
  }, []);

  const sessionTotal = order.length;

  useQuizArrowNav(goPrev, goNext, phase === "active" && order.length > 0);
  useEnterGoesNextAfterAnswer(
    answered,
    goNext,
    phase === "active" && order.length > 0,
  );

  if (phase === "config") {
    return (
      <>
        <button type="button" className="btn link back-btn" onClick={onBack}>
          ← Inicio
        </button>
        <h1 className="title">{examName}</h1>
        <p className="subtitle">Sesión de estudio</p>
        <div className="card study-config">
          <label className="field">
            <span className="field-label">Número de preguntas</span>
            <input
              type="number"
              min={1}
              max={maxN}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
            />
            <span className="field-hint">
              Máximo {maxN} (se eligen al azar del banco).
            </span>
          </label>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={useTimer}
              onChange={(e) => setUseTimer(e.target.checked)}
            />
            <span>Tiempo límite para toda la sesión</span>
          </label>
          {useTimer && (
            <label className="field">
              <span className="field-label">Minutos</span>
              <input
                type="number"
                min={1}
                max={300}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
              />
            </label>
          )}
          <button type="button" className="btn btn-large" onClick={startStudy}>
            Comenzar sesión
          </button>
        </div>
      </>
    );
  }

  if (phase === "done") {
    const pct =
      stats.answered > 0
        ? Math.round((stats.correct / stats.answered) * 100)
        : 0;
    return (
      <>
        <header className="header">
          <div>
            <h1 className="title">Sesión terminada</h1>
            <p className="subtitle">
              {finishReason === "time"
                ? "Se agotó el tiempo."
                : "Completaste todas las preguntas de la sesión."}
            </p>
          </div>
        </header>
        <div className="card study-done">
          <ul className="done-stats">
            <li>
              <strong>{stats.correct}</strong> aciertos
            </li>
            <li>
              <strong>{stats.wrong}</strong> errores
            </li>
            <li>
              <strong>{stats.answered}</strong> respondidas de {sessionTotal}
            </li>
            <li>
              Precisión (sobre las respondidas): <strong>{pct}%</strong>
            </li>
          </ul>
          <div className="footer study-done-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setPhase("config")}
            >
              Nueva sesión
            </button>
            <button type="button" className="btn secondary" onClick={onBack}>
              Inicio
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!current) {
    return (
      <>
        <button type="button" className="btn link back-btn" onClick={onBack}>
          ← Inicio
        </button>
        <p>Error: sesión sin preguntas.</p>
      </>
    );
  }

  const keys = optionKeys(current);
  const attempt = attempts[current.id];
  const progress = ((pos + 1) / sessionTotal) * 100;
  const timed = hasTimeLimit;

  return (
    <>
      <header className="header">
        <div>
          <button type="button" className="btn link" onClick={onBack}>
            ← Inicio
          </button>
          <h1 className="title">{examName}</h1>
          <p className="subtitle">Sesión de estudio</p>
        </div>
        <div className="stats">
          <span>Aciertos: {stats.correct}</span>
          <span>Errores: {stats.wrong}</span>
          {timed && (
            <span className="timer-display" data-paused={pausedSec !== null}>
              {pausedSec !== null ? "⏸ " : ""}
              Tiempo: {formatClock(remainingSec)}
            </span>
          )}
        </div>
      </header>

      {timed && (
        <div className="timer-bar">
          <button
            type="button"
            className="btn secondary btn-small"
            onClick={togglePause}
          >
            {pausedSec !== null ? "Reanudar" : "Pausar"}
          </button>
        </div>
      )}

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pos + 1}
        aria-valuemin={1}
        aria-valuemax={sessionTotal}
      >
        <div
          className="progress-fill study-progress"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="progress-label">
        Pregunta {pos + 1} de {sessionTotal} (ID {current.id})
      </p>

      <article className="card">
        <p className="prompt">{current.prompt}</p>
        <OptionsList
          keys={keys}
          current={current}
          attempt={attempt}
          answered={answered}
          onPick={handlePick}
          questionId={current.id}
          hotkeysEnabled={phase === "active"}
          optionDisabled={timed && pausedSec !== null}
        />
        {!current.answer && (
          <p className="warn">Esta pregunta no tiene respuesta en el banco.</p>
        )}
        {answered && pos < sessionTotal - 1 && (
          <p className="kbd-hint kbd-hint-after">
            <kbd>Enter</kbd> pasa a la siguiente pregunta.
          </p>
        )}
        {answered && pos >= sessionTotal - 1 && (
          <p className="kbd-hint kbd-hint-after">
            <kbd>Enter</kbd> para ver resultados de la sesión.
          </p>
        )}
      </article>

      <nav className="nav">
        <button
          type="button"
          className="btn secondary"
          onClick={goPrev}
          disabled={pos <= 0}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={goNext}
          onKeyDown={(e) => blockEnterAdvance(e, answered)}
        >
          {pos >= sessionTotal - 1 ? "Ver resultados" : "Siguiente"}
        </button>
      </nav>
    </>
  );
}
