"use client";

import { use, useState } from "react";
import Link from "next/link";

type TicketDetail = {
  subject: string;
  customer: string;
  intent: string;
  confidence: number;
  discount: string | null;
  policyCheck: string;
  escalationReason: string | null;
  customerMessage: string;
  aiDraft: string;
};

const MOCK: Record<string, TicketDetail> = {
  "1": {
    subject: "Order #4521 has not arrived",
    customer: "Jan de Vries",
    intent: "order status",
    confidence: 0.91,
    discount: null,
    policyCheck: "Pass — within standard SLA",
    escalationReason: null,
    customerMessage:
      "Hi,\n\nI placed order #4521 on the 28th of February. It's been 5 days and I still haven't received my package. According to the tracking page it hasn't even been shipped yet.\n\nCan you please tell me what's going on?\n\nBest regards,\nJan de Vries",
    aiDraft:
      "Beste Jan,\n\nHartelijk dank voor uw bericht. We begrijpen dat u bezorgd bent over uw bestelling #4521.\n\nNa controle zien we dat uw bestelling momenteel in verwerking is en binnenkort verzonden zal worden. U ontvangt een e-mail zodra uw pakket onderweg is, inclusief trackinginformatie.\n\nWe excuseren ons voor het eventuele ongemak.",
  },
  "2": {
    subject: "I want to return my product",
    customer: "Sofia Martínez",
    intent: "return request",
    confidence: 0.76,
    discount: null,
    policyCheck: "Pass — within return window",
    escalationReason: null,
    customerMessage:
      "Hello,\n\nI received my order last week but I'm not satisfied with the product. I'd like to return it and get a refund.\n\nPlease let me know how to proceed.\n\nSofia",
    aiDraft:
      "Beste Sofia,\n\nBedankt voor uw bericht. We verwerken graag uw retourverzoek.\n\nU kunt uw product retourneren binnen 30 dagen na ontvangst. Stuur ons uw ordernummer zodat wij een retourlabel voor u kunnen aanmaken.",
  },
  "3": {
    subject: "Terrible service, filing complaint",
    customer: "Thomas Brown",
    intent: "complaint",
    confidence: 0.44,
    discount: null,
    policyCheck: "Flag — complaint requires manual review",
    escalationReason: "Low confidence + policy flag on complaint resolution",
    customerMessage:
      "This is completely unacceptable. I've been waiting for 3 weeks. Nobody answers my emails. I'm filing a formal complaint and will contact consumer services if this is not resolved today.",
    aiDraft:
      "Dear Thomas,\n\nWe sincerely apologize for the experience you've had. This does not meet the standard we hold ourselves to.\n\nA member of our team will personally reach out to you within the next 2 hours to resolve this.",
  },
  "4": {
    subject: "Where is my package?",
    customer: "Emma Bakker",
    intent: "order status",
    confidence: 0.88,
    discount: null,
    policyCheck: "Pass — within standard SLA",
    escalationReason: null,
    customerMessage:
      "Hi, I ordered a product a few days ago but haven't received any shipping confirmation. Where is my package?\n\nEmma",
    aiDraft:
      "Beste Emma,\n\nBedankt voor uw bericht. Uw bestelling is ontvangen en wordt momenteel verwerkt. U ontvangt binnenkort een bevestiging met trackinginformatie.",
  },
  "5": {
    subject: "Product arrived broken",
    customer: "Luca Romano",
    intent: "complaint",
    confidence: 0.62,
    discount: "€10 voucher",
    policyCheck: "Pass — damage claim within policy",
    escalationReason: null,
    customerMessage:
      "Hello, my order arrived today but the product is broken. The packaging was intact so it must have been damaged during production. I'm very disappointed.",
    aiDraft:
      "Dear Luca,\n\nThank you for reaching out. We're sorry to hear your product arrived damaged.\n\nWe'll send a replacement free of charge within 2–3 business days. You don't need to return the damaged item.",
  },
};

function Field({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: "13px", fontWeight: 500, color: highlight ?? "var(--text)", margin: 0, lineHeight: 1.5 }}>
        {value}
      </p>
    </div>
  );
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const ticket = MOCK[id] ?? MOCK["1"];
  const [draft, setDraft] = useState(ticket.aiDraft);

  const confColor = ticket.confidence >= 0.8 ? "#B4F000" : ticket.confidence >= 0.6 ? "#fbbf24" : "#f87171";

  return (
    <div className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">

      {/* Breadcrumb + title */}
      <div>
        <Link href="/inbox" style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "none" }}>
          ← Inbox
        </Link>
        <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "8px 0 4px" }}>
          {ticket.subject}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{ticket.customer}</p>
      </div>

      {/* Columns: stacked on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr_0.75fr] lg:items-start">

        {/* Customer message */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 14px" }}>
            Customer Message
          </p>
          <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>
            {ticket.customerMessage}
          </p>
        </div>

        {/* AI draft */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
            AI Draft
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "13px",
              lineHeight: 1.65,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Decision panel — renders after draft on mobile */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
            Decision Panel
          </p>
          <Field label="Intent"            value={ticket.intent} />
          <Field label="Confidence"        value={`${Math.round(ticket.confidence * 100)}%`} highlight={confColor} />
          <Field label="Proposed Discount" value={ticket.discount ?? "None"} />
          <Field label="Policy Check"      value={ticket.policyCheck} />
          {ticket.escalationReason && (
            <Field label="Escalation Reason" value={ticket.escalationReason} highlight="#f87171" />
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button style={{
          padding: "10px 28px", borderRadius: "8px", border: "none",
          background: "#B4F000", color: "#0B1220", fontSize: "13px", fontWeight: 600, cursor: "pointer",
        }}>
          Approve &amp; Send
        </button>
        <button style={{
          padding: "10px 28px", borderRadius: "8px",
          border: "1px solid rgba(248,113,113,0.4)", background: "rgba(239,68,68,0.08)",
          color: "#f87171", fontSize: "13px", fontWeight: 600, cursor: "pointer",
        }}>
          Escalate
        </button>
      </div>
    </div>
  );
}
