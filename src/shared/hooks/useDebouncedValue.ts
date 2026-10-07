import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number, initialValue: T = value) {
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
