import { useEffect, useMemo, useState } from "react";
import {
  addCandidateToRecruitmentCase,
  formatRut,
  type RecruitmentCaseListRow
} from "../services/hiringControl";
import { validateRut } from "../../../shared/lib/rut";
import { SelectField, TextField } from "../../../shared/ui";

type CandidateIntakeFormProps = {
  initialCaseId: string;
  candidateIntakeCases: RecruitmentCaseListRow[];
  onCandidateAdded: (caseId: string, candidateId: string) => Promise<void>;
};

export function CandidateIntakeForm({
  initialCaseId,
  candidateIntakeCases,
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

        <div className="control-span-full">
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            disabled={isCandidateSaving}
            onClick={() => void handleAddCandidate()}
          >
            Registrar candidato en el caso
          </button>
        </div>
      </div>

      {candidateFormError ? (
        <p className="form-status form-status-error">{candidateFormError}</p>
      ) : null}
      {candidateFormStatus ? <p className="form-status">{candidateFormStatus}</p> : null}
    </div>
  );
}
