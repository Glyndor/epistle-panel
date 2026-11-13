import { expect, mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { TEST_ADMIN_ID } from "../../lib/config/test-support/admin-id";
import { installNextIntlMocks, registerStandIn } from "../next-intl";
import { headersStandIn, navigationStandIn } from "../next-navigation";
import { installShortNodePrint } from "../short-node-print";

// Provide `document`/`window` for component tests, then extend `expect` with
// the jest-dom matchers (toBeInTheDocument, toHaveTextContent, …). The matchers
// are imported after the registration on purpose: jest-dom 7 loads
// @testing-library/dom on import, which binds `screen` to the `document` that
// exists at that moment.
GlobalRegistrator.register();
// A failed assertion on a node must say so in a line, not in megabytes: see
// `short-node-print` for what that cost before.
installShortNodePrint();
// The namespace also carries a `default` export that is not a matcher.
const { default: _default, ...matchers } = await import(
	"@testing-library/jest-dom/matchers"
);
expect.extend(matchers);

// `server-only` throws when imported outside a React Server Component; under
// `bun test` there is no RSC runtime, so neutralize it for the API client.
mock.module("server-only", () => ({}));

// One shared stand-in for next-intl, with every export the panel imports:
// differing per-file mocks of it made the suite depend on file order. It also
// wraps `mock.module`, which is what protects the modules registered below.
installNextIntlMocks();

// Server actions imported by client components (e.g. the nav's logout form)
// pull in `next/navigation` and `next/headers`; those server modules do not
// resolve under `bun test`. Registered, not just mocked: a file that mocks one
// of them with a few exports keeps the rest, so the order of files cannot
// take a name away.
registerStandIn("next/navigation", navigationStandIn);
registerStandIn("next/headers", headersStandIn);

// The API client reads these at call time; tests stub `fetch`, so the values
// only need to be present and well-formed.
process.env["EPISTLE_API_URL"] ??= "http://127.0.0.1:8025";
process.env["EPISTLE_API_TOKEN"] ??= "test-token";
process.env["EPISTLE_PANEL_SESSION_SECRET"] ??=
	"test-session-secret-at-least-32-bytes-long";
process.env["EPISTLE_PANEL_ADMIN_ID"] ??= TEST_ADMIN_ID;
