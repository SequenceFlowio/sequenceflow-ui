"use client";

import Link from "next/link";

type TicketStatus = "Draft Ready" | "Needs Review" | "Escalated";
type TicketIntent = "order_status" | "return_request" | "complaint" | "fallback";

type Ticket = {
  id: string;
  subject: string;
  customer: string;
  intent: TicketIntent;
  confidence: number;
  status: TicketStatus;
};

const MOCK_TICKETS: Ticket[] = [
  { id: "1", subject: "Order #4521 has not arrived",         customer: "Jan de Vries",   intent: "order_status",   confidence: 0.91, status: "Draft Ready"  },
  { id: "2", subject: "I want to return my product",         customer: "Sofia Martínez", intent: "return_request", confidence: 0.76, status: "Needs Review"  },
  { id: "3", subject: "Terrible service, filing complaint",  customer: "Thomas Brown",   intent: "complaint",      confidence: 0.44, status: "Escalated"     },
  { id: "4", subject: "Where is my package?",               customer: "Emma Bakker",    intent: "order_status",   confidence: 0.88, status: "Draft Ready"  },
  { id: "5", subject: "Product arrived broken",             customer: "Luca Romano",    intent: "complaint",      confidence: 0.62, status: "Needs Review"  },
];

const INTENT_COLORS: Record<TicketIntent, { bg: string; color: string }> = {
  order_status:   { bg: "rgba(59,130,246,0.14)",  color: "#60a5fa" },
  return_request: { bg: "rgba(139,92,246,0.14)",  color: "#a78bfa" },
  complaint:      { bg: "rgba(239,68,68,0.14)",   color: "#f87171" },
  fallback:       { bg: "rgba(107,114,128,0.14)", color: "#9ca3af" },
};

const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string }> = {
  "Draft Ready":  { bg: "rgba(180,240,0,0.14)",  color: "#B4F000" },
  "Needs Review": { bg: "rgba(251,191,36,0.14)", color: "#fbbf24" },
  "Escalated":    { bg: "rgba(239,68,68,0.14)",  color: "#f87171" },
};

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, borderRadius: "6px",
      padding: "2px 8px", background: bg, color,
      letterSpacing: "0.03em", display: "inline-block", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">

      <div className="mb-8">
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
          Inbox
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", marginTop: "6px" }}>
          AI-generated drafts pending your review.
        </p>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>

        {/* Desktop: table header */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            gap: "16px",
          }}
        >
          {["Subject", "Customer", "Intent", "Confidence", "Status"].map((h) => (
            <span key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {h}
            </span>
          ))}
        </div>

        {MOCK_TICKETS.map((ticket, i) => {
          const intent   = INTENT_COLORS[ticket.intent];
          const status   = STATUS_COLORS[ticket.status];
          const confColor = ticket.confidence >= 0.8 ? "#B4F000" : ticket.confidence >= 0.6 ? "#fbbf24" : "#f87171";
          const confBg    = ticket.confidence >= 0.8 ? "rgba(180,240,0,0.12)" : ticket.confidence >= 0.6 ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)";
          const isLast    = i === MOCK_TICKETS.length - 1;

          return (
            <Link
              key={ticket.id}
              href={`/inbox/${ticket.id}`}
              className="block transition-colors duration-100 hover:bg-[var(--bg)]"
              style={{ borderBottom: isLast ? "none" : "1px solid var(--border)", textDecoration: "none" }}
            >
              {/* Mobile: card */}
              <div className="flex flex-col gap-2 px-4 py-4 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", lineHeight: 1.4 }}>
                    {ticket.subject}
                  </span>
                  <Badge bg={status.bg} color={status.color} label={ticket.status} />
                </div>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{ticket.customer}</span>
                <div className="flex flex-wrap gap-2">
                  <Badge bg={intent.bg} color={intent.color} label={ticket.intent.replace("_", " ")} />
                  <Badge bg={confBg} color={confColor} label={`${Math.round(ticket.confidence * 100)}%`} />
                </div>
              </div>

              {/* Desktop: table row */}
              <div
                className="hidden md:grid"
                style={{
                  gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
                  padding: "14px 20px",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>{ticket.subject}</span>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>{ticket.customer}</span>
                <Badge bg={intent.bg} color={intent.color} label={ticket.intent.replace("_", " ")} />
                <Badge bg={confBg}   color={confColor}    label={`${Math.round(ticket.confidence * 100)}%`} />
                <Badge bg={status.bg} color={status.color} label={ticket.status} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
