import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import { FIXED_MONTHLY_EUR, marginPct, stripeFeeEur, sumBy, usageCostEur, type UsageRow } from "@/lib/internal/costs";
import { isPlatformAdminEmail } from "@/lib/internal/platformAdmin";
import { PLAN_CATALOG_V2, planDisplayName } from "@/lib/planCatalog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const metadata: Metadata = { title: "Intern", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Intern dashboard, alleen voor SequenceFlow zelf: kosten, omzet, marge per
 * klant, de trechter van proef naar betalend en het gebruik. Voor iedereen
 * anders bestaat deze pagina niet (404).
 */

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 1000;
const PAID = new Set(["starter", "pro", "agency"]);

async function currentEmail() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 50_000) {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const eur = (value: number, digits = 0) => `€${value.toLocaleString("nl-NL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export default async function InternPage() {
  if (!isPlatformAdminEmail(await currentEmail())) notFound();

  const db = getSupabaseAdmin();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  type Tenant = { id: string; name: string | null; plan: string; created_at: string; stripe_subscription_id: string | null };
  type Usage = UsageRow & { tenant_id: string; operation: string; created_at: string };
  type Ledger = { tenant_id: string; rate_cents: number; status: string };

  const [tenants, usage, ledger, decisions, emailChannels, google, microsoft] = await Promise.all([
    all<Tenant>((a, b) => db.from("tenants").select("id, name, plan, created_at, stripe_subscription_id").range(a, b)),
    all<Usage>((a, b) => db.from("ai_usage_events").select("tenant_id, operation, model, prompt_tokens, cached_input_tokens, completion_tokens, created_at").gte("created_at", since30).neq("billing_status", "refunded").range(a, b)),
    all<Ledger>((a, b) => db.from("billing_handled_conversations").select("tenant_id, rate_cents, status").gte("final_at", monthStart).range(a, b)),
    all<{ tenant_id: string }>((a, b) => db.from("support_decisions").select("tenant_id").gte("created_at", since30).range(a, b)),
    all<{ tenant_id: string }>((a, b) => db.from("tenant_email_channels").select("tenant_id").range(a, b)),
    all<{ tenant_id: string }>((a, b) => db.from("tenant_google_connections").select("tenant_id").range(a, b)),
    all<{ tenant_id: string }>((a, b) => db.from("tenant_microsoft_connections").select("tenant_id").range(a, b)),
  ]);

  // Omzet: betalende klanten met een Stripe-abonnement, vast bedrag + gesprekken deze maand.
  const base = new Map(PLAN_CATALOG_V2.map((plan) => [plan.id as string, plan.baseCents / 100]));
  const usageRevenue = sumBy(ledger.filter((row) => row.status === "reported" || row.status === "pending_report"), (row) => row.tenant_id, (row) => row.rate_cents / 100);
  const paying = tenants.filter((tenant) => PAID.has(tenant.plan) && tenant.stripe_subscription_id);
  const revenueOf = (tenant: Tenant) => (paying.includes(tenant) ? (base.get(tenant.plan) ?? 0) + (usageRevenue.get(tenant.id) ?? 0) : 0);
  const mrr = paying.reduce((sum, tenant) => sum + revenueOf(tenant), 0);

  // Kosten
  const aiByTenant = sumBy(usage, (row) => row.tenant_id, usageCostEur);
  const aiByOperation = sumBy(usage, (row) => row.operation, usageCostEur);
  const aiByDay = sumBy(usage, (row) => row.created_at.slice(0, 10), usageCostEur);
  const aiTotal = [...aiByTenant.values()].reduce((sum, value) => sum + value, 0);
  const stripeTotal = paying.reduce((sum, tenant) => sum + stripeFeeEur(revenueOf(tenant)), 0);
  const fixedTotal = FIXED_MONTHLY_EUR.reduce((sum, item) => sum + item.eur, 0);
  const costTotal = aiTotal + stripeTotal + fixedTotal;

  // Trechter
  const draftsByTenant = sumBy(decisions, (row) => row.tenant_id, () => 1);
  const connected = new Set([...emailChannels, ...google, ...microsoft].map((row) => row.tenant_id));
  const new30 = tenants.filter((tenant) => tenant.created_at >= since30);
  const funnel = [
    { label: "Aangemeld (totaal)", value: tenants.length, sub: `${new30.length} in 30 dagen` },
    { label: "Mailbox gekoppeld", value: tenants.filter((tenant) => connected.has(tenant.id)).length },
    { label: "Concepten in 30 dagen", value: tenants.filter((tenant) => (draftsByTenant.get(tenant.id) ?? 0) > 0).length, sub: "werkruimtes met minstens één concept" },
    { label: "Betalend (Stripe)", value: paying.length },
  ];
  const plans = sumBy(tenants, (tenant) => tenant.plan, () => 1);
  const ledgerByStatus = sumBy(ledger, (row) => row.status, () => 1);

  const perTenant = tenants
    .map((tenant) => {
      const cost = (aiByTenant.get(tenant.id) ?? 0) + stripeFeeEur(revenueOf(tenant));
      return { tenant, drafts: draftsByTenant.get(tenant.id) ?? 0, ai: aiByTenant.get(tenant.id) ?? 0, revenue: revenueOf(tenant), cost };
    })
    .filter((row) => row.ai > 0 || row.revenue > 0 || row.drafts > 0)
    .sort((a, b) => (b.cost - b.revenue) - (a.cost - a.revenue));

  const days = Array.from({ length: 30 }, (_, index) => new Date(now - (29 - index) * DAY).toISOString().slice(0, 10));
  const maxDay = Math.max(0.0001, ...days.map((day) => aiByDay.get(day) ?? 0));

  return (
    <main className="int">
      <style>{STYLES}</style>
      <header className="int-head">
        <p>Alleen zichtbaar voor SequenceFlow</p>
        <h1>Intern dashboard</h1>
        <span>Kosten over de laatste 30 dagen, omzet deze maand. Bedragen in euro, AI omgerekend van dollars.</span>
      </header>

      <section className="int-kpis">
        <Kpi label="Omzet per maand (MRR)" value={eur(mrr)} sub={`${paying.length} betalend`} />
        <Kpi label="Kosten per maand" value={eur(costTotal)} sub={`AI ${eur(aiTotal, 2)} · Stripe ${eur(stripeTotal, 2)} · vast ${eur(fixedTotal)}`} />
        <Kpi label="Brutomarge" value={marginPct(mrr, costTotal) === null ? "—" : `${marginPct(mrr, costTotal)}%`} sub={mrr ? eur(mrr - costTotal) + " over" : "nog geen omzet"} />
        <Kpi label="AI per concept" value={decisions.length ? eur(aiTotal / decisions.length, 4) : "—"} sub={`${decisions.length} concepten in 30 dagen`} />
      </section>

      <section className="int-card">
        <h2>AI-kosten per dag</h2>
        <div className="int-bars" role="img" aria-label="AI-kosten per dag, laatste 30 dagen">
          {days.map((day) => {
            const value = aiByDay.get(day) ?? 0;
            return <div key={day} title={`${day}: ${eur(value, 3)}`}><i style={{ height: `${Math.max(2, (value / maxDay) * 100)}%` }} /></div>;
          })}
        </div>
        <div className="int-split">
          {[...aiByOperation.entries()].sort((a, b) => b[1] - a[1]).map(([operation, value]) => (
            <span key={operation}>{operation} <b>{eur(value, 3)}</b></span>
          ))}
        </div>
      </section>

      <section className="int-grid">
        <div className="int-card">
          <h2>Van aanmelding naar betalend</h2>
          <ol className="int-funnel">
            {funnel.map((step) => <li key={step.label}><b>{step.value}</b><span>{step.label}{step.sub ? <small>{step.sub}</small> : null}</span></li>)}
          </ol>
        </div>
        <div className="int-card">
          <h2>Pakketten en gesprekken deze maand</h2>
          <div className="int-split">
            {[...plans.entries()].map(([plan, count]) => <span key={plan}>{planDisplayName(plan)} <b>{count}</b></span>)}
          </div>
          <div className="int-split" style={{ marginTop: 12 }}>
            {[["included", "Inbegrepen"], ["pending_report", "Te factureren"], ["reported", "Gefactureerd"], ["over_budget", "Boven budget"], ["not_billed", "Niet gefactureerd"]].map(([key, label]) => (
              <span key={key}>{label} <b>{ledgerByStatus.get(key) ?? 0}</b></span>
            ))}
          </div>
          <h3>Vaste kosten (schatting)</h3>
          <div className="int-split">{FIXED_MONTHLY_EUR.map((item) => <span key={item.name}>{item.name} <b>{eur(item.eur)}</b></span>)}</div>
        </div>
      </section>

      <section className="int-card">
        <h2>Per klant</h2>
        <p className="int-note">Gesorteerd op wie het meest kost ten opzichte van wat hij oplevert.</p>
        <div className="int-table-wrap">
          <table className="int-table">
            <thead><tr><th>Werkruimte</th><th>Pakket</th><th>Concepten</th><th>AI-kosten</th><th>Omzet</th><th>Marge</th></tr></thead>
            <tbody>
              {perTenant.map((row) => {
                const margin = marginPct(row.revenue, row.cost);
                return (
                  <tr key={row.tenant.id}>
                    <td>{row.tenant.name || row.tenant.id.slice(0, 8)}</td>
                    <td>{planDisplayName(row.tenant.plan)}</td>
                    <td>{row.drafts}</td>
                    <td>{eur(row.ai, 2)}</td>
                    <td>{row.revenue ? eur(row.revenue) : "—"}</td>
                    <td className={margin !== null && margin < 50 ? "is-low" : ""}>{margin === null ? "—" : `${margin}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="int-kpi"><span>{label}</span><strong>{value}</strong>{sub ? <small>{sub}</small> : null}</div>;
}

