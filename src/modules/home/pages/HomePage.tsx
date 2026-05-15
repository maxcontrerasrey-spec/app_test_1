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
  hiring_request_id: string;
  hiring_requests:
    | {
        folio: string | null;
        contract_name: string;
        job_position_name: string;
      }
    | {
        folio: string | null;
        contract_name: string;
        job_position_name: string;
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

export function HomePage() {
  const { user, displayName, appRoles, isSuperAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [myRequests, setMyRequests] = useState<HiringRequestSummaryRow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRow[]>([]);
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);
  const [decisionMessage, setDecisionMessage] = useState("");

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

    const approvalsPromise = supabase
      .from("hiring_request_approvals")
      .select(
        "id, step_name, hiring_request_id, hiring_requests!inner(folio, contract_name, job_position_name)"
      )
      .eq("approver_user_id", user.id)
      .eq("status", "pending")
      .neq("step_code", "requester_signature")
      .order("created_at", { ascending: true })
      .limit(8);

    const [requestsResponse, approvalsResponse] = await Promise.all([
      requestsPromise,
      approvalsPromise
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
  }, [user?.id]);

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

      <div className="card-grid">
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

      <div className="card-grid">
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
          <article className="info-card">
            <h3>Aprobaciones pendientes para mi cuenta</h3>
            {pendingApprovals.length === 0 ? (
              <p>{isLoading ? "Cargando pendientes..." : "No tienes pendientes."}</p>
            ) : (
              <ul className="summary-list">
                {pendingApprovals.map((approval) => {
                  const request = Array.isArray(approval.hiring_requests)
                    ? approval.hiring_requests[0]
                    : approval.hiring_requests;

                  return (
                    <li key={approval.id}>
                      <strong>{request?.folio ?? "Sin folio"}</strong> · {approval.step_name} ·{" "}
                      {request?.job_position_name ?? "Cargo no disponible"} ·{" "}
                      {request?.contract_name ?? "Contrato no disponible"}
                      <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="soft-primary-button"
                          disabled={isDecisionLoading === approval.id}
                          onClick={() => handleApprovalDecision(approval.id, "approved")}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="soft-primary-button"
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
    </section>
  );
}
