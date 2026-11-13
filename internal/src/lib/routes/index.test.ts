import { describe, expect, it } from "bun:test";

import {
	OTHER_ADMIN_ID,
	TEST_ADMIN_ID,
} from "@/lib/config/test-support/admin-id";

import {
	adminRoutes,
	classifyAppPath,
	constantTimeEqual,
	isAdminIdShape,
	isMailBodyPath,
	PUBLIC_ROUTES,
} from ".";

describe("isAdminIdShape", () => {
	it("accepts a lower-case UUID v4", () => {
		expect(isAdminIdShape(TEST_ADMIN_ID)).toBe(true);
		expect(isAdminIdShape(OTHER_ADMIN_ID)).toBe(true);
		expect(isAdminIdShape(crypto.randomUUID())).toBe(true);
	});

	it("refuses every other shape", () => {
		for (const value of [
			"",
			"mail",
			TEST_ADMIN_ID.toUpperCase(),
			// version 1, version 7, wrong variant nibble
			"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			"018f3a6e-7b2c-7c5a-9a3b-1c2d3e4f5a6b",
			"3f2b8c1e-5d4a-4b7e-cc3d-1a2b3c4d5e6f",
			// length, braces, spaces, urn, unicode, line breaks, trailing slash
			TEST_ADMIN_ID.slice(0, -1),
			`${TEST_ADMIN_ID}0`,
			`{${TEST_ADMIN_ID}}`,
			` ${TEST_ADMIN_ID}`,
			`${TEST_ADMIN_ID}\\n`,
			`${TEST_ADMIN_ID}/`,
			`urn:uuid:${TEST_ADMIN_ID}`,
			TEST_ADMIN_ID.replaceAll("-", ""),
			TEST_ADMIN_ID.replace("3f2b", "３f2b"),
			"../app",
		]) {
			expect(isAdminIdShape(value), value).toBe(false);
		}
	});
});

describe("adminRoutes", () => {
	const routes = adminRoutes(TEST_ADMIN_ID);

	it("builds every admin path under /app/{id}, with no trailing slash", () => {
		expect(String(routes.home)).toBe(`/app/${TEST_ADMIN_ID}`);
		expect(String(routes.domains)).toBe(`/app/${TEST_ADMIN_ID}/domains`);
		expect(String(routes.accounts)).toBe(`/app/${TEST_ADMIN_ID}/accounts`);
		expect(String(routes.queue)).toBe(`/app/${TEST_ADMIN_ID}/queue`);
		expect(String(routes.suppression)).toBe(
			`/app/${TEST_ADMIN_ID}/suppression`,
		);
		expect(String(routes.deliveries)).toBe(
			`/app/${TEST_ADMIN_ID}/deliveries`,
		);
		expect(String(routes.accountDetail("alice"))).toBe(
			`/app/${TEST_ADMIN_ID}/accounts/alice`,
		);
	});

	it("builds different paths for different ids and shares nothing between them", () => {
		expect(String(adminRoutes(OTHER_ADMIN_ID).queue)).toBe(
			`/app/${OTHER_ADMIN_ID}/queue`,
		);
		expect(String(routes.queue)).toBe(`/app/${TEST_ADMIN_ID}/queue`);
	});

	it("refuses an id that is not a UUID v4 instead of building a path from it", () => {
		for (const value of ["", "mail", "../x", TEST_ADMIN_ID.toUpperCase()]) {
			expect(() => adminRoutes(value), value).toThrow();
		}
	});

	it("keeps the public paths free of the id", () => {
		expect(PUBLIC_ROUTES).toEqual({ root: "/", mail: "/app/mail" });
	});
});

