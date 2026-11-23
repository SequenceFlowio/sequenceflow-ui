/**
 * De Antwoordenbank: 30 kant-en-klare antwoorden op de klantvragen die een
 * webshop elke week krijgt. Gratis download achter de e-mailgate op
 * /nl/gratis/antwoordenbank en /en/free/reply-bank (Instagram-keyword ANTWOORD).
 *
 * Dezelfde vragen als in onze Aware-reels en de productreels van Seffy, zodat
 * wie een reel ziet precies de tekst krijgt die erbij hoort. Tekst tussen
 * [haken] vult de webshop zelf in.
 */

export type ReplyCategoryId = "delivery" | "change" | "returns" | "damaged" | "invoice" | "product";

export type Reply = {
  id: string;
  category: ReplyCategoryId;
  /** De klantvraag in de woorden van de klant. */
  title: string;
  subject: string;
  body: string;
  /** Waarom dit antwoord werkt, of waar je op moet letten. */
  tip: string;
};

export type ReplyBank = {
  categories: ReadonlyArray<{ id: ReplyCategoryId; label: string }>;
  replies: ReadonlyArray<Reply>;
};

const NL: ReplyBank = {
  categories: [
    { id: "delivery", label: "Bezorging" },
    { id: "change", label: "Wijzigen en annuleren" },
    { id: "returns", label: "Retour en ruilen" },
    { id: "damaged", label: "Kapot of verkeerd" },
    { id: "invoice", label: "Factuur en betaling" },
    { id: "product", label: "Product en voorraad" },
  ],
  replies: [
    {
      id: "waar-is-mijn-pakket",
      category: "delivery",
      title: "Waar is mijn pakket?",
      subject: "Je bestelling [bestelnummer] is onderweg",
      body: `Hoi [naam],

Goed dat je het even vraagt. Je bestelling [bestelnummer] is op [verzenddatum] verzonden met [vervoerder].

Hier kun je precies zien waar je pakket nu is: [track & trace-link]

Volgens [vervoerder] wordt het [verwachte bezorgdag] bezorgd. Staat er over twee werkdagen nog niets nieuws in de tracking? Laat het me weten, dan zoek ik het voor je uit.

Groet,
[jouw naam]`,
      tip: "Geef altijd de link én de verwachte dag. Wie alleen een link krijgt, mailt morgen opnieuw.",
    },
    {
      id: "pakket-vertraagd",
      category: "delivery",
      title: "Mijn pakket had er gisteren al moeten zijn",
      subject: "Je pakket is vertraagd, dit weten we",
      body: `Hoi [naam],

Vervelend dat je pakket er nog niet is, terwijl je erop rekende. Ik heb het nagekeken: [vervoerder] heeft het pakket sinds [datum] in het sorteercentrum en geeft nu [nieuwe bezorgdag] als bezorgdag.

Ik houd het voor je in de gaten. Is het er [nieuwe bezorgdag] nog niet, dan stuur ik je dezelfde dag een nieuw exemplaar of krijg je je geld terug, wat jij het liefst hebt.

Groet,
[jouw naam]`,
      tip: "Beloof iets wat jij zelf in de hand hebt (een nieuw exemplaar), niet iets van de vervoerder.",
    },
    {
      id: "bezorgd-niet-ontvangen",
      category: "delivery",
      title: "Er staat 'bezorgd', maar ik heb niets",
      subject: "We zoeken je pakket [bestelnummer] op",
      body: `Hoi [naam],

Wat vervelend. Volgens [vervoerder] is je pakket op [datum] om [tijd] bezorgd, [bij de buren / in de brievenbus / bij een afhaalpunt].

Zou je even willen kijken bij de buren en op een plek rond het huis waar de bezorger het neergelegd kan hebben? Dat lost het in de meeste gevallen op.

Vind je het niet, laat het me dan voor [datum] weten. Dan dien ik een onderzoek in bij [vervoerder] en zorg ik dat jij niet hoeft te wachten tot dat klaar is.

Groet,
[jouw naam]`,
      tip: "Het risico ligt bij jou tot de klant het pakket heeft. Vraag dus om te zoeken, niet om te bewijzen.",
    },
    {
      id: "andere-bezorgdag",
      category: "delivery",
      title: "Kan het op een andere dag bezorgd worden?",
      subject: "Andere bezorgdag voor [bestelnummer]",
      body: `Hoi [naam],

Dat kan. Je pakket gaat met [vervoerder], en via deze link kun je zelf een andere dag of een afhaalpunt kiezen: [link]

Lukt het niet via de link? Stuur me dan de dag die je wilt, dan regel ik het voor je.

Groet,
[jouw naam]`,
      tip: "Bij de meeste vervoerders kan de klant dit zelf. Een link scheelt jou een tweede mail.",
    },
    {
      id: "op-tijd-voor-feestdag",
      category: "delivery",
      title: "Is het op tijd voor [feestdag]?",
      subject: "Op tijd voor [feestdag]? Zo zit het",
      body: `Hoi [naam],

Goede vraag, want het wordt druk bij de vervoerders. Bestel je uiterlijk [uiterste besteldag] voor [tijd], dan verwachten we dat het vóór [feestdag] bij je is.

Wil je zekerheid, kies dan [snellere verzendoptie] bij het afrekenen. Na [uiterste besteldag] kunnen we het helaas niet meer beloven.

Groet,
[jouw naam]`,
      tip: "Zet dezelfde uiterste besteldag ook op je productpagina. Dan krijg je deze vraag een stuk minder.",
    },
    {
      id: "adres-wijzigen",
      category: "change",
      title: "Ik heb een verkeerd adres ingevuld",
      subject: "Adres aangepast voor [bestelnummer]",
      body: `Hoi [naam],

Goed dat je het meteen meldt. Je bestelling was nog niet verzonden, dus ik heb het adres aangepast naar:

[nieuw adres]

Klopt dit zo? Dan hoef je niets meer te doen. Je ontvangt de track & trace zodra het pakket onderweg is.

Groet,
[jouw naam]`,
      tip: "Herhaal het nieuwe adres in je antwoord. Een tikfout wordt dan nu ontdekt en niet bij de bezorger.",
    },
    {
      id: "adres-al-verzonden",
      category: "change",
      title: "Verkeerd adres, maar het is al verzonden",
      subject: "Je pakket is al onderweg, zo lossen we het op",
      body: `Hoi [naam],

Je pakket was helaas al onderweg toen je bericht binnenkwam. Er zijn twee opties:

1. Je past het zelf aan via de link van [vervoerder]: [link]. Dat lukt meestal tot de avond voor bezorging.
2. Lukt dat niet, dan komt het pakket bij ons terug en sturen we het kosteloos opnieuw naar het goede adres.

Laat maar weten wat je kiest.

Groet,
[jouw naam]`,
      tip: "Twee duidelijke opties werken beter dan 'we gaan kijken wat we kunnen doen'.",
    },
    {
      id: "bestelling-aanpassen",
      category: "change",
      title: "Kan ik mijn bestelling nog aanpassen?",
      subject: "Je bestelling [bestelnummer] is aangepast",
      body: `Hoi [naam],

Dat lukt nog, je bestelling is nog niet ingepakt. Ik heb [oud product] vervangen door [nieuw product].

[Het prijsverschil van €[bedrag] heb ik teruggestort. / Het verschil van €[bedrag] kun je hier betalen: [betaallink].]

Verder blijft alles hetzelfde en je pakket gaat [verzenddag] de deur uit.

Groet,
[jouw naam]`,
      tip: "Noem het geld meteen. 'Moet ik nog iets betalen?' is anders de volgende mail.",
    },
    {
      id: "annuleren",
      category: "change",
      title: "Ik wil mijn bestelling annuleren",
      subject: "Je bestelling [bestelnummer] is geannuleerd",
      body: `Hoi [naam],

Geen probleem. Je bestelling [bestelnummer] is geannuleerd en nog niet verzonden.

Je krijgt €[bedrag] terug op dezelfde manier als je hebt betaald. Meestal staat het binnen [aantal] werkdagen op je rekening.

Mocht je later toch nog iets nodig hebben, dan zie ik je graag terug.

Groet,
[jouw naam]`,
      tip: "Niet vragen waarom, niet overtuigen. Wie zonder gedoe kan annuleren, bestelt vaker opnieuw.",
    },
    {
      id: "samenvoegen",
      category: "change",
      title: "Twee bestellingen naar hetzelfde adres",
      subject: "Je twee bestellingen gaan samen in één pakket",
      body: `Hoi [naam],

Ik zag dat je twee bestellingen hebt geplaatst naar hetzelfde adres ([bestelnummer 1] en [bestelnummer 2]). Ik heb ze samengevoegd in één pakket, zodat je maar één keer thuis hoeft te zijn.

De verzendkosten van de tweede bestelling (€[bedrag]) krijg je terug.

Groet,
[jouw naam]`,
      tip: "Doe dit uit jezelf, nog voordat de klant erom vraagt. Het kost jou niets en het blijft hangen.",
    },
    {
      id: "retour-aanvragen",
      category: "returns",
      title: "Hoe stuur ik iets terug?",
      subject: "Zo stuur je [product] terug",
      body: `Hoi [naam],

Natuurlijk. Zo werkt het:

1. Meld je retour aan via [retourlink]. Daar krijg je ook het retourlabel.
2. Doe het product in de originele verpakking, of een andere stevige doos.
3. Breng het pakket naar een [vervoerder]-punt.

Zodra we het binnen hebben, storten we €[bedrag] terug. Dat duurt meestal [aantal] werkdagen.

Groet,
[jouw naam]`,
      tip: "Genummerde stappen worden gelezen. Een alinea met dezelfde info niet.",
    },
    {
      id: "ruilen-maat",
      category: "returns",
      title: "Kan ik een andere maat krijgen?",
      subject: "Ruilen naar maat [maat]",
      body: `Hoi [naam],

Zeker. Maat [maat] is op voorraad. Ik heb hem alvast voor je apart gelegd, zodat hij niet uitverkoopt terwijl je retour onderweg is.

Stuur [product] in maat [oude maat] terug via [retourlink]. Zodra het pakket bij [vervoerder] gescand is, sturen we maat [maat] naar je toe.

Groet,
[jouw naam]`,
      tip: "Apart leggen voorkomt dat een ruil een terugbetaling wordt, en dus een gemiste verkoop.",
    },
    {
      id: "retour-te-laat",
      category: "returns",
      title: "Retour na de bedenktijd",
      subject: "Over je retour van [product]",
      body: `Hoi [naam],

Dank voor je bericht. Je hebt [product] op [datum] ontvangen. De bedenktijd van [aantal] dagen is daarmee helaas voorbij, dus een gewone retour kan niet meer.

Wat ik wel kan doen: [je een tegoedbon geven van €[bedrag] als je het ongebruikt terugstuurt / je helpen het om te ruilen voor iets anders].

Is er iets mis met het product zelf? Laat het me dan weten, want dan valt het onder de garantie en ligt het anders.

Groet,
[jouw naam]`,
      tip: "Bij een defect geldt de garantie, ook na de bedenktijd. Vraag er dus altijd naar.",
    },
    {
      id: "waar-blijft-geld",
      category: "returns",
      title: "Waar blijft mijn geld?",
      subject: "Je terugbetaling van €[bedrag]",
      body: `Hoi [naam],

Ik heb het nagekeken. Je retour is op [datum] bij ons binnengekomen en we hebben €[bedrag] op [datum terugbetaling] teruggestort naar [betaalmethode].

Afhankelijk van je bank duurt het nog [aantal] werkdagen voordat je het ziet. Staat het er op [datum] nog niet, laat het me weten, dan stuur ik je het betaalbewijs.

Groet,
[jouw naam]`,
      tip: "Wettelijk heb je 14 dagen om terug te betalen. Sneller betalen is het goedkoopste wat je kunt doen tegen een slechte review.",
    },
    {
      id: "retour-ontvangen",
      category: "returns",
      title: "Is mijn retour aangekomen?",
      subject: "We hebben je retour ontvangen",
      body: `Hoi [naam],

Ja, je retour is op [datum] binnengekomen en alles ziet er goed uit.

De terugbetaling van €[bedrag] staat klaar en komt binnen [aantal] werkdagen op je rekening.

Bedankt dat je bij ons hebt besteld.

Groet,
[jouw naam]`,
      tip: "Stuur deze mail uit jezelf zodra een retour binnenkomt. Dan komt de vraag nooit.",
    },
    {
      id: "schade-bezorging",
      category: "damaged",
      title: "Het kwam kapot aan",
      subject: "Sorry, we sturen een nieuwe [product]",
      body: `Hoi [naam],

Wat balen dat [product] beschadigd is aangekomen. Dank voor de foto, dan weet ik genoeg.

Ik stuur vandaag een nieuw exemplaar en je hoeft het kapotte product niet terug te sturen. De track & trace volgt zodra het onderweg is.

Groet,
[jouw naam]`,
      tip: "Vraag één foto en geen formulier. Bij goedkope producten is terugsturen duurder dan weggooien.",
    },
    {
      id: "kapot-na-maanden",
      category: "damaged",
      title: "Kapot na drie maanden",
      subject: "Je [product] werkt niet meer, dit gaan we doen",
      body: `Hoi [naam],

Vervelend dat [product] het na drie maanden niet meer doet. Zo hoort het niet.

Zou je een foto of korte video kunnen sturen van wat er gebeurt? Dan kan ik kiezen of we het repareren of dat je meteen een nieuw exemplaar krijgt.

Je hoeft verder niets te doen. De kosten zijn voor ons.

Groet,
[jouw naam]`,
      tip: "In het eerste jaar na levering moet jij aantonen dat het product níet al een gebrek had. Discussie kost dus meer dan vervangen.",
    },
    {
      id: "verkeerd-artikel",
      category: "damaged",
      title: "Ik heb het verkeerde artikel gekregen",
      subject: "Onze fout, het juiste artikel is onderweg",
      body: `Hoi [naam],

Dat is onze fout, sorry. Het juiste product, [product], gaat vandaag nog naar je toe.

Het verkeerde artikel kun je terugsturen met dit gratis retourlabel: [retourlabel]. Haast is er niet bij, het nieuwe pakket wacht daar niet op.

Groet,
[jouw naam]`,
      tip: "Eerst het goede product sturen, daarna het retour. Andersom laat je de klant wachten op jouw fout.",
    },
    {
      id: "onderdeel-kwijt",
      category: "damaged",
      title: "Ik mis een schroefje of kabel",
      subject: "Het onderdeel is onderweg",
      body: `Hoi [naam],

Dat lossen we snel op. Ik stuur je [onderdeel] vandaag in een brievenbuspakje, dan hoef je niet thuis te blijven. Kosten zijn er niet.

Je hebt het waarschijnlijk [dag] in de brievenbus.

Groet,
[jouw naam]`,
      tip: "Houd een bakje met losse onderdelen bij de inpaktafel. Deze vraag komt vaker dan je denkt.",
    },
    {
      id: "handleiding-kwijt",
      category: "damaged",
      title: "Ik ben de handleiding kwijt",
      subject: "De handleiding van [product]",
      body: `Hoi [naam],

Geen probleem, hier is de handleiding van [product] als pdf: [link]

[Tip uit de handleiding die het vaakst nodig is, bijvoorbeeld: Lukt het koppelen niet? Houd de knop aan de zijkant 5 seconden ingedrukt.]

Kom je ergens niet uit, mail gerust.

Groet,
[jouw naam]`,
      tip: "Zet de handleiding ook op de productpagina. Dan wordt dit een vraag die je nooit meer krijgt.",
    },
    {
      id: "factuur-nodig",
      category: "invoice",
      title: "Mag ik een factuur?",
      subject: "Je factuur voor [bestelnummer]",
      body: `Hoi [naam],

Natuurlijk. Je factuur voor bestelling [bestelnummer] zit als pdf in de bijlage.

Heb je hem nodig met andere gegevens, bijvoorbeeld op bedrijfsnaam? Stuur me de naam en het adres, dan maak ik een nieuwe.

Groet,
[jouw naam]`,
      tip: "Stuur de factuur standaard mee met de verzendbevestiging. Dat scheelt zo één vraag per week.",
    },
    {
      id: "btw-nummer",
      category: "invoice",
      title: "Mijn btw-nummer staat niet op de factuur",
      subject: "Aangepaste factuur met je btw-nummer",
      body: `Hoi [naam],

Dank voor je bericht. In de bijlage zit de aangepaste factuur met je bedrijfsnaam [bedrijfsnaam] en btw-nummer [btw-nummer].

De oude factuur is daarmee vervallen.

Groet,
[jouw naam]`,
      tip: "Voeg een veld voor btw-nummer toe aan je checkout. Zakelijke klanten bestellen dan vaker opnieuw.",
    },
    {
      id: "dubbel-besteld",
      category: "invoice",
      title: "Ik heb per ongeluk twee keer besteld",
      subject: "Je dubbele bestelling is geannuleerd",
      body: `Hoi [naam],

Dat zag ik ook. Ik heb bestelling [bestelnummer] geannuleerd en [bestelnummer] blijft gewoon staan.

Het bedrag van €[bedrag] voor de dubbele bestelling krijg je binnen [aantal] werkdagen terug.

Groet,
[jouw naam]`,
      tip: "Noem welk bestelnummer blijft staan. Anders weet de klant niet welke mail hij moet bewaren.",
    },
    {
      id: "korting-gemist",
      category: "invoice",
      title: "Ik ben vergeten de kortingscode in te vullen",
      subject: "Je korting is alsnog verwerkt",
      body: `Hoi [naam],

Dat is zonde, dus ik heb het voor je rechtgezet. De korting van [kortingscode] is €[bedrag], en dat bedrag storten we vandaag terug.

Je ziet het binnen [aantal] werkdagen op je rekening.

Groet,
[jouw naam]`,
      tip: "Voor €5 terugstorten houd je een klant. Een klant die zich benadeeld voelt, kost je veel meer.",
    },
    {
      id: "betaling-mislukt",
      category: "invoice",
      title: "Mijn betaling is mislukt",
      subject: "Je bestelling staat nog voor je klaar",
      body: `Hoi [naam],

Ik zie dat de betaling voor je bestelling niet is gelukt. Er is niets afgeschreven.

Je producten staan nog voor je klaar. Via deze link kun je opnieuw betalen, met dezelfde of een andere betaalmethode: [betaallink]

Lukt het weer niet, laat het me weten, dan zoeken we samen naar een oplossing.

Groet,
[jouw naam]`,
      tip: "Begin met 'er is niets afgeschreven'. Dat is waar de klant zich zorgen over maakt.",
    },
    {
      id: "wanneer-weer-op-voorraad",
      category: "product",
      title: "Wanneer is het weer op voorraad?",
      subject: "[product] is vanaf [datum] terug",
      body: `Hoi [naam],

Goed nieuws: we verwachten [product] in [maat/kleur] rond [datum] weer binnen.

Ik heb je op de lijst gezet. Zodra het binnen is, krijg je van mij een mail met een link om te bestellen, nog voordat het weer op de site staat.

Groet,
[jouw naam]`,
      tip: "Houd bij hoe vaak deze vraag per product komt. Dat is vraag die je niet in je verkoopcijfers ziet.",
    },
    {
      id: "maatadvies",
      category: "product",
      title: "Welke maat moet ik nemen?",
      subject: "Maatadvies voor [product]",
      body: `Hoi [naam],

Goede vraag. [Product] valt [normaal / klein / groot]. Draag je normaal maat [maat], dan raden we maat [maat] aan.

Twijfel je tussen twee maten? De meeste klanten kiezen dan de [grotere / kleinere]. En past het niet, dan ruil je het gratis.

Groet,
[jouw naam]`,
      tip: "Eén zin over hoe het valt, op de productpagina, voorkomt de vraag én de retour.",
    },
    {
      id: "productvraag",
      category: "product",
      title: "Is dit geschikt voor [situatie]?",
      subject: "Over [product] en [situatie]",
      body: `Hoi [naam],

Goede vraag. [Product] is [wel / niet] geschikt voor [situatie], omdat [reden in één zin].

[Als het niet geschikt is:] Voor [situatie] raad ik [ander product] aan: [link]

Hoop dat je hiermee verder kunt. Vraag gerust als je nog twijfelt.

Groet,
[jouw naam]`,
      tip: "Een eerlijk 'nee, maar dit wel' verkoopt beter dan een vaag 'dat zou moeten kunnen'.",
    },
    {
      id: "preorder-levertijd",
      category: "product",
      title: "Wanneer wordt mijn pre-order verzonden?",
      subject: "Update over je pre-order [bestelnummer]",
      body: `Hoi [naam],

Dank voor je geduld. De nieuwe voorraad van [product] komt naar verwachting [datum] bij ons binnen. Jouw bestelling gaat dan binnen [aantal] werkdagen de deur uit.

Duurt het langer, dan hoor je dat eerst van mij. En wil je liever niet wachten, dan annuleer ik het en krijg je je geld meteen terug.

Groet,
[jouw naam]`,
      tip: "Bied zelf de annulering aan. Klanten blijven eerder wachten als ze weten dat ze weg kúnnen.",
    },
    {
      id: "boze-klant",
      category: "product",
      title: "Een boze klant",
      subject: "Je hebt gelijk, dit had beter gemoeten",
      body: `Hoi [naam],

Je hebt gelijk, en het spijt me. [Wat er misging, in één zin, zonder excuses erbij] is niet hoe wij het willen doen.

Dit heb ik al gedaan: [concrete oplossing, bijvoorbeeld: een nieuw exemplaar verstuurd met spoed].
En als goedmaker: [kleine extra, bijvoorbeeld: de verzendkosten terug / €10 tegoed].

Je hoeft verder niets te doen. Ik houd het in de gaten tot het bij je is.

Groet,
[jouw naam]`,
      tip: "Sorry zeggen lost nog niets op. Begin met gelijk geven, en noem wat je al gedáán hebt.",
    },
  ],
};

