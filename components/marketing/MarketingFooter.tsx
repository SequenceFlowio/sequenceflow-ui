import Image from "next/image";
import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div>
        <Image src="/logo-white.png" alt="SequenceFlow" width={170} height={42} />
        <p>AI-klantenservice met menselijke controle.</p>
      </div>
      <div className="mk-footer-links">
        <Link href="/pricing">Prijzen</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Voorwaarden</Link>
        <a href="mailto:hallo@sequenceflow.io">Contact</a>
      </div>
      <p className="mk-footer-meta">SequenceFlow · KvK 78237750 · Nederland</p>
    </footer>
  );
}
