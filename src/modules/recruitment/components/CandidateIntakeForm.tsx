import { useEffect, useMemo, useState } from "react";
import { logger } from "../../../shared/lib/logger";
import {
  addCandidateToRecruitmentCase,
  formatRut,
  normalizeRut,
  findCandidateProfileByRut,
  checkCandidateInBukLive,
  toRecruitmentCandidateStageLabel,
  type RecruitmentCaseListRow,
  type RecruitmentCaseDetail,
  type BukCandidateStatus
} from "../services/hiringControl";
import { validateRut } from "../../../shared/lib/rut";
import { SelectField, TextField } from "../../../shared/ui";

type CandidateIntakeFormProps = {
  initialCaseId: string;
  candidateIntakeCases: RecruitmentCaseListRow[];
  selectedCaseDetail: RecruitmentCaseDetail | null;
  onCandidateAdded: (caseId: string, candidateId: string) => Promise<void>;
};

type CandidateLookupProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export function CandidateIntakeForm({
  initialCaseId,
  candidateIntakeCases,
  selectedCaseDetail,
  onCandidateAdded
}: CandidateIntakeFormProps) {
  const [candidateForm, setCandidateForm] = useState({
    caseId: initialCaseId,
    nationalId: "",
    fullName: "",
    email: "",
    phone: ""
  });
  const [candidateRutTouched, setCandidateRutTouched] = useState(false);
  const [candidateFormError, setCandidateFormError] = useState("");
  const [candidateFormStatus, setCandidateFormStatus] = useState("");
  const [isCandidateSaving, setIsCandidateSaving] = useState(false);

  // States for candidate lookup
  const [isSearchingCandidate, setIsSearchingCandidate] = useState(false);
  const [foundCandidateProfile, setFoundCandidateProfile] = useState<CandidateLookupProfile | null>(null);
  const [lastSearchedRut, setLastSearchedRut] = useState("");
  
  // States for Buk lookup
  const [isSearchingBuk, setIsSearchingBuk] = useState(false);
  const [foundBukStatus, setFoundBukStatus] = useState<BukCandidateStatus | null>(null);

  useEffect(() => {
    if (!candidateForm.caseId && initialCaseId) {
      setCandidateForm((current) => ({
        ...current,
        caseId: initialCaseId
      }));
    }
  }, [candidateForm.caseId, initialCaseId]);

  const isCandidateRutValid = useMemo(() => {
    if (!candidateForm.nationalId) {
      return true;
    }

    return validateRut(candidateForm.nationalId);
  }, [candidateForm.nationalId]);

  const shouldShowCandidateRutError =
    candidateRutTouched && Boolean(candidateForm.nationalId) && !isCandidateRutValid;

  // Perform candidate lookup in background when RUT is valid
  useEffect(() => {
    const rut = candidateForm.nationalId;
    if (validateRut(rut)) {
      const normalized = normalizeRut(rut);
      const lastNormalized = normalizeRut(lastSearchedRut);

      if (normalized && normalized !== lastNormalized) {
        setLastSearchedRut(rut);
        void performCandidateLookup(rut);
      }
    } else {
      // If the RUT is cleared or becomes invalid, reset lookup states
      if (!rut && (foundCandidateProfile || foundBukStatus)) {
        setFoundCandidateProfile(null);
        setFoundBukStatus(null);
        setLastSearchedRut("");
        setCandidateForm((current) => ({
          ...current,
          fullName: "",
          email: "",
          phone: ""
        }));
        setCandidateFormStatus("");
      }
    }
  }, [candidateForm.nationalId, lastSearchedRut, foundCandidateProfile, foundBukStatus]);

  const performCandidateLookup = async (rut: string) => {
    setIsSearchingCandidate(true);
    setIsSearchingBuk(true);
    setCandidateFormError("");
    setFoundBukStatus(null);
    setCandidateFormStatus("🔍 Buscando candidato en el sistema y en BUK...");

    const [localResponse, bukResponse] = await Promise.all([
      findCandidateProfileByRut(rut),
      checkCandidateInBukLive(rut)
    ]);

    setIsSearchingCandidate(false);
    setIsSearchingBuk(false);

    if (localResponse.error) {
      logger.error("CandidateIntakeForm performCandidateLookup local", localResponse.error);
    }
    
    if (bukResponse.error) {
      logger.error("CandidateIntakeForm performCandidateLookup buk", bukResponse.error);
    }

    if (localResponse.data) {
      setFoundCandidateProfile(localResponse.data as CandidateLookupProfile);
      setCandidateForm((current) => ({
        ...current,
        fullName: (localResponse.data as CandidateLookupProfile).full_name,
        email: (localResponse.data as CandidateLookupProfile).email || "",
        phone: (localResponse.data as CandidateLookupProfile).phone || ""
      }));
      setCandidateFormStatus("✓ Candidato registrado en el sistema local. Datos autocompletados.");
    } else {
      setFoundCandidateProfile(null);
      setCandidateFormStatus("");
    }

    if (bukResponse.data?.exists) {
      setFoundBukStatus(bukResponse.data);
    }
  };

  // Check if candidate is already in the selected case
  const candidateInSelectedCase = useMemo(() => {
    if (!candidateForm.nationalId || !validateRut(candidateForm.nationalId)) {
      return null;
    }
    if (!selectedCaseDetail || selectedCaseDetail.case.id !== candidateForm.caseId) {
      return null;
    }

    const normalizedInputRut = normalizeRut(candidateForm.nationalId);
    const existing = selectedCaseDetail.candidates.find(
      (c) => normalizeRut(c.national_id) === normalizedInputRut
    );

    return existing || null;
  }, [candidateForm.nationalId, candidateForm.caseId, selectedCaseDetail]);

  const handleAddCandidate = async () => {
    if (!candidateForm.caseId) {
      setCandidateRutTouched(true);
      setCandidateFormError("Debes seleccionar un caso activo para registrar el candidato.");
      setCandidateFormStatus("");
      return;
    }

    if (!candidateForm.nationalId.trim() || !candidateForm.fullName.trim()) {
      setCandidateRutTouched(true);
      setCandidateFormError("RUT y nombre del candidato son obligatorios.");
      setCandidateFormStatus("");
      return;
    }

    if (!validateRut(candidateForm.nationalId)) {
      setCandidateRutTouched(true);
      setCandidateFormError("El RUT ingresado no es válido.");
      setCandidateFormStatus("");
      return;
    }

    if (candidateInSelectedCase) {
      setCandidateFormError("Este candidato ya participa en el caso seleccionado.");
      setCandidateFormStatus("");
      return;
    }

    setIsCandidateSaving(true);
    setCandidateFormError("");
    setCandidateFormStatus("");

    const { data, error } = await addCandidateToRecruitmentCase({
      caseId: candidateForm.caseId,
      nationalId: candidateForm.nationalId,
      fullName: candidateForm.fullName,
      email: candidateForm.email,
      phone: candidateForm.phone
    });

    if (error) {
      setCandidateFormError(error);
      setIsCandidateSaving(false);
      return;
    }

    const savedCaseId = candidateForm.caseId;
    const savedCandidateId = data?.case_candidate_id ?? "";

    setCandidateForm({
      caseId: savedCaseId,
      nationalId: "",
      fullName: "",
      email: "",
      phone: ""
    });
    setFoundCandidateProfile(null);
    setLastSearchedRut("");
    setCandidateRutTouched(false);
    setCandidateFormStatus("Candidato registrado en el caso seleccionado.");
    setIsCandidateSaving(false);

    await onCandidateAdded(savedCaseId, savedCandidateId);
  };

  return (
    <div className="control-detail-panel control-detail-panel-inline">
      <div className="control-detail-header">
        <h3>Alta de candidato</h3>
        <span className="tracking-filter-caption">
          Registro inicial asociado a un caso activo real.
        </span>
      </div>

      <div className="control-edit-grid">
        <SelectField
          id="candidate-case-id"
          label="Caso activo"
          value={candidateForm.caseId}
          onChange={(event) =>
            setCandidateForm((current) => ({
              ...current,
              caseId: event.target.value
            }))
          }
          options={candidateIntakeCases.map((caseRow) => ({
            value: caseRow.id,
            label: `${caseRow.case_code} · ${caseRow.contract_name} · ${caseRow.job_position_name}`
          }))}
          placeholder="Selecciona un caso"
        />

        <TextField
          id="candidate-national-id"
          label="RUT / Identificador"
          value={candidateForm.nationalId}
          inputMode="text"
          autoComplete="off"
          placeholder="12.345.678-K"
          hasError={shouldShowCandidateRutError}
          onChange={(event) => {
            const nextRut = formatRut(event.target.value);

            setCandidateForm((current) => ({
              ...current,
              nationalId: nextRut
            }));

            if (!candidateRutTouched) {
              return;
            }

            if (!nextRut || validateRut(nextRut)) {
              setCandidateFormError("");
            } else {
              setCandidateFormError("El RUT ingresado no es válido.");
            }
          }}
          onBlur={() => {
            setCandidateRutTouched(true);

            if (candidateForm.nationalId && !validateRut(candidateForm.nationalId)) {
              setCandidateFormError("El RUT ingresado no es válido.");
              return;
            }

            setCandidateFormError("");
          }}
        />

        <TextField
          id="candidate-full-name"
          label="Nombre completo"
          value={candidateForm.fullName}
          placeholder="Nombres Apellido Paterno Apellido Materno"
          onChange={(event) => {
            setCandidateForm((current) => ({
              ...current,
              fullName: event.target.value
            }));
            setCandidateFormError("");
          }}
        />

        <TextField
          id="candidate-email"
          label="Correo"
          value={candidateForm.email}
          onChange={(event) =>
            setCandidateForm((current) => ({
              ...current,
              email: event.target.value
            }))
          }
        />

        <TextField
          id="candidate-phone"
          label="Teléfono"
          value={candidateForm.phone}
          onChange={(event) =>
            setCandidateForm((current) => ({
              ...current,
              phone: event.target.value
            }))
          }
        />

        {candidateInSelectedCase ? (
          <div className="control-span-full" style={{ margin: "0.25rem 0" }}>
            <p className="form-status form-status-error" style={{ fontSize: "0.88rem", fontWeight: 500 }}>
              ⚠️ Este candidato ya participa en el caso seleccionado en la etapa "
              {toRecruitmentCandidateStageLabel(candidateInSelectedCase.stage_code)}".
            </p>
          </div>
        ) : null}

        <div className="control-span-full">
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            disabled={isCandidateSaving || isSearchingCandidate || Boolean(candidateInSelectedCase)}
            onClick={() => void handleAddCandidate()}
          >
            {isCandidateSaving ? "Registrando..." : "Registrar candidato en el caso"}
          </button>
        </div>
      </div>

      {candidateFormError && !candidateInSelectedCase ? (
        <p className="form-status form-status-error" style={{ marginTop: "0.5rem" }}>
          {candidateFormError}
        </p>
      ) : null}

      {foundBukStatus?.exists && !candidateInSelectedCase ? (
        <div 
          className="control-span-full" 
          style={{ 
            marginTop: "0.5rem", 
            padding: "8px 12px", 
            borderRadius: "6px", 
            backgroundColor: foundBukStatus.status?.toLowerCase() === "activo" ? "#fff1f0" : "#fffbe6",
            border: `1px solid ${foundBukStatus.status?.toLowerCase() === "activo" ? "#ffccc7" : "#ffe58f"}`
          }}
        >
          <p 
            style={{ 
              fontSize: "0.88rem", 
              fontWeight: 500, 
              color: foundBukStatus.status?.toLowerCase() === "activo" ? "#cf1322" : "#d48806",
              margin: 0
            }}
          >
            {foundBukStatus.status?.toLowerCase() === "activo" ? "🔴" : "🟡"} Atención: El RUT ingresado ya cuenta con historial en BUK (Estado: {foundBukStatus.status?.toUpperCase()}).
          </p>
        </div>
      ) : null}

      {candidateFormStatus ? (
        <p
          className="form-status"
          style={{
            marginTop: "0.5rem",
            color: foundCandidateProfile ? "#027a48" : (isSearchingCandidate || isSearchingBuk) ? "var(--accent)" : "var(--text-muted)",
            fontWeight: foundCandidateProfile ? 500 : "normal"
          }}
        >
          {candidateFormStatus}
        </p>
      ) : null}
    </div>
  );
}
