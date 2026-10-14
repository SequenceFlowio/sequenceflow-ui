import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

type Cron = { path: string; schedule: string };

const crons = (JSON.parse(source("vercel.json")) as { crons: Cron[] }).crons;

// Every cron run is a billed Vercel function start, around the clock, whether
// or not there is work. Workers that only check a queue share one tick.
test("only mailbox sync and the worker tick run every minute", () => {
  const everyMinute = crons.filter((cron) => cron.schedule === "* * * * *").map((cron) => cron.path).sort();
  assert.deepEqual(everyMinute, ["/api/cron/process-emails", "/api/cron/tick"]);
});

test("the tick runs every queue worker that has no cron of its own", () => {
  const tick = source("app/api/cron/tick/route.ts");
  const scheduled = new Set(crons.map((cron) => cron.path));
  for (const worker of [
    "/api/knowledge/worker",
    "/api/cron/mining-worker",
    "/api/cron/commerce-action-worker",
    "/api/cron/commerce-event-worker",
    "/api/cron/shopify-webhooks",
  ]) {
    assert.ok(!scheduled.has(worker), `${worker} has its own cron and runs in the tick: double work`);
    assert.match(tick, new RegExp(`path: "${worker}"`), `${worker} is missing from the tick`);
  }
});

test("every scheduled path has a route", () => {
  for (const cron of crons) {
    assert.doesNotThrow(() => source(`app${cron.path}/route.ts`), `${cron.path} has no route`);
  }
});
