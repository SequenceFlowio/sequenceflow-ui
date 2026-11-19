import { TranslationNote } from "./TranslationNote";

// Engelse vertaling van AcceptableUsePolicyContent; de Nederlandse tekst is leidend.
export function AcceptableUsePolicyEnglishContent() {
  return (
    <section>
      <div>
        <div>
          <h1>Acceptable Use Policy</h1>
          <div>
            <p>
              This Acceptable Use Policy (AUP) describes what is considered permitted and what is considered
              unacceptable use of SequenceFlow&apos;s flows and services. The AUP applies to all customers and users of
              SequenceFlow&apos;s services.
            </p>
            <p>Last updated: February 2026</p>
            <TranslationNote dutchHref="/nl/acceptable-use-policy" />
          </div>
        </div>
        <article>
          <div>
            <h2>1. Permitted use</h2>
            <p>
              SequenceFlow&apos;s flows and services are intended for lawful, business automation purposes, including:
            </p>
            <ul>
              <li>Automating internal business processes such as data processing, reporting and workflows.</li>
              <li>Lead follow-up and CRM synchronisation as part of legitimate sales and marketing activities.</li>
              <li>Customer service automation based on lawful customer interactions.</li>
              <li>Financial process automation within legal frameworks.</li>
            </ul>
          </div>
          <div>
            <h2>2. Prohibited use</h2>
            <p>You may not use SequenceFlow&apos;s flows or services for the following purposes:</p>
            <ul>
              <li>
                <strong>Spam and unsolicited communication:</strong> sending unsolicited emails, messages or
                notifications to people who have not given consent.
              </li>
              <li>
                <strong>Deception and fraud:</strong> automating fraudulent acts, phishing, identity theft or spreading
                misleading information.
              </li>
              <li>
                <strong>Illegal activities:</strong> any activity that violates Dutch or European laws and regulations.
              </li>
              <li>
                <strong>Privacy violations:</strong> collecting or processing personal data without a lawful basis or
                circumventing the GDPR.
              </li>
              <li>
                <strong>Overloading systems:</strong> deliberately generating excessive API traffic or disrupting the
                operation of external systems.
              </li>
              <li>
                <strong>Resale without permission:</strong> offering SequenceFlow&apos;s flows or services to third
                parties without written permission.
              </li>
            </ul>
          </div>
          <div>
            <h2>3. Customer responsibility</h2>
            <p>
              The customer is responsible for the use of the flows within their organisation. This includes ensuring
              that employees and sub-processors with access to the flows comply with the provisions of this AUP and
              applicable law.
            </p>
            <p>
              SequenceFlow is not liable for damage resulting from misuse of the flows by the customer or by third
              parties to whom the customer has granted access.
            </p>
          </div>
          <div>
            <h2>4. Sanctions for violations</h2>
            <p>
              In the event of (suspected) violation of this AUP, SequenceFlow reserves the right, without prior notice,
              to:
            </p>
            <ul>
              <li>Temporarily suspend the flow concerned.</li>
              <li>Investigate the use further.</li>
              <li>Terminate the agreement with immediate effect in the case of serious or repeated violations.</li>
              <li>Provide relevant information to competent authorities where required by law.</li>
            </ul>
          </div>
          <div>
            <h2>5. Reporting misuse</h2>
            <p>
              Do you suspect misuse of SequenceFlow&apos;s services? Please report it as soon as possible to{" "}
              <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>. We take every report seriously and
              investigate it confidentially.
            </p>
          </div>
          <div>
            <h2>6. Changes to this AUP</h2>
            <p>
              SequenceFlow reserves the right to amend this AUP. Material changes are communicated to active customers
              by email at least 14 days in advance. Continued use of the services after the changes take effect counts
              as acceptance of the new AUP.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
