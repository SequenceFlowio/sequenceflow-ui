import { redirect } from "next/navigation";

// proxy.ts stuurt / al door (tijdelijk naar /support-one op de website, naar
// de app of de website op support.sequenceflow.io). Dit is het vangnet.
export default function HomePage() {
  redirect("/support-one");
}
