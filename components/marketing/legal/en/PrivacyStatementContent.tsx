import { TranslationNote } from "./TranslationNote";

// Engelse vertaling van PrivacyverklaringContent; de Nederlandse tekst is leidend.
export function PrivacyStatementContent() {
  return (
    <section>
      <div>
        <div>
          <h1>Privacy Statement</h1>
          <div>
            <p>
              SequenceFlow attaches great importance to the privacy of its customers and visitors. In this Privacy
              Statement we explain which personal data we collect, why, and how we handle it. We act in accordance with
              the General Data Protection Regulation (GDPR).
            </p>
            <p>Last updated: February 2026</p>
            <TranslationNote dutchHref="/nl/privacyverklaring" />
          </div>
        </div>
        <article>
          <div>
            <h2>1. Who are we?</h2>
            <p>
              SequenceFlow is a Dutch company specialised in Flow-as-a-Service: building, implementing and managing
              autonomous business workflows for small and medium-sized businesses. We are the controller of the personal
              data collected through our website and services.
            </p>
            <p>
              Contact details: <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a> — sequenceflow.io
            </p>
          </div>
          <div>
            <h2>2. What data do we collect?</h2>
            <p>We collect the following categories of personal data:</p>
            <ul>
              <li>
                <strong>Contact details:</strong> name, email address, phone number, company name and website URL —
                collected through the Flow Scan form or direct contact.
              </li>
              <li>
                <strong>Usage data:</strong> IP address, browser type, page visits and interactions on our website
                through analytics services.
              </li>
              <li>
                <strong>Customer data:</strong> business information needed to build and manage flows. This does not
                include personal data of our clients&apos; end customers, unless laid down in a data processing
                agreement.
              </li>
              <li>
                <strong>Instagram and Facebook:</strong> if you connect your Instagram account and Facebook page through
                &quot;Log in with Facebook&quot;, we receive from Meta your name and Facebook ID, the pages you manage
                with their access tokens, the connected Instagram account and the metrics of posts you publish through
                SequenceFlow (reach, likes, comments, saves and shares). We use this data only to publish your posts and
                to show you how they perform. We store tokens encrypted. We do not sell this data and do not use it for
                advertising.
              </li>
              <li>
                <strong>TikTok:</strong> if you connect TikTok through &quot;Log in with TikTok&quot;, we receive your
                TikTok ID, display name and profile picture, access tokens (which we store encrypted) and the posting
                options of your account. We use this data only to send the posts you approve to TikTok and to show their
                status.
              </li>
            </ul>
          </div>
          <div>
            <h2>3. Why do we process your data?</h2>
            <p>We process personal data for the following purposes:</p>
            <ul>
              <li>Performing the agreement and delivering our services.</li>
              <li>Answering questions and following up on submitted Flow Scan forms.</li>
              <li>Sending quotes and invoices.</li>
              <li>Improving our website and services based on usage analytics.</li>
              <li>Complying with legal obligations.</li>
            </ul>
            <p>
              In most cases the legal basis for processing is the performance of a contract (Art. 6(1)(b) GDPR) or our
              legitimate interest (Art. 6(1)(f) GDPR).
            </p>
          </div>
          <div>
            <h2>4. How long do we keep your data?</h2>
            <p>
              We do not keep personal data longer than necessary for the purpose for which it was collected. Customer
              data is kept for the duration of the agreement and up to 2 years afterwards for any follow-up questions.
              Financial data is kept for 7 years in line with the statutory retention obligation.
            </p>
          </div>
          <div>
            <h2>5. Sharing with third parties</h2>
            <p>
              We do not share your data with third parties unless this is necessary for delivering our services or
              required by law. We use the following categories of processors:
            </p>
            <ul>
              <li>Infrastructure and hosting providers (servers within the EU).</li>
              <li>Analytics tools for website statistics.</li>
              <li>Automation platforms used for the flows (e.g. n8n, Make).</li>
              <li>Meta Platforms (Instagram and Facebook) and TikTok, if you connect them yourself, to publish your posts.</li>
            </ul>
            <p>
              If you disconnect Instagram and Facebook, or remove the app in your Facebook settings, we delete the
              tokens and account data immediately. You can also request deletion at any time: see{" "}
              <a href="/gegevens-verwijderen">data deletion</a> (in Dutch).
            </p>
            <p>
              We conclude a data processing agreement with all processors in line with GDPR requirements. Your data is
              not processed outside the European Economic Area (EEA) without appropriate safeguards.
            </p>
          </div>
          <div>
            <h2>6. Your rights under the GDPR</h2>
            <p>As a data subject you have the following rights:</p>
            <ul>
              <li>
                <strong>Right of access:</strong> you can request which of your data we process.
              </li>
              <li>
                <strong>Right to rectification:</strong> you can have incorrect data corrected.
              </li>
              <li>
                <strong>Right to erasure:</strong> you can request deletion of your data.
              </li>
              <li>
                <strong>Right to object:</strong> you can object to processing based on legitimate interest.
              </li>
              <li>
                <strong>Right to data portability:</strong> you can receive your data in a machine-readable format.
              </li>
            </ul>
            <p>
              You can exercise your rights by sending an email to{" "}
              <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>. We respond within 30 days. If you are
              not satisfied with how we process your data, you have the right to lodge a complaint with the Dutch Data
              Protection Authority (autoriteitpersoonsgegevens.nl).
            </p>
          </div>
          <div>
            <h2>7. Cookies</h2>
            <p>
              Our website uses analytical cookies to measure and improve the use of the website. We do not place
              tracking or advertising cookies without your consent. On your first visit you are informed about the use
              of cookies.
            </p>
          </div>
          <div>
            <h2>8. Changes</h2>
            <p>
              We reserve the right to amend this Privacy Statement. Material changes are announced on the website. We
              recommend checking this page periodically.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
