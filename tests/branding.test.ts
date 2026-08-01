import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COMPANY_NAME,
  DEFAULT_APP_ORIGIN,
  FULL_PRODUCT_NAME,
  LEGACY_APP_ORIGIN,
  PRODUCT_NAME,
  SUITE_NAME,
  requestAppOrigin,
} from "../lib/brand.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("brand hierarchy separates company, suite, and product", () => {
  assert.equal(COMPANY_NAME, "SequenceFlow");
  assert.equal(SUITE_NAME, "Commerce");
  assert.equal(PRODUCT_NAME, "Support");
  assert.equal(FULL_PRODUCT_NAME, "SequenceFlow Commerce Support");
  assert.equal(DEFAULT_APP_ORIGIN, "https://support.sequenceflow.io");
});

test("app redirects trust the new and transitional production hosts only", () => {
  assert.equal(
    requestAppOrigin(`${DEFAULT_APP_ORIGIN}/auth/callback?code=test`),
    DEFAULT_APP_ORIGIN,
  );
  assert.equal(
    requestAppOrigin(`${LEGACY_APP_ORIGIN}/auth/callback?code=test`),
    LEGACY_APP_ORIGIN,
  );
  assert.notEqual(
    requestAppOrigin("https://attacker.example/auth/callback?code=test"),
    "https://attacker.example",
  );
});

test("product chrome and legal pages use Commerce Support and the new app URL", () => {
  const sidebar = source("components/Sidebar.tsx");
  const appLayout = source("app/(app)/layout.tsx");
  const login = source("app/login/page.tsx");
  const privacy = source("app/privacy/page.tsx");
  const terms = source("app/terms/page.tsx");

  assert.match(sidebar, />Commerce Support<\/span>/);
  assert.match(appLayout, /Support \| SequenceFlow Commerce/);
  assert.match(login, /SequenceFlow Commerce Support/);
  assert.match(privacy, /DEFAULT_APP_ORIGIN/);
  assert.match(privacy, /support\.sequenceflow\.io/);
  assert.doesNotMatch(privacy, /emailreply\.sequenceflow\.io/);
  assert.match(terms, /DEFAULT_APP_ORIGIN/);
  assert.match(terms, /support\.sequenceflow\.io/);
  assert.doesNotMatch(terms, /emailreply\.sequenceflow\.io/);
});

test("auth and billing redirects use a trusted request origin", () => {
  const callback = source("app/auth/callback/route.ts");
  const checkout = source("app/api/billing/checkout/route.ts");
  const portal = source("app/api/billing/portal/route.ts");

  assert.match(callback, /requestAppOrigin\(request\.url\)/);
  assert.match(checkout, /requestAppOrigin\(req\.url\)/);
  assert.match(portal, /requestAppOrigin\(req\.url\)/);
  assert.doesNotMatch(callback, /emailreply\.sequenceflow\.io/);
  assert.doesNotMatch(checkout, /emailreply\.sequenceflow\.io/);
  assert.doesNotMatch(portal, /emailreply\.sequenceflow\.io/);
});
