import { expect } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as matchers from "@testing-library/jest-dom/matchers";

// Provide `document`/`window` for component tests, then extend `expect` with
// the jest-dom matchers (toBeInTheDocument, toHaveTextContent, …).
GlobalRegistrator.register();
expect.extend(matchers);
