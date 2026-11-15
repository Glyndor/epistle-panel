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
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "test-token";
	await cookies.signIn("admin");
});
afterEach(() => {
	cookies.reset();
	process.env = { ...env };
	clearSecretCache();
	if (fetchDescriptor)
		Object.defineProperty(globalThis, "fetch", fetchDescriptor);
});
const { GET } = await import("./route");
// Audit 12: exercise the route adapter, not only bodyResponse.
it("awaits params and forwards only images=1 and the theme value", async () => {
	for (const [query, images, theme] of [
		["images=1&theme=dark", true, "dark"],
		["images=true&theme=", false, "light dark"],
		["images=0&theme=light", false, "light"],
		["", false, "light dark"],
	] as const) {
		const seen = stubJmap({
			"Email/get": {
				list: [
					emailFixture({
						id: ID,
						htmlBody: [{ partId: "1", type: "text/html" }],
						bodyValues: {
							"1": {
								value: '<p>body</p><img src="https://image.test/x.png">',
							},
						},
					}),
				],
			},
		});
		const response = await GET(
			{
				url: `https://panel.test/app/mail/body/${ID}?${query}`,
			} as Request,
			{ params: Promise.resolve({ id: ID }) },
		);
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(html.includes('src="https://image.test/x.png"')).toBe(images);
		expect(html).toContain(`name="color-scheme" content="${theme}"`);
		expect(seen.flatMap((r) => r.calls)[0]?.[1]["ids"]).toEqual([ID]);
	}
});
it("refuses malformed params before JMAP", async () => {
	const seen = stubJmap({});
	for (const id of ["../x", "x", ""])
		expect(
			(
				await GET({ url: "https://panel.test/" } as Request, {
					params: Promise.resolve({ id }),
				})
			).status,
		).toBe(404);
	expect(seen).toHaveLength(0);
});
