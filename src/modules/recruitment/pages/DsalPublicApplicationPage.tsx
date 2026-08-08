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
        ? "Actualizamos tu postulación pendiente. El equipo de reclutamiento revisará tus datos."
        : "Recibimos tu postulación. El equipo de reclutamiento revisará tus datos y te contactará si corresponde."
    );
  };

  return (
    <main className="public-application-page">
      <section className="public-application-shell">
        <header className="public-application-header">
          <img
            src={consorcioAndinoLogo}
            alt="Consorcio Andino"
            className="public-application-logo"
          />
          <div className="public-application-heading">
            <span className="micro-label">Codelco DSAL · Consorcio Andino</span>
            <h1>Postulación trabajadores actuales</h1>
            <p>
              Gracias por tu interés en participar en la etapa de implementación DSAL.
              Completa tus datos personales y de licencia para que el equipo de reclutamiento
              pueda revisar tu información y contactarte con mayor rapidez.
            </p>
          </div>
        </header>

        <form className="public-application-form" onSubmit={handleSubmit}>
          <section className="public-application-section">
            <div>
              <span className="public-application-step">1</span>
              <h2>Identificación</h2>
            </div>
            <div className="control-edit-grid public-application-grid">
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
                  El RUT ingresado no es válido. Corrígelo para poder enviar la postulación.
                </p>
              ) : null}
            </div>
          </section>

          <section className="public-application-section">
            <div>
              <span className="public-application-step">2</span>
              <h2>Nombre legal</h2>
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
            <div>
              <span className="public-application-step">3</span>
              <h2>Domicilio</h2>
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
            <div>
              <span className="public-application-step">4</span>
              <h2>Licencias</h2>
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
            <div>
              <span className="public-application-step">5</span>
              <h2>Rol actual DSAL</h2>
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
            <div>
              <span className="public-application-step">6</span>
              <h2>Contacto</h2>
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
            <div>
              <span className="public-application-step">7</span>
              <h2>Comentarios</h2>
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
