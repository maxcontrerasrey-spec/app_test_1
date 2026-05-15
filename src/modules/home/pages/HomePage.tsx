import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { supabase } from "../../../shared/lib/supabase";

type HiringRequestSummaryRow = {
  id: string;
  folio: string | null;
  status: "pendiente" | "aprobada" | "rechazada" | "cerrada";
  contract_name: string;
  job_position_name: string;
  created_at: string;
};

type PendingApprovalRow = {
  id: number;
  step_name: string;
  step_code?: string;
  hiring_request_id: string;
  hiring_requests:
    | {
        folio: string | null;
        contract_name: string;
        contract_number?: string | null;
        job_position_name: string;
        requester_name?: string | null;
        requester_email?: string | null;
        vacancies?: number | null;
        requested_entry_date?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        shift_name?: string | null;
        status?: string | null;
        salary_offer?: number | null;
        campamento?: boolean | null;
        pasajes?: boolean | null;
        other_benefits?: string | null;
      }
    | {
        folio: string | null;
        contract_name: string;
        contract_number?: string | null;
        job_position_name: string;
        requester_name?: string | null;
        requester_email?: string | null;
        vacancies?: number | null;
        requested_entry_date?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        shift_name?: string | null;
        status?: string | null;
        salary_offer?: number | null;
        campamento?: boolean | null;
        pasajes?: boolean | null;
        other_benefits?: string | null;
      }[]
    | null;
};

function formatRequestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function toStatusLabel(value: HiringRequestSummaryRow["status"]) {
  if (value === "aprobada") return "Aprobada";
  if (value === "rechazada") return "Rechazada";
  if (value === "cerrada") return "Cerrada";
  return "Pendiente";
}

function formatCurrencyValue(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "No disponible";
  }

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

function formatBooleanLabel(value: boolean | null | undefined) {
  if (value === true) return "Si";
  if (value === false) return "No";
  return "No disponible";
}