const STYLES = `
.int{width:min(100%,1120px);margin:0 auto;padding:40px 24px 72px;color:var(--sf-text)}
.int-head p{margin:0;color:var(--tone-warning);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.int-head h1{margin:6px 0 0;font-size:30px;font-weight:500;letter-spacing:-.02em}
.int-head span{display:block;margin-top:6px;color:var(--sf-text-muted);font-size:13px}
.int-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0 16px}
.int-kpi{padding:16px;border:1px solid var(--sf-border);border-radius:14px;background:var(--sf-surface)}
.int-kpi span{display:block;color:var(--sf-text-muted);font-size:12px}
.int-kpi strong{display:block;margin-top:6px;font-size:24px;font-weight:600;font-variant-numeric:tabular-nums}
.int-kpi small{display:block;margin-top:4px;color:var(--sf-text-muted);font-size:11px}
.int-card{padding:18px;border:1px solid var(--sf-border);border-radius:14px;background:var(--sf-surface);margin-bottom:16px;min-width:0}
.int-card h2{margin:0 0 12px;font-size:14px;font-weight:700}
.int-card h3{margin:16px 0 8px;font-size:12px;font-weight:700;color:var(--sf-text-muted)}
.int-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.int-grid .int-card{margin-bottom:0}
.int-bars{display:grid;grid-template-columns:repeat(30,1fr);gap:3px;align-items:end;height:120px}
.int-bars div{height:100%;display:flex;align-items:flex-end}
.int-bars i{display:block;width:100%;border-radius:3px 3px 0 0;background:var(--sf-green);opacity:.8}
.int-split{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.int-split span{padding:5px 10px;border:1px solid var(--sf-border);border-radius:999px;font-size:12px;color:var(--sf-text-muted)}
.int-split b{color:var(--sf-text);margin-left:4px;font-variant-numeric:tabular-nums}
.int-funnel{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.int-funnel li{display:flex;align-items:center;gap:12px}
.int-funnel b{min-width:48px;font-size:20px;font-variant-numeric:tabular-nums;color:var(--tone-success)}
.int-funnel span{font-size:13px}.int-funnel small{display:block;color:var(--sf-text-muted);font-size:11px}
.int-note{margin:-6px 0 12px;color:var(--sf-text-muted);font-size:12px}
.int-table-wrap{overflow-x:auto}
.int-table{width:100%;border-collapse:collapse;font-size:12px}
.int-table th,.int-table td{padding:8px 10px;border-bottom:1px solid var(--sf-border);text-align:left;white-space:nowrap}
.int-table th{color:var(--sf-text-muted);font-weight:700}
.int-table td.is-low{color:var(--tone-danger);font-weight:700}
@media(max-width:900px){.int-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.int-grid{grid-template-columns:1fr}}
@media(max-width:640px){.int{padding:28px 16px 56px}}
`;
