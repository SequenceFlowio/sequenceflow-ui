export function ProductPreview() {
  return (
    <div className="mk-product-preview" aria-label="Voorbeeld van de SequenceFlow inbox">
      <div className="mk-preview-sidebar">
        <span className="mk-preview-mark">S</span>
        <span className="is-active" />
        <span />
        <span />
        <span />
      </div>
      <div className="mk-preview-list">
        <div className="mk-preview-list-head"><b>Inbox</b><span>3 open</span></div>
        <div className="mk-preview-ticket is-active"><i className="mk-dot mk-dot--blue" /><div><b>Bestelling nog niet ontvangen</b><small>Bestelstatus · 94%</small></div></div>
        <div className="mk-preview-ticket"><i className="mk-dot mk-dot--orange" /><div><b>Retour aanmelden</b><small>Retour · 89%</small></div></div>
        <div className="mk-preview-ticket"><i className="mk-dot mk-dot--green" /><div><b>Welke maat heb ik nodig?</b><small>Productvraag · 92%</small></div></div>
      </div>
      <div className="mk-preview-detail">
        <div className="mk-preview-top"><span>Concept klaar</span><button>Goedkeuren</button></div>
        <p className="mk-preview-label">KLANTVRAAG</p>
        <h3>Bestelling #4521 nog niet ontvangen</h3>
        <p>Hoi, mijn pakket zou gisteren bezorgd worden maar ik heb nog niets ontvangen. Kunnen jullie dit controleren?</p>
        <div className="mk-preview-draft">
          <div><span>AI-CONCEPT</span><strong>94% vertrouwen</strong></div>
          <p>Beste Jan, bedankt voor je bericht. Ik begrijp dat je wilt weten waar bestelling #4521 blijft. Je pakket is onderweg en wordt volgens de laatste tracking vandaag bezorgd...</p>
        </div>
      </div>
    </div>
  );
}
