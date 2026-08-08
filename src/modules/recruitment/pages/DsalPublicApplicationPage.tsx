import { FormEvent, useMemo, useState } from "react";
import consorcioAndinoLogo from "../../competencies/assets/consorcio-andino.png";
import { MultiSelectField, SelectField, TextField } from "../../../shared/ui";
import { formatRut, validateRut } from "../../../shared/lib/rut";
import { bukEmployeeFieldOptions } from "../lib/bukEmployeeTemplate";
import {
  dsalLicenseOptions,
  dsalRoleOptions,
  submitDsalPrecandidateApplication
} from "../services/precandidates";

type ApplicationDraft = {
  nationalId: string;
  firstName: string;
  lastName: string;
  secondLastName: string;
  addressLine: string;
  region: string;
  currentCity: string;
  driverLicenseClasses: string[];
  dsalRole: string;
  phone: string;
  personalEmail: string;
  comments: string;
};

const initialDraft: ApplicationDraft = {
  nationalId: "",
  firstName: "",
  lastName: "",
  secondLastName: "",
  addressLine: "",
  region: "",
  currentCity: "",
  driverLicenseClasses: [],
  dsalRole: "",
  phone: "",
  personalEmail: "",
  comments: ""
};

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function DsalPublicApplicationPage() {
  const [draft, setDraft] = useState<ApplicationDraft>(initialDraft);
  const [rutTouched, setRutTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  const rutIsValid = useMemo(
    () => !draft.nationalId || validateRut(draft.nationalId),
    [draft.nationalId]
  );
  const emailIsValid = useMemo(
    () => !draft.personalEmail || isEmailValid(draft.personalEmail),
    [draft.personalEmail]
  );
  const requiredFieldsReady = Boolean(
    draft.nationalId &&
      validateRut(draft.nationalId) &&
      draft.firstName.trim() &&
      draft.lastName.trim() &&
      draft.secondLastName.trim() &&
      draft.addressLine.trim() &&
      draft.region.trim() &&
      draft.currentCity.trim() &&
      draft.driverLicenseClasses.length > 0 &&
      draft.dsalRole.trim() &&
      draft.phone.trim() &&
      draft.personalEmail.trim() &&
      isEmailValid(draft.personalEmail)
  );

  const updateDraft = (patch: Partial<ApplicationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setFormError("");
    setFormMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRutTouched(true);
    setEmailTouched(true);
    setFormError("");
    setFormMessage("");

    if (!requiredFieldsReady) {
      setFormError("Revisa los campos obligatorios antes de enviar la postulación.");
      return;
    }

    setIsSubmitting(true);

    const result = await submitDsalPrecandidateApplication(draft);

    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setDraft(initialDraft);
    setRutTouched(false);
    setEmailTouched(false);
    setFormMessage(
      result.data?.status === "updated"
        ? "Actualizamos tu postulación pendiente. Reclutamiento revisará tus datos."
        : "Recibimos tu postulación. Reclutamiento revisará tus datos y te contactará si corresponde."
    );
  };

  return (
    <main className="public-application-page">
      <section className="public-application-shell">
        <header className="public-application-header">
          <div className="public-application-brand">
            <img
              src={consorcioAndinoLogo}
              alt="Consorcio Andino"
              className="public-application-logo"
            />
            <div>
              <span>Consorcio Andino</span>
              <strong>Codelco DSAL</strong>
            </div>
          </div>
          <div className="public-application-status">
            <span>Postulación pública</span>
          </div>
        </header>

        <div className="public-application-welcome">
          <h1>Estimado(a) postulante:</h1>
          <p>Agradecemos su interés en formar parte de nuestro equipo.</p>
          <p>
            Para facilitar el proceso de evaluación y permitir que nuestro equipo de Reclutamiento
            y Selección pueda contactarlo oportunamente, le solicitamos completar el siguiente
            formulario con la información requerida.
          </p>
          <p>
            ¡Le deseamos mucho éxito y agradecemos su interés en ser parte de nuestra organización!
          </p>
        </div>

        <form className="public-application-form tracking-panel" onSubmit={handleSubmit}>
          <section className="public-application-section public-application-section-identification">
            <div className="public-application-section-title">
              <span className="public-application-step">1</span>
              <div>
                <h2>Identificación</h2>
                <p>Usa tu RUT chileno vigente.</p>
              </div>
            </div>
            <TextField
              id="dsal-public-rut"
              label="RUT"
              value={draft.nationalId}
              inputMode="text"
              autoComplete="off"
              placeholder="12.345.678-K"
              hasError={rutTouched && Boolean(draft.nationalId) && !rutIsValid}
              onChange={(event) => {
                const nextRut = formatRut(event.target.value);
                updateDraft({ nationalId: nextRut });
                if (nextRut) {
                  setRutTouched(true);
                }
              }}
              onBlur={() => setRutTouched(true)}
            />
            {rutTouched && draft.nationalId && !rutIsValid ? (
              <p className="form-status form-status-error public-application-alert" role="alert">
                El RUT ingresado no es válido. Corrígelo para enviar la postulación.
              </p>
            ) : null}
          </section>

          <section className="public-application-section">
            <div className="public-application-section-title">
              <span className="public-application-step">2</span>
              <div>
                <h2>Nombre legal</h2>
                <p>Debe coincidir con tus documentos.</p>
              </div>
            </div>
            <div className="control-edit-grid public-application-grid">
              <TextField
                id="dsal-public-first-name"
                label="Nombres"
                value={draft.firstName}
                autoComplete="given-name"
                onChange={(event) => updateDraft({ firstName: event.target.value })}
              />
              <TextField
                id="dsal-public-last-name"
                label="Apellido paterno"
                value={draft.lastName}
                autoComplete="family-name"
                onChange={(event) => updateDraft({ lastName: event.target.value })}
              />
              <TextField
                id="dsal-public-second-last-name"
                label="Apellido materno"
                value={draft.secondLastName}
                onChange={(event) => updateDraft({ secondLastName: event.target.value })}
              />
            </div>
          </section>

          <section className="public-application-section">
            <div className="public-application-section-title">
              <span className="public-application-step">3</span>
              <div>
                <h2>Domicilio</h2>
                <p>Separado según la ficha ERP.</p>
              </div>
            </div>
            <div className="control-edit-grid public-application-grid">
              <TextField
                id="dsal-public-address"
                label="Dirección"
                value={draft.addressLine}
                placeholder="Calle, número, departamento o referencia"
                className="control-span-full"
                onChange={(event) => updateDraft({ addressLine: event.target.value })}
              />
              <SelectField
                id="dsal-public-region"
                label="Región"
                value={draft.region}
                options={bukEmployeeFieldOptions.region}
                placeholder="Selecciona región"
                onChange={(event) => updateDraft({ region: event.target.value })}
              />
              <TextField
                id="dsal-public-city"
                label="Ciudad"
                value={draft.currentCity}
                onChange={(event) => updateDraft({ currentCity: event.target.value })}
              />
            </div>
          </section>

          <section className="public-application-section">
            <div className="public-application-section-title">
              <span className="public-application-step">4</span>
              <div>
                <h2>Licencias</h2>
                <p>Puedes seleccionar más de una.</p>
              </div>
            </div>
            <MultiSelectField
              id="dsal-public-licenses"
              label="Tipos de licencia"
              value={draft.driverLicenseClasses}
              options={[...dsalLicenseOptions]}
              placeholder="Selecciona una o más licencias"
              onChange={(values) => updateDraft({ driverLicenseClasses: values })}
            />
          </section>

          <section className="public-application-section">
            <div className="public-application-section-title">
              <span className="public-application-step">5</span>
              <div>
                <h2>Rol actual DSAL</h2>
                <p>Selecciona una sola opción.</p>
              </div>
            </div>
            <SelectField
              id="dsal-public-role"
              label="Rol actual"
              value={draft.dsalRole}
              options={[...dsalRoleOptions]}
              placeholder="Selecciona una opción"
              onChange={(event) => updateDraft({ dsalRole: event.target.value })}
            />
          </section>

          <section className="public-application-section">
            <div className="public-application-section-title">
              <span className="public-application-step">6</span>
              <div>
                <h2>Contacto</h2>
                <p>Teléfono y correo personal.</p>
              </div>
            </div>
            <div className="control-edit-grid public-application-grid">
              <TextField
                id="dsal-public-phone"
                label="Número de teléfono"
                value={draft.phone}
                inputMode="tel"
                autoComplete="tel"
                onChange={(event) => updateDraft({ phone: event.target.value })}
              />
              <TextField
                id="dsal-public-email"
                label="Email personal"
                type="email"
                value={draft.personalEmail}
                autoComplete="email"
                hasError={emailTouched && Boolean(draft.personalEmail) && !emailIsValid}
                onChange={(event) => updateDraft({ personalEmail: event.target.value })}
                onBlur={() => setEmailTouched(true)}
              />
              {emailTouched && draft.personalEmail && !emailIsValid ? (
                <p className="form-status form-status-error public-application-alert" role="alert">
                  Ingresa un email personal válido.
                </p>
              ) : null}
            </div>
          </section>

          <section className="public-application-section">
            <div className="public-application-section-title">
              <span className="public-application-step">7</span>
              <div>
                <h2>Comentarios</h2>
                <p>Indica observaciones relevantes.</p>
              </div>
            </div>
            <label className="field-group" htmlFor="dsal-public-comments">
              <span className="field-label">Comentarios adicionales</span>
              <textarea
                id="dsal-public-comments"
                className="control-textarea public-application-textarea"
                value={draft.comments}
                rows={4}
                onChange={(event) => updateDraft({ comments: event.target.value })}
              />
            </label>
          </section>

          {formError ? (
            <p className="form-status form-status-error public-application-submit-message" role="alert">
              {formError}
            </p>
          ) : null}
          {formMessage ? (
            <p className="form-status public-application-submit-message" role="status">
              {formMessage}
            </p>
          ) : null}

          <div className="public-application-actions">
            <p>
              Al enviar confirmas que los datos ingresados son correctos para revisión de
              reclutamiento.
            </p>
            <button
              type="submit"
              className="soft-primary-button approval-button-approve public-application-submit"
              disabled={isSubmitting || !requiredFieldsReady}
            >
              {isSubmitting ? "Enviando postulación..." : "Enviar postulación"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
