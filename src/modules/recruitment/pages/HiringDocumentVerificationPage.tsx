import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import jmLogoUrl from "../../competencies/assets/jm.png";
import "../../competencies/styles/competencies.css";
import {
  verifyHiringDocument,
  type HiringDocumentPublicVerification
} from "../services/hiringDocumentVerification";

function formatDate(value: string | null) {
  if (!value) return "No informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
}

function statusLabel(verification: HiringDocumentPublicVerification) {
  if (!verification.found) return "Documento no encontrado";
  if (verification.status === "valid") return "Solicitud de contratación válida";
  if (verification.status === "pending_buk") return "Documento auténtico · registro BUK pendiente";
  if (verification.status === "reconciliation_required") return "Documento auténtico · carga BUK en conciliación";
  if (verification.status === "revoked") return "Documento revocado";
  if (verification.status === "replaced") return "Documento reemplazado";
  return "Documento no vigente";
}

function statusTone(verification: HiringDocumentPublicVerification) {
  if (!verification.found) return "neutral";
  if (verification.isCurrent) return "success";
  if (verification.isAuthentic && ["pending_buk", "reconciliation_required"].includes(verification.status)) return "warning";
  return "danger";
}

export function HiringDocumentVerificationPage() {
  const { lookup } = useParams();
  const initialLookup = useMemo(() => decodeURIComponent(lookup ?? "").trim(), [lookup]);
  const [lookupText, setLookupText] = useState(initialLookup);
  const [verification, setVerification] = useState<HiringDocumentPublicVerification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runVerification(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      setVerification(null);
      setErrorMessage("Escanea el código QR o ingresa el token de verificación del documento.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setVerification(await verifyHiringDocument(normalized));
    } catch (error) {
      setVerification(null);
      setErrorMessage(error instanceof Error ? error.message : "No fue posible validar el documento.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setLookupText(initialLookup);
    if (initialLookup) void runVerification(initialLookup);
  }, [initialLookup]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runVerification(lookupText);
  }

  const tone = verification ? statusTone(verification) : "neutral";

  return (
    <main className="competency-verification-page">
      <section className="competency-verification-card">
        <header className="competency-verification-header">
          <img src={jmLogoUrl} alt="JM" />
          <div>
            <p>Portal de validación ERP</p>
            <h1>Validación de Solicitud de Contratación</h1>
          </div>
        </header>

        <form className="competency-verification-search" onSubmit={handleSubmit}>
          <label htmlFor="hiring-document-public-lookup">Token del código QR</label>
          <div>
            <input
              id="hiring-document-public-lookup"
              value={lookupText}
              onChange={(event) => setLookupText(event.target.value)}
              placeholder="Token de verificación"
              autoComplete="off"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Validando..." : "Validar"}
            </button>
          </div>
        </form>

        {errorMessage ? <div className="competency-alert">{errorMessage}</div> : null}

        {verification ? (
          <section className={`competency-verification-result competency-verification-result-${tone}`}>
            <div className="competency-verification-status">
              <span>{statusLabel(verification)}</span>
              <strong>{verification.document.folio || "Sin folio informado"}</strong>
            </div>

            {!verification.found ? (
              <p className="competency-verification-muted">
                No existe una Solicitud de Contratación emitida por el ERP para este token.
              </p>
            ) : (
              <>
                <div className="competency-verification-grid">
                  <div>
                    <span>Trabajador</span>
                    <strong>{verification.worker.fullName}</strong>
                    <small>RUN {verification.worker.documentNumberMasked}</small>
                  </div>
                  <div>
                    <span>Contratación</span>
                    <strong>{verification.worker.jobTitle}</strong>
                    <small>{verification.employment.companyName} · {verification.employment.contractName}</small>
                  </div>
                  <div>
                    <span>Validación documental</span>
                    <strong>{verification.validation.fullName}</strong>
                    <small>{verification.validation.jobTitle} · {formatDate(verification.validation.validatedAt)}</small>
                  </div>
                </div>

                <dl className="competency-verification-metadata">
                  <div>
                    <dt>Código de formato</dt>
                    <dd>{verification.document.templateCode} · Versión {verification.document.templateVersion}</dd>
                  </div>
                  <div>
                    <dt>Emitido el</dt>
                    <dd>{formatDate(verification.document.issuedAt)}</dd>
                  </div>
                  <div>
                    <dt>Huella SHA-256 del PDF</dt>
                    <dd>{verification.document.pdfSha256 ?? "No informada"}</dd>
                  </div>
                </dl>
              </>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