const EN: ReplyBank = {
  categories: [
    { id: "delivery", label: "Delivery" },
    { id: "change", label: "Changes and cancellations" },
    { id: "returns", label: "Returns and exchanges" },
    { id: "damaged", label: "Damaged or wrong item" },
    { id: "invoice", label: "Invoices and payment" },
    { id: "product", label: "Product and stock" },
  ],
  replies: [
    {
      id: "waar-is-mijn-pakket",
      category: "delivery",
      title: "Where is my parcel?",
      subject: "Your order [order number] is on its way",
      body: `Hi [name],

Thanks for checking in. Your order [order number] shipped on [ship date] with [carrier].

You can see exactly where your parcel is here: [tracking link]

[Carrier] expects to deliver it on [expected day]. If the tracking hasn't moved in two working days, let me know and I'll look into it for you.

Best,
[your name]`,
      tip: "Always give the link and the expected day. A link on its own gets you a second email tomorrow.",
    },
    {
      id: "pakket-vertraagd",
      category: "delivery",
      title: "My parcel should have arrived yesterday",
      subject: "Your parcel is delayed, here's what we know",
      body: `Hi [name],

Sorry your parcel hasn't arrived when you were counting on it. I've checked: [carrier] has had it at the sorting centre since [date] and now expects to deliver on [new day].

I'm keeping an eye on it. If it hasn't arrived by [new day], I'll send a replacement the same day or refund you, whichever you prefer.

Best,
[your name]`,
      tip: "Promise something you control (a replacement), not something the carrier controls.",
    },
    {
      id: "bezorgd-niet-ontvangen",
      category: "delivery",
      title: "It says 'delivered', but I have nothing",
      subject: "Let's find your parcel [order number]",
      body: `Hi [name],

That's annoying. According to [carrier], your parcel was delivered on [date] at [time], [with a neighbour / through the letterbox / at a pickup point].

Could you check with your neighbours and around the house where the driver might have left it? That solves it in most cases.

If you can't find it, let me know by [date]. I'll open an investigation with [carrier] and make sure you don't have to wait for it to finish.

Best,
[your name]`,
      tip: "The risk is yours until the customer has the parcel. Ask them to look, not to prove anything.",
    },
    {
      id: "andere-bezorgdag",
      category: "delivery",
      title: "Can it be delivered on another day?",
      subject: "Another delivery day for [order number]",
      body: `Hi [name],

Yes. Your parcel is with [carrier], and you can pick another day or a pickup point yourself here: [link]

If the link doesn't work, send me the day you'd like and I'll sort it for you.

Best,
[your name]`,
      tip: "Most carriers let customers do this themselves. A link saves you a second email.",
    },
    {
      id: "op-tijd-voor-feestdag",
      category: "delivery",
      title: "Will it arrive before [holiday]?",
      subject: "In time for [holiday]? Here's how it works",
      body: `Hi [name],

Good question, carriers get very busy now. If you order by [last order day] before [time], we expect it to reach you before [holiday].

Want to be sure? Choose [faster shipping option] at checkout. After [last order day] we can't promise it any more.

Best,
[your name]`,
      tip: "Put the same last order day on your product page and you'll get this question far less.",
    },
    {
      id: "adres-wijzigen",
      category: "change",
      title: "I entered the wrong address",
      subject: "Address updated for [order number]",
      body: `Hi [name],

Thanks for letting me know straight away. Your order hadn't shipped yet, so I've changed the address to:

[new address]

If that's right, you don't need to do anything. You'll get tracking as soon as it's on its way.

Best,
[your name]`,
      tip: "Repeat the new address in your reply. A typo gets caught now, not at the door.",
    },
    {
      id: "adres-al-verzonden",
      category: "change",
      title: "Wrong address, but it has already shipped",
      subject: "Your parcel is on its way, here's the fix",
      body: `Hi [name],

Your parcel had already left by the time your message came in. There are two options:

1. Change it yourself with [carrier] here: [link]. That usually works until the evening before delivery.
2. If that doesn't work, the parcel comes back to us and we'll resend it to the right address at no cost.

Just let me know which you prefer.

Best,
[your name]`,
      tip: "Two clear options beat 'we'll see what we can do'.",
    },
    {
      id: "bestelling-aanpassen",
      category: "change",
      title: "Can I still change my order?",
      subject: "Your order [order number] has been updated",
      body: `Hi [name],

You're in time, your order hasn't been packed yet. I've swapped [old product] for [new product].

[I've refunded the difference of [amount]. / You can pay the difference of [amount] here: [payment link].]

Everything else stays the same and your parcel ships on [ship day].

Best,
[your name]`,
      tip: "Mention the money straight away, or 'do I need to pay anything?' is the next email.",
    },
    {
      id: "annuleren",
      category: "change",
      title: "I want to cancel my order",
      subject: "Your order [order number] has been cancelled",
      body: `Hi [name],

No problem. Your order [order number] is cancelled and hasn't shipped.

You'll get [amount] back the same way you paid. It usually shows up within [number] working days.

If you need anything later, we'd love to see you again.

Best,
[your name]`,
      tip: "Don't ask why and don't try to talk them out of it. Easy cancellations bring people back.",
    },
    {
      id: "samenvoegen",
      category: "change",
      title: "Two orders to the same address",
      subject: "Your two orders are going in one parcel",
      body: `Hi [name],

I noticed you placed two orders to the same address ([order number 1] and [order number 2]). I've combined them into one parcel, so you only need to be home once.

You'll get the shipping cost of the second order ([amount]) back.

Best,
[your name]`,
      tip: "Do this before the customer asks. It costs you nothing and people remember it.",
    },
    {
      id: "retour-aanvragen",
      category: "returns",
      title: "How do I send something back?",
      subject: "How to return [product]",
      body: `Hi [name],

Of course. Here's how:

1. Register your return here: [returns link]. You'll get the return label there too.
2. Pack the product in its original box, or another sturdy one.
3. Drop it off at a [carrier] point.

As soon as it's back with us, we'll refund [amount]. That usually takes [number] working days.

Best,
[your name]`,
      tip: "Numbered steps get read. A paragraph with the same information doesn't.",
    },
    {
      id: "ruilen-maat",
      category: "returns",
      title: "Can I get a different size?",
      subject: "Exchange to size [size]",
      body: `Hi [name],

Sure. Size [size] is in stock and I've set one aside for you, so it doesn't sell out while your return is on its way.

Send [product] in size [old size] back via [returns link]. As soon as [carrier] scans the parcel, we'll ship size [size] to you.

Best,
[your name]`,
      tip: "Setting it aside stops an exchange from turning into a refund, and a lost sale.",
    },
    {
      id: "retour-te-laat",
      category: "returns",
      title: "Return after the cooling-off period",
      subject: "About your return of [product]",
      body: `Hi [name],

Thanks for your message. You received [product] on [date], so the [number]-day return period has unfortunately passed and a standard return isn't possible any more.

What I can do: [give you store credit of [amount] if you send it back unused / help you exchange it for something else].

Is something wrong with the product itself? Let me know, because then it's covered by the warranty and that's a different story.

Best,
[your name]`,
      tip: "A defect is covered by the legal guarantee, even after the return period. Always ask.",
    },
    {
      id: "waar-blijft-geld",
      category: "returns",
      title: "Where is my refund?",
      subject: "Your refund of [amount]",
      body: `Hi [name],

I've checked. Your return arrived on [date] and we refunded [amount] to your [payment method] on [refund date].

Depending on your bank, it can take another [number] working days to show. If it's not there by [date], let me know and I'll send you the payment confirmation.

Best,
[your name]`,
      tip: "In the EU you have 14 days to refund. Refunding faster is the cheapest way to prevent a bad review.",
    },
    {
      id: "retour-ontvangen",
      category: "returns",
      title: "Has my return arrived?",
      subject: "We've received your return",
      body: `Hi [name],

Yes, your return arrived on [date] and everything looks good.

Your refund of [amount] is on its way and will reach your account within [number] working days.

Thanks for ordering with us.

Best,
[your name]`,
      tip: "Send this one yourself as soon as a return arrives, and the question never comes.",
    },
    {
      id: "schade-bezorging",
      category: "damaged",
      title: "It arrived broken",
      subject: "Sorry, a new [product] is on its way",
      body: `Hi [name],

What a shame that [product] arrived damaged. Thanks for the photo, that tells me enough.

I'm sending a replacement today and you don't need to return the broken one. Tracking follows as soon as it's on its way.

Best,
[your name]`,
      tip: "Ask for one photo, not a form. For cheap products, a return costs more than the item.",
    },
    {
      id: "kapot-na-maanden",
      category: "damaged",
      title: "Broken after three months",
      subject: "Your [product] stopped working, here's what we'll do",
      body: `Hi [name],

Sorry to hear [product] stopped working after three months. That shouldn't happen.

Could you send a photo or short video of what's going on? Then I can decide whether we repair it or send you a new one straight away.

You don't need to do anything else. The costs are on us.

Best,
[your name]`,
      tip: "In the EU, a fault in the first year is presumed to have been there at delivery. Arguing costs more than replacing.",
    },
    {
      id: "verkeerd-artikel",
      category: "damaged",
      title: "I received the wrong item",
      subject: "Our mistake, the right item is on its way",
      body: `Hi [name],

That's our mistake, sorry. The right product, [product], ships to you today.

You can send the wrong item back with this free return label: [return label]. No rush, the new parcel doesn't wait for it.

Best,
[your name]`,
      tip: "Ship the right product first, then handle the return. The other way round, the customer waits for your mistake.",
    },
    {
      id: "onderdeel-kwijt",
      category: "damaged",
      title: "I'm missing a screw or cable",
      subject: "The part is on its way",
      body: `Hi [name],

Easy to fix. I'm sending [part] today in a letterbox parcel, so you don't need to stay home. There's no charge.

You'll probably have it on [day].

Best,
[your name]`,
      tip: "Keep a box of spare parts next to the packing table. This question comes more often than you'd think.",
    },
    {
      id: "handleiding-kwijt",
      category: "damaged",
      title: "I've lost the manual",
      subject: "The manual for [product]",
      body: `Hi [name],

No problem, here's the manual for [product] as a PDF: [link]

[The tip people need most, for example: Can't pair it? Hold the button on the side for 5 seconds.]

If you get stuck, just email me.

Best,
[your name]`,
      tip: "Put the manual on the product page too, and you'll never get this question again.",
    },
    {
      id: "factuur-nodig",
      category: "invoice",
      title: "Can I have an invoice?",
      subject: "Your invoice for [order number]",
      body: `Hi [name],

Of course. Your invoice for order [order number] is attached as a PDF.

Need it with different details, for example your company name? Send me the name and address and I'll make a new one.

Best,
[your name]`,
      tip: "Attach the invoice to the shipping confirmation by default. That's one question a week gone.",
    },
    {
      id: "btw-nummer",
      category: "invoice",
      title: "My VAT number is missing from the invoice",
      subject: "Updated invoice with your VAT number",
      body: `Hi [name],

Thanks for your message. Attached is the updated invoice with your company name [company name] and VAT number [VAT number].

This replaces the previous invoice.

Best,
[your name]`,
      tip: "Add a VAT number field to your checkout. Business customers reorder more often when they don't have to ask.",
    },
    {
      id: "dubbel-besteld",
      category: "invoice",
      title: "I accidentally ordered twice",
      subject: "Your duplicate order has been cancelled",
      body: `Hi [name],

I spotted that too. I've cancelled order [order number] and [order number] goes ahead as normal.

You'll get the [amount] for the duplicate order back within [number] working days.

Best,
[your name]`,
      tip: "Say which order number stays, or the customer won't know which email to keep.",
    },
    {
      id: "korting-gemist",
      category: "invoice",
      title: "I forgot to enter my discount code",
      subject: "Your discount has been applied after all",
      body: `Hi [name],

That would be a shame, so I've fixed it. The [discount code] discount comes to [amount], and we're refunding that today.

You'll see it in your account within [number] working days.

Best,
[your name]`,
      tip: "A small refund keeps a customer. One who feels short-changed costs you far more.",
    },
    {
      id: "betaling-mislukt",
      category: "invoice",
      title: "My payment failed",
      subject: "Your order is still waiting for you",
      body: `Hi [name],

I can see the payment for your order didn't go through. Nothing has been charged.

Your products are still reserved. You can pay again here, with the same or a different payment method: [payment link]

If it fails again, let me know and we'll find a solution together.

Best,
[your name]`,
      tip: "Start with 'nothing has been charged'. That's what the customer is worried about.",
    },
    {
      id: "wanneer-weer-op-voorraad",
      category: "product",
      title: "When will it be back in stock?",
      subject: "[product] is back from [date]",
      body: `Hi [name],

Good news: we expect [product] in [size/colour] back around [date].

I've put you on the list. As soon as it's in, I'll email you a link to order, before it's back on the site.

Best,
[your name]`,
      tip: "Track how often this question comes per product. It's demand you never see in your sales figures.",
    },
    {
      id: "maatadvies",
      category: "product",
      title: "Which size should I get?",
      subject: "Size advice for [product]",
      body: `Hi [name],

Good question. [Product] runs [true to size / small / large]. If you normally wear size [size], we recommend size [size].

Between two sizes? Most customers go for the [larger / smaller] one. And if it doesn't fit, exchanges are free.

Best,
[your name]`,
      tip: "One sentence on fit, on the product page, prevents both the question and the return.",
    },
    {
      id: "productvraag",
      category: "product",
      title: "Is this suitable for [situation]?",
      subject: "About [product] and [situation]",
      body: `Hi [name],

Good question. [Product] is [/ isn't] suitable for [situation], because [reason in one sentence].

[If it isn't:] For [situation] I'd recommend [other product]: [link]

Hope that helps. Feel free to ask if you're still unsure.

Best,
[your name]`,
      tip: "An honest 'no, but this one is' sells better than a vague 'that should work'.",
    },
    {
      id: "preorder-levertijd",
      category: "product",
      title: "When will my pre-order ship?",
      subject: "Update on your pre-order [order number]",
      body: `Hi [name],

Thanks for your patience. New stock of [product] is expected on [date]. Your order ships within [number] working days after that.

If it takes longer, you'll hear it from me first. And if you'd rather not wait, I'll cancel it and refund you straight away.

Best,
[your name]`,
      tip: "Offer the cancellation yourself. People wait more patiently when they know they can leave.",
    },
    {
      id: "boze-klant",
      category: "product",
      title: "An angry customer",
      subject: "You're right, we should have done better",
      body: `Hi [name],

You're right, and I'm sorry. [What went wrong, in one sentence, with no excuses] isn't how we want to do things.

Here's what I've already done: [concrete fix, for example: sent a replacement by express].
And to make up for it: [small extra, for example: your shipping costs back / 10 in store credit].

You don't need to do anything else. I'll keep an eye on it until it's with you.

Best,
[your name]`,
      tip: "Saying sorry doesn't fix anything yet. Start by agreeing, then say what you've already done.",
    },
  ],
};

export const REPLY_BANK: Record<"nl" | "en", ReplyBank> = { nl: NL, en: EN };

/** Deze drie staan open op de pagina (en dus in Google); de rest komt na de e-mailgate. */
export const REPLY_PREVIEW_IDS = ["waar-is-mijn-pakket", "kapot-na-maanden", "boze-klant"] as const;
