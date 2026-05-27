import { useEffect, useState } from "react";
import { SelectField, TextField } from "../../../shared/ui";
import {
  updateCandidatePersonProfile,
  updateCandidateWorkerFile,
  type RecruitmentCaseCandidateRow,
  type RecruitmentCaseDetail
} from "../services/hiringControl";

type CandidateWorkerFileFormProps = {
  candidate: RecruitmentCaseCandidateRow;
  caseDetail: RecruitmentCaseDetail;
  onSaved?: () => Promise<void>;
};

type PersonDraft = {
  birthDate: string;
  nationality: string;
  maritalStatus: string;
  addressLine: string;
  districtOrCommune: string;
  currentCity: string;
  region: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  inclusionNotes: string;
  firefighterStatus: string;
  shirtSize: string;
  pantsSize: string;
  shoeSize: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  afpName: string;
  healthProvider: string;
};

type WorkerDraft = {
  projectName: string;
  companyEntryDate: string;
  shiftName: string;
  advanceAmount: string;
  contractNotes: string;
};

const maritalStatusOptions = [
  { value: "soltero", label: "Soltero(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "union_civil", label: "Unión civil" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viudo", label: "Viudo(a)" }
];

const firefighterStatusOptions = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_informa", label: "No informa" }
];

const bankAccountTypeOptions = [
  { value: "corriente", label: "Cuenta corriente" },
  { value: "vista", label: "Cuenta vista" },
  { value: "ahorro", label: "Cuenta de ahorro" },
  { value: "rut", label: "Cuenta RUT" }
];

function buildPersonDraft(candidate: RecruitmentCaseCandidateRow): PersonDraft {
  return {
    birthDate: candidate.birth_date ?? "",
    nationality: candidate.nationality ?? "",
    maritalStatus: candidate.marital_status ?? "",
    addressLine: candidate.address_line ?? "",
    districtOrCommune: candidate.district_or_commune ?? "",
    currentCity: candidate.current_city ?? "",
    region: candidate.region ?? "",
    emergencyContactName: candidate.emergency_contact_name ?? "",
    emergencyContactPhone: candidate.emergency_contact_phone ?? "",
    emergencyContactRelationship: candidate.emergency_contact_relationship ?? "",
    inclusionNotes: candidate.inclusion_notes ?? "",
    firefighterStatus: candidate.firefighter_status ?? "",
    shirtSize: candidate.shirt_size ?? "",
    pantsSize: candidate.pants_size ?? "",
    shoeSize: candidate.shoe_size ?? "",
    bankName: candidate.bank_name ?? "",
    bankAccountType: candidate.bank_account_type ?? "",
    bankAccountNumber: candidate.bank_account_number ?? "",
    afpName: candidate.afp_name ?? "",
    healthProvider: candidate.health_provider ?? ""
  };
}

function buildWorkerDraft(
  candidate: RecruitmentCaseCandidateRow,
  caseDetail: RecruitmentCaseDetail
): WorkerDraft {
  return {
    projectName: candidate.worker_file?.project_name ?? caseDetail.case.contract_name ?? "",
    companyEntryDate:
      candidate.worker_file?.company_entry_date ??
      caseDetail.case.requested_entry_date ??
      caseDetail.case.hiring_request.start_date ??
      "",
    shiftName:
      candidate.worker_file?.shift_name ?? caseDetail.case.hiring_request.shift_name ?? "",
    advanceAmount:
      candidate.worker_file?.advance_amount != null
        ? String(candidate.worker_file.advance_amount)
        : "",
    contractNotes: candidate.worker_file?.contract_notes ?? ""
  };
}