describe("constantTimeEqual", () => {
	it("is true only for equal strings", () => {
		expect(constantTimeEqual(TEST_ADMIN_ID, TEST_ADMIN_ID)).toBe(true);
		expect(constantTimeEqual("", "")).toBe(true);
		expect(constantTimeEqual(TEST_ADMIN_ID, OTHER_ADMIN_ID)).toBe(false);
		expect(
			constantTimeEqual(TEST_ADMIN_ID, TEST_ADMIN_ID.toUpperCase()),
		).toBe(false);
	});

	it("is false for a prefix, an extension and the empty string", () => {
		expect(
			constantTimeEqual(TEST_ADMIN_ID, TEST_ADMIN_ID.slice(0, -1)),
		).toBe(false);
		expect(constantTimeEqual(`${TEST_ADMIN_ID}x`, TEST_ADMIN_ID)).toBe(
			false,
		);
		expect(constantTimeEqual("", TEST_ADMIN_ID)).toBe(false);
		expect(constantTimeEqual(TEST_ADMIN_ID, "")).toBe(false);
		// A trailing NUL must not equal a missing character.
		expect(constantTimeEqual("a\\0", "a")).toBe(false);
	});
});

describe("classifyAppPath", () => {
	it("is root only for the root, in any spelling that is the root", () => {
		for (const path of ["/", "//", "///", "\\", "/\\"]) {
			expect(classifyAppPath(path), path).toEqual({ kind: "root" });
		}
	});

	it("is other for everything no route answers, the old paths and the look-alikes included", () => {
		for (const path of [
			"/login",
			"/accounts",
			"/queue",
			"/application",
			"/apps",
			"/x/app",
			"/robots.txt",
			"/theme.css",
			"/__not-found__",
			"/app",
			"/app/",
			"//app//",
			"/APP",
			"/%61pp",
			"/app;x",
			"/app%",
			"/%E0%A4%A",
			"/app/%E0%A4%A",
		]) {
			expect(classifyAppPath(path), path).toEqual({ kind: "other" });
		}
	});

	it("is mail for /app/mail and below, in any spelling the router may read", () => {
		for (const path of [
			"/app/mail",
			"/app/mail/",
			"/app/mail/inbox",
			"/APP/MAIL",
			"/%61pp/%6dail",
			"//app//mail",
			"\\app\\mail",
			"/app/mail;x",
		]) {
			expect(classifyAppPath(path), path).toEqual({ kind: "mail" });
		}
	});

	it("hands the second segment to the id comparison, decoded and with its case", () => {
		for (const [path, segment] of [
			[`/app/${TEST_ADMIN_ID}`, TEST_ADMIN_ID],
			[`/app/${TEST_ADMIN_ID}/`, TEST_ADMIN_ID],
			[`/app/${TEST_ADMIN_ID}/queue`, TEST_ADMIN_ID],
			[`//app//${TEST_ADMIN_ID}//queue`, TEST_ADMIN_ID],
			[`/%61pp/${TEST_ADMIN_ID.replace("3f", "%33f")}`, TEST_ADMIN_ID],
			[`/APP/${TEST_ADMIN_ID}`, TEST_ADMIN_ID],
			[`/app/${TEST_ADMIN_ID};x=1/queue`, TEST_ADMIN_ID],
			[
				`/app/${TEST_ADMIN_ID.toUpperCase()}`,
				TEST_ADMIN_ID.toUpperCase(),
			],
			["/app/queue", "queue"],
			["/app/accounts/alice", "accounts"],
			["/app/a%2fb", "a"],
		] as const) {
			expect(classifyAppPath(path), path).toEqual({
				kind: "admin",
				segment,
			});
		}
	});
});

describe("isMailBodyPath", () => {
	it("matches the framed body route spelled exactly", () => {
		expect(isMailBodyPath("/app/mail/body/abc")).toBe(true);
		expect(
			isMailBodyPath(
				"/app/mail/body/01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
			),
		).toBe(true);
	});

	it("matches nothing else, so any other spelling keeps the panel's headers", () => {
		for (const path of [
			"/app/mail",
			"/app/mail/body",
			"/app/mail/body/",
			"/app/mail/body/a/b",
			"/APP/mail/body/a",
			"/app/Mail/body/a",
			"/app/mail/bodyx/a",
			"//app/mail/body/a",
			"/x/app/mail/body/a",
			"/app/mail/attachment/a/1",
		]) {
			expect(isMailBodyPath(path), path).toBe(false);
		}
	});
});
