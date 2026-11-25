import { TranslationNote } from "./TranslationNote";

// Engelse vertaling van AiDataEthiekContent; de Nederlandse tekst is leidend.
export function AiDataEthicsContent() {
  return (
    <section>
      <div>
        <div>
          <h1>AI &amp; Data Ethics</h1>
          <div>
            <p>
              SequenceFlow uses AI technology to build and manage autonomous workflows. We believe AI is a powerful
              tool — but only when it is used responsibly, transparently and fairly. On this page we explain how we
              handle AI models and customer data.
            </p>
            <p>Last updated: February 2026</p>
            <TranslationNote dutchHref="/nl/ai-data-ethiek" />
          </div>
        </div>
        <article>
          <div>
            <h2>1. Our principles</h2>
            <p>SequenceFlow follows these core principles when using AI:</p>
            <ul>
              <li>
                <strong>Transparency:</strong> we are open about which AI models we use and how they are used.
              </li>
              <li>
                <strong>Data minimisation:</strong> we only process the data that is strictly necessary for the flows to
                work.
              </li>
              <li>
                <strong>Human oversight:</strong> AI decisions in critical processes are always reviewed by or reported
                to a human (human-on-the-loop).
              </li>
              <li>
                <strong>GDPR compliance:</strong> all AI processing takes place within the limits of European privacy
                law.
              </li>
            </ul>
          </div>
          <div>
            <h2>2. Which AI models do we use?</h2>
            <p>
              SequenceFlow uses large language models (LLMs) from reputable providers for tasks such as text
              processing, classification, summarisation and drafting communication. The models are used as part of the
              flows we build for customers.
            </p>
            <p>
              We deliberately choose providers that respect European privacy law and offer contractual guarantees
              about data use. We periodically evaluate our model choices based on security updates and privacy
              policies.
            </p>
          </div>
          <div>
            <h2>3. No use of customer data for model training</h2>
            <p>
              <strong>SequenceFlow never uses your business data or the data of your customers to train AI models.</strong>{" "}
              Data processed by the flows is used solely to carry out the specific flow task and is not stored for
              training or analysis purposes outside the flow.
            </p>
            <p>
              We deliberately choose API-based integrations with AI providers that contractually guarantee that API
              input is not used for model improvement. This is an explicit requirement in our supplier selection.
            </p>
          </div>
          <div>
            <h2>4. Data isolation per customer</h2>
            <p>
              Each customer environment is logically isolated. Data from customer A is never mixed with data from
              customer B. Flows are built in separate environments and access is limited to SequenceFlow staff directly
              involved with that customer.
            </p>
          </div>
          <div>
            <h2>5. Human oversight (human-on-the-loop)</h2>
            <p>
              SequenceFlow believes in AI as an assistant, not as a replacement for human judgement in critical
              decisions. In every flow where AI makes a decision that may have significant consequences, a human
              checkpoint is built in or exceptions are flagged for manual review.
            </p>
            <p>
              This principle is called &quot;human-on-the-loop&quot;: the AI handles the volume, a human reviews the
              exceptions and monitors the quality of the output.
            </p>
          </div>
          <div>
            <h2>6. Logging and auditability</h2>
            <p>
              All actions carried out by flows are logged. Customers can view the logs of their flows on request. This
              makes it possible to audit AI decisions and trace how a particular outcome was reached.
            </p>
          </div>
          <div>
            <h2>7. Fairness and non-discrimination</h2>
            <p>
              We build flows so that they do not make unjustified distinctions based on personal characteristics such
              as gender, age, origin or religion. When designing AI-driven decision logic, we check for possible bias
              and adjust the configuration where necessary.
            </p>
          </div>
          <div>
            <h2>8. Contact</h2>
            <p>
              Do you have questions about our use of AI, or would you like to know which models are used in your
              specific flow? Contact us at <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
