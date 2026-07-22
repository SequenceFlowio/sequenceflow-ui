import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SequenceFlow",
  description: "Privacy policy for SequenceFlow — how we collect, use and protect your data.",
};

const LAST_UPDATED = "July 20, 2026";
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

          <SubHeading>2.2 Email data</SubHeading>
          <P>To provide the core service, incoming customer emails are imported into SequenceFlow through your configured inbound setup, such as forwarding or IMAP mailbox access.</P>
          <P><strong>Your source mailbox remains untouched:</strong> SequenceFlow reads and stores a service copy of incoming messages. It does not delete, move, archive, or otherwise remove the original customer email from Gmail, Hostinger, or another connected email provider.</P>
          <P><strong>What email data we receive:</strong> subject line, sender address, email body text, email thread headers (Message-ID, References), and customer-sent attachments when present.</P>
          <P><strong>What we do NOT do:</strong> We do not sell, rent, transfer, or share your email data with any third party for advertising, analytics, or any purpose beyond providing the SequenceFlow service.</P>

          <SubHeading>2.3 Commerce integration data</SubHeading>
          <P>When an organisation connects WooCommerce or another supported commerce provider, SequenceFlow retrieves only the order, amount, item, fulfillment, cancellation, refund, and tracking fields needed to answer a support case and prepare an approved action. We do not retain full provider API responses. Customer email addresses used for order matching are converted into a tenant-specific pseudonymous key.</P>
          <P>WooCommerce access uses a merchant-created REST API key with read/write permission. Shopify access uses merchant-owned app credentials with the limited read_orders and write_orders scopes. SequenceFlow stores provider credentials and webhook secrets encrypted.</P>

          <SubHeading>2.4 AI processing</SubHeading>
          <P>Email content (subject and body text) is sent to OpenAI&apos;s API to generate a suggested reply. OpenAI processes this under their <a href="https://openai.com/policies/api-data-usage-policies" style={linkStyle} target="_blank" rel="noopener noreferrer">API data usage policy</a>. Data submitted via the API is not used to train OpenAI models.</P>

          <SubHeading>2.5 Usage and attribution data</SubHeading>
          <P>We log service metadata such as the number of emails processed, response latency, routing decisions, and outcomes for reliability, billing limits, and product improvement. These event logs do not contain email subjects, bodies, or draft replies.</P>
          <P>On our public website we record first-party campaign parameters, advertising click identifiers, landing-page visits, and button clicks so we can measure which campaigns lead to sign-ups. We do not build cross-site profiles or send this information to advertising platforms through pixels.</P>

          <SubHeading>2.6 Billing data</SubHeading>
          <P>Payments are processed by Stripe. We do not store credit card numbers. Stripe shares with us only your subscription status and customer ID.</P>
        </Section>

        <Section title="3. How we use your data">
          <ul style={ulStyle}>
            <li style={liStyle}>To receive incoming customer emails forwarded to your unique SequenceFlow address and generate AI draft replies</li>
            <li style={liStyle}>To create and send email replies on your behalf when you approve them</li>
            <li style={liStyle}>To display email threads, drafts, and analytics in the SequenceFlow dashboard</li>
            <li style={liStyle}>To match support cases to current commerce orders and execute an order action only after an authorised administrator approves it</li>
            <li style={liStyle}>To operate the service, process payments, and send transactional notifications</li>
            <li style={liStyle}>To diagnose errors and improve service reliability</li>
          </ul>
          <P>We use your data <strong>only</strong> for these stated purposes. Email data is never used for advertising or shared with third parties for their own use.</P>
        </Section>

        <Section title="4. Data protection mechanisms">
          <P>We take the following technical and organisational measures to protect account and customer-support data:</P>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Encryption in transit:</strong> Data is transmitted over encrypted connections such as HTTPS/TLS, IMAPS, and SMTP with TLS where supported by your mail provider.</li>
            <li style={liStyle}><strong>Encryption at rest:</strong> Data is stored in Supabase (hosted on AWS), which encrypts data at rest using AES-256.</li>
            <li style={liStyle}><strong>Credential security:</strong> Mailbox and SMTP credentials are handled by server-side processes and are not returned to browser clients after configuration.</li>
            <li style={liStyle}><strong>Commerce credential security:</strong> Commerce API secrets and webhook secrets are encrypted with authenticated AES-256-GCM encryption, handled server-side, excluded from application logs, and never returned to the browser.</li>
            <li style={liStyle}><strong>Tenant isolation:</strong> Each customer&apos;s data is isolated by tenant ID. Row-Level Security (RLS) policies in our database prevent any cross-tenant data access. Only authenticated users belonging to your organisation can access your data.</li>
            <li style={liStyle}><strong>Minimal Google access:</strong> Google OAuth is used for account authentication. SequenceFlow does not request Google Drive, Calendar, or Gmail mailbox access through Google OAuth.</li>
            <li style={liStyle}><strong>Limited retention:</strong> Email content and customer-sent attachments are stored only to enable the reply workflow. SequenceFlow&apos;s stored copy of handled and archived tickets is automatically removed after 90 days. This never removes the original message from your email provider.</li>
            <li style={liStyle}><strong>Restricted access:</strong> Production access is limited to authorised personnel who need it for security, incident response, or support, and to the automated systems that operate the service.</li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Email content / tickets:</strong> Open, review, and scheduled drafts are retained while they need action. SequenceFlow&apos;s imported copy of handled and archived tickets and customer-sent attachments is automatically deleted after 90 days, unless you mark the ticket to be kept or permanently delete it earlier from the archive. The original provider email remains untouched.</li>
            <li style={liStyle}><strong>Pseudonymous case memory:</strong> Before a handled ticket expires, SequenceFlow may preserve a quote-free structured summary linked to a tenant-specific customer key. Case memories, decision and outcome metadata, and sanitised commerce audit events are retained for no more than 24 months.</li>
            <li style={liStyle}><strong>Commerce data:</strong> Normalised order context is retained while the integration and related cases require it. Disconnecting the store removes encrypted credentials and synchronised order data, then stops sync and actions. Quote-free pseudonymous case memory and decision, outcome, and sanitised audit metadata may remain for up to 24 months; account deletion removes the tenant&apos;s remaining commerce data.</li>
            <li style={liStyle}><strong>Ignored senders:</strong> An organisation administrator may store an exact sender email address to prevent future mail from creating inbox tickets or AI drafts. These addresses remain until an administrator removes them in Settings or the account is deleted.</li>
            <li style={liStyle}><strong>Mailbox credentials:</strong> Retained while the relevant IMAP or SMTP integration is active and removed when that integration is disconnected.</li>
            <li style={liStyle}><strong>Account data:</strong> Retained while your account is active. Verified deletion requests are completed within 30 days, except where legal obligations require limited records to be kept longer.</li>
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
                ["Resend", "Transactional and service email", "Recipient, subject, and email content"],
                ["Vercel", "Hosting & deployment", "Request logs (IP, URL)"],
                ["Connected WooCommerce store", "Commerce source and approved order actions", "Minimum order and action fields selected by your organisation"],
              ].map(([proc, purpose, data]) => (
                <tr key={proc} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px 10px 0", fontWeight: 500 }}>{proc}</td>
                  <td style={{ padding: "10px 12px 10px 0", color: "#6b7280" }}>{purpose}</td>
                  <td style={{ padding: "10px 0", color: "#6b7280" }}>{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <P>We do not allow these processors to use customer-support data for their own advertising or unrelated purposes.</P>
        </Section>

        <Section title="7. Google sign-in">
          <P>Google OAuth is used to authenticate your account. We receive the basic profile information described in section 2.1 and use it only to create, secure, and display your SequenceFlow account. We do not use Google account data for advertising or credit decisions.</P>
        </Section>

        <Section title="8. Your rights">
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li style={liStyle}><strong>Deletion:</strong> Request deletion of your account and all associated data by emailing <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.</li>
            <li style={liStyle}><strong>Withdraw integrations:</strong> Disconnect IMAP, SMTP, or commerce access in Settings → Integrations and remove any forwarding rule at your mail provider to stop new processing. Commerce disconnect removes stored credentials and registered webhooks where the provider permits it.</li>
            <li style={liStyle}><strong>Data portability:</strong> Request an export of your data in a machine-readable format.</li>
            <li style={liStyle}><strong>Correction:</strong> Request correction of inaccurate personal data.</li>
          </ul>
          <P>To exercise any of these rights, email <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>. We will respond within 30 days.</P>
        </Section>

        <Section title="9. Cookies">
          <P>We use essential authentication cookies and a first-party attribution cookie that remembers the campaign and landing page associated with a visit for up to 30 days. This cookie supports our own sign-up measurement; it is not used for cross-site tracking or advertising profiles.</P>
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
            Dutch Chamber of Commerce (KvK): 78237750<br />
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
