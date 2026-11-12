import { describe, expect, it } from "bun:test";

import { runCases } from "@/test/prng";
import { outcome } from "../test-support/api-url-outcome";
import { refusedByModel } from "../test-support/host-notations";

const SCHEMES = [
	"http://",
	"https://",
	"HTTP://",
	"ftp://",
	"//",
	"",
	"http:/",
	"https:\\\\",
	" http://",
	"http://\t",
];
const USERINFO = ["", "", "", "a@", "a:b@", "@"];
const HOSTS = [
	"localhost",
	"127.0.0.1",
	"[::1]",
	"example.org",
	"EXAMPLE.org.",
	"a.b.c.d",
	"1.2.3",
	"1.2.3.4.5",
	"999.1.1.1",
	"0x7f.1",
	"0300.0250.0.1",
	"4294967295",
	"4294967296",
	"-1",
	"[::ffff:7f00:1]",
	"[1:2:3:4:5:6:7:8]",
	"[::1",
	"::1]",
	"[]",
	"[fe80::1%25eth0]",
	"[fe80::1%eth0]",
	"%31%32%37.0.0.1",
	"127.0.0.1%00",
	"ｌｏｃａｌｈｏｓｔ",
	"１２７.0.0.1",
	"xn--nxasmq6b.example",
	"münchen.example",
	"①②⑦.0.0.1",
	"a b",
	"",
	".",
	"..",
	"a..b",
	"metadata",
	"metadata.",
	"METADATA.GOOGLE.INTERNAL",
	"169.254.169.254",
	"169。254。169。254",
	"0xA9.0xFE.0xA9.0xFE",
	"[::]",
	"[::ffff:a9fe:a9fe]",
	"[64:ff9b::a9fe:a9fe]",
	"100.100.100.200",
	"0",
	"0.0.0.0",
	"00",
	"0x0",
	"[::0]",
	"\u0000",
	"a\u0000b",
	"%00",
	"%",
	"%zz",
	"a%2Fb",
];
const PORTS = [
	"",
	"",
	":80",
	":8025",
	":0",
	":65535",
	":65536",
	":abc",
	":",
	":-1",
	":８０",
];
const TAILS = [
	"",
	"",
	"/",
	"//",
	"/x",
	"/.",
	"/..",
	"?",
	"#",
	"?a",
	"#a",
	"/?",
	"\\",
	";a",
	"\n",
	" ",
	"/ ",
];

describe("parseApiUrl on arbitrary dressings", () => {
	it("only ever returns an origin or throws ConfigError, and no origin is refused", async () => {
		let accepted = 0;
		await runCases("arbitrary urls", 6000, (rng) => {
			const raw =
				rng.pick(SCHEMES) +
				rng.pick(USERINFO) +
				rng.pick(HOSTS) +
				rng.pick(PORTS) +
				rng.pick(TAILS);
			const result = outcome(
				raw,
				rng.chance() ? ["example.org", "a.b.c.d"] : [],
			);
			if ("error" in result) {
				// A message never carries the configured value.
				expect(
					result.error.message.startsWith("EPISTLE_API_URL "),
				).toBe(true);
				return;
			}
			accepted++;
			const url = new URL(result.origin);
			expect(["http:", "https:"]).toContain(url.protocol);
			expect(url.origin).toBe(result.origin);
			expect(url.username + url.password + url.search + url.hash).toBe(
				"",
			);
			expect(refusedByModel(url.hostname)).toBe(false);
			expect(outcome(result.origin, ["example.org", "a.b.c.d"])).toEqual(
				result,
			);
		});
		expect(accepted).toBeGreaterThan(100);
	});

	it("never throws anything but ConfigError for random character soup", async () => {
		await runCases("character soup", 3000, (rng) => {
			const raw = rng.string(
				"abcXYZ019:/.?#@[]%;\\ \t\u0000é。．😀-_~!$&'()*+,=",
				rng.int(0, 40),
			);
			outcome(raw);
			outcome(`http://${raw}`);
			outcome(`https://[${raw}]`);
		});
	});
});
