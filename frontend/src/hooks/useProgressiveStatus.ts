"use client";

import { useEffect, useState } from "react";

const DEFAULT_STEPS = [
  "Connecting securely...",
  "This is taking a little longer than usual. Please don't close this page.",
];

/**
 * Escalates a contextual status message while a slow request is in flight.
 * Use the base label immediately (e.g. "Generating with AI...") and let this
 * hook layer reassurance messaging only when the backend is genuinely slow.
 */
export function useProgressiveStatus(
  active: boolean,
  steps: string[] = DEFAULT_STEPS,
  delayMs = 4000
): string | null {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (!active) {
      const resetTimer = setTimeout(() => setStep(-1), 0);
      return () => clearTimeout(resetTimer);
    }
    if (steps.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, index) => {
      timers.push(setTimeout(() => setStep(index), delayMs * (index + 1)));
    });

    return () => timers.forEach((t) => clearTimeout(t));
  }, [active, steps, delayMs]);

  return step >= 0 ? steps[step] : null;
}