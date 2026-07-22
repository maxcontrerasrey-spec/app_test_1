import type { Dispatch, SetStateAction } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import { bukEmployeeFieldOptions } from "../lib/bukEmployeeTemplate";
import { bukPaymentPeriodOptions, type WorkerDraft, yesNoBukOptions } from "../lib/candidateWorkerFileFormHelpers";

type CandidateWorkerFileContractSectionProps = {
  readOnly?: boolean;
  isProfileLoading: boolean;
  workerDraft: WorkerDraft;
  setWorkerDraft: Dispatch<SetStateAction<WorkerDraft>>;
  updateWorkerDraft: (patch: Partial<WorkerDraft>) => void;
  workerMessage: string;
  isWorkerSaving: boolean;
  healthProviderRequiresUfPlan: boolean;
  usesAutomaticFonasaPlan: boolean;
  handleWorkerSave: () => Promise<void>;
};

export function CandidateWorkerFileContractSection({
  readOnly,
  isProfileLoading,
  workerDraft,
  setWorkerDraft,
  updateWorkerDraft,
  workerMessage,
  isWorkerSaving,
  healthProviderRequiresUfPlan,
  usesAutomaticFonasaPlan,
  handleWorkerSave
}: CandidateWorkerFileContractSectionProps) {
  return (
      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Base BUK</small>
            <h4>Previsión, pagos y datos del ingreso</h4>
          </div>
        </div>

        <fieldset className="worker-file-readonly-fieldset" disabled={readOnly}>
          <div className="control-edit-grid worker-file-grid">
          <TextField
            id="candidate-employee-code"
            label="Código de ficha"
            value={workerDraft.employeeCode}
            onChange={(event) =>
              updateWorkerDraft({ employeeCode: event.target.value })
            }
          />
          <TextField
            id="candidate-entry-date"
            label="Ingreso compañía"
            type="date"
            value={workerDraft.companyEntryDate}
            onChange={(event) =>
              updateWorkerDraft({ companyEntryDate: event.target.value })
            }
          />
          <SelectField
            id="candidate-private-role"
            label="Rol privado"
            value={workerDraft.privateRole}
            options={bukEmployeeFieldOptions.privateRole}
            placeholder="Selecciona opción"
            onChange={(event) =>
              updateWorkerDraft({ privateRole: event.target.value })
            }
          />
          <TextField
            id="candidate-afc-start-date"
            label="Inicio cotización AFC"
            type="date"
            value={workerDraft.afcStartDate}
            onChange={(event) =>
              updateWorkerDraft({ afcStartDate: event.target.value })
            }
          />
          <TextField
            id="candidate-seniority-recognition-date"
            label="Reconocimiento antigüedad"
            type="date"
            value={workerDraft.seniorityRecognitionDate}
            onChange={(event) =>
              updateWorkerDraft({ seniorityRecognitionDate: event.target.value })
            }
          />
          <TextField
            id="candidate-progressive-vacation-start-date"
            label="Inicio vacaciones progresivas"
            type="date"
            value={workerDraft.progressiveVacationStartDate}
            onChange={(event) =>
              updateWorkerDraft({ progressiveVacationStartDate: event.target.value })
            }
          />
          <SelectField
            id="candidate-payment-method"
            label="Forma de pago"
            value={workerDraft.paymentMethod}
            options={bukEmployeeFieldOptions.paymentMethod}
            placeholder="Selecciona forma de pago"
            onChange={(event) =>
              updateWorkerDraft({ paymentMethod: event.target.value })
            }
          />
          <SelectField
            id="candidate-payment-period"
            label="Periodo de pago"
            value={workerDraft.paymentPeriod}
            options={bukPaymentPeriodOptions}
            placeholder="Selecciona periodo"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, paymentPeriod: event.target.value }))
            }
          />
          <SelectField
            id="candidate-bank-name"
            label="Banco"
            value={workerDraft.bankName}
            options={bukEmployeeFieldOptions.bank}
            placeholder="Selecciona banco"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, bankName: event.target.value }))
            }
          />
          <SelectField
            id="candidate-bank-account-type"
            label="Tipo de cuenta"
            value={workerDraft.bankAccountType}
            options={bukEmployeeFieldOptions.bankAccountType}
            placeholder="Selecciona tipo"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                bankAccountType: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-bank-account-number"
            label="Número de cuenta"
            value={workerDraft.bankAccountNumber}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                bankAccountNumber: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-bank-branch-code"
            label="Código sucursal"
            value={workerDraft.bankBranchCode}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, bankBranchCode: event.target.value }))
            }
          />
          <SelectField
            id="candidate-vale-vista-type"
            label="Tipo vale vista"
            value={workerDraft.valeVistaType}
            options={bukEmployeeFieldOptions.valeVistaType}
            placeholder="Selecciona tipo"
            onChange={(event) =>
              updateWorkerDraft({ valeVistaType: event.target.value })
            }
          />
          <SelectField
            id="candidate-pension-regime"
            label="Régimen previsional"
            value={workerDraft.pensionRegime}
            options={bukEmployeeFieldOptions.pensionRegime}
            placeholder="Selecciona régimen"
            onChange={(event) =>
              updateWorkerDraft({ pensionRegime: event.target.value })
            }
          />
          <SelectField
            id="candidate-contribution-fund"
            label="Fondo de cotización"
            value={workerDraft.contributionFund}
            options={bukEmployeeFieldOptions.contributionFund}
            placeholder="Selecciona fondo"
            onChange={(event) =>
              updateWorkerDraft({ contributionFund: event.target.value })
            }
          />
          <TextField
            id="candidate-afp-collection-entity"
            label="AFP recaudadora"
            value={workerDraft.afpCollectionEntity}
            onChange={(event) =>
              updateWorkerDraft({ afpCollectionEntity: event.target.value })
            }
          />
          <SelectField
            id="candidate-increase-quote-one-percent"
            label="Aumentar cotización 1%"
            value={workerDraft.increaseQuoteOnePercent}
            options={yesNoBukOptions}
            placeholder="Selecciona opción"
            onChange={(event) =>
              updateWorkerDraft({ increaseQuoteOnePercent: event.target.value })
            }
          />
          <SelectField
            id="candidate-health-provider"
            label="Fonasa / Isapre"
            value={workerDraft.healthProvider}
            options={bukEmployeeFieldOptions.healthProvider}
            placeholder="Selecciona prestador"
            onChange={(event) =>
              updateWorkerDraft({ healthProvider: event.target.value })
            }
          />
          <TextField
            id="candidate-health-plan-uf"
            label="Plan Isapre UF"
            value={workerDraft.healthPlanUf}
            inputMode="decimal"
            disabled={!healthProviderRequiresUfPlan}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, healthPlanUf: event.target.value }))
            }
          />
          <TextField
            id="candidate-health-plan-pesos"
            label="Plan Isapre pesos"
            value={workerDraft.healthPlanPesos}
            inputMode="decimal"
            disabled
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                healthPlanPesos: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-health-plan-percentage"
            label="Plan Isapre porcentual"
            value={workerDraft.healthPlanPercentage}
            inputMode="decimal"
            disabled
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                healthPlanPercentage: event.target.value
              }))
            }
          />
          <div className="control-span-full">
            <p className="tracking-filter-caption">
              {usesAutomaticFonasaPlan
                ? "Fonasa se completa automáticamente con plan porcentual 7% para el envío a BUK."
                : healthProviderRequiresUfPlan
                  ? "Si el prestador es Isapre, Plan Isapre UF es obligatorio."
                  : "Mutual y No Cotiza Salud no requieren plan adicional."}
            </p>
          </div>
          <SelectField
            id="candidate-afc-regime"
            label="AFC"
            value={workerDraft.afcRegime}
            options={bukEmployeeFieldOptions.afcRegime}
            placeholder="Selecciona tramo"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, afcRegime: event.target.value }))
            }
          />
          <SelectField
            id="candidate-retired-status"
            label="Jubilado"
            value={workerDraft.retiredStatus}
            options={bukEmployeeFieldOptions.retiredStatus}
            placeholder="Selecciona condición"
            onChange={(event) =>
              updateWorkerDraft({ retiredStatus: event.target.value })
            }
          />
          <SelectField
            id="candidate-retirement-regime"
            label="Régimen jubilación"
            value={workerDraft.retirementRegime}
            options={bukEmployeeFieldOptions.retirementRegime}
            placeholder="Selecciona régimen"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                retirementRegime: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-account-two-fund"
            label="Cuenta 2"
            value={workerDraft.accountTwoFund}
            options={bukEmployeeFieldOptions.accountTwoFund}
            placeholder="Selecciona fondo"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, accountTwoFund: event.target.value }))
            }
          />
          <TextField
            id="candidate-account-two-plan"
            label="Plan cuenta 2"
            value={workerDraft.accountTwoPlan}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, accountTwoPlan: event.target.value }))
            }
          />
          <SelectField
            id="candidate-currency"
            label="Moneda"
            value={workerDraft.currency}
            options={bukEmployeeFieldOptions.currency}
            placeholder="Selecciona moneda"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, currency: event.target.value }))
            }
          />
          <TextField
            id="candidate-simple-load-count"
            label="Carga simple"
            value={workerDraft.simpleLoadCount}
            inputMode="numeric"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                simpleLoadCount: event.target.value.replace(/[^\d]/g, "")
              }))
            }
          />
          <TextField
            id="candidate-maternal-load-count"
            label="Carga maternal"
            value={workerDraft.maternalLoadCount}
            inputMode="numeric"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                maternalLoadCount: event.target.value.replace(/[^\d]/g, "")
              }))
            }
          />
          <TextField
            id="candidate-invalid-load-count"
            label="Carga inválida"
            value={workerDraft.invalidLoadCount}
            inputMode="numeric"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                invalidLoadCount: event.target.value.replace(/[^\d]/g, "")
              }))
            }
          />
          <SelectField
            id="candidate-family-allowance-section"
            label="Tramo de asignación"
            value={workerDraft.familyAllowanceSection}
            options={bukEmployeeFieldOptions.familyAllowanceSection}
            placeholder="Selecciona tramo"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                familyAllowanceSection: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-personal-data-update-date"
            label="Actualización datos personales"
            type="date"
            value={workerDraft.personalDataUpdateDate}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                personalDataUpdateDate: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-project-name"
            label="Proyecto / contrato"
            value={workerDraft.projectName}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, projectName: event.target.value }))
            }
          />
          <TextField
            id="candidate-shift-name"
            label="Turno"
            value={workerDraft.shiftName}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, shiftName: event.target.value }))
            }
          />
          <TextField
            id="candidate-advance-amount"
            label="Monto anticipo"
            value={workerDraft.advanceAmount}
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
              onChange={(event) =>
                setWorkerDraft((current) => ({ ...current, contractNotes: event.target.value }))
              }
            />
          </div>
          </div>
        </fieldset>

        {workerMessage ? (
          <p
            className={`worker-file-feedback ${workerMessage.includes("actualizada") ? "success" : "error"}`}
          >
            {workerMessage}
          </p>
        ) : null}

        {!readOnly ? (
          <div className="worker-file-actions">
            <button
              type="button"
              className="soft-primary-button approval-button-approve"
              onClick={() => void handleWorkerSave()}
              disabled={isWorkerSaving || isProfileLoading}
            >
              {isWorkerSaving ? "Guardando..." : "Guardar ficha contractual BUK"}
            </button>
          </div>
        ) : null}
      </section>
  );
}
