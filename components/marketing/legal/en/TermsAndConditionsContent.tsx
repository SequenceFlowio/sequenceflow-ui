import { TranslationNote } from "./TranslationNote";

// Engelse vertaling van AlgemeneVoorwaardenContent; de Nederlandse tekst is leidend.
export function TermsAndConditionsContent() {
  return (
    <section>
      <div>
        <div>
          <h1>General Terms and Conditions</h1>
          <div>
            <p>
              These General Terms and Conditions apply to all services offered by <strong>SequenceFlow</strong>,
              established in the Netherlands and registered with the Dutch Chamber of Commerce. By using our services
              you agree to these terms.
            </p>
            <p>Last updated: February 2026</p>
            <TranslationNote dutchHref="/nl/algemene-voorwaarden" />
          </div>
        </div>
        <article>
          <div>
            <h2>1. Definitions</h2>
            <ul>
              <li>
                <strong>SequenceFlow:</strong> SequenceFlow, provider of Flow-as-a-Service.
              </li>
              <li>
                <strong>Customer:</strong> the legal entity or natural person that enters into an agreement with
                SequenceFlow.
              </li>
              <li>
                <strong>Flow:</strong> an autonomous, automated workflow that SequenceFlow builds, implements and
                manages.
              </li>
              <li>
                <strong>Flow-as-a-Service (FaaS):</strong> the service model in which SequenceFlow delivers flows on a
                subscription basis.
              </li>
              <li>
                <strong>Setup Fee:</strong> the one-off fee for building and implementing a flow.
              </li>
              <li>
                <strong>Monthly subscription:</strong> the recurring fee for management, monitoring and optimisation.
              </li>
            </ul>
          </div>
          <div>
            <h2>2. Applicability</h2>
            <p>
              These terms apply to all quotes, agreements and deliveries of SequenceFlow. Deviations are only valid if
              agreed in writing. The applicability of any purchasing or other terms of the customer is expressly
              rejected.
            </p>
          </div>
          <div>
            <h2>3. Flow-as-a-Service model</h2>
            <p>
              SequenceFlow delivers flows on a two-part model: a one-off Setup Fee for building and implementation, and
              a monthly subscription for maintenance, monitoring and optimisation. Both fees are laid down in the
              agreement.
            </p>
            <p>
              SequenceFlow retains the intellectual property of the flows it builds at all times, unless agreed
              otherwise in writing. The customer obtains a right of use for as long as the subscription is active.
            </p>
          </div>
          <div>
            <h2>4. Subscriptions and payments</h2>
            <p>
              Invoices for the monthly subscription are sent in advance and must be paid within 14 days. If the payment
              term is exceeded, SequenceFlow is entitled to temporarily suspend the service without liability for any
              consequences.
            </p>
            <p>
              Price changes are communicated in writing at least 30 days in advance. Annual indexation in line with the
              CBS (Statistics Netherlands) wage index is permitted without notice.
            </p>
            <h3>4a. Paying per handled conversation</h3>
            <p>
              With plans that include a usage component, you pay per handled conversation on top of the fixed monthly
              fee: one rate for conversations in which a team member reviewed or scheduled the reply, and one rate for
              conversations that Support One handled on its own. Each plan includes a number of handled conversations
              per billing period; the rate only applies above that number, in the order in which conversations become
              final. The current rates and numbers are on the pricing page.
            </p>
            <p>
              A conversation is handled when a substantive reply has been sent through Support One and the customer
              does not respond in the same conversation for 72 hours afterwards. Drafts, follow-up questions,
              acknowledgements of receipt, spam and failed sends do not count. If the customer responds within 72
              hours, the count lapses, unless the message is only a short thank-you without a new question or
              complaint; if the conversation is then handled after all, at most the rate for reviewed applies. Each
              conversation counts at most once.
            </p>
            <p>
              You can set a monthly budget for the usage component in the app. Nothing above it is charged and the
              service keeps working. If you think a conversation was counted incorrectly, report it within 30 days of
              the invoice; justified objections are credited.
            </p>
          </div>
          <div>
            <h2>5. Notice period and termination</h2>
            <p>
              The monthly subscription can be terminated by either party with a notice period of{" "}
              <strong>one calendar month</strong>, starting on the first day of the following month. Notice must be
              given in writing (by email).
            </p>
            <p>
              On termination, SequenceFlow provides documentation of the flows built and the integration logic on
              request, so that the customer can ensure continuity. SequenceFlow is not obliged to keep the flow active
              after the subscription ends.
            </p>
          </div>
          <div>
            <h2>6. Liability</h2>
            <p>
              SequenceFlow is not liable for indirect damage, consequential damage, lost profits or loss of data
              arising from the use of the flows, unless there is intent or gross negligence on the part of
              SequenceFlow.
            </p>
            <p>
              In all cases, the total liability of SequenceFlow is limited to the amount the customer paid in the three
              months preceding the event causing the damage.
            </p>
            <p>
              SequenceFlow is not liable for outages or errors caused by third parties, including API providers, CRM
              systems, email providers or other external systems with which the flows are integrated.
            </p>
          </div>
          <div>
            <h2>7. Intellectual property</h2>
            <p>
              All workflows, logic, configurations and documentation developed by SequenceFlow remain the intellectual
              property of SequenceFlow. The customer receives a non-exclusive, non-transferable right of use for the
              duration of the subscription.
            </p>
            <p>
              The customer may not copy, reproduce, sell or make the flows available to third parties without the prior
              written consent of SequenceFlow.
            </p>
          </div>
          <div>
            <h2>8. Confidentiality</h2>
            <p>
              Both parties undertake to keep confidential all confidential information they receive from the other
              party in connection with the agreement. This obligation continues after the agreement ends.
            </p>
          </div>
          <div>
            <h2>9. Governing law and disputes</h2>
            <p>
              All agreements between SequenceFlow and the customer are governed by Dutch law. Disputes will first be
              resolved through consultation where possible. If this fails, disputes will be submitted to the competent
              court in the district where SequenceFlow is established.
            </p>
          </div>
          <div>
            <h2>10. Contact details</h2>
            <p>
              For questions about these General Terms and Conditions, contact us at{" "}
              <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
