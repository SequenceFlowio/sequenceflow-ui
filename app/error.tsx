"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

/** Foutscherm voor de website en alles buiten de app-schil. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
