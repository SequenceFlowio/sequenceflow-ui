import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SequenceFlow",
  description: "Terms of Service for SequenceFlow — the rules and conditions for using our service.",
};

const LAST_UPDATED = "April 12, 2026";
const CONTACT_EMAIL = "hallo@sequenceflow.io";
const APP_URL = "https://emailreply.sequenceflow.io";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 48px" }}>
          Last updated: {LAST_UPDATED} · Applies to {APP_URL}
        </p>

        <Section title="1. Acceptance of terms">
          <P>By accessing or using SequenceFlow (&quot;the Service&quot;) at <strong>emailreply.sequenceflow.io</strong>, you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Service.</P>
          <P>These Terms apply to all users, including individuals and organisations (&quot;you&quot;, &quot;your&quot;). SequenceFlow is operated by SequenceFlow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).</P>
        </Section>

        <Section title="2. Description of service">
          <P>SequenceFlow is an AI-powered customer support inbox. You forward incoming customer emails to your unique SequenceFlow address, and the Service generates AI draft replies for your team to review and send. The Service is provided on a subscription basis.</P>
          <P>We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice.</P>
        </Section>

        <Section title="3. Account registration">
          <P>You must sign in using a valid Google account. You are responsible for:</P>
          <ul style={ulStyle}>
            <li style={liStyle}>Maintaining the confidentiality of your account</li>
            <li style={liStyle}>All activity that occurs under your account</li>
            <li style={liStyle}>Ensuring all team members you add comply with these Terms</li>
            <li style={liStyle}>Notifying us immediately of any unauthorised use at <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a></li>
          </ul>
          <P>You must be at least 18 years old and have the authority to enter into these Terms on behalf of your organisation.</P>
        </Section>

        <Section title="4. Subscriptions and payment">
          <SubHeading>4.1 Plans and billing</SubHeading>
          <P>The Service is offered on paid subscription plans (Starter, Pro, Agency) billed monthly. By subscribing, you authorise us to charge your payment method on a recurring basis via Stripe.</P>

          <SubHeading>4.2 Free trial</SubHeading>
          <P>New accounts may receive a free trial period. At the end of the trial, you must subscribe to continue using the Service. We reserve the right to modify or end trial offers at any time.</P>

          <SubHeading>4.3 Cancellation</SubHeading>
          <P>You may cancel your subscription at any time from Settings → Billing. Cancellation takes effect at the end of the current billing period. No refunds are issued for the remaining period.</P>

          <SubHeading>4.4 Price changes</SubHeading>
          <P>We may change pricing with 30 days&apos; notice. Continued use of the Service after the notice period constitutes acceptance of the new price.</P>
        </Section>

        <Section title="5. Acceptable use">
          <P>You agree not to use the Service to:</P>
          <ul style={ulStyle}>
            <li style={liStyle}>Send spam, unsolicited emails, or bulk marketing without consent</li>
            <li style={liStyle}>Violate any applicable law or regulation</li>
            <li style={liStyle}>Infringe the intellectual property rights of others</li>
            <li style={liStyle}>Transmit harmful, abusive, or illegal content</li>
            <li style={liStyle}>Attempt to gain unauthorised access to any system or data</li>
            <li style={liStyle}>Reverse engineer or copy any part of the Service</li>
          </ul>
          <P>We reserve the right to suspend or terminate accounts that violate these rules.</P>
        </Section>

        <Section title="6. Email data">
          <P>By setting up email forwarding to SequenceFlow, you authorise us to receive and process the forwarded emails as described in our <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>. This access is used solely to provide the Service.</P>
          <P>You can stop email processing at any time by removing the forwarding rule in your email client. This stops all email processing but does not automatically cancel your subscription.</P>
          <P>You are responsible for ensuring you have the necessary rights and consents to process your customers&apos; emails through the Service.</P>
        </Section>

        <Section title="7. Intellectual property">
          <P><strong>Your content:</strong> You retain ownership of all emails, drafts, and data you bring to or create through the Service. You grant us a limited licence to process this content solely to provide the Service.</P>
          <P><strong>Our service:</strong> All software, design, and technology behind SequenceFlow is our property or licensed to us. These Terms do not grant you any rights to our intellectual property.</P>
        </Section>

        <Section title="8. AI-generated content">
          <P>The Service uses AI to generate draft email replies. These drafts are suggestions only. You are solely responsible for reviewing and approving any reply before it is sent. We do not guarantee the accuracy, appropriateness, or completeness of AI-generated content.</P>
          <P>By using auto-send features, you accept full responsibility for emails sent automatically on your behalf.</P>
        </Section>

        <Section title="9. Disclaimer of warranties">
          <P>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or meet your specific requirements.</P>
        </Section>

        <Section title="10. Limitation of liability">
          <P>To the maximum extent permitted by law, SequenceFlow shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to loss of data, revenue, or business opportunities.</P>
          <P>Our total liability for any claim related to the Service shall not exceed the amount you paid us in the 12 months preceding the claim.</P>
        </Section>

        <Section title="11. Termination">
          <P>We may suspend or terminate your access to the Service immediately if you breach these Terms, fail to pay, or if we are required to do so by law.</P>
          <P>Upon termination, your right to use the Service ceases. Data retention after termination is governed by our <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>.</P>
        </Section>

        <Section title="12. Changes to these terms">
          <P>We may update these Terms from time to time. We will notify you of material changes by email or by displaying a notice in the app. Continued use of the Service after changes constitutes acceptance of the updated Terms.</P>
        </Section>

        <Section title="13. Governing law">
          <P>These Terms are governed by the laws of the Netherlands. Any disputes shall be subject to the exclusive jurisdiction of the courts of the Netherlands.</P>
        </Section>

        <Section title="14. Contact">
          <P>For questions about these Terms:</P>
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
