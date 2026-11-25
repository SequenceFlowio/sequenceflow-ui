import Link from "next/link";

/** Bovenaan elke Engelse juridische pagina: de Nederlandse tekst is leidend. */
export function TranslationNote({ dutchHref }: { dutchHref: string }) {
  return (
    <p>
      <em>
        This is an English translation for your convenience. In case of any difference, the{" "}
        <Link href={dutchHref}>Dutch version</Link> prevails.
      </em>
    </p>
  );
}
