import Image from "next/image";

import { MEDIA_SLOTS, type MediaSlot, type MediaSlotId } from "@/lib/marketing/mediaSlots";

/**
 * Een vaste plek voor een foto. Zonder bestand tekent hij een rustige,
 * donkere plek in de huisstijl, zodat de pagina ook vóór de fotoshoot af
 * oogt; in development staat de briefing erin, zodat je ziet wat waar hoort.
 */
export function PhotoSlot({ id, className, sizes = "(max-width: 760px) 100vw, 50vw", priority = false }: {
  id: MediaSlotId;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const slot: MediaSlot = MEDIA_SLOTS[id];
  const classes = `mk-photo${slot.src ? "" : " mk-photo--empty"}${className ? ` ${className}` : ""}`;

  if (slot.src) {
    return (
      <div className={classes} style={{ aspectRatio: slot.ratio }}>
        <Image src={slot.src} alt={slot.alt} fill sizes={sizes} priority={priority} />
      </div>
    );
  }

  return (
    <div className={classes} style={{ aspectRatio: slot.ratio }} aria-hidden="true">
      {process.env.NODE_ENV === "development" && (
        <div className="mk-photo-brief"><strong>Foto · {id}</strong><span>{slot.brief}</span></div>
      )}
    </div>
  );
}
