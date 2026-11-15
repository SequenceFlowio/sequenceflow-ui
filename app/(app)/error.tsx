"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

/** Foutscherm binnen de app: zelfde scherm, met de weg terug naar het overzicht. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
