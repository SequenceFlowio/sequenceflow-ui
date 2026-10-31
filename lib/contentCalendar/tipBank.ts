import type { PostDraft } from "./types";

/**
 * Handgeschreven tips. Worden gebruikt als er (nog) geen kie.ai-sleutel is,
 * of als de AI-generatie faalt. Zo werkt de kalender altijd.
 */
type Tip = Omit<PostDraft, "hashtags" | "template"> & { template?: PostDraft["template"] };

export const TIP_BANK: Tip[] = [
  {
    pillar: "tijd", headline: "Plan je week op vrijdag, niet op maandag", subline: "15 minuten die je maandag redden",
    slides: [
      { title: "Kijk terug", body: "Wat is af, wat schuift door? Schrijf het op in plaats van het te onthouden." },
      { title: "Kies 3 prioriteiten", body: "Niet tien. Drie dingen die volgende week het verschil maken." },
      { title: "Blok ze in je agenda", body: "Een prioriteit zonder tijdslot is een wens." },
    ],
    caption: "Maandagochtend begint bij de meeste ondernemers met een volle inbox en geen plan. Draai het om: gebruik vrijdagmiddag 15 minuten om je week voor te bereiden. Je begint maandag met richting in plaats van brandjes.",
    scene: "a clean wooden desk on a Friday afternoon with an open paper weekly planner, a pen and a cup of coffee, warm low sunlight",
  },
  {
    pillar: "tijd", headline: "Batch je terugkerende taken", subline: "Elke contextswitch kost je focus",
    slides: [
      { title: "Groepeer hetzelfde werk", body: "Facturen, bestellingen, social: elk op een vast moment in de week." },
      { title: "Eén blok, één soort taak", body: "Je hoofd hoeft niet steeds op te warmen voor iets nieuws." },
      { title: "Begin klein", body: "Kies één taak die je nu dagelijks doet en doe hem voortaan twee keer per week." },
    ],
    caption: "Tien keer per dag even je mail checken voelt productief, maar elke switch kost opstarttijd. Door gelijksoortig werk te bundelen win je uren terug zonder harder te werken.",
    scene: "neatly stacked paper documents and folders sorted into three groups on a minimal desk, top-down view, soft daylight",
  },
  {
    pillar: "tijd", headline: "De 2-minutenregel voor ondernemers", subline: "Klein werk direct, groot werk inplannen",
    slides: [
      { title: "Duurt het < 2 minuten?", body: "Doe het meteen. Opschrijven kost meer tijd dan uitvoeren." },
      { title: "Duurt het langer?", body: "Zet het in je agenda of op je lijst, niet in je hoofd." },
      { title: "Let op de valkuil", body: "Twintig keer twee minuten is ook een ochtend. Gebruik de regel binnen een vast blok." },
    ],
    caption: "Kleine taken stapelen zich op tot een mentale to-do-lijst die je de hele dag meesleept. Met de 2-minutenregel ruim je ze op zonder dat ze je dag overnemen.",
    scene: "a hand placing a single sticky note on an almost empty desk next to a minimalist analog clock, calm morning light",
  },
  {
    pillar: "tijd", headline: "Zeg vaker nee, zonder schuldgevoel", subline: "Elke ja is een nee tegen iets anders",
    slides: [
      { title: "Toets aan je doelen", body: "Helpt dit verzoek een van je drie prioriteiten? Zo niet: nee of later." },
      { title: "Gebruik een standaardzin", body: "\"Nu niet, ik kom er in maart op terug.\" Vriendelijk en duidelijk." },
      { title: "Bewaak je ochtenden", body: "Plan afspraken bij voorkeur na de lunch." },
    ],
    caption: "Druk zijn betekent vaak: overal ja op zeggen. De meest effectieve ondernemers zijn goed in één ding: nee zeggen tegen alles wat niet bijdraagt.",
    scene: "a closed laptop and a single plant on a tidy desk by a window, peaceful empty office, soft overcast light",
  },
  {
    pillar: "systemen", headline: "Schrijf een SOP in 15 minuten", subline: "Kennis uit je hoofd, op papier",
    slides: [
      { title: "Neem jezelf op", body: "Doe de taak één keer terwijl je je scherm opneemt en hardop praat." },
      { title: "Laat AI een eerste versie maken", body: "Transcript erin, stappenlijst eruit. Jij controleert." },
      { title: "Test het met iemand anders", body: "Kan een collega het zonder vragen uitvoeren? Dan is het klaar." },
    ],
    caption: "Zolang een proces alleen in jouw hoofd zit, ben jij de bottleneck. Een simpele SOP maakt werk overdraagbaar, en dat hoeft geen dag te kosten.",
    scene: "a notebook with a hand-drawn numbered checklist next to a laptop on a light desk, overhead shot, minimal and clean",
  },
  {
    pillar: "systemen", headline: "Automatiseer wat je 3x per week doet", subline: "De simpelste vuistregel voor automatisering",
    slides: [
      { title: "Houd een week bij", body: "Noteer elke taak die je herhaalt. Je schrikt van de lijst." },
      { title: "Reken het uit", body: "10 minuten, 3x per week = 26 uur per jaar. Per taak." },
      { title: "Begin met de saaiste", body: "Wat je het meest irriteert, automatiseer je het liefst." },
    ],
    caption: "Niet alles hoeft geautomatiseerd. Maar alles wat je minstens drie keer per week op dezelfde manier doet, is een kandidaat. Begin daar.",
    scene: "a minimalist desk with a mechanical keyboard and a small lime-green desk object, geometric shadows, modern calm workspace",
  },
  {
    pillar: "systemen", headline: "Templates voor je meest gestuurde mails", subline: "Stop met elke keer opnieuw typen",
    slides: [
      { title: "Zoek je top-5", body: "Welke mails stuur je elke week bijna hetzelfde? Offertes, follow-ups, bevestigingen." },
      { title: "Schrijf ze één keer goed", body: "Met plekken voor naam en details." },
      { title: "Zet ze onder een sneltoets", body: "Snippets in je mailprogramma maken van 5 minuten 10 seconden." },
    ],
    caption: "Je beste mail schrijf je niet om 22:00 uur onder tijdsdruk. Schrijf hem één keer met aandacht en hergebruik hem daarna.",
    scene: "close-up of hands typing on a laptop in a bright minimal room, out of focus background, soft natural light",
  },
  {
    pillar: "systemen", headline: "Eén plek voor alle informatie", subline: "Zoeken is ook werk",
    slides: [
      { title: "Kies één bron van waarheid", body: "Eén plek voor klantinfo, één voor taken, één voor documenten." },
      { title: "Ruim dubbele lijstjes op", body: "Post-its, notities in je telefoon, losse Excels: samenvoegen." },
      { title: "Spreek het af met je team", body: "Staat het er niet, dan bestaat het niet." },
    ],
    caption: "Gemiddeld zoeken we elke dag naar bestanden, wachtwoorden en afspraken. Eén vaste plek per soort informatie scheelt meer tijd dan je denkt.",
    scene: "a single neat binder and one laptop on an otherwise empty desk, everything aligned, calm architectural light",
  },
  {
    pillar: "focus", headline: "Check je inbox twee keer per dag", subline: "Je mail is andermans to-do-lijst",
    slides: [
      { title: "Vaste momenten", body: "Bijvoorbeeld 11:00 en 16:00. Daarbuiten staat je mail dicht." },
      { title: "Zet notificaties uit", body: "Echte spoed komt via de telefoon, niet via mail." },
      { title: "Verwerk, lees niet alleen", body: "Elke mail: beantwoorden, plannen, delegeren of archiveren." },
    ],
    caption: "Wie de hele dag reageert, komt niet toe aan het werk dat zijn bedrijf vooruit helpt. Twee vaste mailmomenten geven je de rest van de dag terug.",
    scene: "a smartphone lying face down on a desk next to an open notebook and a cup of tea, calm focused atmosphere, morning light",
  },
  {
    pillar: "focus", headline: "Je eerste uur bepaalt je dag", subline: "Begin met maken, niet met reageren",
    slides: [
      { title: "Geen mail voor 10:00", body: "Begin met je belangrijkste taak terwijl je hoofd nog fris is." },
      { title: "Bepaal het de avond ervoor", body: "Dan hoef je 's ochtends niet na te denken over waar je begint." },
      { title: "Telefoon in een andere kamer", body: "Uit het zicht is uit je hoofd." },
    ],
    caption: "De meeste ondernemers beginnen hun dag in andermans prioriteiten. Draai het om en geef je eerste uur aan het werk dat écht telt.",
    scene: "early morning sunlight on a desk with a notebook and coffee, empty chair, quiet home office, warm tones",
  },
  {
    pillar: "focus", headline: "Minder meetings, betere meetings", subline: "Elke meeting een doel en een eindtijd",
    slides: [
      { title: "Geen agenda, geen meeting", body: "Wat moet er na afloop besloten zijn?" },
      { title: "25 in plaats van 30 minuten", body: "Tijd om je volgende afspraak voor te bereiden." },
      { title: "Kan het async?", body: "Een update kan ook in een bericht of korte video." },
    ],
    caption: "Een team van vijf in een overbodig uur overleg kost vijf werkuren. Een paar simpele regels maken meetings korter en nuttiger.",
    scene: "an empty modern meeting table with two chairs and a small timer, clean bright room, minimal",
  },
  {
    pillar: "focus", headline: "Single-tasking is sneller", subline: "Multitasken voelt druk, niet productief",
    slides: [
      { title: "Eén tabblad open", body: "Sluit alles wat niet nodig is voor deze taak." },
      { title: "Werk in blokken van 50 minuten", body: "Daarna 10 minuten echt pauze." },
      { title: "Schrijf afleiders op", body: "Een gedachte tussendoor? Op papier, en door." },
    ],
    caption: "Steeds wisselen tussen taken voelt als veel doen, maar het werk duurt langer en wordt slordiger. Eén ding tegelijk is de snelste route.",
    scene: "a single open book and a pencil on a clean desk under a focused beam of daylight, dark warm background",
  },
  {
    pillar: "delegeren", headline: "Wat moet jij écht zelf doen?", subline: "De vraag die je agenda leegmaakt",
    slides: [
      { title: "Maak twee lijsten", body: "Taken die alleen jij kunt doen, en de rest." },
      { title: "Prijs je eigen uur", body: "Wat levert jouw uur op? Alles wat goedkoper kan, is delegeerbaar." },
      { title: "Draag elke maand één taak over", body: "Klein beginnen, consequent volhouden." },
    ],
    caption: "De meeste ondernemers besteden het grootste deel van hun tijd aan werk dat iemand anders ook kan. Begin met eerlijk kijken naar je agenda.",
    scene: "two notebooks side by side on a table, one full and one nearly empty, a hand holding a pen between them, soft daylight",
  },
  {
    pillar: "delegeren", headline: "Delegeer met een video, niet met een lap tekst", subline: "Laten zien gaat sneller dan uitleggen",
    slides: [
      { title: "Neem je scherm op", body: "Doe de taak en praat erbij. 5 minuten is genoeg." },
      { title: "Benoem het resultaat", body: "Wat is 'goed'? Laat een voorbeeld zien van het eindproduct." },
      { title: "Bewaar alles op één plek", body: "Zo bouw je vanzelf een handboek op." },
    ],
    caption: "Overdragen voelt vaak als meer werk dan het zelf doen. Een korte opname maakt het eenmalig, en daarna nooit meer.",
    scene: "a laptop with a small webcam light glowing on a tidy desk, cozy evening lamp light, out of focus plant",
  },
  {
    pillar: "delegeren", headline: "Geef beslisregels, geen goedkeuringen", subline: "Zo hoeft niet alles langs jou",
    slides: [
      { title: "Bepaal de grenzen", body: "\"Retour tot €50 mag je zelf goedkeuren.\"" },
      { title: "Schrijf ze op", body: "Een regel die je moet uitleggen, is nog geen regel." },
      { title: "Evalueer maandelijks", body: "Gaat het goed? Dan mag de grens omhoog." },
    ],
    caption: "Als elk besluit via jou moet, schaalt je bedrijf niet verder dan jouw agenda. Duidelijke beslisregels geven je team vertrouwen en jou rust.",
    scene: "a simple flowchart sketched on paper next to a coffee cup on a light wooden table, top-down, minimal",
  },
  {
    pillar: "klantcontact", headline: "Beantwoord vragen voordat ze gesteld worden", subline: "De beste supportmail is er een die niet komt",
    slides: [
      { title: "Tel je top-10 vragen", body: "Bestelstatus, retour, levertijd: meestal zijn het steeds dezelfde." },
      { title: "Zet het antwoord waar het gezocht wordt", body: "Op de productpagina, in de bevestigingsmail, in de FAQ." },
      { title: "Meet het effect", body: "Neemt het aantal mails over dit onderwerp af?" },
    ],
    caption: "Veel klantvragen zijn eigenlijk ontbrekende informatie. Wie die vooraf goed communiceert, krijgt minder mail en tevredener klanten.",
    scene: "a neatly packed shipping box with tissue paper on a bright workbench, minimal e-commerce packing station, daylight",
  },
  {
    pillar: "klantcontact", headline: "Stel verwachtingen bij levering", subline: "Duidelijkheid voorkomt 'waar blijft mijn pakket?'",
    slides: [
      { title: "Noem een realistische levertijd", body: "Liever iets ruimer en sneller leveren dan andersom." },
      { title: "Stuur een update bij vertraging", body: "Proactief mailen kost minder tijd dan reageren." },
      { title: "Maak track & trace makkelijk", body: "Eén klik vanuit de verzendmail." },
    ],
    caption: "'Waar blijft mijn bestelling?' is voor veel webshops de meest gestelde vraag. Met heldere verwachtingen haal je het grootste deel weg.",
    scene: "a stack of brown parcels near a sunny window in a small tidy warehouse corner, calm and organized",
  },
  {
    pillar: "klantcontact", headline: "Bouw vaste antwoordblokken", subline: "Persoonlijk én snel",
    slides: [
      { title: "Schrijf blokken, geen hele mails", body: "Een blok voor retour, een voor levertijd, een voor garantie." },
      { title: "Combineer en personaliseer", body: "Begin altijd met de naam en de echte vraag van de klant." },
      { title: "Houd ze actueel", body: "Verandert je beleid? Pas het blok aan, één keer." },
    ],
    caption: "Snel antwoorden betekent niet onpersoonlijk antwoorden. Met vaste blokken schrijf je goede mails in een fractie van de tijd.",
    scene: "a headset resting next to a laptop and a small plant on a light desk, calm customer service workspace, soft light",
  },
  {
    pillar: "cijfers", headline: "5 cijfers die je elke week moet zien", subline: "Overzicht zonder dashboards bouwen",
    slides: [
      { title: "Omzet & marge", body: "Niet alleen wat er binnenkomt, maar wat je overhoudt." },
      { title: "Aantal orders & gemiddelde orderwaarde", body: "Groei je door meer klanten of grotere bestellingen?" },
      { title: "Klantvragen", body: "Meer vragen dan normaal? Dan zit er ergens een probleem." },
    ],
    caption: "Je hoeft geen data-analist te zijn om goede beslissingen te nemen. Vijf cijfers, elke week op hetzelfde moment, geven je genoeg grip.",
    scene: "a printed simple bar chart on paper next to a calculator and coffee on a warm wooden desk, top-down, minimal",
  },
  {
    pillar: "cijfers", headline: "Wat kost een taak je echt?", subline: "Reken je eigen tijd mee",
    slides: [
      { title: "Tijd × frequentie", body: "15 minuten per dag = ruim 60 uur per jaar." },
      { title: "Maal je uurwaarde", body: "Bij €75 per uur is dat €4.500 per jaar. Voor één taak." },
      { title: "Vergelijk met de oplossing", body: "Een tool of hulp is vaak goedkoper dan je denkt." },
    ],
    caption: "Ondernemers rekenen hun eigen tijd zelden mee. Doe je dat wel, dan worden sommige keuzes ineens heel makkelijk.",
    scene: "a vintage calculator, a pen and a small hourglass on a clean desk, warm side light, minimalist still life",
  },
  {
    pillar: "mindset", headline: "Kies een vaste eindtijd", subline: "Werk dijt uit tot de tijd die je het geeft",
    slides: [
      { title: "Bepaal je stoptijd", body: "Bijvoorbeeld 17:30. Elke dag." },
      { title: "Plan terug vanaf het einde", body: "Wat moet er af vóór je stopt?" },
      { title: "Sluit bewust af", body: "Schrijf op waar je morgen begint. Dan kan je hoofd ook stoppen." },
    ],
    caption: "Zonder eindtijd loopt werk door tot in de avond. Met een vaste stoptijd word je vanzelf scherper in wat er écht moet gebeuren.",
    scene: "a desk lamp being switched off at dusk in a cozy home office, laptop closed, calm evening atmosphere",
  },
  {
    pillar: "mindset", headline: "Reflecteer 10 minuten op vrijdag", subline: "Leer van je eigen week",
    slides: [
      { title: "Wat ging goed?", body: "Herhaal wat werkt." },
      { title: "Wat kostte onnodig veel tijd?", body: "Daar zit je volgende optimalisatie." },
      { title: "Wat stop ik mee?", body: "Soms is de beste verbetering iets weglaten." },
    ],
    caption: "Optimaliseren begint met kijken. Tien minuten reflectie per week levert meer op dan elke nieuwe productiviteitsapp.",
    scene: "a person seen from behind sitting by a large window with a notebook, late afternoon golden light, calm",
  },
  {
    pillar: "product", headline: "Hoe wij zelf onze klantmail inrichten", subline: "Controle vóór autonomie",
    slides: [
      { title: "AI maakt het concept", body: "Op basis van ons eigen beleid, niet van gokwerk." },
      { title: "Wij keuren goed", body: "Een mens houdt de laatste stap, zeker bij uitzonderingen." },
      { title: "Pas daarna meer automatisering", body: "Vertrouwen bouw je op, je zet het niet aan." },
    ],
    caption: "Wij geloven niet in 'alles op de automatische piloot'. Bij SequenceFlow laten we AI het voorwerk doen en houden we zelf de controle. Precies zo hebben we Support One gebouwd.",
    scene: "a laptop on a calm desk with a small lime-green notebook beside it, soft daylight, modern minimal SaaS office",
  },
];
