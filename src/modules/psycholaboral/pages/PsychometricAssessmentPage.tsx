import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import appLogo from "../../../assets/app-logo.png";
import { formatRut, validateRut } from "../../../shared/lib/rut";
import {
  acceptPsychConsents,
  redeemPsychInvite,
  resumePsychSession,
  savePsychResponses,
  submitPsychInstrument,
} from "../services/psycholaboralApi";
import type { CandidateInstrument, CandidateSession } from "../types";
import "../styles/psycholaboral.css";

const QUESTIONS_PER_BLOCK = 10;
const storageKey = (publicId: string) => `psycholaboral-session-v2:${publicId}`;
const remaining = (deadline: string) =>
  Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function PsychometricAssessmentPage() {
  const [params] = useSearchParams();
  const publicId = params.get("invitation") ?? "";
  const [rut, setRut] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState(() =>
    publicId ? (localStorage.getItem(storageKey(publicId)) ?? "") : "",
  );
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [instrumentIndex, setInstrumentIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const revisionRef = useRef(0);
  const answersRef = useRef<Record<string, number>>({});
  const saveInFlight = useRef(false);
  const instrumentSectionRef = useRef<HTMLElement | null>(null);
  const [saved, setSaved] = useState("Sin cambios pendientes");
  const instrument: CandidateInstrument | null =
    session?.instruments[instrumentIndex] ?? null;
  const visibleSeconds = session?.deadline_at
    ? seconds || remaining(session.deadline_at)
    : 0;
  const questions = instrument?.questions ?? [];
  const blockCount = Math.max(
    1,
    Math.ceil(questions.length / QUESTIONS_PER_BLOCK),
  );
  const visibleQuestions = questions.slice(
    blockIndex * QUESTIONS_PER_BLOCK,
    (blockIndex + 1) * QUESTIONS_PER_BLOCK,
  );
  const blockCompletion = useMemo(
    () =>
      Array.from({ length: blockCount }, (_, index) => {
        const blockQuestions = questions.slice(
          index * QUESTIONS_PER_BLOCK,
          (index + 1) * QUESTIONS_PER_BLOCK,
        );
        return blockQuestions.length > 0 && blockQuestions.every((question) =>
          Object.prototype.hasOwnProperty.call(answers, String(question.order)),
        );
      }),
    [answers, blockCount, questions],
  );
  const complete = instrument
    ? Object.keys(answers).length === questions.length
    : false;
  const currentAnswered = Object.keys(answers).length;
  const overall = useMemo(
    () =>
      session?.instruments.reduce(
        (sum, item, index) =>
          sum +
          (index === instrumentIndex && item.status !== "completed"
            ? currentAnswered
            : item.status === "completed"
              ? item.questions.length
              : Object.keys(item.responses).length),
        0,
      ) ?? 0,
    [currentAnswered, instrumentIndex, session],
  );
  const total = useMemo(
    () =>
      session?.instruments.reduce(
        (sum, item) => sum + item.questions.length,
        0,
      ) ?? 0,
    [session],
  );

  const installSession = (next: CandidateSession) => {
    if (next.public_id && publicId && next.public_id !== publicId)
      throw new Error("La invitación no corresponde a esta sesión.");
    setSession(next);
    const pending = next.instruments.findIndex(
      (item) => item.status !== "completed",
    );
    if (pending >= 0) setInstrumentIndex(pending);
  };

  useEffect(() => {
    if (!token || !publicId) return;
    let active = true;
    setBusy(true);
    resumePsychSession(token)
      .then((data) => {
        if (active) installSession(data);
      })
      .catch((cause) => {
        if (!active) return;
        localStorage.removeItem(storageKey(publicId));
        setToken("");
        setError(
          cause instanceof Error ? cause.message : "La sesión no es válida.",
        );
      })
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [publicId, token]);

  useEffect(() => {
    if (!session?.deadline_at || session.execution_status === "completed")
      return;
    const tick = () => setSeconds(remaining(session.deadline_at));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session?.deadline_at, session?.execution_status]);

  useEffect(() => {
    if (!instrument) return;
    setAnswers(instrument.responses ?? {});
    revisionRef.current = instrument.revision ?? 0;
    setBlockIndex(0);
    setSaved("Avance recuperado");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [instrument?.code]);

  useEffect(() => {
    if (!instrument || blockIndex === 0) return;
    const frame = window.requestAnimationFrame(() => {
      instrumentSectionRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [blockIndex, instrument?.code]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (
        session?.execution_status === "in_progress" &&
        saved !== "Guardado en ERP" &&
        saved !== "Avance recuperado"
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [saved, session?.execution_status]);

  const persist = async (snapshot = answers) => {
    if (
      !instrument ||
      saveInFlight.current ||
      instrument.status === "completed"
    )
      return;
    saveInFlight.current = true;
    setSaved("Guardando...");
    const serialized = JSON.stringify(snapshot);
    try {
      const result = await savePsychResponses(
        token,
        instrument.code,
        snapshot,
        revisionRef.current,
      );
      revisionRef.current = result.revision;
      setSaved(
        JSON.stringify(answersRef.current) === serialized
          ? "Guardado en ERP"
          : "Cambios pendientes",
      );
      setError("");
    } catch (cause) {
      setSaved("No guardado");
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible guardar el avance.",
      );
    } finally {
      saveInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!instrument || saved !== "Cambios pendientes") return;
    const snapshot = answers;
    const id = window.setTimeout(() => void persist(snapshot), 1200);
    return () => window.clearTimeout(id);
  }, [answers, instrument?.code, saved]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!publicId || !validateRut(rut) || code.trim().length < 6)
      return setError("Revisa el RUT, el código y el enlace recibido.");
    setBusy(true);
    setError("");
    try {
      const data = await redeemPsychInvite(publicId, rut, code);
      if (data.session.public_id !== publicId)
        throw new Error("La invitación no corresponde a la sesión creada.");
      localStorage.setItem(storageKey(publicId), data.session_token);
      setToken(data.session_token);
      installSession(data.session);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No fue posible ingresar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!session || session.consents.some((item) => !accepted[item.code]))
      return setError("Debes aceptar ambos consentimientos para continuar.");
    setBusy(true);
    setError("");
    try {
      installSession(await acceptPsychConsents(token, session.consents));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible registrar los consentimientos.",
      );
    } finally {
      setBusy(false);
    }
  };

  const changeBlock = async (next: number) => {
    if (saved === "Cambios pendientes" || saved === "No guardado")
      await persist();
    setBlockIndex(Math.min(Math.max(next, 0), blockCount - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (
      !instrument ||
      !complete ||
      !window.confirm(
        "¿Confirmas tus respuestas de este test? Después no podrás modificarlas.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const next = await submitPsychInstrument(token, instrument.code, answers);
      installSession(next);
      if (next.execution_status === "completed")
        localStorage.removeItem(storageKey(publicId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible finalizar el test.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!publicId)
    return (
      <main className="psych-public">
        <section className="psych-finished">
          <img src={appLogo} alt="Buses JM" className="psych-public-logo" />
          <h1>Enlace inválido</h1>
          <p>Solicita a Reclutamiento un nuevo enlace de evaluación.</p>
        </section>
      </main>
    );
  if (!token || !session)
    return (
      <main className="psych-public">
        <section className="psych-access">
          <img src={appLogo} alt="Buses JM" className="psych-public-logo" />
          <span className="psych-eyebrow">Proceso de selección</span>
          <h1>Evaluación psicolaboral</h1>
          <p>
            Ingresa el RUT y el código temporal incluidos en tu correo. Al
            validarlos comenzarán 90 minutos continuos.
          </p>
          {error ? (
            <div className="psych-feedback psych-feedback--error">{error}</div>
          ) : null}
          <form onSubmit={login}>
            <label>
              <span>RUT</span>
              <input
                value={rut}
                onChange={(event) => setRut(formatRut(event.target.value))}
                inputMode="text"
                autoComplete="username"
                placeholder="12.345.678-9"
              />
            </label>
            <label>
              <span>Código temporal</span>
              <input
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 10),
                  )
                }
                autoComplete="one-time-code"
                placeholder="Código del correo"
              />
            </label>
            <button className="psych-primary-action" disabled={busy}>
              {busy ? "Validando..." : "Ingresar y comenzar"}
            </button>
          </form>
          <small>
            El código funciona una sola vez. Tu avance se guardará
            automáticamente en el ERP.
          </small>
        </section>
      </main>
    );
  if (session.execution_status === "expired" || visibleSeconds <= 0)
    return (
      <main className="psych-public">
        <section className="psych-finished">
          <img src={appLogo} alt="Buses JM" className="psych-public-logo" />
          <h1>El tiempo terminó</h1>
          <p>La sesión de 90 minutos expiró. Comunícate con Reclutamiento.</p>
        </section>
      </main>
    );
  if (session.execution_status === "cancelled")
    return (
      <main className="psych-public">
        <section className="psych-finished">
          <img src={appLogo} alt="Buses JM" className="psych-public-logo" />
          <h1>Evaluación no disponible</h1>
          <p>El proceso de selección asociado ya no se encuentra activo.</p>
        </section>
      </main>
    );
  if (!session.consents_accepted)
    return (
      <main className="psych-public psych-public--scroll">
        <section className="psych-consents">
          <header>
            <div>
              <img src={appLogo} alt="Buses JM" className="psych-public-logo" />
              <span className="psych-eyebrow">Paso obligatorio</span>
              <h1>Consentimientos informados</h1>
            </div>
            <strong className="psych-clock">{clock(visibleSeconds)}</strong>
          </header>
          <p>
            Lee los documentos asignados. Las preguntas solo se habilitarán
            después de aceptar exactamente estas versiones.
          </p>
          {session.consents.map((item) => (
            <article key={`${item.code}-${item.version}`}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.code} · versión {item.version}
                </span>
              </div>
              {item.body
                .split("\n")
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={`${item.code}-${index}`}>{paragraph}</p>
                ))}
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(accepted[item.code])}
                  onChange={(event) =>
                    setAccepted((current) => ({
                      ...current,
                      [item.code]: event.target.checked,
                    }))
                  }
                />
                Declaro haber leído y acepto este consentimiento.
              </label>
            </article>
          ))}
          {error ? (
            <div className="psych-feedback psych-feedback--error">{error}</div>
          ) : null}
          <button
            className="psych-primary-action"
            type="button"
            disabled={
              busy || session.consents.some((item) => !accepted[item.code])
            }
            onClick={() => void accept()}
          >
            {busy ? "Registrando..." : "Aceptar y continuar"}
          </button>
        </section>
      </main>
    );
  if (session.execution_status === "completed")
    return (
      <main className="psych-public">
        <section className="psych-finished">
          <img src={appLogo} alt="Buses JM" className="psych-public-logo" />
          <span className="psych-finished__mark" aria-hidden="true">
            ✓
          </span>
          <h1>Evaluación terminada</h1>
          <p>
            Tus respuestas fueron recibidas y tabuladas correctamente.
            Reclutamiento revisará los resultados.
          </p>
          <small>Ya puedes cerrar esta página.</small>
        </section>
      </main>
    );

  return (
    <main className="psych-runner">
      <header className="psych-runner__header">
        <div className="psych-runner__identity">
          <img src={appLogo} alt="Buses JM" />
          <div>
            <span>{session.candidate.full_name}</span>
            <small>
              {session.candidate.job_position_name} ·{" "}
              {session.candidate.contract_name}
            </small>
          </div>
        </div>
        <div className="psych-progress">
          <span>
            {overall}/{total} respuestas guardadas
          </span>
          <progress max={total} value={overall} />
        </div>
        <strong className="psych-clock">{clock(visibleSeconds)}</strong>
      </header>
      {instrument ? (
        <section ref={instrumentSectionRef} className="psych-instrument">
          <div className="psych-instrument__heading">
            <div>
              <span className="psych-eyebrow">
                Test {instrumentIndex + 1} de {session.instruments.length} ·
                bloque {blockIndex + 1} de {blockCount}
              </span>
              <h1>{instrument.name}</h1>
              <p>{instrument.instructions}</p>
            </div>
            <span
              className={`psych-save-status psych-save-status--${saved === "No guardado" ? "error" : "ok"}`}
            >
              {saved}
            </span>
          </div>
          <nav className="psych-block-nav" aria-label="Páginas del test">
            {Array.from({ length: blockCount }, (_, index) => (
              <button
                type="button"
                key={index}
                className={`psych-block-nav__button ${
                  blockCompletion[index]
                    ? "psych-block-nav__button--complete"
                    : "psych-block-nav__button--incomplete"
                }`}
                aria-current={index === blockIndex ? "step" : undefined}
                aria-label={`Página ${index + 1}: ${
                  blockCompletion[index] ? "completa" : "falta responder"
                }`}
                title={`Página ${index + 1}: ${
                  blockCompletion[index] ? "completa" : "falta responder"
                }`}
                onClick={() => void changeBlock(index)}
              >
                {index + 1}
              </button>
            ))}
          </nav>
          <div className="psych-questions">
            {visibleQuestions.map((question) => (
              <fieldset key={question.order}>
                <legend>
                  <span className="psych-question-number">
                    {question.order}
                  </span>
                  <span className="psych-question-text">{question.text}</span>
                </legend>
                <div>
                  {instrument.options.map((option) => (
                    <label
                      key={option.value}
                      className={
                        answers[String(question.order)] === option.value
                          ? "selected"
                          : ""
                      }
                    >
                      <input
                        type="radio"
                        name={`${instrument.code}-${question.order}`}
                        value={option.value}
                        checked={
                          answers[String(question.order)] === option.value
                        }
                        onChange={() => {
                          setAnswers((current) => ({
                            ...current,
                            [String(question.order)]: option.value,
                          }));
                          setSaved("Cambios pendientes");
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {error ? (
            <div className="psych-feedback psych-feedback--error">{error}</div>
          ) : null}
          <footer className="psych-runner__footer">
            <button
              className="psych-secondary-action"
              type="button"
              disabled={blockIndex === 0 || busy}
              onClick={() => void changeBlock(blockIndex - 1)}
            >
              Anterior
            </button>
            <span>
              {currentAnswered}/{questions.length} respondidas
            </span>
            {blockIndex < blockCount - 1 ? (
              <button
                className="psych-primary-action"
                type="button"
                disabled={busy}
                onClick={() => void changeBlock(blockIndex + 1)}
              >
                Guardar y continuar
              </button>
            ) : (
              <button
                className="psych-primary-action"
                type="button"
                disabled={!complete || busy}
                onClick={() => void submit()}
              >
                {busy ? "Finalizando..." : "Finalizar este test"}
              </button>
            )}
          </footer>
        </section>
      ) : null}
    </main>
  );
}
