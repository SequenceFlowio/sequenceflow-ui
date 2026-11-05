import { SequenceMark } from "@/components/marketing/SequenceMark";
export const metadata = { title: "Mascotstudies — SequenceFlow", robots: { index: false, follow: false } };
export default function MascotStudies() {
  return <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: "40px 24px" }}>
    <h1>Mascotstudies</h1><p>Dezelfde tekst, drie silhouetten. Flow is de huidige voorkeur.</p>
    {(["flow", "tile", "drop"] as const).map((shape) => <section key={shape} style={{ padding: "40px 0", borderBottom: "1px solid #272b24" }}><h2>{shape === "flow" ? "A · Flow" : shape === "tile" ? "B · Tegel" : "C · Druppel"}</h2><p style={{ fontSize: "clamp(28px, 5vw, 60px)", lineHeight: 1.3 }}>Jouw webshop groeit.<br /><span style={{ color: "#c7f56f" }}>Jij krijgt <SequenceMark size={56} gear="none" shape={shape} state="observing" title={shape} /> weer ruimte.</span></p><SequenceMark size={28} gear="none" shape={shape} state="observing" title="Kleine weergave" /></section>)}
  </main>;
}
