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
// Audit 12: both dynamic parameters must reach the download handler.
it("awaits the id and part and downloads only that listed attachment", async () => {
	const seen = stubJmap(
		{
			"Email/get": {
				list: [
					emailFixture({
						id: ID,
						attachments: [
							{
								partId: "2",
								blobId: "blob-2",
								name: "report.pdf",
								type: "application/pdf",
								size: 5,
							},
						],
					}),
				],
			},
		},
		new Response("hello", { headers: { "content-length": "5" } }),
	);
	const response = await GET({} as Request, {
		params: Promise.resolve({ id: ID, part: "2" }),
	});
	expect(response.status).toBe(200);
	expect(await response.text()).toBe("hello");
	expect(response.headers.get("content-disposition")).toContain("report.pdf");
	expect(seen[0]?.calls[0]?.[1]["ids"]).toEqual([ID]);
	expect(seen[1]?.url).toContain("blob-2");
});
it("refuses invalid id and part without fetching anything", async () => {
	const seen = stubJmap({});
	for (const [id, part] of [
		["../x", "2"],
		[ID, "../2"],
		[ID, ""],
	])
		expect(
			(
				await GET({} as Request, {
					params: Promise.resolve({ id: id ?? "", part: part ?? "" }),
				})
			).status,
		).toBe(404);
	expect(seen).toHaveLength(0);
});
