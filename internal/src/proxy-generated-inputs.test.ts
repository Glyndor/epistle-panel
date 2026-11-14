import { describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { type Rng, runCases } from "@/test/prng";

import { config, HIDDEN_PATH, proxy } from "./proxy";

// Next compiles the matcher itself; the pattern is plain enough to anchor and
// run as a regular expression here to see which paths reach the proxy.
const reachesProxy = new RegExp(`^${config.matcher[0]}$`);

/**
 * What a request ends as: `static` skips the proxy,
 * `gated` is sent to the sign-in page, `hidden` is rewritten to the 404 path,
 * `passed` goes on to the router, as the root or as a path let in.
 */
type Verdict = "static" | "passed" | "gated" | "hidden";

/** Who sends the request: nobody, a user session or an admin session. */
type Caller = "anonymous" | "user" | "admin";

const isDot = (segment: string) => /^(\.|%2e)$/i.test(segment);
const isDotDot = (segment: string) => /^(\.|%2e)(\.|%2e)$/i.test(segment);

/**
 * Reference model of the gate, written from the intent and not from the code:
 * what a URL parser leaves of a request path, then what each caller gets. The
 * static assets skip the proxy. The root is let on. Anything else is read in
 * any spelling a router may read it (percent-encoded, any case, backslashes,
 * repeated slashes, a `;` parameter, an undecodable escape): under `/app`,
 * `mail` wants a session of any role and sends the others to the sign-in page,
 * and a second segment that is exactly the configured id lets an admin in; every
 * other path is hidden as a 404.
 */
/**
 * The routes of the mail area, written again here and not taken from the code:
 * the home, a folder by role or by its name as one segment, a message's id
 * after either, and the routes that are no folder.
 */
// An id as the page reads one: version 1 to 8, the RFC variant.
const MESSAGE =
	"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const FOLDER = "(?:[A-Za-z0-9-]|_[0-9A-F]{2})(?:[A-Za-z0-9.-]|_[0-9A-F]{2})*";
const MAIL_ROUTE = new RegExp(
	`^/app/mail(?:/(?:inbox|drafts|sent|archive|junk|trash)(?:/${MESSAGE})?|/folder/${FOLDER}(?:/${MESSAGE})?|/compose|/compose-message|/upload|/body/[^/]+|/attachment/[^/]+/[^/]+)?$`,
);

function expectedVerdict(rawPath: string, caller: Caller): Verdict {
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
		path === "/robots.txt" ||
		path === "/theme.css" ||
		path === "/brand/logo" ||
		path === "/brand/favicon"
	) {
		return "static";
	}
	if (path === "/__not-found__") {
		return "passed";
	}
	let decoded: string;
	try {
		decoded = decodeURIComponent(path);
	} catch {
		return "hidden";
	}
	const parts = decoded
		.replaceAll("\\", "/")
		.split("/")
		.filter((part) => part !== "");
	if (parts.length === 0) {
		return "passed";
	}
	const second = parts[1]?.split(";")[0];
	if (
		parts[0]?.split(";")[0]?.toLowerCase() !== "app" ||
		second === undefined
	) {
		return "hidden";
	}
	if (second?.toLowerCase() === "mail") {
		// Without a session every spelling goes to the sign-in page. With one,
		// only a route of the mail area passes, read exactly as it is spelled.
		if (caller === "anonymous") {
			return "gated";
		}
		return MAIL_ROUTE.test(path.endsWith("/") ? path.slice(0, -1) : path)
			? "passed"
			: "hidden";
	}
	return caller === "admin" && second === TEST_ADMIN_ID ? "passed" : "hidden";
}

/** What the real matcher and proxy do with a request for `rawPath` from `caller`. */
async function observedVerdict(
	rawPath: string,
	caller: Caller = "anonymous",
): Promise<Verdict> {
	const request = new NextRequest(`http://panel.test${rawPath}`);
	if (!reachesProxy.test(request.nextUrl.pathname)) {
		return "static";
	}
	if (caller !== "anonymous") {
		request.cookies.set(
			SESSION_COOKIE,
			await createSession("someone", caller),
		);
	}
	const response = await proxy(request);
	if (response.status === 307) {
		// The target is the sign-in page of the same origin with no query. Next
		// keeps a trailing slash the request had; it is not sent on.
		const target = new URL(response.headers.get("location") ?? "");
		expect(target.origin).toBe("http://panel.test");
		expect(target.pathname).toBe("/");
		expect(target.search).toBe("");
		return "gated";
	}
	expect(response.status).toBe(200);
	const rewrite = response.headers.get("x-middleware-rewrite");
	if (rewrite !== null) {
		// The hidden request is answered from one fixed path and nothing of the
		// original survives in the rewrite.
		// A request that ends in a slash never reaches the proxy on a real
		// server (Next redirects it first), but a test request can, and the
		// URL class keeps the slash.
		expect(new URL(rewrite).pathname.replace(/\/$/, "")).toBe(HIDDEN_PATH);
		expect(new URL(rewrite).search).toBe("");
		return "hidden";
	}
	return "passed";
}