export function HomePage() {
  const { user, displayName, appRoles, isSuperAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [myRequests, setMyRequests] = useState<HiringRequestSummaryRow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRow[]>([]);
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalRow | null>(null);

  const loadHomeSummary = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyRequests([]);
      setPendingApprovals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const requestsPromise = supabase
      .from("hiring_requests")
      .select("id, folio, status, contract_name, job_position_name, created_at")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const isPrivilegedApprover =
      isSuperAdmin || appRoles.includes("admin") || appRoles.includes("aprobador_folios");

    let approvalsQuery = supabase
      .from("hiring_request_approvals")
      .select(
        "id, step_code, step_name, hiring_request_id, approver_user_id, hiring_requests!inner(folio, contract_name, contract_number, job_position_name, requester_name, requester_email, vacancies, requested_entry_date, start_date, end_date, shift_name, status, salary_offer, campamento, pasajes, other_benefits)"
      )
      .eq("status", "pending")
      .neq("step_code", "requester_signature")
      .order("created_at", { ascending: true })
      .limit(8);

    if (!isPrivilegedApprover) {
      approvalsQuery = approvalsQuery.eq("approver_user_id", user.id);
    }

    const [requestsResponse, approvalsResponse] = await Promise.all([
      requestsPromise,
      approvalsQuery
    ]);

    if (requestsResponse.error || approvalsResponse.error) {
      setErrorMessage("No fue posible cargar el resumen del inicio.");
      setMyRequests([]);
      setPendingApprovals([]);
      setIsLoading(false);
      return;
    }

    setMyRequests((requestsResponse.data as HiringRequestSummaryRow[] | null) ?? []);
    setPendingApprovals((approvalsResponse.data as PendingApprovalRow[] | null) ?? []);
    setIsLoading(false);
  }, [appRoles, isSuperAdmin, user?.id]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      await loadHomeSummary();
      if (!isMounted) {
        return;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadHomeSummary]);

  const requestStatusSummary = useMemo(
    () =>
      myRequests.reduce<Record<string, number>>((accumulator, row) => {
        accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
        return accumulator;
      }, {}),
    [myRequests]
  );

  const isApprover =
    isSuperAdmin ||
    appRoles.includes("admin") ||
    appRoles.includes("aprobador_folios");

  const pendingApprovalsCount = pendingApprovals.length;

  const handleApprovalDecision = async (
    approvalId: number,
    decision: "approved" | "rejected"
  ) => {
    if (!supabase) {
      return;
    }

    setIsDecisionLoading(approvalId);
    setDecisionMessage("");

    const { error } = await supabase.rpc("decide_hiring_request_approval", {
      p_approval_id: approvalId,
      p_decision: decision,
      p_comments: null
    });

    if (error) {
      setDecisionMessage("No fue posible registrar la decisión.");
      setIsDecisionLoading(null);
      return;
    }

    setDecisionMessage(decision === "approved" ? "Aprobación registrada." : "Rechazo registrado.");
    setIsDecisionLoading(null);
    setSelectedApproval(null);
    await loadHomeSummary();
  };

  return (
    <section className="page">
      <div className="hero-panel hero-panel-accent">
        <span className="eyebrow eyebrow-inverse">Plataforma JM</span>
        <h2>Panel de Inicio de {displayName}</h2>
        <p className="hero-copy">
          Este panel resume tus requerimientos de contratación y, cuando corresponda, tus
          aprobaciones pendientes.
        </p>
      </div>

      <div className="card-grid home-overview-grid">
        <article className="info-card">
          <h3>Mis solicitudes</h3>
          <p>{isLoading ? "Cargando..." : `${myRequests.length} registradas recientemente`}</p>
          <p>
            Pendientes: {requestStatusSummary.pendiente ?? 0} · Aprobadas:{" "}
            {requestStatusSummary.aprobada ?? 0} · Rechazadas:{" "}
            {requestStatusSummary.rechazada ?? 0}
          </p>
        </article>

        <article className="info-card">
          <h3>Aprobaciones pendientes</h3>
          <p>
            {isApprover
              ? isLoading
                ? "Cargando..."
                : `${pendingApprovalsCount} pendientes de decisión`
              : "Tu perfil no tiene aprobaciones asignadas"}
          </p>
          {isApprover ? <p>Gestiona tus aprobaciones directamente desde este panel.</p> : null}
        </article>

        <article className="info-card">
          <h3>Estado operativo</h3>
          <p>{errorMessage || "Datos sincronizados desde Supabase."}</p>
          <p>
            <Link to="/solicitud-contrataciones">Crear nueva solicitud</Link>
          </p>
        </article>
      </div>

      <div className="card-grid home-detail-grid">
        <article className="info-card">
          <h3>Ultimas solicitudes realizadas</h3>
          {myRequests.length === 0 ? (
            <p>{isLoading ? "Cargando requerimientos..." : "Aun no tienes solicitudes."}</p>
          ) : (
            <ul className="summary-list">
              {myRequests.map((request) => (
                <li key={request.id}>
                  <strong>{request.folio ?? "Sin folio"}</strong> ·{" "}
                  {toStatusLabel(request.status)} · {request.job_position_name} ·{" "}
                  {request.contract_name} · {formatRequestDate(request.created_at)}
                </li>
              ))}
            </ul>
          )}
        </article>

        {isApprover ? (
          <article className="info-card approval-panel-card">
            <h3>Aprobaciones pendientes para mi cuenta</h3>
            {pendingApprovals.length === 0 ? (
              <p>{isLoading ? "Cargando pendientes..." : "No tienes pendientes."}</p>
            ) : (
              <ul className="approval-queue">
                {pendingApprovals.map((approval) => {
                  const request = Array.isArray(approval.hiring_requests)
                    ? approval.hiring_requests[0]
                    : approval.hiring_requests;

                  return (
                    <li key={approval.id} className="approval-queue-item">
                      <div className="approval-queue-copy">
                        <strong>{request?.folio ?? "Sin folio"}</strong>
                        <span>{approval.step_name}</span>
                        <span>{request?.job_position_name ?? "Cargo no disponible"}</span>
                        <span>{request?.contract_name ?? "Contrato no disponible"}</span>
                      </div>
                      <div className="approval-action-row">
                        <button
                          type="button"
                          className="soft-primary-button soft-primary-button-neutral"
                          onClick={() => setSelectedApproval(approval)}
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          className="soft-primary-button soft-primary-button-success"
                          disabled={isDecisionLoading === approval.id}
                          onClick={() => handleApprovalDecision(approval.id, "approved")}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="soft-primary-button soft-primary-button-danger"
                          disabled={isDecisionLoading === approval.id}
                          onClick={() => handleApprovalDecision(approval.id, "rejected")}
                        >
                          Rechazar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}
          </article>
        ) : null}
      </div>

      {selectedApproval ? (
        <div className="info-card approval-detail-card">
          {(() => {
            const request = Array.isArray(selectedApproval.hiring_requests)
              ? selectedApproval.hiring_requests[0]
              : selectedApproval.hiring_requests;

            return (
              <>
                <h3>Detalle para aprobación</h3>
                <div className="approval-detail-grid">
                  <div className="approval-detail-item">
                    <small>Folio</small>
                    <strong>{request?.folio ?? "Sin folio"}</strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Etapa</small>
                    <strong>{selectedApproval.step_name}</strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Solicitante</small>
                    <strong title={request?.requester_name ?? "No disponible"}>
                      {request?.requester_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Correo</small>
                    <strong title={request?.requester_email ?? "No disponible"}>
                      {request?.requester_email ?? "No disponible"}
                    </strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Cargo solicitado</small>
                    <strong title={request?.job_position_name ?? "No disponible"}>
                      {request?.job_position_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Vacantes</small>
                    <strong>{request?.vacancies ?? 0}</strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Contrato</small>
                    <strong title={request?.contract_name ?? "No disponible"}>
                      {request?.contract_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div className="approval-detail-item">
                    <small>Numero contrato</small>
                    <strong title={request?.contract_number ?? "No disponible"}>
                      {request?.contract_number ?? "No disponible"}
                    </strong>
                  </div>
                </div>

                <div className="approval-chip-row">
                  <span className="approval-chip">
                    Fecha ingreso:{" "}
                    {request?.requested_entry_date
                      ? formatRequestDate(request.requested_entry_date)
                      : "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Inicio:{" "}
                    {request?.start_date ? formatRequestDate(request.start_date) : "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Termino:{" "}
                    {request?.end_date ? formatRequestDate(request.end_date) : "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Turno: {request?.shift_name ?? "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Renta: {formatCurrencyValue(request?.salary_offer)}
                  </span>
                  <span className="approval-chip">
                    Campamento: {formatBooleanLabel(request?.campamento)}
                  </span>
                  <span className="approval-chip">
                    Pasajes: {formatBooleanLabel(request?.pasajes)}
                  </span>
                  <span className="approval-chip">
                    Estado: {request?.status ?? "No disponible"}
                  </span>
                </div>

                <div className="approval-detail-note">
                  <small>Otros beneficios</small>
                  <strong>{request?.other_benefits?.trim() || "No informado"}</strong>
                </div>

                <div className="approval-action-row approval-action-row-detail">
                  <button
                    type="button"
                    className="soft-primary-button soft-primary-button-success"
                    disabled={isDecisionLoading === selectedApproval.id}
                    onClick={() => handleApprovalDecision(selectedApproval.id, "approved")}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button soft-primary-button-danger"
                    disabled={isDecisionLoading === selectedApproval.id}
                    onClick={() => handleApprovalDecision(selectedApproval.id, "rejected")}
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button soft-primary-button-neutral"
                    onClick={() => setSelectedApproval(null)}
                  >
                    Cerrar detalle
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
    </section>
  );
}
