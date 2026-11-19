import { TranslationNote } from "./TranslationNote";

// Engelse vertaling van SlaContent; de Nederlandse tekst is leidend.
export function SlaEnglishContent() {
  return (
    <section>
      <div>
        <div>
          <h1>Service Level Agreement (SLA)</h1>
          <div>
            <p>
              This Service Level Agreement describes the service levels SequenceFlow guarantees for the flows it
              manages. We understand that your business processes may depend on the flows we manage for you, and we
              take that responsibility seriously.
            </p>
            <p>Last updated: February 2026</p>
            <TranslationNote dutchHref="/nl/service-level-agreement" />
          </div>
        </div>
        <article>
          <div>
            <h2>1. Availability (uptime)</h2>
            <p>
              SequenceFlow aims for an availability of <strong>99% per calendar month</strong> for all active flows.
              Planned maintenance is not included in the availability calculation, provided it is announced in advance.
            </p>
            <p>
              Availability also depends on the uptime of external services the flows are connected to (such as your
              CRM, email provider or ERP). Outages of external systems are outside SequenceFlow&apos;s responsibility.
            </p>
          </div>
          <div>
            <h2>2. Monitoring</h2>
            <p>All active flows are monitored continuously. SequenceFlow is automatically notified of:</p>
            <ul>
              <li>Outages or errors in a flow.</li>
              <li>Deviations in the expected volume or execution speed.</li>
              <li>Failed integrations with external systems.</li>
            </ul>
            <p>
              Monitoring takes place 24/7. Customers do not need to report outages themselves — we detect problems
              proactively.
            </p>
          </div>
          <div>
            <h2>3. Response times for outages</h2>
            <p>
              After an outage is detected, we use the following response times (on working days, unless agreed
              otherwise):
            </p>
            <ul>
              <li>
                <strong>Critical outage</strong> (flow completely non-functional, direct revenue impact): first response{" "}
                <strong>within 4 hours</strong>, recovery within 24 hours.
              </li>
              <li>
                <strong>Major disruption</strong> (flow partially non-functional): first response{" "}
                <strong>within 1 working day</strong>, recovery within 3 working days.
              </li>
              <li>
                <strong>Minor disruption</strong> (flow works, but with deviations): resolved in the next maintenance
                cycle.
              </li>
            </ul>
          </div>
          <div>
            <h2>4. Planned maintenance</h2>
            <p>
              SequenceFlow preferably schedules maintenance outside office hours (Monday to Friday, 08:00–18:00 CET).
              Planned maintenance is announced by email at least <strong>48 hours in advance</strong>. Urgent maintenance
              due to security vulnerabilities may be carried out without prior notice.
            </p>
          </div>
          <div>
            <h2>5. Communication during outages</h2>
            <p>
              In the event of a critical outage, SequenceFlow actively informs the customer by email about the status
              and the expected recovery time. After recovery, the customer receives a brief incident report with the
              cause and the measures taken.
            </p>
          </div>
          <div>
            <h2>6. Maintenance and optimisation</h2>
            <p>
              The monthly subscription includes regular maintenance, bug fixes and optimisations. Changes to the flow
              resulting from changes in external APIs or third-party systems are handled proactively by SequenceFlow as
              part of the subscription.
            </p>
            <p>
              New functionality or structural extensions of the flow fall outside regular maintenance and are quoted
              separately.
            </p>
          </div>
          <div>
            <h2>7. Escalation</h2>
            <p>
              If a customer is not satisfied with how an outage was handled, they can escalate by contacting{" "}
              <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a> with the subject &quot;Escalation — [flow
              name]&quot;. SequenceFlow aims to pick up escalations within 1 working day.
            </p>
          </div>
          <div>
            <h2>8. Exclusions</h2>
            <p>The SLA guarantees do not apply in the case of:</p>
            <ul>
              <li>Outages of external services and APIs outside SequenceFlow&apos;s control.</li>
              <li>Outages caused by incorrect use or unauthorised changes by the customer.</li>
              <li>Force majeure.</li>
              <li>Non-payment resulting in suspended services.</li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
