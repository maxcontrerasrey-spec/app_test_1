import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { verifyCompetencyCertificate } from "../services/competencyCoreApi";
import type { CompetencyPublicVerification } from "../types";
import jmLogoUrl from "../assets/jm.png";
import "../styles/competencies.css";

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string | null) {
  if (!value) return "No informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function statusLabel(verification: CompetencyPublicVerification) {
  if (!verification.found) return "No encontrado";
  if (verification.status === "valid") return "Certificado vigente";
  if (verification.status === "expired") return "Certificado vencido";
  if (verification.status === "revoked") return "Certificado revocado";
  if (verification.status === "replaced") return "Certificado reemplazado";
  if (verification.status === "buk_upload_failed") return "Pendiente de registro BUK";
  return "Certificado no vigente";
}

function statusTone(verification: CompetencyPublicVerification) {
  if (!verification.found) return "neutral";
  if (verification.isCurrent) return "success";
  if (verification.status === "expired") return "warning";
  return "danger";
}

function normalizeLookup(value: string | undefined) {
  return decodeURIComponent(value ?? "").trim();
}

export function CompetencyVerificationPage() {
  const { lookup } = useParams();
  const initialLookup = useMemo(() => normalizeLookup(lookup), [lookup]);
  const [lookupText, setLookupText] = useState(initialLookup);
  const [verification, setVerification] = useState<CompetencyPublicVerification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runVerification(nextLookup: string) {
    const normalized = nextLookup.trim();
    if (!normalized) {
      setVerification(null);
      setErrorMessage("Ingresa un folio o abre el enlace desde el codigo QR del certificado.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await verifyCompetencyCertificate(normalized);
      setVerification(result);
    } catch (error) {
      setVerification(null);
      setErrorMessage(buildErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setLookupText(initialLookup);
    if (initialLookup) {
      void runVerification(initialLookup);
    }
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
            <p>Portal de validacion ERP</p>
            <h1>Validacion de certificado de competencias</h1>
          </div>
        </header>

        <form className="competency-verification-search" onSubmit={handleSubmit}>
          <label htmlFor="competency-public-lookup">Folio o codigo QR</label>
          <div>
            <input
              id="competency-public-lookup"
              value={lookupText}
              onChange={(event) => setLookupText(event.target.value)}
              placeholder="Ej: COMP-2026-000001"
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
              <strong>{verification.certificate.folio || "Sin folio informado"}</strong>
            </div>

            {!verification.found ? (
              <p className="competency-verification-muted">
                No existe un certificado emitido por el ERP para el folio o codigo consultado.
              </p>
            ) : (
              <>
                <div className="competency-verification-grid">
                  <div>
                    <span>Trabajador</span>
                    <strong>{verification.worker.fullName}</strong>
                    <small>RUT N. {verification.worker.documentNumber}</small>
                  </div>
                  <div>
                    <span>Vigencia</span>
                    <strong>{formatDate(verification.certificate.validFrom)} al {formatDate(verification.certificate.validUntil)}</strong>
                    <small>{verification.certificate.bukRegistered ? "Registrado en BUK" : "Registro BUK pendiente"}</small>
                  </div>
                  <div>
                    <span>Instructor</span>
                    <strong>{verification.instructor.fullName}</strong>
                    <small>{verification.instructor.profileCode}</small>
                  </div>
                </div>

                <div className="competency-verification-equipment">
                  <h2>Equipos autorizados</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Marca</th>
                        <th>Tipo de equipo</th>
                        <th>Modelo / configuracion autorizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verification.equipment.map((item) => (
                        <tr key={`${item.brandName}-${item.typeName}-${item.modelName}`}>
                          <td>{item.brandName}</td>
                          <td>{item.typeName}</td>
                          <td>{item.modelName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <dl className="competency-verification-metadata">
                  <div>
                    <dt>Codigo de formato</dt>
                    <dd>{verification.certificate.templateCode} · Version {verification.certificate.templateVersion}</dd>
                  </div>
                  <div>
                    <dt>Emitido el</dt>
                    <dd>{formatDate(verification.certificate.issuedAt)}</dd>
                  </div>
                  <div>
                    <dt>Huella SHA-256 del PDF</dt>
                    <dd>{verification.certificate.pdfSha256 ?? "No informada"}</dd>
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
