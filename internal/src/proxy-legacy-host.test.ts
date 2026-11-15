import { expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { proxy } from "./proxy";

// Audit 20: proxy logic, supplemented by the real HTTP legacy-host scenario.
it("derives the legacy redirect from nextUrl.origin despite both hostile host headers", async () => {
	const request = new NextRequest(
		"https://panel.test/app/mail?box=Sent&q=a%26page%3D9",
	);
	request.headers.set("host", "evil.test");
	request.headers.set("x-forwarded-host", "evil.test");
	request.cookies.set(
		SESSION_COOKIE,
		await createSession("host-audit", "user"),
	);
	const response = await proxy(request);
	expect(response.status).toBe(307);
	expect(response.headers.get("location")).toBe(
		"https://panel.test/app/mail/folder/Sent?q=a%26page%3D9",
	);
});
