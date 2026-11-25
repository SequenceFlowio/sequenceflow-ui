import { TranslationNote } from "./TranslationNote";

// Engelse vertaling van VerwerkersovereenkomstContent; de Nederlandse tekst is leidend.
export function DataProcessingAgreementContent() {
  return (
    <section>
      <div>
        <div>
          <h1>Data Processing Agreement</h1>
          <div>
            <p>
              Because SequenceFlow processes personal data on behalf of its customers as part of its services, a Data
              Processing Agreement (DPA) is required by law under Article 28 of the GDPR. This page describes the
              standard terms that apply. A copy signed by both parties is provided at the start of the collaboration.
            </p>
            <p>Last updated: February 2026</p>
            <TranslationNote dutchHref="/nl/verwerkersovereenkomst" />
          </div>
        </div>
        <article>
          <div>
            <h2>1. Parties and subject</h2>
            <p>
              The data processing agreement is concluded between the customer (controller) and SequenceFlow B.V.
              (processor). SequenceFlow processes personal data solely on the customer&apos;s instructions, for the
              purposes laid down in the General Terms and Conditions and the specific service description.
            </p>
          </div>
          <div>
            <h2>2. Nature and purpose of the processing</h2>
            <p>
              SequenceFlow processes personal data that is necessary to carry out the agreed flows. Examples are passing
              lead data to a CRM system, processing customer service messages or synchronising contact details between
              systems.
            </p>
            <p>
              SequenceFlow processes the data solely for the agreed purposes and not for its own commercial purposes.
              Customer data is not used to train AI models.
            </p>
          </div>
          <div>
            <h2>3. Security measures</h2>
            <p>
              SequenceFlow takes appropriate technical and organisational measures to protect personal data:
            </p>
            <ul>
              <li>Encrypted connections (TLS/HTTPS) for all data transport.</li>
              <li>Access control based on the need-to-know principle.</li>
              <li>Data stored exclusively on servers within the European Economic Area.</li>
              <li>Use of hardened, hosted automation environments with secure configurations.</li>
              <li>Periodic review of the security measures.</li>
            </ul>
          </div>
          <div>
            <h2>4. Sub-processors</h2>
            <p>
              SequenceFlow uses sub-processors for the infrastructure and automation tools needed for the flows.
              SequenceFlow informs the customer about (changes in) the use of sub-processors. The customer has the
              right to object to the use of a new sub-processor.
            </p>
            <p>
              All sub-processors are established within the EEA or provide appropriate safeguards for transfers outside
              the EEA (such as Standard Contractual Clauses).
            </p>
          </div>
          <div>
            <h2>5. Data breach procedure</h2>
            <p>
              In the event of a security incident that leads to a (possible) personal data breach, SequenceFlow informs
              the customer by email as soon as possible — and in any case within <strong>72 hours</strong> of discovery.
              SequenceFlow provides all cooperation needed for any notification to the Dutch Data Protection Authority.
            </p>
          </div>
          <div>
            <h2>6. Rights of data subjects</h2>
            <p>
              If a data subject (e.g. an end customer of the client) submits a request under the GDPR (access,
              rectification, erasure), SequenceFlow gives the customer the technical cooperation needed to meet the
              request. SequenceFlow does not handle requests from data subjects on its own without instructions from
              the customer, unless required by law.
            </p>
          </div>
          <div>
            <h2>7. Audit and accountability</h2>
            <p>
              The customer has the right to verify compliance with this data processing agreement, subject to a
              reasonable notice period. SequenceFlow provides all cooperation and the necessary information. Audits are
              carried out at the customer&apos;s expense and may not disproportionately disrupt SequenceFlow&apos;s
              operations.
            </p>
          </div>
          <div>
            <h2>8. Termination</h2>
            <p>
              When the main agreement ends, SequenceFlow deletes or returns all of the customer&apos;s personal data,
              unless a statutory retention obligation applies. This is confirmed in writing.
            </p>
          </div>
          <div>
            <h2>9. Contact</h2>
            <p>
              For questions about the processing of personal data or to request a signed data processing agreement,
              contact us at <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