export function CandidateWorkerFileForm({
  candidate,
  caseDetail,
  onSaved
}: CandidateWorkerFileFormProps) {
  const [personDraft, setPersonDraft] = useState<PersonDraft>(() => buildPersonDraft(candidate));
  const [workerDraft, setWorkerDraft] = useState<WorkerDraft>(() =>
    buildWorkerDraft(candidate, caseDetail)
  );
  const [isPersonSaving, setIsPersonSaving] = useState(false);
  const [isWorkerSaving, setIsWorkerSaving] = useState(false);
  const [personMessage, setPersonMessage] = useState("");
  const [workerMessage, setWorkerMessage] = useState("");

  useEffect(() => {
    setPersonDraft(buildPersonDraft(candidate));
    setWorkerDraft(buildWorkerDraft(candidate, caseDetail));
    setPersonMessage("");
    setWorkerMessage("");
  }, [candidate, caseDetail]);

  const handlePersonSave = async () => {
    setIsPersonSaving(true);
    setPersonMessage("");

    const { error } = await updateCandidatePersonProfile({
      caseCandidateId: candidate.id,
      birthDate: personDraft.birthDate || null,
      nationality: personDraft.nationality,
      maritalStatus: personDraft.maritalStatus,
      addressLine: personDraft.addressLine,
      districtOrCommune: personDraft.districtOrCommune,
      currentCity: personDraft.currentCity,
      region: personDraft.region,
      emergencyContactName: personDraft.emergencyContactName,
      emergencyContactPhone: personDraft.emergencyContactPhone,
      emergencyContactRelationship: personDraft.emergencyContactRelationship,
      inclusionNotes: personDraft.inclusionNotes,
      firefighterStatus: personDraft.firefighterStatus,
      shirtSize: personDraft.shirtSize,
      pantsSize: personDraft.pantsSize,
      shoeSize: personDraft.shoeSize,
      bankName: personDraft.bankName,
      bankAccountType: personDraft.bankAccountType,
      bankAccountNumber: personDraft.bankAccountNumber,
      afpName: personDraft.afpName,
      healthProvider: personDraft.healthProvider
    });

    if (error) {
      setPersonMessage(error);
      setIsPersonSaving(false);
      return;
    }

    await onSaved?.();
    setPersonMessage("Ficha personal actualizada.");
    setIsPersonSaving(false);
  };

  const handleWorkerSave = async () => {
    setIsWorkerSaving(true);
    setWorkerMessage("");

    const normalizedAdvanceAmount =
      workerDraft.advanceAmount.trim() === ""
        ? null
        : Number(workerDraft.advanceAmount.replace(",", "."));

    if (
      normalizedAdvanceAmount != null &&
      (Number.isNaN(normalizedAdvanceAmount) || normalizedAdvanceAmount < 0)
    ) {
      setWorkerMessage("El anticipo debe ser un monto numérico válido.");
      setIsWorkerSaving(false);
      return;
    }

    const { error } = await updateCandidateWorkerFile({
      caseCandidateId: candidate.id,
      projectName: workerDraft.projectName,
      companyEntryDate: workerDraft.companyEntryDate || null,
      shiftName: workerDraft.shiftName,
      advanceAmount: normalizedAdvanceAmount,
      contractNotes: workerDraft.contractNotes
    });

    if (error) {
      setWorkerMessage(error);
      setIsWorkerSaving(false);
      return;
    }

    await onSaved?.();
    setWorkerMessage("Ficha del ingreso actual actualizada.");
    setIsWorkerSaving(false);
  };

  return (
    <div className="control-detail-body">
      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Ficha personal</small>
            <h4>Datos persistentes del candidato</h4>
          </div>
        </div>

        <div className="control-edit-grid worker-file-grid">
          <TextField
            id="candidate-birth-date"
            label="Fecha de nacimiento"
            type="date"
            value={personDraft.birthDate}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, birthDate: event.target.value }))
            }
          />
          <TextField
            id="candidate-nationality"
            label="Nacionalidad"
            value={personDraft.nationality}
            placeholder="Ej: Chilena"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, nationality: event.target.value }))
            }
          />
          <SelectField
            id="candidate-marital-status"
            label="Estado civil"
            value={personDraft.maritalStatus}
            options={maritalStatusOptions}
            placeholder="Selecciona estado civil"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, maritalStatus: event.target.value }))
            }
          />
          <SelectField
            id="candidate-firefighter-status"
            label="Bomberos"
            value={personDraft.firefighterStatus}
            options={firefighterStatusOptions}
            placeholder="Selecciona condición"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, firefighterStatus: event.target.value }))
            }
          />
          <TextField
            id="candidate-address-line"
            label="Dirección"
            value={personDraft.addressLine}
            placeholder="Calle y numeración"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, addressLine: event.target.value }))
            }
            className="control-span-full"
          />
          <TextField
            id="candidate-district"
            label="Comuna"
            value={personDraft.districtOrCommune}
            placeholder="Ej: Antofagasta"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                districtOrCommune: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-city"
            label="Ciudad"
            value={personDraft.currentCity}
            placeholder="Ej: Calama"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, currentCity: event.target.value }))
            }
          />
          <TextField
            id="candidate-region"
            label="Región"
            value={personDraft.region}
            placeholder="Ej: Antofagasta"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, region: event.target.value }))
            }
          />
          <TextField
            id="candidate-emergency-name"
            label="Contacto de emergencia"
            value={personDraft.emergencyContactName}
            placeholder="Nombre y apellido"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactName: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-phone"
            label="Teléfono de emergencia"
            value={personDraft.emergencyContactPhone}
            placeholder="Ej: 912345678"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactPhone: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-relationship"
            label="Relación contacto emergencia"
            value={personDraft.emergencyContactRelationship}
            placeholder="Ej: Madre, Cónyuge"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactRelationship: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-shirt-size"
            label="Talla polera"
            value={personDraft.shirtSize}
            placeholder="Ej: L"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, shirtSize: event.target.value }))
            }
          />
          <TextField
            id="candidate-pants-size"
            label="Talla pantalón"
            value={personDraft.pantsSize}
            placeholder="Ej: 42"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, pantsSize: event.target.value }))
            }
          />
          <TextField
            id="candidate-shoe-size"
            label="Talla calzado"
            value={personDraft.shoeSize}
            placeholder="Ej: 41"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, shoeSize: event.target.value }))
            }
          />
          <TextField
            id="candidate-bank-name"
            label="Banco"
            value={personDraft.bankName}
            placeholder="Ej: BancoEstado"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, bankName: event.target.value }))
            }
          />
          <SelectField
            id="candidate-bank-account-type"
            label="Tipo de cuenta"
            value={personDraft.bankAccountType}
            options={bankAccountTypeOptions}
            placeholder="Selecciona tipo de cuenta"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                bankAccountType: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-bank-account-number"
            label="Número de cuenta"
            value={personDraft.bankAccountNumber}
            placeholder="Número de cuenta"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                bankAccountNumber: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-afp-name"
            label="AFP"
            value={personDraft.afpName}
            placeholder="Ej: Habitat"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, afpName: event.target.value }))
            }
          />
          <TextField
            id="candidate-health-provider"
            label="Salud"
            value={personDraft.healthProvider}
            placeholder="Ej: Fonasa, Colmena"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                healthProvider: event.target.value
              }))
            }
          />
          <div className="field-group control-span-full">
            <label className="field-label" htmlFor="candidate-inclusion-notes">
              Inclusión / discapacidad / etnia
            </label>
            <textarea
              id="candidate-inclusion-notes"
              className="worker-file-textarea"
              value={personDraft.inclusionNotes}
              placeholder="Registrar solo información relevante para operación, inclusión o adaptaciones."
              onChange={(event) =>
                setPersonDraft((current) => ({ ...current, inclusionNotes: event.target.value }))
              }
            />
          </div>
        </div>

        {personMessage ? (
          <p className={`worker-file-feedback ${personMessage.includes("actualizada") ? "success" : "error"}`}>
            {personMessage}
          </p>
        ) : null}

        <div className="worker-file-actions">
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            onClick={() => void handlePersonSave()}
            disabled={isPersonSaving}
          >
            {isPersonSaving ? "Guardando..." : "Guardar ficha personal"}
          </button>
        </div>
      </section>

      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Ingreso actual</small>
            <h4>Datos específicos de este proceso</h4>
          </div>
        </div>

        <div className="control-edit-grid worker-file-grid">
          <TextField
            id="candidate-project-name"
            label="Proyecto / contrato"
            value={workerDraft.projectName}
            placeholder={caseDetail.case.contract_name}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, projectName: event.target.value }))
            }
          />
          <TextField
            id="candidate-entry-date"
            label="Fecha ingreso empresa"
            type="date"
            value={workerDraft.companyEntryDate}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                companyEntryDate: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-shift-name"
            label="Turno"
            value={workerDraft.shiftName}
            placeholder={caseDetail.case.hiring_request.shift_name ?? "Ej: 10x10"}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, shiftName: event.target.value }))
            }
          />
          <TextField
            id="candidate-advance-amount"
            label="Monto anticipo"
            value={workerDraft.advanceAmount}
            placeholder="Ej: 150000"
            inputMode="decimal"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                advanceAmount: event.target.value.replace(/[^\d.,-]/g, "")
              }))
            }
          />
          <div className="field-group control-span-full">
            <label className="field-label" htmlFor="candidate-contract-notes">
              Observaciones del ingreso actual
            </label>
            <textarea
              id="candidate-contract-notes"
              className="worker-file-textarea"
              value={workerDraft.contractNotes}
              placeholder="Notas contractuales, restricciones o acuerdos específicos de este ingreso."
              onChange={(event) =>
                setWorkerDraft((current) => ({ ...current, contractNotes: event.target.value }))
              }
            />
          </div>
        </div>

        {workerMessage ? (
          <p className={`worker-file-feedback ${workerMessage.includes("actualizada") ? "success" : "error"}`}>
            {workerMessage}
          </p>
        ) : null}

        <div className="worker-file-actions">
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            onClick={() => void handleWorkerSave()}
            disabled={isWorkerSaving}
          >
            {isWorkerSaving ? "Guardando..." : "Guardar ingreso actual"}
          </button>
        </div>
      </section>
    </div>
  );
}
