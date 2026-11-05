import assert from "node:assert/strict";
import test from "node:test";

import { miloBriefing, routeQuestion, splitSuggestedReply } from "../lib/assistants/team.ts";

test("a named team member always gets the question", () => {
  assert.equal(routeQuestion("Otis, wat moet ik bijbestellen?"), "otis");
  assert.equal(routeQuestion("Seffy kun je hier naar kijken"), "seffy");
  assert.equal(routeQuestion("Hey Juno"), "juno");
  assert.equal(routeQuestion("Milo, hoe ging de week?", { current: "otis" }), "milo");
});

test("the topic decides who answers, and an order question is not stock", () => {
  assert.equal(routeQuestion("Moet ik hoodies bijbestellen?"), "otis");
  assert.equal(routeQuestion("Welke varianten zijn bijna uitverkocht?"), "otis");
  assert.equal(routeQuestion("Bedenk een Instagram post over de nieuwe collectie"), "juno");
  assert.equal(routeQuestion("Wat moet ik antwoorden op deze mail?"), "seffy");
  assert.equal(routeQuestion("Waar blijft bestelling 1043?"), "milo");
  assert.equal(routeQuestion("Waarom krijg ik zoveel vragen over retouren?"), "seffy");
  assert.equal(routeQuestion("hoe zit het met klantvragen"), "seffy");
  assert.equal(routeQuestion("Wat staat er in mijn inbox?"), "seffy");
  assert.equal(routeQuestion("Hoe ging deze week?"), "milo");
});

test("a shared customer question goes to Seffy, unless it is clearly about stock", () => {
  assert.equal(routeQuestion("Wat vind je ervan?", { mailAttached: true }), "seffy");
  assert.equal(routeQuestion("Is maat M nog op voorraad?", { mailAttached: true }), "otis");
  assert.equal(routeQuestion("Hoe ging de rest van de week eigenlijk?", { mailAttached: true, current: "seffy" }), "milo");
});

test("a follow-up stays with whoever is already in the chat", () => {
  assert.equal(routeQuestion("Ja, zet hem klaar", { current: "otis" }), "otis");
  assert.equal(routeQuestion("Ja, zet hem klaar"), "milo");
  assert.equal(routeQuestion("Waarom die hoeveelheid?", { current: "otis" }), "otis");
  assert.equal(routeQuestion("Hoe ging de rest van de week eigenlijk?", { current: "seffy" }), "milo");
});

test("Milo's opening line says what waits and what burns, or that it is quiet", () => {
  assert.equal(miloBriefing({ language: "nl", hour: 9, review: 3, escalated: 0, stockAlerts: 2 }), "Goedemorgen! 3 klantvragen wachten op je akkoord en Otis heeft 2 voorraadmeldingen. Waar wil je beginnen?");
  assert.equal(miloBriefing({ language: "nl", hour: 14, review: 1, escalated: 1, stockAlerts: 0 }), "Goedemiddag! 1 klantvraag wacht op je akkoord en 1 vraag heeft jou echt nodig. Waar wil je beginnen?");
  assert.equal(miloBriefing({ language: "nl", hour: 20, review: 0, escalated: 0, stockAlerts: 0 }), "Goedenavond! Rustig vandaag: er wacht niks op je en er brandt niks.");
  assert.match(miloBriefing({ language: "en", hour: 8, review: null, escalated: null, stockAlerts: null }), /^Good morning! I'm Milo\./);
});

test("the suggested reply is taken out of the answer, also while it streams in", () => {
  assert.deepEqual(splitSuggestedReply("Wil je dat Otis een concept klaarzet?\n>> Ja, zet hem klaar"), { content: "Wil je dat Otis een concept klaarzet?", suggestion: "Ja, zet hem klaar" });
  assert.deepEqual(splitSuggestedReply("Wil je dat?\n>"), { content: "Wil je dat?", suggestion: null });
  assert.deepEqual(splitSuggestedReply("Klaar.\n\n"), { content: "Klaar.", suggestion: null });
  assert.deepEqual(splitSuggestedReply("> citaat\nGewoon antwoord."), { content: "> citaat\nGewoon antwoord.", suggestion: null });
});
