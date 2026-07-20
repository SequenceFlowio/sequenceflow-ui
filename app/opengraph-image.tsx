import { ImageResponse } from "next/og";

export const alt = "SequenceFlow: elke klantmail goed afgehandeld";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f7f7f2",
          color: "#111711",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "68px 76px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 650 }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 32, fontWeight: 800, gap: 16 }}>
            <div style={{ alignItems: "center", background: "#c7f56f", borderRadius: 18, display: "flex", height: 58, justifyContent: "center", width: 58 }}>S</div>
            SequenceFlow
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 70, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, marginTop: 78 }}>
            <span>Elke klantmail.</span>
            <span>Goed afgehandeld.</span>
          </div>
          <div style={{ color: "#667064", fontSize: 28, lineHeight: 1.35, marginTop: 30 }}>
            AI-klantenservice vanuit je eigen beleid, met menselijke controle.
          </div>
        </div>
        <div style={{ background: "#111711", borderRadius: 34, display: "flex", flexDirection: "column", height: 470, padding: 34, width: 360 }}>
          <div style={{ color: "#8d978d", fontSize: 18, fontWeight: 700 }}>INKOMENDE MAIL</div>
          <div style={{ color: "white", fontSize: 30, fontWeight: 700, lineHeight: 1.2, marginTop: 22 }}>Bestelling nog niet ontvangen</div>
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <div style={{ background: "#243349", borderRadius: 10, color: "#60a5fa", display: "flex", fontSize: 18, padding: "9px 12px" }}>bestelstatus</div>
            <div style={{ background: "#26351e", borderRadius: 10, color: "#c7f56f", display: "flex", fontSize: 18, padding: "9px 12px" }}>94%</div>
          </div>
          <div style={{ borderTop: "1px solid #394139", color: "#e7eae5", display: "flex", flexDirection: "column", fontSize: 22, lineHeight: 1.4, marginTop: 30, paddingTop: 28 }}>
            <span style={{ color: "#8d978d", fontSize: 17, fontWeight: 700 }}>AI-CONCEPT</span>
            <span style={{ marginTop: 14 }}>Bedankt voor je bericht. Je pakket is onderweg...</span>
          </div>
          <div style={{ background: "#c7f56f", borderRadius: 13, color: "#111711", display: "flex", fontSize: 18, fontWeight: 800, justifyContent: "center", marginTop: 28, padding: 13 }}>CONCEPT KLAAR</div>
        </div>
      </div>
    ),
    size
  );
}
