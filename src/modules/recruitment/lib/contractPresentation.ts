export function formatContractDisplayName(value: string | null | undefined) {
  const contractName = value?.trim();
  return contractName ? contractName.replace(/\s*\(\d+\)\s*$/, "") : "—";
}
