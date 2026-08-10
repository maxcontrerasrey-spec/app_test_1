import { FormEvent, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import consorcioAndinoLogo from "../../competencies/assets/consorcio-andino.png";
import { SelectField, TextField } from "../../../shared/ui";
import { formatRut, validateRut } from "../../../shared/lib/rut";
import { bukEmployeeFieldOptions } from "../lib/bukEmployeeTemplate";
import { bukPaymentPeriodOptions } from "../lib/candidateWorkerFileFormHelpers";
import {
  startPublicBukWorkerFile,
  submitPublicBukWorkerFile,
  type PublicBukWorkerFileDraft,
  type PublicBukWorkerFileSession
} from "../services/publicBukWorkerFile";

const emptyDraft: PublicBukWorkerFileDraft = {
  gender: "",
  birthDate: "",
  nationality: "",
  maritalStatus: "",
  personalEmail: "",
  phone: "",
  streetName: "",
  streetNumber: "",
  apartmentOrOffice: "",
  districtOrCommune: "",
  currentCity: "",
  region: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  firefighterStatus: "no_informa",
  foreignWorker: "No",
  shirtSize: "",
  pantsSize: "",
  shoeSize: "",
  paymentMethod: "Transferencia Bancaria",
  paymentPeriod: "Mensual",
  bankName: "",
  bankAccountType: "",
  bankAccountNumber: "",
  pensionRegime: "",
  contributionFund: "",
  healthProvider: "",
  healthPlanUf: "",
  retiredStatus: "No",
  retirementRegime: ""
};

const publicBukFieldOptions = {
  ...bukEmployeeFieldOptions,
  firefighterStatus: [
    { value: "si", label: "Sí" },
    { value: "no", label: "No" },
    { value: "no_informa", label: "No informa" }
  ],
  yesNo: [
    { value: "Sí", label: "Sí" },
    { value: "No", label: "No" }
  ]
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function updateDraftValue(
  setDraft: Dispatch<SetStateAction<PublicBukWorkerFileDraft>>,
  field: keyof PublicBukWorkerFileDraft,
  value: string
) {
  setDraft((current) => ({ ...current, [field]: value }));
}

export function PublicBukWorkerFilePage() {
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<PublicBukWorkerFileSession | null>(null);
  const [draft, setDraft] = useState<PublicBukWorkerFileDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessTouched, setAccessTouched] = useState(false);

  const accessReady = validateRut(rut) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const healthPlanRequired = useMemo(() => {
    const normalized = draft.healthProvider.trim().toLowerCase();
    return normalized !== "" && !["fonasa", "mutual", "no cotiza salud", "no cotiza"].includes(normalized);
  }, [draft.healthProvider]);
  const formReady = Boolean(
    draft.gender && draft.birthDate && draft.nationality && draft.maritalStatus &&
    draft.personalEmail && draft.phone.length === 8 && draft.streetName &&
    draft.districtOrCommune && draft.currentCity && draft.region && draft.shirtSize &&
    draft.pantsSize && draft.shoeSize && draft.paymentMethod && draft.paymentPeriod &&
    draft.pensionRegime && draft.healthProvider && (!healthPlanRequired || draft.healthPlanUf)
  );

  const handleAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccessTouched(true);
    setError("");
    setMessage("");
    if (!accessReady) return;

    setIsLoading(true);
    const result = await startPublicBukWorkerFile(rut, email);
    setIsLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "No fue posible iniciar el formulario.");
      return;
    }

    setSession(result.data as PublicBukWorkerFileSession);
    setDraft((result.data as PublicBukWorkerFileSession & { candidate: { draft: PublicBukWorkerFileDraft } }).candidate.draft);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!session || !formReady) {
      setError("Completa los campos obligatorios antes de enviar la ficha.");
      return;
    }

    setIsSubmitting(true);
    const result = await submitPublicBukWorkerFile(session.session_token, draft);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSession(null);
    setRut("");
    setEmail("");
    setDraft(emptyDraft);
    setMessage("Recibimos tu información. El equipo de Reclutamiento continuará la validación de tu ficha BUK.");
  };

  const updateText = (field: keyof PublicBukWorkerFileDraft, value: string) =>
    updateDraftValue(setDraft, field, normalizeText(value));

  return (
    <main className="public-application-page public-buk-worker-file-page">
      <section className="public-application-shell">
        <header className="public-application-header">
          <div className="public-application-brand">
            <img src={consorcioAndinoLogo} alt="Consorcio Andino" className="public-application-logo" />
            <div><span>Consorcio Andino</span><strong>Codelco DSAL</strong></div>
          </div>
          <div className="public-application-status"><span>Ficha BUK</span></div>
        </header>

        <div className="public-application-welcome">
          <h1>Completa tu ficha BUK</h1>
          <p>Este formulario está habilitado únicamente para candidatos DSAL aprobados.</p>
          <p>Ingresa tu RUT y el correo personal registrado en tu postulación para continuar.</p>
        </div>

        {!session ? (
          <form className="public-application-form tracking-panel public-buk-access-form" onSubmit={handleAccess}>
            <section className="public-application-section">
              <div className="public-application-section-title"><span className="public-application-step">1</span><div><h2>Verificación de acceso</h2><p>Validaremos tu aprobación antes de mostrar la ficha.</p></div></div>
              <div className="control-edit-grid public-application-grid">
                <TextField id="public-buk-rut" label="RUT" value={rut} placeholder="12.345.678-K" hasError={accessTouched && !validateRut(rut)} onChange={(event) => setRut(formatRut(event.target.value))} />
                <TextField id="public-buk-email" label="Correo personal" type="email" value={email} onChange={(event) => setEmail(event.target.value.toLowerCase())} />
              </div>
              {accessTouched && !accessReady ? <p className="form-status form-status-error public-application-alert" role="alert">Ingresa un RUT válido y el correo personal registrado.</p> : null}
              <div className="public-application-actions"><button className="soft-primary-button approval-button-approve public-application-submit" disabled={isLoading || !accessReady}>{isLoading ? "Validando..." : "Acceder a la ficha"}</button></div>
            </section>
          </form>
        ) : (
          <form className="public-application-form tracking-panel" onSubmit={handleSubmit}>
            <section className="public-application-section">
              <div className="public-application-section-title"><span className="public-application-step">2</span><div><h2>Identificación</h2><p>Estos datos provienen de tu aprobación DSAL y no se pueden editar.</p></div></div>
              <div className="public-buk-identity"><strong>{session.candidate.full_name}</strong><span>RUT {session.candidate.national_id}</span></div>
              <div className="control-edit-grid public-application-grid">
                <SelectField id="public-buk-gender" label="Sexo" value={draft.gender} options={bukEmployeeFieldOptions.gender} placeholder="Selecciona sexo" onChange={(event) => updateDraftValue(setDraft, "gender", event.target.value)} />
                <TextField id="public-buk-birth-date" label="Fecha de nacimiento" type="date" value={draft.birthDate} onChange={(event) => updateDraftValue(setDraft, "birthDate", event.target.value)} />
                <SelectField id="public-buk-nationality" label="Nacionalidad" value={draft.nationality} options={bukEmployeeFieldOptions.nationality} placeholder="Selecciona nacionalidad" onChange={(event) => updateDraftValue(setDraft, "nationality", event.target.value)} />
                <SelectField id="public-buk-marital-status" label="Estado civil" value={draft.maritalStatus} options={bukEmployeeFieldOptions.maritalStatus} placeholder="Selecciona estado civil" onChange={(event) => updateDraftValue(setDraft, "maritalStatus", event.target.value)} />
              </div>
            </section>

            <section className="public-application-section"><div className="public-application-section-title"><span className="public-application-step">3</span><div><h2>Domicilio y contacto</h2><p>Completa la información según tu documentación vigente.</p></div></div>
              <div className="control-edit-grid public-application-grid">
                <TextField id="public-buk-street" label="Calle" value={draft.streetName} onChange={(event) => updateText("streetName", event.target.value)} />
                <TextField id="public-buk-street-number" label="Número" value={draft.streetNumber} onChange={(event) => updateText("streetNumber", event.target.value)} />
                <TextField id="public-buk-apartment" label="Depto / Oficina" value={draft.apartmentOrOffice} onChange={(event) => updateText("apartmentOrOffice", event.target.value)} />
                <SelectField id="public-buk-region" label="Región" value={draft.region} options={bukEmployeeFieldOptions.region} placeholder="Selecciona región" onChange={(event) => updateDraftValue(setDraft, "region", event.target.value)} />
                <SelectField id="public-buk-commune" label="Comuna" value={draft.districtOrCommune} options={bukEmployeeFieldOptions.commune} placeholder="Selecciona comuna" onChange={(event) => updateDraftValue(setDraft, "districtOrCommune", event.target.value)} />
                <TextField id="public-buk-city" label="Ciudad" value={draft.currentCity} onChange={(event) => updateText("currentCity", event.target.value)} />
                <label className="field-group" htmlFor="public-buk-phone"><span className="field-label">Teléfono particular</span><span className="public-phone-input"><span className="public-phone-prefix">+56 9</span><input id="public-buk-phone" className="text-field public-phone-number" inputMode="numeric" maxLength={8} value={draft.phone} placeholder="12345678" onChange={(event) => updateDraftValue(setDraft, "phone", event.target.value.replace(/\D/g, "").slice(0, 8))} /></span></label>
                <TextField id="public-buk-personal-email" label="Correo personal" type="email" value={draft.personalEmail} disabled />
                <TextField id="public-buk-emergency-name" label="Contacto de emergencia" value={draft.emergencyContactName} onChange={(event) => updateText("emergencyContactName", event.target.value)} />
                <TextField id="public-buk-emergency-phone" label="Teléfono de emergencia" value={draft.emergencyContactPhone} onChange={(event) => updateText("emergencyContactPhone", event.target.value)} />
                <TextField id="public-buk-emergency-relationship" label="Relación contacto" value={draft.emergencyContactRelationship} onChange={(event) => updateText("emergencyContactRelationship", event.target.value)} />
              </div>
            </section>

            <section className="public-application-section"><div className="public-application-section-title"><span className="public-application-step">4</span><div><h2>Datos operativos</h2><p>Información necesaria para preparar el ingreso BUK.</p></div></div>
              <div className="control-edit-grid public-application-grid">
                <SelectField id="public-buk-shirt" label="Talla polera" value={draft.shirtSize} options={bukEmployeeFieldOptions.shirtSize} placeholder="Selecciona talla" onChange={(event) => updateDraftValue(setDraft, "shirtSize", event.target.value)} />
                <SelectField id="public-buk-pants" label="Talla pantalón" value={draft.pantsSize} options={bukEmployeeFieldOptions.pantsSize} placeholder="Selecciona talla" onChange={(event) => updateDraftValue(setDraft, "pantsSize", event.target.value)} />
                <SelectField id="public-buk-shoes" label="Número calzado" value={draft.shoeSize} options={bukEmployeeFieldOptions.shoeSize} placeholder="Selecciona número" onChange={(event) => updateDraftValue(setDraft, "shoeSize", event.target.value)} />
                <SelectField id="public-buk-firefighter" label="Bomberos" value={draft.firefighterStatus} options={publicBukFieldOptions.firefighterStatus} placeholder="Selecciona opción" onChange={(event) => updateDraftValue(setDraft, "firefighterStatus", event.target.value)} />
                <SelectField id="public-buk-foreign-worker" label="Trabajador extranjero" value={draft.foreignWorker} options={publicBukFieldOptions.yesNo} placeholder="Selecciona opción" onChange={(event) => updateDraftValue(setDraft, "foreignWorker", event.target.value)} />
              </div>
            </section>

            <section className="public-application-section"><div className="public-application-section-title"><span className="public-application-step">5</span><div><h2>Pagos, previsión y salud</h2><p>Selecciona la opción que corresponda a tu situación actual.</p></div></div>
              <div className="control-edit-grid public-application-grid">
                <SelectField id="public-buk-payment-method" label="Forma de pago" value={draft.paymentMethod} options={bukEmployeeFieldOptions.paymentMethod} placeholder="Selecciona forma de pago" onChange={(event) => updateDraftValue(setDraft, "paymentMethod", event.target.value)} />
                <SelectField id="public-buk-payment-period" label="Periodo de pago" value={draft.paymentPeriod} options={bukPaymentPeriodOptions} placeholder="Selecciona periodo" onChange={(event) => updateDraftValue(setDraft, "paymentPeriod", event.target.value)} />
                <SelectField id="public-buk-bank" label="Banco" value={draft.bankName} options={bukEmployeeFieldOptions.bank} placeholder="Selecciona banco" onChange={(event) => updateDraftValue(setDraft, "bankName", event.target.value)} />
                <SelectField id="public-buk-account-type" label="Tipo de cuenta" value={draft.bankAccountType} options={bukEmployeeFieldOptions.bankAccountType} placeholder="Selecciona tipo" onChange={(event) => updateDraftValue(setDraft, "bankAccountType", event.target.value)} />
                <TextField id="public-buk-account-number" label="Número de cuenta" value={draft.bankAccountNumber} onChange={(event) => updateText("bankAccountNumber", event.target.value)} />
                <SelectField id="public-buk-pension" label="Régimen previsional" value={draft.pensionRegime} options={bukEmployeeFieldOptions.pensionRegime} placeholder="Selecciona régimen" onChange={(event) => updateDraftValue(setDraft, "pensionRegime", event.target.value)} />
                <SelectField id="public-buk-fund" label="Fondo de cotización" value={draft.contributionFund} options={bukEmployeeFieldOptions.contributionFund} placeholder="Selecciona fondo" onChange={(event) => updateDraftValue(setDraft, "contributionFund", event.target.value)} />
                <SelectField id="public-buk-health" label="Fonasa / Isapre" value={draft.healthProvider} options={bukEmployeeFieldOptions.healthProvider} placeholder="Selecciona prestador" onChange={(event) => updateDraftValue(setDraft, "healthProvider", event.target.value)} />
                <TextField id="public-buk-health-plan" label="Plan Isapre UF" value={draft.healthPlanUf} disabled={!healthPlanRequired} inputMode="decimal" onChange={(event) => updateDraftValue(setDraft, "healthPlanUf", event.target.value.replace(",", "."))} />
                <SelectField id="public-buk-retired" label="Jubilado" value={draft.retiredStatus} options={bukEmployeeFieldOptions.retiredStatus} placeholder="Selecciona opción" onChange={(event) => updateDraftValue(setDraft, "retiredStatus", event.target.value)} />
                <SelectField id="public-buk-retirement" label="Régimen jubilación" value={draft.retirementRegime} options={bukEmployeeFieldOptions.retirementRegime} placeholder="Selecciona régimen" onChange={(event) => updateDraftValue(setDraft, "retirementRegime", event.target.value)} />
              </div>
            </section>

            {error ? <p className="form-status form-status-error public-application-submit-message" role="alert">{error}</p> : null}
            <div className="public-application-actions"><p>La sesión es temporal y el envío quedará registrado en el ERP para revisión de Reclutamiento.</p><button className="soft-primary-button approval-button-approve public-application-submit" disabled={isSubmitting || !formReady}>{isSubmitting ? "Guardando ficha..." : "Enviar ficha BUK"}</button></div>
          </form>
        )}
        {message ? <p className="form-status public-application-submit-message" role="status">{message}</p> : null}
        {error && !session ? <p className="form-status form-status-error public-application-submit-message" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
