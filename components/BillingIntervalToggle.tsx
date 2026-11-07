"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { BillingInterval } from "@/lib/billingInterval";
export function BillingIntervalToggle({ value, onChange, nl = true }: { value: BillingInterval; onChange: (value: BillingInterval) => void; nl?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "20px 0", flexWrap: "wrap" }} role="group" aria-label={nl ? "Betaalperiode" : "Billing period"}>
    {(["month", "year"] as const).map(interval => <button key={interval} type="button" aria-pressed={value === interval} onClick={() => onChange(interval)} style={{ padding: "12px 20px", borderRadius: 999, border: "1px solid #414936", background: value === interval ? "#c7f56f" : "#151614", color: value === interval ? "#152000" : "#f5f5f5", cursor: "pointer" }}>{interval === "month" ? (nl ? "Maandelijks" : "Monthly") : (nl ? "Jaarlijks · 20% korting" : "Yearly · Save 20%")}</button>)}
  </div>;
}

const BillingIntervalContext = createContext<{ interval: BillingInterval; setInterval: (value: BillingInterval) => void } | null>(null);
export function BillingIntervalProvider({ children }: { children: ReactNode }) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  return <BillingIntervalContext.Provider value={{ interval, setInterval }}>{children}</BillingIntervalContext.Provider>;
}
export function useBillingInterval() {
  const shared = useContext(BillingIntervalContext);
  const [interval, setInterval] = useState<BillingInterval>("month");
  return shared ?? { interval, setInterval };
}
