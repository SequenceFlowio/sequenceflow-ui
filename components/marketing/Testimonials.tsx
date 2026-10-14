import { Reveal } from "./Reveal";

/** Customer quotes carried over from the old sequenceflow.io, word for word. */
const TESTIMONIALS = [
  { name: "Thomas Bakker", role: "Founder", quote: "Onze klanten worden nu binnen minuten geholpen via de AI First-Line Support. De klanttevredenheid is door het dak gegaan." },
  { name: "Mark de Vries", role: "CEO", quote: "Dankzij SequenceFlow hebben we onze lead opvolging volledig geautomatiseerd. We missen geen enkele kans meer en onze conversie is met 40% gestegen." },
  { name: "Sophie Jansen", role: "Operations Manager", quote: "De Admin-Killer flow bespaart ons team minimaal 20 uur per week. Facturen, contracten en rapportages gaan nu volledig automatisch." },
  { name: "Lisa van den Berg", role: "Sales Director", quote: "De Smart Lead Scoring heeft onze sales pipeline getransformeerd. We focussen nu alleen nog op de leads die er echt toe doen." },
  { name: "Pieter Vermeer", role: "CFO", quote: "De CRM-Sync Flow zorgt ervoor dat onze data altijd 100% klopt. Geen handmatige invoer meer, geen fouten." },
  { name: "Emma de Groot", role: "Marketing Manager", quote: "Met de Autonome Outreach bereiken we nu 10x meer prospects dan voorheen. En het mooiste: het voelt persoonlijk en authentiek." },
];

function initials(name: string) {
  return name.split(" ").filter((part) => /^[A-Z]/.test(part)).map((part) => part[0]).slice(0, 2).join("");
}

export function Testimonials() {
  return (
    <Reveal as="section" className="mk-testimonials">
      <div className="mk-section-heading"><span>KLANTEN OVER SEQUENCEFLOW</span><h2>Wat klanten zeggen.</h2></div>
      <ul>
        {TESTIMONIALS.map((item) => (
          <li key={item.name}>
            <blockquote>“{item.quote}”</blockquote>
            <div className="mk-testimonial-person">
              <span aria-hidden="true">{initials(item.name)}</span>
              <div><strong>{item.name}</strong><small>{item.role}</small></div>
            </div>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
