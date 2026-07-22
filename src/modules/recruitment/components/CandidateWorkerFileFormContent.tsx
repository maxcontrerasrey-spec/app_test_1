import type { Dispatch, SetStateAction } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import { formatRut } from "../../../shared/lib/rut";
import { bukEmployeeFieldOptions } from "../lib/bukEmployeeTemplate";
import { CandidateWorkerFileContractSection } from "./CandidateWorkerFileContractSection";
import {
  firefighterStatusOptions,
  looksLikeRut,
  type PersonDraft,
  type WorkerDraft,
  yesNoBukOptions
} from "../lib/candidateWorkerFileFormHelpers";
import {
  getCandidateEmailValidationMessage,
  normalizeCandidateEmail,
  validateOptionalCandidateEmail
} from "../lib/candidateEmail";

type TouchedPersonEmails = {
  companyEmail: boolean;
  personalEmail: boolean;
};

type CandidateWorkerFileFormContentProps = {
  readOnly?: boolean;
  isProfileLoading: boolean;
  personDraft: PersonDraft;
  setPersonDraft: Dispatch<SetStateAction<PersonDraft>>;
  workerDraft: WorkerDraft;
  setWorkerDraft: Dispatch<SetStateAction<WorkerDraft>>;
  updateWorkerDraft: (patch: Partial<WorkerDraft>) => void;
  touchedPersonEmails: TouchedPersonEmails;
  setTouchedPersonEmails: Dispatch<SetStateAction<TouchedPersonEmails>>;
  shouldShowCompanyEmailError: boolean;
  shouldShowPersonalEmailError: boolean;
  derivedAddressLine: string;
  personMessage: string;
  workerMessage: string;
  isPersonSaving: boolean;
  isWorkerSaving: boolean;
  healthProviderRequiresUfPlan: boolean;
  usesAutomaticFonasaPlan: boolean;
  setPersonMessage: Dispatch<SetStateAction<string>>;
  handlePersonSave: () => Promise<void>;
  handleWorkerSave: () => Promise<void>;
};

