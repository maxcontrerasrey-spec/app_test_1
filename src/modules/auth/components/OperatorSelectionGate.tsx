import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export function OperatorSelectionGate() {
  const { operatorOptions, selectOperator, signOut } = useAuth();
  const [selectedOperatorId, setSelectedOperatorId] = useState(operatorOptions[0]?.id ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedOperatorId) {
      setErrorMessage("Selecciona quién está operando esta sesión.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    const { error } = await selectOperator(selectedOperatorId);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    }
  };

  return (
    <section className="operator-gate-screen">
      <div className="operator-gate-card" role="dialog" aria-modal="true" aria-labelledby="operator-gate-title">
        <div className="operator-gate-card__header">
          <p className="operator-gate-card__eyebrow">Cuenta compartida</p>
          <h1 id="operator-gate-title">Selecciona quién está operando</h1>
        </div>

        <div className="operator-gate-options" role="radiogroup" aria-label="Operador de esta sesión">
          {operatorOptions.map((operator) => (
            <label
              className="operator-gate-option"
              data-selected={selectedOperatorId === operator.id ? "true" : "false"}
              key={operator.id}
            >
              <input
                type="radio"
                name="active-operator"
                value={operator.id}
                checked={selectedOperatorId === operator.id}
                onChange={(event) => setSelectedOperatorId(event.target.value)}
              />
              <span className="operator-gate-option__name">{operator.operatorName}</span>
              <span className="operator-gate-option__meta">
                {operator.operatorRole}
                {operator.contractCode ? ` / ${operator.contractCode}` : ""}
              </span>
              {operator.areaName ? <span className="operator-gate-option__area">{operator.areaName}</span> : null}
            </label>
          ))}
        </div>

        {errorMessage ? <p className="login-error">{errorMessage}</p> : null}

        <div className="operator-gate-actions">
          <button className="soft-secondary-button" type="button" onClick={() => void signOut()} disabled={isSubmitting}>
            Cerrar sesión
          </button>
          <button
            className="soft-primary-button"
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!selectedOperatorId || isSubmitting}
          >
            {isSubmitting ? "Confirmando..." : "Entrar"}
          </button>
        </div>
      </div>
    </section>
  );
}
