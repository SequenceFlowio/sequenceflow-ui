import { PAYOUT_VAT_RATE } from "@/lib/referrals/payoutCore";
import type { Payout } from "@/lib/referrals/payouts";
import { formatEuro } from "@/lib/referrals/program";

/**
 * Self-billingfactuur van één uitbetaling: opgemaakt door SequenceFlow namens
 * de affiliate. Lichte pagina om te printen of als pdf op te slaan. De gegevens
 * van de affiliate komen uit de momentopname bij de uitbetaling.
 */
const COMPANY = {
  name: process.env.COMPANY_LEGAL_NAME?.trim() || "SequenceFlow",
  address: process.env.COMPANY_ADDRESS?.trim() || "",
  kvk: process.env.COMPANY_KVK?.trim() || "78237750",
  vat: process.env.COMPANY_VAT_NUMBER?.trim() || "",
};

const STYLES = `
.inv{min-height:100vh;background:#fff;color:#111;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;padding:48px 24px}
.inv-sheet{max-width:720px;margin:0 auto}
.inv h1{font-size:26px;font-weight:600;margin:0 0 4px}
.inv-sub{color:#555;margin:0 0 32px}
.inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
.inv-parties h2{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 6px}
.inv-parties p{margin:0;white-space:pre-line}
.inv table{width:100%;border-collapse:collapse;margin-bottom:24px}
.inv th,.inv td{padding:10px 0;border-bottom:1px solid #ddd;text-align:left}
.inv th:last-child,.inv td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.inv tfoot td{border-bottom:0}
.inv tfoot tr:last-child td{font-weight:700;border-top:2px solid #111}
.inv-note{color:#555;font-size:12.5px;margin:0 0 8px}
.inv-print{margin-top:24px;padding:10px 16px;border:1px solid #111;border-radius:8px;background:#111;color:#fff;font:inherit;font-weight:600;cursor:pointer}
@media print{.inv{padding:0}.inv-print{display:none}}
@media(max-width:560px){.inv-parties{grid-template-columns:1fr;gap:20px}}
`;

export function PayoutInvoice({ payout, printButton }: { payout: Payout; printButton: React.ReactNode }) {
  const s = payout.snapshot;
  const date = new Date(payout.paidAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
  const supplier = [s.companyName || s.name, s.companyName ? s.name : null, s.kvkNumber ? `KvK ${s.kvkNumber}` : null, s.vatNumber ? `Btw ${s.vatNumber}` : null, s.email].filter(Boolean).join("\n");
  const customer = [COMPANY.name, COMPANY.address || null, `KvK ${COMPANY.kvk}`, COMPANY.vat ? `Btw ${COMPANY.vat}` : null].filter(Boolean).join("\n");
  return (
    <main className="inv">
      <style>{STYLES}</style>
      <div className="inv-sheet">
        <h1>Factuur {payout.invoiceNumber}</h1>
        <p className="inv-sub">Factuurdatum {date} · factuur uitgereikt door afnemer (self-billing)</p>
        <div className="inv-parties">
          <div><h2>Leverancier (affiliate)</h2><p>{supplier}</p></div>
          <div><h2>Afnemer</h2><p>{customer}</p></div>
        </div>
        <table>
          <thead><tr><th>Omschrijving</th><th>Bedrag</th></tr></thead>
          <tbody>
            <tr><td>Affiliatecommissie SequenceFlow, {payout.rewardCount} {payout.rewardCount === 1 ? "betaalde klantfactuur" : "betaalde klantfacturen"}</td><td>{formatEuro(payout.amountCents)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td>Subtotaal excl. btw</td><td>{formatEuro(payout.amountCents)}</td></tr>
            <tr><td>{payout.vatCents ? `Btw ${Math.round(PAYOUT_VAT_RATE * 100)}%` : s.isBusiness ? "Btw (geen btw-nummer opgegeven)" : "Btw (particulier, niet van toepassing)"}</td><td>{formatEuro(payout.vatCents)}</td></tr>
            <tr><td>Totaal uitbetaald</td><td>{formatEuro(payout.totalCents)}</td></tr>
          </tfoot>
        </table>
        <p className="inv-note">Overgemaakt op {date} naar {s.ibanMasked ?? "de opgegeven rekening"}{s.accountHolder ? ` op naam van ${s.accountHolder}` : ""}{payout.reference ? `, kenmerk ${payout.reference}` : ""}.</p>
        <p className="inv-note">Deze factuur is door {COMPANY.name} opgemaakt namens de leverancier, zoals afgesproken in de spelregels van het affiliateprogramma.</p>
        {printButton}
      </div>
    </main>
  );
}
