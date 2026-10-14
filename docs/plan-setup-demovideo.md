# Plan: korte demovideo's bij het koppelen (fase 2)

Status: visie, nog niet gebouwd. Fase 1 (een nieuwe klant via een tweede testwinkel) is op 14 okt 2026 afgerond.

## Waarom

Het koppelen van de mailbox is de enige stap waar een nieuwe klant de app uit moet:

- inloggen bij Google,
- doorsturen instellen in Gmail,
- soms een app-wachtwoord maken.

Daar haakt een klant af of mailt hij ons. Een korte video op precies die plek laat zien wat er gaat gebeuren. De klant herkent de schermen dan, en weet dat de waarschuwing van Google of de bevestigingsmail van Gmail normaal is.

## Wat de klant ziet

- **Op de Mailbox-pagina** staat bij elke route een knop "Bekijk hoe het werkt (45 s)". De knop opent een venster met de video.
- **Op het welkomstscherm in Shopify** staat dezelfde knop bij stap 1, "Koppel je supportmailbox".
- **In de web-app** (support.sequenceflow.io) staat dezelfde video's op de Mailbox-pagina. Eén set video's dient dus beide ingangen.
- De video speelt pas af als de klant erop klikt. Hij laadt niet mee met de pagina.

## Welke video's

Eén video per koppelroute, met de meest gebruikte eerst:

| Video | Inhoud | Lengte |
|---|---|---|
| 1. Gmail (aanbevolen) | Inloggen met Google, doorsturen aanzetten in Gmail, "Doorsturen actief" in de app, testmail | 45–60 s |
| 2. Outlook / Microsoft 365 | Doorsturen instellen in Outlook, versturen via app-wachtwoord | 45–60 s |
| 3. Andere mailbox (IMAP/SMTP) | Gegevens van de provider invullen, testen, eerste concept | 45 s |

Later kunnen er video's bij voor "kennis toevoegen" en "een concept goedkeuren". Die stappen zijn in de app zelf al duidelijk, dus ze hebben minder haast.

## Vorm

- **Geen stem, wel ondertitels in beeld** (NL en EN). Dat werkt zonder geluid, en we hoeven niet in te spreken bij elke wijziging.
- **Schermopname van de echte app**, met de testwinkel "SequenceFlow Nieuwe Klant" en een testmailbox. Nooit klantgegevens. Mailadressen die niet van ons zijn maken we onleesbaar.
- **Kort:** bij voorkeur onder de minuut. Klikken worden uitgelicht, wachttijden knippen we weg.
- **Bestanden:** MP4 (H.264) met een stilstaand beginbeeld. We streven naar minder dan 4 MB per video.

## Waar de bestanden staan

Voorstel: in Vercel Blob (publiek), met een vaste URL per video en taal. De app verwijst ernaar met een gewone `<video>`-tag.

- Dit laadt snel binnen de Shopify-iframe.
- Het kan zonder YouTube-embed, dus zonder tracking-cookies en zonder gedoe met de inhoudsbeleid-regels (CSP).
- Video 1 kan ook als promovideo op de App Store-pagina van Shopify. Die vraagt wel een YouTube-link; daarvoor gebruiken we een niet-openbare upload.

## Hoe we opnemen

1. Een vast script per video: welke schermen, welke klikken, welke ondertitel.
2. Claude neemt de browserstappen op met de Chrome-opname. ffmpeg (staat op deze Mac) maakt er een MP4 van met ondertitels in beeld. Zo is de verificatievideo voor Google ook gemaakt.
3. Navaron kijkt elke video na voordat hij online gaat.
4. Verandert het koppelscherm, dan nemen we de video opnieuw op. Het script staat in deze map, dus dat kost weinig tijd.

## Wat moet er eerst gebeuren

- **Video 1 pas na de goedkeuring van Google** opnemen. Tot die tijd toont Google een waarschuwingsscherm ("Google hasn't verified this app"), en dat willen we niet vastleggen.
- Op dat moment moet ook de Google-vergrendeling eraf: `GOOGLE_SEND_TENANT_IDS` leeg maken.
- Video 2 en 3 kunnen meteen.

## Stappen

1. De drie scripts schrijven (NL en EN ondertitels) en laten goedkeuren.
2. Een videoknop met afspeelvenster bouwen in de Mailbox-pagina en het welkomstscherm (Shopify en web).
3. Video's 2 en 3 opnemen en plaatsen.
4. Na goedkeuring door Google: video 1 opnemen en plaatsen, en dezelfde video als App Store-promovideo gebruiken.

## Meten

We tellen per route hoeveel klanten de video afspelen en hoeveel daarna binnen een dag een werkende mailbox hebben. Zakt dat laatste, dan klopt de video niet meer met de app.
