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

const SCENARIOS_EN: typeof SCENARIOS = [
  {
    moment: "Monday morning after a sale",
    question: "Dozens of emails about delivery: “Where is my parcel?”",
    support: "Looks up the order for every email and prepares a draft with the current shipping status.",
    you: "You check the drafts and send them. No more tabs full of tracking pages.",
  },
  {
    moment: "A return just past the deadline",
    question: "“I'd like to return my jacket.” The order is 35 days old, your policy says 30.",
    support: "Mentions your return window in the draft and promises nothing your policy doesn't.",
    you: "You decide whether to make an exception. Adjusting the draft takes seconds.",
  },
  {
    moment: "An upset customer",
    question: "“This is the second time my order has arrived damaged.”",
    support: "Recognises a sensitive question and keeps it with you, with the order and history attached.",
    you: "You reply yourself, with all the context in one place. Emails like this never go out on their own.",
  },
];

export function InboxScenarios({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const en = lang === "en";
  return (
    <Reveal as="section" className="mk-testimonials mk-scenarios">
      <div className="mk-section-heading"><span>{en ? "FROM THE INBOX" : "UIT DE INBOX"}</span><h2>{en ? "How Support One helps on an ordinary workday." : "Zo helpt Support One op een gewone werkdag."}</h2><p>{en ? "Three situations every online store knows." : "Drie voorbeeldsituaties die elke webshop kent."}</p></div>
      <ul>
        {(en ? SCENARIOS_EN : SCENARIOS).map((item) => (
          <li key={item.moment}>
            <div>
              <small className="mk-scenario-moment">{item.moment}</small>
              <blockquote>{item.question}</blockquote>
            </div>
            <dl>
              <div><dt>Support One</dt><dd>{item.support}</dd></div>
              <div><dt>{en ? "You" : "Jij"}</dt><dd>{item.you}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
