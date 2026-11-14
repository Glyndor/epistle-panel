import { describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";

import { proxy } from "./proxy";

/**
 * The mail area in the proxy: which paths under `/app/mail` are routes, and
 * where an address from before a folder was a path is sent. Beside
 * `proxy.test.ts`, which holds the admin area and the headers.
 */
describe("proxy: the mail area", () => {
	// Any UUID the page reads as a message's id.
	const ID = TEST_ADMIN_ID;
	// happy-dom's `Headers` drops `cookie` as a forbidden header, so the
	// cookie is set through the request's own jar instead of a header.
	const request = (cookie: string | undefined, path: string) => {
		const req = new NextRequest(`http://panel.test${path}`);
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return req;
	};
	const user = () => createSession("ana", "user");

	/** Whether the proxy hid the request: a rewrite to the one fixed 404 path. */
	const isHidden = (response: Response) =>
		response.status === 200 &&
		/^http:\/\/panel\.test\/__not-found__\/?$/.test(
			response.headers.get("x-middleware-rewrite") ?? "",
		);

	it("lets a session into the routes of the mail area and hides what is none, with the one 404", async () => {
		const cookie = await user();
		for (const path of [
			"/app/mail/inbox",
			"/app/mail/folder/Work_2FQ4",
			`/app/mail/trash/${ID}`,
			"/app/mail/compose",
		]) {
			expect([
				path,
				isHidden(await proxy(request(cookie, path))),
			]).toEqual([path, false]);
		}
		for (const path of [
			"/app/mail/no-such-place",
			"/app/mail/Inbox",
			"/app/mail/label/Work",
			"/app/mail/inbox/not-an-id",
			// Shaped like an id, but not one the page reads: the page would answer 200.
			"/app/mail/inbox/11111111-1111-1111-1111-111111111111",
			"/app/mail/folder/Work%2FQ4",
			"/app/mail/folder/Work_2fQ4",
			"/app/mail/folder/a_00b",
			"/APP/MAIL/inbox",
		]) {
			const response = await proxy(request(cookie, path));
			expect([path, isHidden(response)]).toEqual([path, true]);
			// Hidden, never a redirect that would tell it apart from any other path.
			expect(response.headers.get("location")).toBeNull();
		}
	});

	it("redirects an address from before a folder was a path, for a session, with a real 307", async () => {
		const cookie = await user();
		const cases = [
			["/app/mail?box=Archive", "/app/mail/folder/Archive", ""],
			[
				`/app/mail?box=Work%2FQ4&page=2&filter=unread&q=a+b&msg=${ID}`,
				`/app/mail/folder/Work_2FQ4/${ID}`,
				"?page=2&filter=unread&q=a+b",
			],
			[`/app/mail/?msg=${ID}`, `/app/mail/inbox/${ID}`, ""],
		] as const;
		for (const [path, pathname, search] of cases) {
			const response = await proxy(request(cookie, path));
			expect([path, response.status]).toEqual([path, 307]);
			const to = new URL(response.headers.get("location") ?? "");
			expect([to.origin, to.pathname, to.search]).toEqual([
				"http://panel.test",
				pathname,
				search,
			]);
			// The redirect carries the panel's headers like any other response.
			expect(response.headers.get("content-security-policy")).toContain(
				"frame-ancestors 'none'",
			);
		}
	});

	it("redirects an old address nowhere but into the mail area", async () => {
		const cookie = await user();
		for (const box of [
			"//evil.example",
			"https://evil.example/",
			"../../..",
			"@evil.example",
			"/\\evil.example",
		]) {
			const response = await proxy(
				request(cookie, `/app/mail?box=${encodeURIComponent(box)}`),
			);
			expect([box, response.status]).toEqual([box, 307]);
			const to = new URL(response.headers.get("location") ?? "");
			expect([box, to.origin]).toEqual([box, "http://panel.test"]);
			expect([box, to.pathname.startsWith("/app/mail/folder/")]).toEqual([
				box,
				true,
			]);
			expect([box, to.pathname.split("/").length]).toEqual([box, 5]);
		}
	});

	it("does not redirect what names no folder and no message, another page, a form post, or a visitor with no session", async () => {
		const cookie = await user();
		for (const path of [
			"/app/mail",
			"/app/mail?page=2&filter=unread&q=x",
			"/app/mail?box=a%0Ab&msg=nope",
			"/app/mail/inbox?box=Sent",
			"/app/mail/compose?msg=" + ID,
		]) {
			const response = await proxy(request(cookie, path));
			expect([path, response.headers.get("location")]).toEqual([
				path,
				null,
			]);
			expect([path, isHidden(response)]).toEqual([path, false]);
		}
		// A Server Action posted to the home is the action, whatever its query.
		const post = new NextRequest("http://panel.test/app/mail?box=Sent", {
			method: "POST",
		});
		post.cookies.set(SESSION_COOKIE, cookie);
		const posted = await proxy(post);
		expect(posted.headers.get("location")).toBeNull();
		expect(isHidden(posted)).toBe(false);
		// Without a session the old address says nothing of where it would lead.
		const anonymous = await proxy(request(undefined, "/app/mail?box=Sent"));
		expect(anonymous.status).toBe(307);
		const to = new URL(anonymous.headers.get("location") ?? "");
		expect([to.pathname, to.search]).toEqual(["/", ""]);
	});

	it("still sends any path under the mail area to the sign-in page without a session", async () => {
		for (const path of [
			"/app/mail/inbox",
			"/app/mail/no-such-place",
			"/app/mail/folder/Work%2FQ4",
		]) {
			const response = await proxy(request(undefined, path));
			expect([path, response.status]).toEqual([path, 307]);
			expect(
				new URL(response.headers.get("location") ?? "").pathname,
			).toBe("/");
		}
	});
});
