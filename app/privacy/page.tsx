export default function PrivacyPage() {
  return (
    <div style={{
      maxWidth: "720px",
      margin: "0 auto",
      padding: "64px 32px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#111927",
      lineHeight: 1.7,
    }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", letterSpacing: "-0.02em" }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "40px" }}>
        Emailreply by SequenceFlow — Last updated: April 2025
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>What is Emailreply?</h2>
        <p style={{ fontSize: "15px", color: "#374151" }}>
          Emailreply is an AI-powered email support tool built by SequenceFlow. It connects to your Gmail inbox to read incoming support emails, generate AI-drafted replies, and send or save those replies as drafts on your behalf.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Data we access</h2>
        <p style={{ fontSize: "15px", color: "#374151" }}>
          When you connect your Gmail account, Emailreply requests the following permissions:
        </p>
        <ul style={{ fontSize: "15px", color: "#374151", paddingLeft: "20px", marginTop: "8px" }}>
          <li><strong>Read emails</strong> — to fetch incoming support messages</li>
          <li><strong>Compose &amp; send</strong> — to create and send AI-drafted replies</li>
          <li><strong>Modify emails</strong> — to mark messages as read and apply labels after processing</li>
        </ul>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>How we use your data</h2>
        <p style={{ fontSize: "15px", color: "#374151" }}>
          Email content is processed in real time solely to generate reply drafts. We do not sell, share, or retain your email data beyond what is required to operate the service. No email content is used to train AI models.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Data retention</h2>
        <p style={{ fontSize: "15px", color: "#374151" }}>
          Processed emails and generated drafts are stored only as long as necessary to display them in your inbox view. You can disconnect your Gmail account at any time from the Settings page, which revokes all access and removes stored tokens.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Third-party services</h2>
        <p style={{ fontSize: "15px", color: "#374151" }}>
          Emailreply uses the Google Gmail API under Google&apos;s terms of service. Authentication is handled via Google OAuth 2.0. AI reply generation is powered by OpenAI. Data is stored securely on Supabase infrastructure.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Contact</h2>
        <p style={{ fontSize: "15px", color: "#374151" }}>
          For any privacy-related questions, contact us at{" "}
          <a href="mailto:sequenceflownl@gmail.com" style={{ color: "#111927", textDecoration: "underline" }}>
            sequenceflownl@gmail.com
          </a>.
        </p>
      </section>
    </div>
  );
}
