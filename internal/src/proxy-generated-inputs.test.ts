import { describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { type Rng, runCases } from "@/test/prng";

import { config, proxy } from "./proxy";

// Next compiles the matcher itself; the pattern is plain enough to anchor and
// run as a regular expression here to see which paths reach the proxy.
const reachesProxy = new RegExp(`^${config.matcher[0]}$`);

type Verdict = "static" | "login" | "gated";

const isDot = (segment: string) => /^(\.|%2e)$/i.test(segment);
const isDotDot = (segment: string) => /^(\.|%2e)(\.|%2e)$/i.test(segment);

/**
 * Reference model of the gate, written from the intent and not from the code:
 * what a URL parser leaves of a request path, then which routes are open.
 * Only the exact login route, the static assets and `/robots.txt` need no session; every
 * other path, however it is spelled, is gated.
 */
function expectedVerdict(rawPath: string): Verdict {
	// A parser drops tabs and newlines anywhere and trailing control characters
	// and spaces, then ends the path at the first `?` or `#`.
	let text = rawPath
		.replace(/[\t\n\r]/g, "")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: the parser trims C0 controls.
		.replace(/[\u0000- ]+$/, "");
	text = text.split(/[?#]/)[0] ?? "";
	const segments = text.replaceAll("\\", "/").slice(1).split("/");
	const out: string[] = [];
	segments.forEach((segment, i) => {
		const last = i === segments.length - 1;
		if (isDotDot(segment)) {
			out.pop();
		}
		if (isDot(segment) || isDotDot(segment)) {
			if (last) {
				out.push("");
			}
			return;
		}
		out.push(segment);
	});
	const path = `/${out.join("/")}`;
	if (
		path.startsWith("/_next/static/") ||
		path === "/_next/image" ||
		path === "/favicon.ico" ||
		path === "/robots.txt"
	) {
		return "static";
	}
	return path === "/login" || path === "/login/" ? "login" : "gated";
}

/** What the real matcher and proxy do with a request for `rawPath`, no cookie. */
async function observedVerdict(rawPath: string): Promise<Verdict> {
	const request = new NextRequest(`http://panel.test${rawPath}`);
	if (!reachesProxy.test(request.nextUrl.pathname)) {
		return "static";
	}
	const response = await proxy(request);
	if (response.status === 307) {
		// The target is the login route of the same origin with no query. Next
		// keeps a trailing slash or fragment the request had; neither is sent.
		const target = new URL(response.headers.get("location") ?? "");
		expect(target.origin).toBe("http://panel.test");
		expect(["/login", "/login/"]).toContain(target.pathname);
		expect(target.search).toBe("");
		return "gated";
	}
	expect(response.status).toBe(200);
	return "login";
}

/** `/login` with the character at each chosen index percent-encoded. */
function encodeSome(text: string, rng: Rng, p: number): string {
	return Array.from(text, (c) =>
		rng.chance(p) ? `%${c.charCodeAt(0).toString(16).padStart(2, "0")}` : c,
	).join("");
}

const BASES = [
	"/login",
	"/login/",
	"/Login",
	"/LOGIN",
	"/loginx",
	"/login-",
	"/logi",
	"/",
	"/queue",
	"/domains/x",
	"/_next/static/a.js",
	"/_next/static",
	"/_next/image",
	"/_next/imagex",
	"/_next/image/x",
	"/_NEXT/static/a.js",
	"/favicon.ico",
	"/faviconxico",
	"/favicon.ico/",
	"/favicon.icox",
	"/robots.txt",
	"/robots.txtx",
	"/robots.txt/",
	"/robots.txt/queue",
	"/x/robots.txt",
	"/ROBOTS.TXT",
	"/robots%2etxt",
	"/robotsxtxt",
	"/lоgin",
	"/ｌｏｇｉｎ",
	"/login​",
	"/login­",
	"/ⅼogin",
	"/login。",
	"/login\u0000",
	"/login%00",
	"/login﻿",
];

function variant(rng: Rng): string {
	let path = rng.pick(BASES);
	const steps = rng.int(0, 3);
	for (let i = 0; i < steps; i++) {
		switch (rng.int(0, 11)) {
			case 0:
				path = `/${encodeSome(path.slice(1), rng, 0.3)}`;
				break;
			case 1:
				path = `${rng.pick(["/", "//", "///", "/./", "/x/../"])}${path.slice(1)}`;
				break;
			case 2:
				path += rng.pick([
					"/",
					"//",
					"///",
					"/.",
					"/./",
					"/..",
					"/x/..",
					"/%2e",
					"/%2E%2e",
				]);
				break;
			case 3:
				path = path.replace(
					"/",
					rng.pick([
						"/%2e/",
						"/./",
						"/../",
						"/.%2e/",
						"/%2e%2E/",
						"/a/%2e%2e/",
						"//",
					]),
				);
				break;
			case 4:
				path += rng.pick([";a=b", "/;x", "%3Bx", ";", ";/", "/;/"]);
				break;
			case 5:
				path += rng.pick([
					"?",
					"?a=1",
					"?/login",
					"#f",
					"#/login",
					"?#",
					"?x=/../queue",
				]);
				break;
			case 6:
				path = path.replace(
					"/",
					rng.pick(["/\t", "/\n", "/\r", "/ ", "\\"]),
				);
				break;
			case 7:
				path += rng.pick([
					" ",
					"\t",
					"\n",
					"\u0001",
					"%20",
					"%09",
					"\\",
					"\\\\",
				]);
				break;
			case 8: {
				const at = rng.int(1, path.length);
				path =
					path.slice(0, at) +
					rng.pick(["\t", "\n", "\r", "%0a", "%2f", "%5c"]) +
					path.slice(at);
				break;
			}
			case 9:
				path = `/${rng.string("abc./%2eE;\\", rng.int(1, 8))}${path}`;
				break;
			case 10:
				path = path.toUpperCase();
				break;
			default:
				path = path.replace(/[a-z]/, (c) => c.toUpperCase());
		}
	}
	return path;
}

describe("proxy gate on generated paths", () => {
	it("opens only the exact login route and the static assets, whatever the spelling", async () => {
		const seen: Record<Verdict, number> = { static: 0, login: 0, gated: 0 };
		await runCases("path variants", 4000, async (rng) => {
			const path = variant(rng);
			const want = expectedVerdict(path);
			const got = await observedVerdict(path);
			seen[want]++;
			expect(JSON.stringify([path, got])).toBe(
				JSON.stringify([path, want]),
			);
		});
		// Each outcome must be exercised, or the model is vacuous.
		expect(seen.static).toBeGreaterThan(50);
		expect(seen.login).toBeGreaterThan(50);
		expect(seen.gated).toBeGreaterThan(500);
	});

	it("gates every spelling of /login with one character percent-encoded", async () => {
		for (let i = 1; i < "/login".length; i++) {
			for (const hexCase of [true, false]) {
				const code = "/login".charCodeAt(i).toString(16);
				const encoded = `%${hexCase ? code : code.toUpperCase()}`;
				const path = `${"/login".slice(0, i)}${encoded}${"/login".slice(i + 1)}`;
				expect([path, await observedVerdict(path)]).toEqual([
					path,
					"gated",
				]);
				expect([`${path}/`, await observedVerdict(`${path}/`)]).toEqual(
					[`${path}/`, "gated"],
				);
			}
		}
	});

	it("keeps look-alikes of the skipped assets inside the gate", async () => {
		for (const path of [
			"/faviconxico",
			"/favicon-ico",
			"/favicon.icox",
			"/favicon.ico/x",
			"/_next/imagex",
			"/_next/image-x",
			"/_next/imagex/y",
			"/_next/staticx/a.js",
			"/_next/static",
		]) {
			expect([path, await observedVerdict(path)]).toEqual([
				path,
				"gated",
			]);
		}
		for (const path of [
			"/favicon.ico",
			"/_next/image",
			"/_next/static/a.js",
		]) {
			expect([path, await observedVerdict(path)]).toEqual([
				path,
				"static",
			]);
		}
	});
});
