import { describe, expect, it } from "bun:test";

import { parseHttpsOrigin } from ".";

describe("parseHttpsOrigin", () => {
	it("returns the exact origin for a host, with or without a port and one slash", () => {
		expect(parseHttpsOrigin("https://cdn.example.com")).toBe(
			"https://cdn.example.com",
		);
		expect(parseHttpsOrigin("https://cdn.example.com/")).toBe(
			"https://cdn.example.com",
		);
		expect(parseHttpsOrigin("https://cdn.example.com:8443")).toBe(
			"https://cdn.example.com:8443",
		);
		expect(parseHttpsOrigin("https://a-b.example.com:65535/")).toBe(
			"https://a-b.example.com:65535",
		);
		expect(parseHttpsOrigin("https://localhost")).toBe("https://localhost");
	});

	it("lowercases the scheme and the host, drops the default port and trims the edges", () => {
		expect(parseHttpsOrigin("HTTPS://CDN.Example.COM")).toBe(
			"https://cdn.example.com",
		);
		expect(parseHttpsOrigin("https://cdn.example.com:443")).toBe(
			"https://cdn.example.com",
		);
		expect(parseHttpsOrigin(" \thttps://cdn.example.com\n")).toBe(
			"https://cdn.example.com",
		);
	});

	it("takes an internationalised name only in its punycode form", () => {
		expect(parseHttpsOrigin("https://xn--bcher-kva.example")).toBe(
			"https://xn--bcher-kva.example",
		);
		expect(parseHttpsOrigin("https://bücher.example")).toBeUndefined();
		expect(parseHttpsOrigin("https://ｃdn.example.com")).toBeUndefined();
	});

	it("refuses anything that is not scheme, host and port", () => {
		for (const value of [
			"",
			"   ",
			"cdn.example.com",
			"//cdn.example.com",
			"http://cdn.example.com",
			"http://localhost",
			"http://127.0.0.1:8080",
			"ftp://cdn.example.com",
			"wss://cdn.example.com",
			"https:cdn.example.com",
			"https:///cdn.example.com",
			"https://",
			"https://*.example.com",
			"https://cdn.*.example.com",
			"https://*",
			"*",
			"https://cdn.example.com/assets",
			"https://cdn.example.com//",
			"https://cdn.example.com/?a=1",
			"https://cdn.example.com?a=1",
			"https://cdn.example.com#top",
			"https://user@cdn.example.com",
			"https://user:pass@cdn.example.com",
			"https://cdn.example.com:",
			"https://cdn.example.com:0",
			"https://cdn.example.com:65536",
			"https://cdn.example.com:99999999",
			"https://cdn.example.com:80a",
			"https://cdn.example.com:-1",
			"https://[::1]",
			"https://[::1]:8443",
			"https://cdn..example.com",
			"https://.example.com",
			"https://example.com.",
			"https://-cdn.example.com",
			"https://cdn-.example.com",
			"https://cdn_x.example.com",
			"https://999.1.1.1",
		]) {
			expect(parseHttpsOrigin(value)).toBeUndefined();
		}
	});

	it("refuses spaces and control characters anywhere inside", () => {
		for (const value of [
			"https://cdn .example.com",
			"https://cdn.example.com img-src *",
			"https://cdn.example.com\tx",
			"https://cdn.example.com\nhttps://evil.example",
			"https://cdn.example.com\u0000",
			"https://cdn​.example.com",
			"https://cdn.example.com x",
		]) {
			expect(parseHttpsOrigin(value)).toBeUndefined();
		}
	});

	it("refuses characters that would end a policy directive or add a source", () => {
		for (const value of [
			"https://cdn.example.com;script-src",
			"https://cdn.example.com;",
			"https://cdn.example.com,https://evil.example",
			"https://cdn.example.com'",
			"https://cdn.example.com'unsafe-inline'",
			"https://cdn.example.com%20x",
			"https://cdn.example.com\\evil",
			"https://cdn.example.com|x",
			"https://cdn.example.com<script>",
			"https://a;b.example",
			"https://a'b.example",
		]) {
			expect(parseHttpsOrigin(value)).toBeUndefined();
		}
	});

	it("takes a host of 253 characters and refuses one of 254, and takes ports 1 and 65535", () => {
		const label = "a".repeat(63);
		const host253 = `${label}.${label}.${label}.${"a".repeat(61)}`;
		expect(host253).toHaveLength(253);
		expect(parseHttpsOrigin(`https://${host253}`)).toBe(
			`https://${host253}`,
		);
		expect(parseHttpsOrigin(`https://${host253}a`)).toBeUndefined();
		expect(parseHttpsOrigin("https://cdn.example.com:1")).toBe(
			"https://cdn.example.com:1",
		);
		expect(parseHttpsOrigin("https://cdn.example.com:65535")).toBe(
			"https://cdn.example.com:65535",
		);
		expect(
			parseHttpsOrigin("https://cdn.example.com:65536"),
		).toBeUndefined();
	});

	it("refuses a value of 5000 characters without looking further", () => {
		expect(
			parseHttpsOrigin(`https://${"a".repeat(5000)}.example.com`),
		).toBeUndefined();
		expect(parseHttpsOrigin("x".repeat(5000))).toBeUndefined();
		expect(
			parseHttpsOrigin(`https://${"a".repeat(64)}.example.com`),
		).toBeUndefined();
		expect(
			parseHttpsOrigin(
				`https://${Array.from({ length: 60 }, () => "abcde").join(".")}`,
			),
		).toBeUndefined();
	});
});
