# Support One: Shopify eerst, WooCommerce daarna

De eerste pilotklant verkoopt via Shopify; er is ook een WooCommerce-kandidaat. Daarom volgt de volgorde de beschikbare klanten in plaats van de technische eenvoud van een WooCommerce API-sleutel.

## Wat vandaag werkt

- Een gekoppelde supportmailbox levert de klantvragen, ongeacht het verkoopplatform. Bedrijfskennis helpt bij het antwoord; een medewerker beoordeelt het concept.
- De bol-koppeling kan daarnaast bestelcontext ophalen. Shopify en WooCommerce zijn in `lib/commerce/providers.ts` uitgezet en hun actieve aansluitroutes blokkeren mutaties. De bestaande adapters zijn dus nog geen werkende productintegratie.
- Het systeem kiest momenteel één actieve commerce-verbinding per tenant, met voorkeur voor bol. Een winkel met zowel bol als Shopify heeft nog providerselectie per vraag nodig.

## Shopify-pilot: oplevercriteria

1. **Leesrechten afbakenen.** Maak het pad voor bestelcontext read-only. De huidige Shopify-scopecontrole en installatiegids vereisen `write_orders` omdat de adapter ook annuleringscode bevat. Bestelvragen hebben die schrijfrechten niet nodig. Controleer ook welke rechten eventuele webhookregistratie vraagt; laat die functie desnoods buiten de eerste pilot.
2. **Aansluitroute kiezen.** Valideer de bestaande merchant-eigen app met client credentials bij deze ene winkel. Bouw voor algemene uitrol een Shopify-installatie met goedkeuring door de merchant; een client-credentialsgrant werkt alleen voor winkels in de organisatie die de app bezit. Vraag toegang tot beschermde klantgegevens alleen wanneer de ordermatching die echt nodig heeft.
3. **Afschermen per pilottenant.** Maak de koppeling alleen zichtbaar en bruikbaar voor de geselecteerde tenant, zonder de pauze voor andere klanten op te heffen. Houd annuleringen, retouracties en terugbetalingen uit.
4. **Echte keten testen.** Controleer installatie, tokenvernieuwing, orderlookup op bestelnummer en afzender, ontbrekende/onduidelijke matches, verzendstatus, conceptkwaliteit en menselijke goedkeuring. Test met toestemming van de pilotklant en leg geen API-geheimen in de repository vast.
5. **Onboarding tonen.** Maak ‘Mailbox verbonden’ en ‘Bestelgegevens verbonden’ afzonderlijk zichtbaar. Laat tijdens de installatie een voorbeeldorder opzoeken en toon een duidelijke fout als een recht of match ontbreekt.

Pas na deze controles kan publieke copy de Shopify-orderkoppeling als beschikbaar beschrijven. Tot die tijd: ‘Shopify-pilot’, niet ‘Shopify geïntegreerd’. WooCommerce volgt met dezelfde leesrechten- en praktijkcontrole bij de tweede kandidaat.
