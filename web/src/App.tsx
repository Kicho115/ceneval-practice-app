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
import { LatexText } from "./LatexText";
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

/** Categoría, PDF y página de la guía, si están en el banco. */
function formatQuestionMeta(item: QuestionItem): string | null {
  const bits: string[] = [];
  if (item.category) bits.push(item.category);
  if (item.sourcePdf) bits.push(item.sourcePdf);
  const p = item.sourcePages?.question;
  if (p != null) bits.push(`p. ${p}`);
  return bits.length ? bits.join(" · ") : null;
}

const GOOGLE_SEARCH = "https://www.google.com/search?q=";
const OPENAI_APP = "https://chatgpt.com/";

function openGoogleQuery(query: string) {
  const q = query.trim();
  if (!q) return;
  window.open(
    `${GOOGLE_SEARCH}${encodeURIComponent(q)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

/** Texto para buscar una opción: prefijo pedido para Gemini / búsqueda del concepto. */
function queryForOptionConcept(optionText: string) {
  const t = optionText.trim();
  if (!t) return "";
  return `qué es ${t}`;
}

/** Abre OpenAI: copia el prompt al portapapeles y usa ?prompt= (útil también con extensiones que lo interpretan). */
async function openOpenAIWithPrompt(prompt: string) {
  const text = prompt.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* sin permiso o contexto no seguro */
  }
  let url = `${OPENAI_APP}?prompt=${encodeURIComponent(text)}`;
  if (url.length > 6000) {
    url = OPENAI_APP;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function IconGoogle() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function IconOpenAI() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2.2c.3 0 .6.2.7.5l1.5 4.6h4.8c.7 0 1 .9.5 1.4l-3.9 2.8 1.5 4.6c.2.7-.6 1.3-1.2.9L12 16.9l-3.9 2.8c-.6.4-1.4-.2-1.2-.9l1.5-4.6-3.9-2.8c-.5-.5-.2-1.4.5-1.4h4.8l1.5-4.6c.1-.3.4-.5.7-.5z"
      />
    </svg>
  );
}

function SearchIconPair({
  googleTitle,
  openaiTitle,
  onGoogle,
  onOpenAI,
}: {
  googleTitle: string;
  openaiTitle: string;
  onGoogle: () => void;
  onOpenAI: () => void | Promise<void>;
}) {
  return (
    <div
      className="search-icon-pair"
      role="group"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn-icon-search btn-icon-google"
        title={googleTitle}
        aria-label={googleTitle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onGoogle();
        }}
      >
        <IconGoogle />
      </button>
      <button
        type="button"
        className="btn-icon-search btn-icon-openai"
        title={openaiTitle}
        aria-label={openaiTitle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onOpenAI();
        }}
      >
        <IconOpenAI />
      </button>
    </div>
  );
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

function QuestionExplanation({
  item,
  answered,
}: {
  item: QuestionItem;
  answered: boolean;
}) {
  const raw = item.explanation?.trim();
  if (!answered || !raw) return null;
  return (
    <div className="explanation" role="note">
      <p className="explanation-heading">Explicación</p>
      <div className="explanation-body">
        <LatexText text={raw} />
      </div>
    </div>
  );
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
          const concept = queryForOptionConcept(text);
          return (
            <li key={key} className="opt-line">
              <button
                type="button"
                className={cls}
                disabled={answered || optionDisabled}
                onClick={() => onPick(key)}
              >
                <span className="opt-key">{key}</span>
                <span className="opt-text">
                  <LatexText text={text} />
                </span>
                <SearchIconPair
                  googleTitle="Buscar en Google el texto «qué es» + esta opción"
                  openaiTitle="Abrir OpenAI con «qué es» + esta opción (se copia al portapapeles y se abre chatgpt.com)"
                  onGoogle={() => openGoogleQuery(concept)}
                  onOpenAI={() => void openOpenAIWithPrompt(concept)}
                />
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
  const questionMeta = formatQuestionMeta(current);

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
        {questionMeta && <p className="question-meta">{questionMeta}</p>}
        <div className="prompt-row">
          <p className="prompt">
            <LatexText text={current.prompt} />
          </p>
          <SearchIconPair
            googleTitle="Buscar el enunciado de esta pregunta en Google"
            openaiTitle="Abrir OpenAI solo con el texto de la pregunta (se copia al portapapeles y se abre chatgpt.com)"
            onGoogle={() => openGoogleQuery(current.prompt)}
            onOpenAI={() => void openOpenAIWithPrompt(current.prompt)}
          />
        </div>
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
        <QuestionExplanation item={current} answered={answered} />
        {answered && pos < order.length - 1 && (
          <p className="kbd-hint kbd-hint-after">
            <kbd>Enter</kbd> pasa a la siguiente pregunta.
          </p>
        )}
        {answered && pos >= order.length - 1 && (
          <p className="kbd-hint kbd-hint-after">Última pregunta del banco.</p>
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const cat = it.category?.trim();
      if (cat) set.add(cat);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  /** Índices al banco original: solo preguntas con respuesta y de las categorías elegidas. */
  const eligibleIndices = useMemo(
    () =>
      items
        .map((_, i) => i)
        .filter((i) => {
          const item = items[i];
          const a = item?.answer;
          if (!(typeof a === "string" && a.trim() !== "")) return false;
          if (selectedCategories.length === 0) return true;
          const cat = item?.category?.trim();
          return !!cat && selectedCategories.includes(cat);
        }),
    [items, selectedCategories],
  );
  const maxN = eligibleIndices.length;

  const [phase, setPhase] = useState<StudyPhase>("config");
  const [countInput, setCountInput] = useState(() =>
    maxN === 0 ? "0" : String(Math.min(20, maxN)),
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
    setSelectedCategories((prev) =>
      prev.filter((cat) => categoryOptions.includes(cat)),
    );
  }, [categoryOptions]);

  useEffect(() => {
    if (maxN === 0) {
      setCountInput("0");
      return;
    }
    const current = Math.max(1, parseInt(countInput, 10) || 0);
    if (current > maxN) setCountInput(String(maxN));
    else if (current <= 0) setCountInput(String(Math.min(20, maxN)));
  }, [countInput, maxN]);

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
    if (eligibleIndices.length === 0) return;
    const n = Math.min(
      eligibleIndices.length,
      Math.max(1, parseInt(countInput, 10) || 0),
    );
    const allIdx = shuffle([...eligibleIndices]);
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
  }, [countInput, eligibleIndices, minutesInput, useTimer]);

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
  const selectedCount = selectedCategories.length;
  const isAllCategories = selectedCount === 0;

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
          <div className="field">
            <span className="field-label">Categorías</span>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={isAllCategories}
                onChange={(e) => {
                  if (e.target.checked) setSelectedCategories([]);
                }}
              />
              <span>Todas las categorías</span>
            </label>
            <div className="category-list">
              {categoryOptions.map((cat) => (
                <label key={cat} className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat)}
                    onChange={(e) => {
                      setSelectedCategories((prev) => {
                        if (e.target.checked) {
                          return [...prev, cat];
                        }
                        return prev.filter((c) => c !== cat);
                      });
                    }}
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
            <span className="field-hint">
              {isAllCategories
                ? "Se usarán todas las categorías."
                : `${selectedCount} categoría(s) seleccionada(s).`}
            </span>
          </div>
          <label className="field">
            <span className="field-label">Número de preguntas</span>
            <input
              type="number"
              min={maxN === 0 ? 0 : 1}
              max={maxN}
              value={countInput}
              disabled={maxN === 0}
              onChange={(e) => setCountInput(e.target.value)}
            />
            <span className="field-hint">
              Máximo {maxN} (solo preguntas con respuesta
              {isAllCategories
                ? " en el banco"
                : " en las categorías seleccionadas"}
              ; orden aleatorio).
            </span>
          </label>
          {maxN === 0 && (
            <p className="warn">
              No hay preguntas con solución en el banco; no se puede iniciar una
              sesión.
            </p>
          )}
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
          <button
            type="button"
            className="btn btn-large"
            onClick={startStudy}
            disabled={maxN === 0}
          >
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
  const questionMeta = formatQuestionMeta(current);

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
        {questionMeta && <p className="question-meta">{questionMeta}</p>}
        <div className="prompt-row">
          <p className="prompt">
            <LatexText text={current.prompt} />
          </p>
          <SearchIconPair
            googleTitle="Buscar el enunciado de esta pregunta en Google"
            openaiTitle="Abrir OpenAI solo con el texto de la pregunta (se copia al portapapeles y se abre chatgpt.com)"
            onGoogle={() => openGoogleQuery(current.prompt)}
            onOpenAI={() => void openOpenAIWithPrompt(current.prompt)}
          />
        </div>
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
        <QuestionExplanation item={current} answered={answered} />
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
