import { SequenceMark, type MarkState } from "./SequenceMark";

// Each post gets its own expression, so the covers don't look copy-pasted.
const STATES: MarkState[] = ["reading", "thinking", "investigating", "happy", "idle"];

/** Blog cover in the landing page's look: dark surface, lime glow, outline mascot. */
export function BlogCover({ index, tag, large = false }: { index: number; tag?: string; large?: boolean }) {
  return (
    <div className={large ? "mk-blog-cover mk-blog-cover--large" : "mk-blog-cover"} aria-hidden="true">
      {tag ? <span className="so-state">{tag}</span> : null}
      <SequenceMark className="mk-blog-cover-mark" variant="outline" state={STATES[index % STATES.length]} title="" />
    </div>
  );
}
