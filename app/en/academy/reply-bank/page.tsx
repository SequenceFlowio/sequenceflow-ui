import type { Metadata } from "next";
import Link from "next/link";

import { ReplyBankView } from "@/components/marketing/ReplyBankView";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/academy/reply-bank",
  dutchPath: "/nl/academy/antwoordenbank",
  lang: "en",
  title: "The Reply Bank: 30 customer emails for your store | SequenceFlow",
  shareTitle: "Free: 30 ready-to-send customer emails for your store",
  description: "30 free replies to the questions every online store gets: where is my parcel, returns, broken products, invoices, angry customers. Copy, fill in, send.",
});

export default function ReplyBankPage() {
  return (
    <SitePage lang="en">
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span /><Link href="/en/academy">ACADEMY</Link> · BONUS: REPLY BANK</div>
        <h1>30 customer emails you can send tomorrow.</h1>
        <p>The questions every online store gets every week, with a reply that solves it in one go. Copy, fill in the <mark className="rb-mark">[brackets]</mark> and you&apos;re done. Each reply says why it works.</p>
      </header>
      <ReplyBankView lang="en" />
    </SitePage>
  );
}
