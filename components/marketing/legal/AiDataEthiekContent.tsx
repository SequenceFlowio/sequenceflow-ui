// Overgenomen van de oude sequenceflow.io (tekst ongewijzigd); opmaak komt uit marketing.css (.mk-legal).
export function AiDataEthiekContent() {
  return (
    <section>
      <div>
        <div>
          <h1>AI &amp; Data Ethiek</h1>
          <div>
            <p>
              SequenceFlow maakt gebruik van AI-technologie om autonome workflows te bouwen en te beheren. Wij geloven
              dat AI een krachtig middel is — maar alleen als het verantwoord, transparant en eerlijk wordt ingezet. Op
              deze pagina leggen wij uit hoe wij omgaan met AI-modellen en klantdata.
            </p>
            <p>Laatste update: februari 2026</p>
          </div>
        </div>
        <article>
          <div>
            <h2>1. Onze principes</h2>
            <p>SequenceFlow hanteert de volgende kernprincipes bij de inzet van AI:</p>
            <ul>
              <li>
                <strong>Transparantie:</strong> wij zijn open over welke AI-modellen wij inzetten en hoe zij worden
                gebruikt.
              </li>
              <li>
                <strong>Dataminimalisatie:</strong> wij verwerken alleen de data die strikt noodzakelijk is voor de
                werking van de flows.
              </li>
              <li>
                <strong>Menselijk toezicht:</strong> AI-beslissingen in kritische processen worden altijd beoordeeld
                door of gerapporteerd aan een mens (Human-on-the-loop).
              </li>
              <li>
                <strong>AVG-conformiteit:</strong> alle AI-verwerking vindt plaats binnen de grenzen van de Europese
                privacywetgeving.
              </li>
            </ul>
          </div>
          <div>
            <h2>2. Welke AI-modellen gebruiken wij?</h2>
            <p>
              SequenceFlow maakt gebruik van large language models (LLMs) van gerenommeerde aanbieders voor taken zoals
              tekstverwerking, classificatie, samenvatting en het opstellen van communicatie. De modellen worden ingezet
              als onderdeel van de flows die wij voor klanten bouwen.
            </p>
            <p>
              Wij maken een bewuste keuze voor aanbieders die de Europese privacywetgeving respecteren en contractuele
              garanties bieden over datagebruik. Wij evalueren onze modelkeuzes periodiek op basis van
              veiligheidsupdates en privacybeleid.
            </p>
          </div>
          <div>
            <h2>3. Geen gebruik van klantdata voor modeltraining</h2>
            <p>
              <strong>
                SequenceFlow gebruikt uw bedrijfsdata en de data van uw klanten nooit voor de training van AI-modellen.
              </strong>{" "}
              Data die door de flows wordt verwerkt, wordt uitsluitend gebruikt voor de uitvoering van de specifieke
              flow-taak en wordt niet opgeslagen voor trainings- of analysedoeleinden buiten de flow.
            </p>
            <p>
              Wij kiezen bewust voor API-gebaseerde integraties met AI-aanbieders die contractueel garanderen dat
              API-input niet wordt gebruikt voor modelverbetering. Dit is een expliciete vereiste in onze
              leverancierselectie.
            </p>
          </div>
          <div>
            <h2>4. Data-isolatie per klant</h2>
            <p>
              Elke klantomgeving is logisch geïsoleerd. Data van klant A wordt nooit vermengd met data van klant B.
              Flows worden gebouwd in afgescheiden omgevingen en toegang is beperkt tot medewerkers van SequenceFlow die
              rechtstreeks betrokken zijn bij die klant.
            </p>
          </div>
          <div>
            <h2>5. Menselijk toezicht (Human-on-the-loop)</h2>
            <p>
              SequenceFlow gelooft in AI als assistent, niet als vervanger van menselijk oordeel voor kritische
              beslissingen. In alle flows waar AI een beslissing neemt die aanzienlijke gevolgen kan hebben, wordt een
              menselijke controlemomenten ingebouwd of worden uitzonderingen geflagd voor handmatige beoordeling.
            </p>
            <p>
              Dit principe heet &quot;Human-on-the-loop&quot;: de AI verwerkt het volume, een mens beoordeelt de
              uitzonderingen en bewaakt de output op kwaliteit.
            </p>
          </div>
          <div>
            <h2>6. Logging en auditbaarheid</h2>
            <p>
              Alle acties die door flows worden uitgevoerd, worden gelogd. Klanten hebben op verzoek inzage in de
              logboeken van hun flows. Dit maakt het mogelijk om AI-beslissingen te auditen en na te gaan hoe een
              bepaalde uitkomst tot stand is gekomen.
            </p>
          </div>
          <div>
            <h2>7. Eerlijkheid en niet-discriminatie</h2>
            <p>
              Wij bouwen flows zo dat zij geen ongerechtvaardigd onderscheid maken op basis van persoonskenmerken zoals
              geslacht, leeftijd, afkomst of religie. Bij het ontwerpen van AI-gestuurde beslissingslogica controleren
              wij op mogelijke bias en passen wij de configuratie aan waar nodig.
            </p>
          </div>
          <div>
            <h2>8. Contact</h2>
            <p>
              Heeft u vragen over ons AI-gebruik of wilt u weten welke modellen worden ingezet in uw specifieke flow?
              Neem dan contact op via <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
