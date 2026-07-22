import { Suspense } from "react";
import { redirect } from "next/navigation";

import SettingsClient from "./SettingsClient";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;

  if (params.tab === "integrations") {
    const preserved = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "tab" || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) preserved.append(key, item);
    }
    redirect(`/integrations${preserved.size ? `?${preserved.toString()}` : ""}`);
  }

  return (
    <Suspense>
      <SettingsClient />
    </Suspense>
  );
}
