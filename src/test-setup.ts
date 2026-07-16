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

// The API client reads these at call time; tests stub `fetch`, so the values
// only need to be present and well-formed.
process.env.EPISTLE_API_URL ??= "http://127.0.0.1:8025";
process.env.EPISTLE_API_TOKEN ??= "test-token";
