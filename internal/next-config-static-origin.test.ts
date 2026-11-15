import { expect, it } from "bun:test";
import config from "./next.config";

// The static origin is read while the build runs, so what this file can see is
// the build every test run makes: with no `EPISTLE_PANEL_STATIC_ORIGIN` in the
// environment, Next gets no asset prefix and no compiled-in origin, and the
// files stay on the panel's own origin. What a set value turns on is tested
// where it is built (`src/lib/config/static-origin`).
it("leaves Next's asset prefix and env alone without a static origin", () => {
	expect(process.env["EPISTLE_PANEL_STATIC_ORIGIN"]).toBeUndefined();
	expect(config).not.toHaveProperty("assetPrefix");
	expect(config).not.toHaveProperty("env");
});
