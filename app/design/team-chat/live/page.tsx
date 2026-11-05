import { LiveHarness } from "./LiveHarness";

export const metadata = { title: "Team-chat — testbank", robots: { index: false, follow: false } };

/** De echte team-chat met nagebootste serverantwoorden, zonder login te testen. */
export default function TeamChatLive() {
  return <LiveHarness />;
}
