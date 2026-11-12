import { afterEach, describe, expect, it } from "bun:test";

import { apiBaseUrl, DEFAULT_API_URL, parseApiUrl } from ".";

describe("parseApiUrl accepted", () => {
	const accepted: [string, string][] = [
		[DEFAULT_API_URL, "http://127.0.0.1:8025"],
		["http://127.0.0.1:8025/", "http://127.0.0.1:8025"],
		["http://127.5.6.7:9", "http://127.5.6.7:9"],
		["http://localhost:8025", "http://localhost:8025"],
		["http://panel.localhost:8025", "http://panel.localhost:8025"],
		["http://[::1]:8025", "http://[::1]:8025"],
		["http://[::ffff:127.0.0.1]:8025", "http://[::ffff:7f00:1]:8025"],
		["https://api.example.org", "https://api.example.org"],
		["https://api.example.org:8443/", "https://api.example.org:8443"],
		["https://10.8.0.1:8025", "https://10.8.0.1:8025"],
		["HTTPS://API.Example.ORG", "https://api.example.org"],
	];
	for (const [raw, origin] of accepted) {
		it(`accepts ${raw}`, () => {
			expect(parseApiUrl(raw)).toBe(origin);
		});
	}

	it("accepts plain http to a host named in the allow list", () => {
		expect(parseApiUrl("http://node2.wg:8025", ["node2.wg"])).toBe(
			"http://node2.wg:8025",
		);
		expect(parseApiUrl("http://10.8.0.2:8025", ["10.8.0.2"])).toBe(
			"http://10.8.0.2:8025",
		);
	});
});

describe("parseApiUrl refused", () => {
	const refused: [string, string][] = [
		["not a url", "is not a valid URL"],
		["", "is not a valid URL"],
		["ftp://127.0.0.1:8025", "must use http or https"],
		["file:///etc/passwd", "must use http or https"],
		["http://user:pass@127.0.0.1:8025", "must not embed credentials"],
		["http://user@127.0.0.1:8025", "must not embed credentials"],
		["http://127.0.0.1:8025/api", "no path, query or fragment"],
		["http://127.0.0.1:8025?x=1", "no path, query or fragment"],
		["http://127.0.0.1:8025?", "no path, query or fragment"],
		["http://127.0.0.1:8025#frag", "no path, query or fragment"],
		["http://127.0.0.1:8025#", "no path, query or fragment"],
		["http://169.254.169.254", "link-local or metadata"],
		[
			"http://169.254.169.254/latest/meta-data",
			"no path, query or fragment",
		],
		["https://169.254.0.1", "link-local or metadata"],
		["http://2852039166", "link-local or metadata"],
		["http://0xa9fea9fe", "link-local or metadata"],
		["http://0251.0376.0251.0376", "link-local or metadata"],
		["http://[fe80::1]:8025", "link-local or metadata"],
		["https://[fe80::1%25eth0]:8025", "is not a valid URL"],
		["http://[febf::1]:8025", "link-local or metadata"],
		["http://[::ffff:169.254.169.254]", "link-local or metadata"],
		["http://[64:ff9b::a9fe:a9fe]", "link-local or metadata"],
		["https://[fd00:ec2::254]", "link-local or metadata"],
		["http://0.0.0.0:8025", "link-local or metadata"],
		["http://[::]:8025", "link-local or metadata"],
		["https://100.100.100.200", "link-local or metadata"],
		["https://metadata.google.internal", "link-local or metadata"],
		["https://metadata.google.internal.", "link-local or metadata"],
		["http://api.remoto:8025", "must use https"],
		["http://10.0.0.5:8025", "must use https"],
		["http://[fd12::1]:8025", "must use https"],
		["http://192.168.0.107:8025", "must use https"],
		["http://[64:ff9b::7f00:1]", "must use https"],
	];
	for (const [raw, reason] of refused) {
		it(`refuses ${JSON.stringify(raw)}`, () => {
			expect(() => parseApiUrl(raw)).toThrow(reason);
			expect(() => parseApiUrl(raw)).toThrow("EPISTLE_API_URL");
		});
	}

	it("refuses a link-local host even when the allow list names it", () => {
		expect(() =>
			parseApiUrl("http://169.254.169.254", ["169.254.169.254"]),
		).toThrow("link-local or metadata");
	});

	it("does not let the allow list cover a different host", () => {
		expect(() => parseApiUrl("http://node2.wg:8025", ["node3.wg"])).toThrow(
			"must use https",
		);
	});

	it("never echoes the value, which may hold credentials", () => {
		for (const raw of [
			"http://admin:hunter2@127.0.0.1:8025",
			"http://hunter2.remote:8025",
			"ftp://hunter2",
		]) {
			const error = (() => {
				try {
					parseApiUrl(raw);
				} catch (e) {
					return e as Error;
				}
				return undefined;
			})();
			expect(error).toBeDefined();
			expect(error?.message).not.toContain("hunter2");
		}
	});
});

describe("apiBaseUrl", () => {
	afterEach(() => {
		delete process.env["EPISTLE_API_URL"];
		delete process.env["EPISTLE_API_ALLOW_HTTP_HOSTS"];
		process.env["EPISTLE_API_URL"] = DEFAULT_API_URL;
	});

	it("defaults to the loopback API", () => {
		delete process.env["EPISTLE_API_URL"];
		expect(apiBaseUrl()).toBe("http://127.0.0.1:8025");
	});

	it("fails closed on an empty variable", () => {
		process.env["EPISTLE_API_URL"] = "";
		expect(() => apiBaseUrl()).toThrow(
			"EPISTLE_API_URL is not a valid URL",
		);
	});

	it("rejects a refused value and recovers when it is fixed", () => {
		process.env["EPISTLE_API_URL"] = "http://169.254.169.254";
		expect(() => apiBaseUrl()).toThrow("link-local");
		process.env["EPISTLE_API_URL"] = "https://api.example.org";
		expect(apiBaseUrl()).toBe("https://api.example.org");
	});

	it("reads the allow list, trimmed and case-insensitive", () => {
		process.env["EPISTLE_API_URL"] = "http://Node2.WG:8025";
		process.env["EPISTLE_API_ALLOW_HTTP_HOSTS"] = " other.wg , NODE2.wg ,,";
		expect(apiBaseUrl()).toBe("http://node2.wg:8025");
	});

	it("stops accepting plain http when the allow list is removed", () => {
		process.env["EPISTLE_API_URL"] = "http://node2.wg:8025";
		process.env["EPISTLE_API_ALLOW_HTTP_HOSTS"] = "node2.wg";
		expect(apiBaseUrl()).toBe("http://node2.wg:8025");
		delete process.env["EPISTLE_API_ALLOW_HTTP_HOSTS"];
		expect(() => apiBaseUrl()).toThrow("must use https");
	});
});
