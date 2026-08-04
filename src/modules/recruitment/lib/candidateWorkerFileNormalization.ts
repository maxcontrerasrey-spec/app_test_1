export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 3) {
    return {
      firstName: parts.slice(0, -2).join(" "),
      lastName: parts[parts.length - 2],
      secondLastName: parts[parts.length - 1]
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      secondLastName: ""
    };
  }

  return {
    firstName: fullName,
    lastName: "",
    secondLastName: ""
  };
}

export function normalizeLegacyMaritalStatus(value: string | null | undefined) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "soltero":
    case "soltero(a)":
      return "Soltero";
    case "casado":
    case "casado(a)":
      return "Casado";
    case "divorciado":
    case "divorciado(a)":
      return "Divorciado";
    case "viudo":
    case "viudo(a)":
      return "Viudo";
    case "union_civil":
    case "unión civil":
      return "Acuerdo de Unión Civil";
    default:
      return value ?? "";
  }
}
