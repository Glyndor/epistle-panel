import { afterEach, beforeEach, expect, it } from "bun:test";
import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";

const cookies = mockRequestCookies();
const env = { ...process.env };
const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
const ID = "00000000-0000-4000-8000-0000000000cc";
beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	delete process.env["EPISTLE_PANEL_REMOTE_IMAGES"];
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "test-token";
	await cookies.signIn("admin");
});
afterEach(() => {
	cookies.reset();
	delete process.env["EPISTLE_PANEL_REMOTE_IMAGES"];
	process.env = { ...env };
	clearSecretCache();
	if (fetchDescriptor)
		Object.defineProperty(globalThis, "fetch", fetchDescriptor);
});
const { GET } = await import("./route");

const { bodyResponse } = await import(
	"@/features/mail/responses/body-response"
);
function installBody() {
	stubJmap({
		"Email/get": {
			list: [
				emailFixture({
					id: ID,
					htmlBody: [{ partId: "1", type: "text/html" }],
					bodyValues: {
						"1": {
							value: '<p>body</p><img src="https://image.test/x.png"><script>evil()</script><a href="javascript:evil()">link</a>',
						},
					},
				}),
			],
		},
	});
}
for (const mode of ["ask", "always", "never"] as const)
	for (const requested of [false, true]) {
		it(`${mode} with images=${requested ? "1" : "absent"} enforces HTML and CSP`, async () => {
			cookies.jar.set("remote-images", mode);
			installBody();
			const response = await GET(
				new Request(
					`https://panel.test/app/mail/body/${ID}${requested ? "?images=1" : ""}`,
				),
				{ params: Promise.resolve({ id: ID }) },
			);
			const html = await response.text();
			const allowed = mode === "always" || (mode === "ask" && requested);
			expect(response.status).toBe(200);
			expect(html.includes('src="https://image.test/x.png"')).toBe(
				allowed,
			);
			expect(response.headers.get("content-security-policy")).toContain(
				allowed ? "img-src data: https: http:;" : "img-src data:;",
			);
			expect(html).not.toContain("evil()");
			expect(response.headers.get("cache-control")).toBe(
				"private, no-store",
			);
		});
	}
it("default ask preserves the previous response bytes and headers with and without images=1", async () => {
	installBody();
	for (const requested of [false, true]) {
		const response = await GET(
			new Request(
				`https://panel.test/app/mail/body/${ID}${requested ? "?images=1" : ""}`,
			),
			{ params: Promise.resolve({ id: ID }) },
		);
		const previous = await bodyResponse(ID, requested, null);
		expect(await response.text()).toBe(await previous.text());
		expect([...response.headers]).toEqual([...previous.headers]);
	}
});
it("operator never overrides cookie always and images=1 at the route", async () => {
	process.env["EPISTLE_PANEL_REMOTE_IMAGES"] = "never";
	cookies.jar.set("remote-images", "always");
	installBody();
	const response = await GET(
		new Request(`https://panel.test/app/mail/body/${ID}?images=1`),
		{ params: Promise.resolve({ id: ID }) },
	);
	expect(await response.text()).not.toContain(
		'src="https://image.test/x.png"',
	);
	expect(response.headers.get("content-security-policy")).toContain(
		"img-src data:;",
	);
});
