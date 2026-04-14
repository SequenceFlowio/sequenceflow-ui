import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SequenceFlow",
  description: "Privacy policy for SequenceFlow — how we collect, use and protect your data.",
};

const LAST_UPDATED = "April 12, 2026";
const CONTACT_EMAIL = "hallo@sequenceflow.io";
const APP_URL = "https://emailreply.sequenceflow.io";

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f9f9f7",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      color: "#1a1a1a",
    }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        padding: "0 40px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="SequenceFlow" style={{ height: 24, width: "auto" }} />
        </Link>
        <Link href="/login" style={{
          fontSize: 13, fontWeight: 600, color: "#1a1a1a",
          textDecoration: "none", padding: "7px 16px",
          border: "1px solid #e5e7eb", borderRadius: 8,
        }}>
          Log in
        </Link>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 40px 80px" }}>

        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 48px" }}>
          Last updated: {LAST_UPDATED} · Applies to {APP_URL}
        </p>

        <Section title="1. Who we are">
          <P>SequenceFlow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the web application available at <strong>emailreply.sequenceflow.io</strong> — an AI-powered customer support inbox that reads incoming customer emails, generates AI draft replies, and lets your team approve and send them.</P>
          <P>For questions about this policy, contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.</P>
        </Section>

        <Section title="2. Data we collect">
          <SubHeading>2.1 Account information</SubHeading>
          <P>When you sign in via Google OAuth we receive your name, email address, and profile picture from Google. We store your email address and name to identify your account.</P>

          <SubHeading>2.2 Email data (via forwarding)</SubHeading>
          <P>To provide the core service, you set up an email forwarding rule in your inbox (e.g. Gmail) that sends a copy of incoming customer emails to your unique SequenceFlow address. We do not connect to your email account directly and do not store your email password or OAuth tokens.</P>
          <P><strong>What email data we receive:</strong> subject line, sender address, email body text, and email thread headers (Message-ID, References). We do not receive attachments.</P>
          <P><strong>What we do NOT do:</strong> We do not sell, rent, transfer, or share your email data with any third party for advertising, analytics, or any purpose beyond providing the SequenceFlow service.</P>

          <SubHeading>2.3 AI processing</SubHeading>
          <P>Email content (subject and body text) is sent to OpenAI&apos;s API to generate a suggested reply. OpenAI processes this under their <a href="https://openai.com/policies/api-data-usage-policies" style={linkStyle} target="_blank" rel="noopener noreferrer">API data usage policy</a>. Data submitted via the API is not used to train OpenAI models.</P>

          <SubHeading>2.4 Usage data</SubHeading>
          <P>We log metadata about how the service is used (e.g. number of emails processed, response latency, routing decisions) for performance monitoring and product improvement. This data does not include email content.</P>

          <SubHeading>2.5 Billing data</SubHeading>
          <P>Payments are processed by Stripe. We do not store credit card numbers. Stripe shares with us only your subscription status and customer ID.</P>
        </Section>

        <Section title="3. How we use your data">
          <ul style={ulStyle}>
            <li style={liStyle}>To receive incoming customer emails forwarded to your unique SequenceFlow address and generate AI draft replies</li>
            <li style={liStyle}>To create and send email replies on your behalf when you approve them</li>
            <li style={liStyle}>To display email threads, drafts, and analytics in the SequenceFlow dashboard</li>
            <li style={liStyle}>To operate the service, process payments, and send transactional notifications</li>
            <li style={liStyle}>To diagnose errors and improve service reliability</li>
          </ul>
          <P>We use your data <strong>only</strong> for these stated purposes. Email data is never used for advertising or shared with third parties for their own use.</P>
        </Section>

        <Section title="4. Data protection mechanisms">
          <P>We take the following technical and organisational measures to protect your data, including sensitive Gmail content:</P>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Encryption in transit:</strong> All data is transmitted over HTTPS/TLS. Gmail OAuth tokens and email content are never sent over unencrypted connections.</li>
            <li style={liStyle}><strong>Encryption at rest:</strong> Data is stored in Supabase (hosted on AWS), which encrypts data at rest using AES-256.</li>
            <li style={liStyle}><strong>OAuth token security:</strong> Gmail OAuth access tokens and refresh tokens are stored in our database and are only accessible to server-side processes. Tokens are never exposed to client-side code or third parties.</li>
            <li style={liStyle}><strong>Tenant isolation:</strong> Each customer&apos;s data is isolated by tenant ID. Row-Level Security (RLS) policies in our database prevent any cross-tenant data access. Only authenticated users belonging to your organisation can access your data.</li>
            <li style={liStyle}><strong>Minimal scope:</strong> We request only the Gmail scopes necessary for the service to function. We do not request access to Google Drive, Calendar, or other Google services.</li>
            <li style={liStyle}><strong>Limited retention:</strong> Email content (subject, body text) is stored as part of the ticket record to enable the reply workflow. You can delete any ticket at any time from the inbox.</li>
            <li style={liStyle}><strong>No human access to email content:</strong> SequenceFlow staff do not read your customers&apos; emails. Access to production data is restricted to automated systems and is logged.</li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Email content / tickets:</strong> Retained until you delete them or close your account.</li>
            <li style={liStyle}><strong>Gmail OAuth tokens:</strong> Retained while your Gmail integration is active. Revoking access in Google Account Settings or disconnecting in SequenceFlow immediately invalidates the tokens.</li>
            <li style={liStyle}><strong>Account data:</strong> Retained for 30 days after account closure, then permanently deleted.</li>
            <li style={liStyle}><strong>Usage logs:</strong> Retained for 90 days for debugging purposes, then automatically deleted.</li>
          </ul>
        </Section>

        <Section title="6. Third-party processors">
          <P>We share data with the following sub-processors to operate the service:</P>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "8px 12px 8px 0", color: "#6b7280", fontWeight: 600 }}>Processor</th>
                <th style={{ textAlign: "left", padding: "8px 12px 8px 0", color: "#6b7280", fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: "left", padding: "8px 0", color: "#6b7280", fontWeight: 600 }}>Data shared</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Supabase (AWS eu-west)", "Database & authentication", "All account and ticket data"],
                ["OpenAI", "AI reply generation", "Email subject & body text"],
                ["Stripe", "Payment processing", "Billing information only"],
                ["Vercel", "Hosting & deployment", "Request logs (IP, URL)"],
              ].map(([proc, purpose, data]) => (
                <tr key={proc} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px 10px 0", fontWeight: 500 }}>{proc}</td>
                  <td style={{ padding: "10px 12px 10px 0", color: "#6b7280" }}>{purpose}</td>
                  <td style={{ padding: "10px 0", color: "#6b7280" }}>{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <P>No other third parties receive your data.</P>
        </Section>

        <Section title="7. Google API Services disclosure">
          <P>SequenceFlow&apos;s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={linkStyle} target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</P>
          <P>Specifically: data obtained through Google APIs is used only to provide and improve the SequenceFlow service as described in this policy. It is not used for serving advertisements, is not transferred to third parties except as necessary to provide the service, and is not used to determine creditworthiness or for lending purposes.</P>
        </Section>

        <Section title="8. Your rights">
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li style={liStyle}><strong>Deletion:</strong> Request deletion of your account and all associated data by emailing <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.</li>
            <li style={liStyle}><strong>Revoke Gmail access:</strong> Disconnect your Gmail integration at any time from Settings → Integrations, or via <a href="https://myaccount.google.com/permissions" style={linkStyle} target="_blank" rel="noopener noreferrer">Google Account Permissions</a>. Revoking access stops all email processing immediately.</li>
            <li style={liStyle}><strong>Data portability:</strong> Request an export of your data in a machine-readable format.</li>
            <li style={liStyle}><strong>Correction:</strong> Request correction of inaccurate personal data.</li>
          </ul>
          <P>To exercise any of these rights, email <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>. We will respond within 30 days.</P>
        </Section>

        <Section title="9. Cookies">
          <P>We use only essential cookies required for authentication (session cookies set by Supabase). We do not use tracking or advertising cookies.</P>
        </Section>

        <Section title="10. Changes to this policy">
          <P>We may update this policy from time to time. We will notify you of material changes by email or by displaying a notice in the app. Continued use of the service after changes constitutes acceptance of the updated policy.</P>
        </Section>

        <Section title="11. Contact">
          <P>For privacy questions or to exercise your rights:</P>
          <div style={{
            background: "#ffffff", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: "20px 24px", marginTop: 8,
            fontSize: 14, lineHeight: 1.8,
          }}>
            <strong>SequenceFlow</strong><br />
            <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a><br />
            {APP_URL}
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#1a1a1a" }}>{title}</h2>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, margin: "20px 0 8px", color: "#1a1a1a" }}>{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "#374151", margin: "0 0 12px" }}>{children}</p>;
}

const linkStyle: React.CSSProperties = {
  color: "#1a1a1a", fontWeight: 600, textDecoration: "underline",
};

const ulStyle: React.CSSProperties = {
  margin: "0 0 12px", paddingLeft: 20,
  display: "flex", flexDirection: "column", gap: 8,
};

const liStyle: React.CSSProperties = {
  fontSize: 14, lineHeight: 1.7, color: "#374151",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "monospace", fontSize: 12,
  background: "#f3f4f6", padding: "1px 6px", borderRadius: 4,
};