export function CandidateWorkerFileFormContent({
  readOnly,
  isProfileLoading,
  personDraft,
  setPersonDraft,
  workerDraft,
  setWorkerDraft,
  updateWorkerDraft,
  touchedPersonEmails,
  setTouchedPersonEmails,
  shouldShowCompanyEmailError,
  shouldShowPersonalEmailError,
  derivedAddressLine,
  personMessage,
  workerMessage,
  isPersonSaving,
  isWorkerSaving,
  healthProviderRequiresUfPlan,
  usesAutomaticFonasaPlan,
  setPersonMessage,
  handlePersonSave,
  handleWorkerSave
}: CandidateWorkerFileFormContentProps) {
  return (
    <div className="control-detail-body">
      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Base BUK</small>
            <h4>Identidad y contacto del trabajador</h4>
          </div>
        </div>

        {isProfileLoading ? <p className="tracking-filter-caption">Cargando ficha BUK...</p> : null}

        {readOnly ? (
          <p className="worker-file-readonly-notice">
            Ficha bloqueada: el trabajador ya está en Personal contratado.
          </p>
        ) : null}

        <fieldset className="worker-file-readonly-fieldset" disabled={readOnly}>
          <div className="control-edit-grid worker-file-grid">
          <SelectField
            id="candidate-document-type"
            label="Tipo de documento"
            value={personDraft.documentType}
            options={bukEmployeeFieldOptions.documentType}
            placeholder="Selecciona tipo"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, documentType: event.target.value }))
            }
          />
          <TextField
            id="candidate-document-number"
            label="Número de documento"
            value={personDraft.documentNumber}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                documentNumber:
                  current.documentType === "RUT" || looksLikeRut(event.target.value)
                    ? formatRut(event.target.value)
                    : event.target.value
              }))
            }
          />
          <TextField
            id="candidate-first-name"
            label="Nombre"
            value={personDraft.firstName}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, firstName: event.target.value }))
            }
          />
          <TextField
            id="candidate-last-name"
            label="Apellido"
            value={personDraft.lastName}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, lastName: event.target.value }))
            }
          />
          <TextField
            id="candidate-second-last-name"
            label="Segundo apellido"
            value={personDraft.secondLastName}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                secondLastName: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-gender"
            label="Sexo"
            value={personDraft.gender}
            options={bukEmployeeFieldOptions.gender}
            placeholder="Selecciona sexo"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, gender: event.target.value }))
            }
          />
          <TextField
            id="candidate-birth-date"
            label="Fecha de nacimiento"
            type="date"
            value={personDraft.birthDate}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, birthDate: event.target.value }))
            }
          />
          <SelectField
            id="candidate-nationality"
            label="Nacionalidad"
            value={personDraft.nationality}
            options={bukEmployeeFieldOptions.nationality}
            placeholder="Selecciona nacionalidad"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, nationality: event.target.value }))
            }
          />
          <SelectField
            id="candidate-marital-status"
            label="Estado civil"
            value={personDraft.maritalStatus}
            options={bukEmployeeFieldOptions.maritalStatus}
            placeholder="Selecciona estado civil"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                maritalStatus: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-company-email"
            label="Email corporativo"
            type="email"
            value={personDraft.companyEmail}
            hasError={shouldShowCompanyEmailError}
            onChange={(event) => {
              setPersonDraft((current) => ({ ...current, companyEmail: event.target.value }))
              if (
                touchedPersonEmails.companyEmail &&
                validateOptionalCandidateEmail(event.target.value).isValid
              ) {
                setPersonMessage("");
              }
            }}
            onBlur={(event) => {
              const normalizedEmail = normalizeCandidateEmail(event.target.value);

              setTouchedPersonEmails((current) => ({ ...current, companyEmail: true }));
              setPersonDraft((current) => ({
                ...current,
                companyEmail: normalizedEmail
              }));

              if (!validateOptionalCandidateEmail(normalizedEmail).isValid) {
                setPersonMessage(
                  getCandidateEmailValidationMessage("El email corporativo", normalizedEmail)
                );
                return;
              }

              setPersonMessage("");
            }}
          />
          <TextField
            id="candidate-personal-email"
            label="Email personal"
            type="email"
            value={personDraft.personalEmail}
            hasError={shouldShowPersonalEmailError}
            onChange={(event) => {
              setPersonDraft((current) => ({ ...current, personalEmail: event.target.value }))
              if (
                touchedPersonEmails.personalEmail &&
                validateOptionalCandidateEmail(event.target.value).isValid
              ) {
                setPersonMessage("");
              }
            }}
            onBlur={(event) => {
              const normalizedEmail = normalizeCandidateEmail(event.target.value);

              setTouchedPersonEmails((current) => ({ ...current, personalEmail: true }));
              setPersonDraft((current) => ({
                ...current,
                personalEmail: normalizedEmail
              }));

              if (!validateOptionalCandidateEmail(normalizedEmail).isValid) {
                setPersonMessage(
                  getCandidateEmailValidationMessage("El email personal", normalizedEmail)
                );
                return;
              }

              setPersonMessage("");
            }}
          />
          <TextField
            id="candidate-private-phone"
            label="Teléfono particular"
            value={personDraft.privatePhone}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, privatePhone: event.target.value }))
            }
          />
          <TextField
            id="candidate-office-phone"
            label="Teléfono oficina"
            value={personDraft.officePhone}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, officePhone: event.target.value }))
            }
          />
          <TextField
            id="candidate-country"
            label="País"
            value={personDraft.country}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, country: event.target.value }))
            }
          />
          </div>
        </fieldset>
      </section>

      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Base BUK</small>
            <h4>Domicilio, estudios e inclusión</h4>
          </div>
        </div>

        <fieldset className="worker-file-readonly-fieldset" disabled={readOnly}>
          <div className="control-edit-grid worker-file-grid">
          <TextField
            id="candidate-address-line"
            label="Dirección base"
            value={derivedAddressLine || personDraft.addressLine}
            readOnly
            className="control-span-full"
          />
          <SelectField
            id="candidate-region"
            label="Región"
            value={personDraft.region}
            options={bukEmployeeFieldOptions.region}
            placeholder="Selecciona región"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, region: event.target.value }))
            }
          />
          <SelectField
            id="candidate-commune"
            label="Comuna"
            value={personDraft.districtOrCommune}
            options={bukEmployeeFieldOptions.commune}
            placeholder="Selecciona comuna"
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
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, currentCity: event.target.value }))
            }
          />
          <TextField
            id="candidate-street-name"
            label="Calle"
            value={personDraft.streetName}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, streetName: event.target.value }))
            }
          />
          <TextField
            id="candidate-street-number"
            label="Número de calle"
            value={personDraft.streetNumber}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, streetNumber: event.target.value }))
            }
          />
          <TextField
            id="candidate-apartment"
            label="Depto / Oficina"
            value={personDraft.apartmentOrOffice}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                apartmentOrOffice: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-title"
            label="Título"
            value={personDraft.educationTitle}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                educationTitle: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-institution"
            label="Institución"
            value={personDraft.educationInstitution}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                educationInstitution: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-name"
            label="Contacto de emergencia"
            value={personDraft.emergencyContactName}
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
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactPhone: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-relationship"
            label="Relación contacto"
            value={personDraft.emergencyContactRelationship}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactRelationship: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-disability-status"
            label="Situación de discapacidad"
            value={personDraft.disabilityStatus}
            options={bukEmployeeFieldOptions.disabilityStatus}
            placeholder="Selecciona estado"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                disabilityStatus: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-disability-notice-date"
            label="Fecha notificación discapacidad"
            type="date"
            value={personDraft.disabilityNoticeDate}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                disabilityNoticeDate: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-invalidity-status"
            label="Situación de invalidez"
            value={personDraft.invalidityStatus}
            options={bukEmployeeFieldOptions.invalidityStatus}
            placeholder="Selecciona estado"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                invalidityStatus: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-invalidity-notice-date"
            label="Fecha notificación invalidez"
            type="date"
            value={personDraft.invalidityNoticeDate}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                invalidityNoticeDate: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-foreign-worker"
            label="Trabajador extranjero"
            value={personDraft.foreignWorker}
            options={yesNoBukOptions}
            placeholder="Selecciona condición"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                foreignWorker: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-labor-inclusion"
            label="Inclusión laboral"
            value={personDraft.laborInclusion}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                laborInclusion: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-firefighter-status"
            label="Bomberos"
            value={personDraft.firefighterStatus}
            options={firefighterStatusOptions}
            placeholder="Selecciona condición"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                firefighterStatus: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-shoe-size"
            label="Número calzado"
            value={personDraft.shoeSize}
            options={bukEmployeeFieldOptions.shoeSize}
            placeholder="Selecciona talla"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, shoeSize: event.target.value }))
            }
          />
          <SelectField
            id="candidate-pants-size"
            label="Talla pantalón"
            value={personDraft.pantsSize}
            options={bukEmployeeFieldOptions.pantsSize}
            placeholder="Selecciona talla"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, pantsSize: event.target.value }))
            }
          />
          <SelectField
            id="candidate-shirt-size"
            label="Talla polera"
            value={personDraft.shirtSize}
            options={bukEmployeeFieldOptions.shirtSize}
            placeholder="Selecciona talla"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, shirtSize: event.target.value }))
            }
          />
          <div className="field-group control-span-full">
            <label className="field-label" htmlFor="candidate-inclusion-notes">
              Notas de inclusión / observaciones
            </label>
            <textarea
              id="candidate-inclusion-notes"
              className="worker-file-textarea"
              value={personDraft.inclusionNotes}
              onChange={(event) =>
                setPersonDraft((current) => ({
                  ...current,
                  inclusionNotes: event.target.value
                }))
              }
            />
          </div>
          </div>
        </fieldset>

        {personMessage ? (
          <p
            className={`worker-file-feedback ${personMessage.includes("actualizada") ? "success" : "error"}`}
          >
            {personMessage}
          </p>
        ) : null}

        {!readOnly ? (
          <div className="worker-file-actions">
            <button
              type="button"
              className="soft-primary-button approval-button-approve"
              onClick={() => void handlePersonSave()}
              disabled={isPersonSaving || isProfileLoading}
            >
              {isPersonSaving ? "Guardando..." : "Guardar ficha personal BUK"}
            </button>
          </div>
        ) : null}
      </section>

      <CandidateWorkerFileContractSection
        readOnly={readOnly}
        isProfileLoading={isProfileLoading}
        workerDraft={workerDraft}
        setWorkerDraft={setWorkerDraft}
        updateWorkerDraft={updateWorkerDraft}
        workerMessage={workerMessage}
        isWorkerSaving={isWorkerSaving}
        healthProviderRequiresUfPlan={healthProviderRequiresUfPlan}
        usesAutomaticFonasaPlan={usesAutomaticFonasaPlan}
        handleWorkerSave={handleWorkerSave}
      />
    </div>
  );
}
