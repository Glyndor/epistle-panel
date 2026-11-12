import { describe, expect, it } from "bun:test";

import { runCases } from "@/test/prng";

import type { ConfigError } from "../config-error";
import { outcome } from "../test-support/api-url-outcome";
import { refusedHost, v4Form, wrap } from "../test-support/host-notations";
import { DEFAULT_API_URL, parseApiUrl } from ".";

const LINK_LOCAL = "must not point at a link-local or metadata address";

describe("parseApiUrl on generated hosts", () => {
	it("refuses link-local, unspecified and metadata addresses in every notation", async () => {
		await runCases("refused hosts", 4000, (rng) => {
			const raw = wrap(refusedHost(rng), rng);
			const result = outcome(raw);
			// The fixture is a clean bare origin, so the refusal must be this one.
			expect(result).toHaveProperty("error");
			expect((result as { error: ConfigError }).error.message).toContain(
				LINK_LOCAL,
			);
		});
	});

	it("never accepts a refused address however the rest of the URL is dressed", async () => {
		await runCases("dressed refused hosts", 2500, (rng) => {
			let host = refusedHost(rng);
			if (rng.chance(0.4) && !host.startsWith("[")) {
				// Percent-encode a few characters: a URL decodes them in the host.
				host = Array.from(host, (c) =>
					rng.chance(0.3)
						? `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`
						: c,
				).join("");
			}
			const userinfo = rng.pick(["", "", "u@", "u:p@", "@", ":@"]);
			const port = rng.chance(0.5) ? `:${rng.int(0, 70000)}` : "";
			const tail = rng.pick([
				"",
				"/",
				"/x",
				"?q=1",
				"#f",
				"/?",
				"/#",
				"?",
				"#",
			]);
			const scheme = rng.pick(["http", "https", "ftp", "file", ""]);
			const raw = `${scheme}${scheme === "" ? "//" : "://"}${userinfo}${host}${port}${tail}`;
			expect(outcome(raw)).toHaveProperty("error");
			expect(outcome(raw, [host, host.toLowerCase()])).toHaveProperty(
				"error",
			);
		});
	});

	it("accepts the documented default and loopback hosts in every notation", async () => {
		expect(parseApiUrl(DEFAULT_API_URL)).toBe(DEFAULT_API_URL);
		await runCases("loopback hosts", 1500, (rng) => {
			const [b, c, d] = [
				rng.int(0, 255),
				rng.int(0, 255),
				rng.int(0, 255),
			];
			const host = rng.pick([
				() => v4Form([127, b, c, d], rng),
				() => `[::ffff:127.${b}.${c}.${d}]`,
				() => "[::1]",
				() => "[0:0:0:0:0:0:0:1]",
				() =>
					rng.pick([
						"localhost",
						"LOCALHOST",
						"Localhost.",
						"localhost",
					]),
				() => `${rng.string("abcz09-", rng.int(1, 8))}.localhost`,
			])();
			const result = outcome(wrap(host, rng).replace(/^[^:]+/, "http"));
			expect(result).toHaveProperty("origin");
		});
	});

	it("keeps plain http for loopback or listed hosts and allows https elsewhere", async () => {
		await runCases("remote hosts", 800, (rng) => {
			const host = rng.chance()
				? `${rng.string("abcdefgh", rng.int(1, 10))}.example.${rng.pick(["org", "net"])}`
				: v4Form(
						[
							rng.pick([10, 11, 172, 192, 8]),
							rng.int(1, 253),
							rng.int(0, 255),
							rng.int(1, 254),
						],
						rng,
					);
			const canonical = new URL(`http://${host}`).hostname;
			expect(outcome(`https://${host}`)).toHaveProperty("origin");
			expect(outcome(`http://${host}`)).toHaveProperty("error");
			expect(outcome(`http://${host}`, [canonical])).toHaveProperty(
				"origin",
			);
			expect(
				outcome(`http://${host}`, ["other.example.org"]),
			).toHaveProperty("error");
		});
	});
});

describe("parseApiUrl on generated shapes of a good host", () => {
	it("refuses credentials, paths, queries and fragments on otherwise valid origins", async () => {
		await runCases("dressed good hosts", 1500, (rng) => {
			const host = rng.pick([
				"127.0.0.1",
				"localhost",
				"[::1]",
				"api.example.org",
			]);
			const scheme = host === "api.example.org" ? "https" : "http";
			const userinfo = rng.pick([
				"u@",
				"u:p@",
				":p@",
				"u:@",
				"%75@",
				"a:b:c@",
			]);
			const withUser = `${scheme}://${userinfo}${host}:8025`;
			const refusal = (outcome(withUser) as { error: ConfigError }).error;
			expect(refusal.message).toContain("must not embed credentials");
			expect(refusal.message).not.toContain(userinfo);
			const suffix = rng.pick([
				"/a",
				"/a/b",
				"?x",
				"#y",
				"//",
				"/.x",
				"?",
				"#",
				"/?#",
			]);
			const bare = outcome(`${scheme}://${host}:8025${suffix}`);
			if (suffix === "//") {
				// `//` is a path and so refused as well.
				expect(bare).toHaveProperty("error");
			} else {
				expect(
					(bare as { error: ConfigError }).error.message,
				).toContain("no path, query or fragment");
			}
			expect(outcome(`${scheme}://${host}:8025/`)).toHaveProperty(
				"origin",
			);
		});
	});
});
