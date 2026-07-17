import { expect, mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as matchers from "@testing-library/jest-dom/matchers";

// Provide `document`/`window` for component tests, then extend `expect` with
// the jest-dom matchers (toBeInTheDocument, toHaveTextContent, …).
GlobalRegistrator.register();
expect.extend(matchers);

// `server-only` throws when imported outside a React Server Component; under
// `bun test` there is no RSC runtime, so neutralize it for the API client.
mock.module("server-only", () => ({}));

// Server actions imported by client components (e.g. the nav's logout form)
// pull in `next/navigation` and `next/headers`; those server modules do not
// resolve under `bun test`, so stub the pieces the actions reference.
mock.module("next/navigation", () => ({
	redirect: () => {
		throw new Error("NEXT_REDIRECT");
	},
	usePathname: () => "/",
}));
mock.module("next/headers", () => ({
	cookies: async () => ({
		get: () => undefined,
		set: () => {},
		delete: () => {},
	}),
}));

// The API client reads these at call time; tests stub `fetch`, so the values
// only need to be present and well-formed.
process.env.EPISTLE_API_URL ??= "http://127.0.0.1:8025";
process.env.EPISTLE_API_TOKEN ??= "test-token";
process.env.EPISTLE_PANEL_SESSION_SECRET ??=
	"test-session-secret-at-least-32-bytes-long";