/** `text` with each character percent-encoded with probability `p`. */
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
	"/accounts",
	"/domains/x",
	"/app",
	"/app/",
	"/App",
	"/APP/queue",
	"/app/queue",
	"/app/accounts/alice",
	"/app/unknown/deep",
	"/app/mail",
	"/app/mail/",
	"/app/mail/inbox",
	"/app/mail/trash",
	"/app/mail/inbox/01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
	"/app/mail/folder/Work_2FQ4",
	"/app/mail/folder/Work_2FQ4/01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
	"/app/mail/compose",
	"/app/mail/body/01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
	"/app/mail/no-such-place",
	"/app/mail/label/Work",
	"/app/mail/inbox/not-an-id",
	"/app/mail/inbox/01890a5d-ac96-074b-b9aa-9be4c3bd6b0e",
	"/app/mail/sent/01890a5d-ac96-774b-c9aa-9be4c3bd6b0e",
	"/app/mail/folder/Work%2FQ4",
	"/app/Mail",
	"/app/MAIL/x",
	"/app/mailx",
	"/app/mai",
	`/app/${TEST_ADMIN_ID}`,
	`/app/${TEST_ADMIN_ID}/`,
	`/app/${TEST_ADMIN_ID}/queue`,
	`/app/${TEST_ADMIN_ID}/accounts/alice`,
	`/app/${TEST_ADMIN_ID}//queue`,
	`//app//${TEST_ADMIN_ID}`,
	`/app/${TEST_ADMIN_ID.toUpperCase()}`,
	`/app/${TEST_ADMIN_ID.slice(0, -1)}`,
	`/app/${TEST_ADMIN_ID}0`,
	`/app/%33f2b8c1e-5d4a-4b7e-9c3d-1a2b3c4d5e6f/queue`,
	`/app/${TEST_ADMIN_ID};x/queue`,
	`/app/${TEST_ADMIN_ID}%2fqueue`,
	`/app/${TEST_ADMIN_ID}\\queue`,
	"/apps",
	"/application",
	"/x/app",
	"/%61pp",
	"/app%",
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
	"/theme.css",
	"/theme.cssx",
	"/theme.css/",
	"/x/theme.css",
	"/THEME.CSS",
	"/brand/logo",
	"/brand/logox",
	"/brand/logo/x",
	"/brand/favicon",
	"/brand/favicon.ico",
	"/brand",
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

const CALLERS: readonly Caller[] = ["anonymous", "user", "admin"];

describe("proxy gate on generated paths", () => {
	it("hides the admin area from everyone but an admin with the right id, and gates the mail area, whatever the spelling", async () => {
		const seen: Record<Verdict, number> = {
			static: 0,
			passed: 0,
			gated: 0,
			hidden: 0,
		};
		await runCases("path variants", 4000, async (rng) => {
			const path = variant(rng);
			const caller = rng.pick(CALLERS);
			const want = expectedVerdict(path, caller);
			const got = await observedVerdict(path, caller);
			seen[want]++;
			expect(JSON.stringify([path, caller, got])).toBe(
				JSON.stringify([path, caller, want]),
			);
		});
		// Each outcome must be exercised, or the model is vacuous.
		expect(seen.static).toBeGreaterThan(50);
		expect(seen.passed).toBeGreaterThan(200);
		expect(seen.gated).toBeGreaterThan(20);
		expect(seen.hidden).toBeGreaterThan(500);
	});

	it("never lets a caller without the admin role reach the admin id, in any spelling", async () => {
		for (const caller of ["anonymous", "user"] as const) {
			for (const path of [
				`/app/${TEST_ADMIN_ID}`,
				`/app/${TEST_ADMIN_ID}/`,
				`/app/${TEST_ADMIN_ID}/queue`,
				`/APP/${TEST_ADMIN_ID}/queue`,
				`/%61pp/${TEST_ADMIN_ID}`,
				`//app//${TEST_ADMIN_ID}`,
			]) {
				expect([
					path,
					caller,
					await observedVerdict(path, caller),
				]).toEqual([path, caller, "hidden"]);
			}
		}
	});

	it("hides every spelling of /app with one character percent-encoded when nothing else is right", async () => {
		for (let i = 1; i < "/app".length; i++) {
			for (const hexCase of [true, false]) {
				const code = "/app".charCodeAt(i).toString(16);
				const encoded = `%${hexCase ? code : code.toUpperCase()}`;
				const path = `${"/app".slice(0, i)}${encoded}${"/app".slice(i + 1)}/queue`;
				expect([path, await observedVerdict(path)]).toEqual([
					path,
					"hidden",
				]);
			}
		}
	});

	it("keeps look-alikes of the skipped assets inside the proxy, which hides them", async () => {
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
				"hidden",
			]);
			const under = `/app${path}`;
			expect([under, await observedVerdict(under)]).toEqual([
				under,
				"hidden",
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
