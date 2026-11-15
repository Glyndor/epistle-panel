import { expect, it } from "bun:test";
import config from "../../../next.config";

// Audit 10: these are independent buffering boundaries, with different owners.
it("keeps Server Actions at 16kb and the proxy buffer at 2mb", () => {
	expect(config.experimental?.serverActions).toEqual({
		bodySizeLimit: "16kb",
	});
	expect(config.experimental?.proxyClientMaxBodySize).toBe("2mb");
});
