import { AlertTriangle, ArrowDown, Check, ClipboardList, Mail, PackageOpen, Users } from "lucide-react";

import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";

/**
 * De twee agents binnen Support One, elk met een eigen podium: Seffy (klantmail,
 * koptelefoon) en Otis (voorraad en inkoop, montuur). Iedereen draagt het
 * merkgroen; het onderscheid zit in het accessoire en de kleur van het podium,
 * zodat je in één oogopslag ziet dat het twee collega's zijn met elk een eigen taak.
 */

const SEFFY_TASKS = [
  { icon: Mail, title: "Waar blijft mijn pakket?", meta: "Bestelling #4521 erbij", state: "Concept klaar" },
  { icon: Mail, title: "Kan ik mijn jas ruilen?", meta: "Retourbeleid · 30 dagen", state: "Concept klaar" },
  { icon: AlertTriangle, title: "Tweede keer beschadigd", meta: "Gevoelige vraag", state: "Wacht op jou", waiting: true },
];

const OTIS_TASKS = [
  { icon: PackageOpen, title: "Linnen overhemd · M", meta: "Op in ongeveer 6 dagen", state: "Bijbestellen" },
  { icon: Users, title: "Sneaker wit · 41", meta: "Klanten vragen ernaar", state: "Wachtlijst" },
  { icon: ClipboardList, title: "Concept-inkooporder", meta: "3 varianten · 1 leverancier", state: "Te checken", waiting: true },
];

type Task = (typeof SEFFY_TASKS)[number] & { waiting?: boolean };

function TaskList({ label, tasks }: { label: string; tasks: Task[] }) {
  return (
    <div className="s1-agent-list">
      <span className="s1-agent-list-label">{label}</span>
      {tasks.map(({ icon: Icon, title, meta, state, waiting }) => (
        <div className="s1-agent-task" key={title}>
          <span className="s1-agent-task-icon"><Icon size={17} /></span>
          <span className="s1-agent-task-copy"><strong>{title}</strong><small>{meta}</small></span>
          <em className={waiting ? "is-waiting" : ""}>{waiting ? null : <Check size={12} strokeWidth={3} />}{state}</em>
        </div>
      ))}
    </div>
  );
}

export function SupportAgents() {
  return (
    <section className="s1-agents" aria-labelledby="s1-agents-title">
      <div className="s1-heading s1-heading--center">
        <span className="mk-section-kicker">JE TEAM IN SUPPORT ONE</span>
        <h2 id="s1-agents-title">Twee collega&apos;s. Elk een eigen vak.</h2>
        <p>Seffy beantwoordt je klantmails, Otis let op je voorraad. Ze werken samen, maar jij beslist.</p>
      </div>

      <Reveal as="article" className="s1-agent s1-agent--seffy">
        <div className="s1-agent-stage">
          <div className="s1-agent-mascot"><SequenceMark size={150} gear="headset" state="happy" followPointer={600} title="Seffy, je klantmail-collega" /></div>
          <TaskList label="Vandaag in je inbox" tasks={SEFFY_TASKS} />
        </div>
        <div className="s1-agent-copy">
          <span className="s1-agent-tag">Seffy · klantmails</span>
          <h3>Seffy beantwoordt je klantmails.</h3>
          <p>Leest elke klantvraag, pakt de bestelling en je beleid erbij en zet een antwoord klaar in jouw toon. Gevoelige mails blijven bij jou.</p>
          <blockquote>“Hey baas! Laat mij maar.”</blockquote>
          <a href="#seffy" className="s1-agent-link">Wat Seffy kan <ArrowDown size={15} /></a>
        </div>
      </Reveal>

      <Reveal as="article" className="s1-agent s1-agent--otis">
        <div className="s1-agent-copy">
          <span className="s1-agent-tag">Otis · voorraad &amp; inkoop</span>
          <h3>Otis houdt je voorraad in de gaten.</h3>
          <p>Ziet welke variant opraakt, rekent in dagen in plaats van stuks en zet een concept-inkooporder klaar. Pas na jouw akkoord gebeurt er iets.</p>
          <blockquote>“Ik heb het nageteld.”</blockquote>
          <a href="#otis" className="s1-agent-link">Wat Otis kan <ArrowDown size={15} /></a>
          <span className="s1-agent-note">Onderdeel van Scale · werkt met je gekoppelde verkoopkanaal</span>
        </div>
        <div className="s1-agent-stage">
          <div className="s1-agent-mascot"><SequenceMark size={150} gear="analyst" state="observing" followPointer={600} title="Otis, je voorraadcollega" /></div>
          <TaskList label="Voorraadsignalen" tasks={OTIS_TASKS} />
        </div>
      </Reveal>
    </section>
  );
}
