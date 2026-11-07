import { Reveal } from "./Reveal";

/**
 * Drie voorbeeldsituaties uit een webshopinbox. Bewust geen klantcitaten met
 * namen: zolang we geen echte, toegestane quotes van Support One-klanten
 * hebben, laten we zien hoe het werkt in plaats van wat iemand zou zeggen.
 */
const SCENARIOS = [
  {
    moment: "Maandagochtend na een actie",
    question: "Tientallen mails over bezorging: “Waar blijft mijn pakket?”",
    support: "Zoekt bij elke mail de bestelling op en zet een concept klaar met de actuele verzendstatus.",
    you: "Je loopt de concepten na en verstuurt ze. Geen tabbladen met track & trace meer.",
  },
  {
    moment: "Een retour net buiten de termijn",
    question: "“Ik wil mijn jas terugsturen.” De bestelling is 35 dagen oud, je beleid zegt 30.",
    support: "Noemt jouw retourtermijn in het concept en belooft niets wat je beleid niet zegt.",
    you: "Jij beslist of je een uitzondering maakt. Het concept pas je in een paar tellen aan.",
  },
  {
    moment: "Een klant die boos is",
    question: "“Dit is de tweede keer dat mijn bestelling beschadigd aankomt.”",
    support: "Herkent een gevoelige vraag en houdt die bij jou, met de bestelling en de voorgeschiedenis erbij.",
    you: "Je antwoordt zelf, met alle context al bij elkaar. Dit soort mails gaat nooit vanzelf de deur uit.",
  },
];

export function InboxScenarios() {
  return (
    <Reveal as="section" className="mk-testimonials mk-scenarios">
      <div className="mk-section-heading"><span>UIT DE INBOX</span><h2>Zo helpt Support One op een gewone werkdag.</h2><p>Drie voorbeeldsituaties die elke webshop kent.</p></div>
      <ul>
        {SCENARIOS.map((item) => (
          <li key={item.moment}>
            <div>
              <small className="mk-scenario-moment">{item.moment}</small>
              <blockquote>{item.question}</blockquote>
            </div>
            <dl>
              <div><dt>Support One</dt><dd>{item.support}</dd></div>
              <div><dt>Jij</dt><dd>{item.you}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
