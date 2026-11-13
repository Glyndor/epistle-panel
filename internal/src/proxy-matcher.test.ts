import { describe, expect, it } from "bun:test";

import { config } from "./proxy";

// Next compiles the matcher itself; the pattern is plain enough to anchor and
// run as a regular expression here to see which paths reach the proxy.
const covered = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
	it("skips Next internals and static assets only", () => {
		for (const path of [
			"/_next/static/chunk.js",
			"/_next/image",
			"/favicon.ico",
		]) {
			expect(covered.test(path)).toBe(false);
		}
	});

	it("skips the operator's theme and brand assets as those exact paths, and nothing around them", () => {
		for (const path of ["/theme.css", "/brand/logo", "/brand/favicon"]) {
			expect(covered.test(path)).toBe(false);
		}
		for (const path of [
			"/theme.cssx",
			"/theme.css/app",
			"/x/theme.css",
			"/THEME.CSS",
			"/theme%2ecss",
			"/brand/logox",
			"/brand/logo/x",
			"/brand",
			"/brand/",
			"/brand/favicon.ico",
			"/x/brand/logo",
		]) {
			expect(covered.test(path)).toBe(true);
		}
	});

	it("skips /robots.txt as that exact path, and nothing around it", () => {
		expect(covered.test("/robots.txt")).toBe(false);
		for (const path of [
			"/robots.txtx",
			"/robots.txt/",
			"/robots.txt/app",
			"/x/robots.txt",
			"/ROBOTS.TXT",
			"/robotsxtxt",
			"/app/robots.txt",
		]) {
			expect(covered.test(path)).toBe(true);
		}
	});

	it("skips the attachment upload as that exact path, and nothing around it", () => {
		expect(covered.test("/app/mail/upload")).toBe(false);
		for (const path of [
			"/app/mail/uploadx",
			"/app/mail/upload/",
			"/app/mail/upload/x",
			"/app/mail/UPLOAD",
			"/app/mail/upload%2f",
			"/x/app/mail/upload",
			"/app/mail",
			"/app/mail/compose-message",
			"/app/upload",
			"/upload",
		]) {
			expect([path, covered.test(path)]).toEqual([path, true]);
		}
	});

	it("covers the login route so it gets the nonce, and every other route", () => {
		for (const path of [
			"/",
			"/login",
			"/app",
			"/app/queue",
			"/loginx",
			"/login-admin",
		]) {
			expect(covered.test(path)).toBe(true);
		}
	});

	it("does not let look-alikes of the skipped paths escape the proxy", () => {
		for (const path of [
			"/_next/staticx/a.js",
			"/favicon.icox",
			"/favicon.ico/app",
			"/_NEXT/static/a.js",
		]) {
			expect(covered.test(path)).toBe(true);
		}
	});
});
