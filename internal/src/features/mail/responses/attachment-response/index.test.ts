import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { stubFetchResponse } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { attachmentResponse, forcedType, MAX_ATTACHMENT_BYTES } = await import(
	"."
);

const ID = "00000000-0000-4000-8000-0000000000dd";
const withAttachment = (extra: Record<string, unknown>) =>
	emailFixture({
		id: ID,
		attachments: [
			{
				partId: "2",
				blobId: `${ID}.2`,
				type: "application/pdf",
				name: "report.pdf",
				size: 5,
				...extra,
			},
		],
	});

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "operator-token";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

describe("forcedType", () => {
	it("keeps a type that cannot be rendered as a page and forces the rest to octet-stream", () => {
		expect(forcedType("application/pdf")).toBe("application/pdf");
		expect(forcedType("IMAGE/PNG; name=a.png")).toBe("image/png");
		expect(forcedType("text/plain; charset=utf-8")).toBe("text/plain");
		for (const hostile of [
			"text/html",
			"image/svg+xml",
			"application/xhtml+xml",
			"text/xml",
			"application/xml",
			"text/javascript",
			"application/javascript",
			"application/x-shockwave-flash",
			"message/rfc822",
			"",
			null,
			undefined,
			"garbage",
		]) {
			expect(forcedType(hostile)).toBe("application/octet-stream");
		}
	});
});

describe("attachmentResponse", () => {
	it("sends the file as an attachment, with a clean name and a type that is not rendered", async () => {
		const seen = stubJmap(
			{ "Email/get": { list: [withAttachment({})] } },
			new Response("hello", { headers: { "content-type": "text/html" } }),
		);

		const response = await attachmentResponse(ID, "2");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello");
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toBe(
			"attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf",
		);
		expect(response.headers.get("content-length")).toBe("5");
		// The proxy sets the panel's policy on this route; a policy set here would be replaced.
		expect(response.headers.get("content-security-policy")).toBeNull();
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(seen.at(-1)?.url).toBe(
			`http://127.0.0.1:8025/jmap/download/admin/${ID}.2/blob`,
		);
	});

	it("downloads the blob the message lists for that part, not one built from the ids", async () => {
		const listedBlob = "00000000-0000-4000-8000-0000000000ee";
		const seen = stubJmap(
			{ "Email/get": { list: [withAttachment({ blobId: listedBlob })] } },
			new Response("hello"),
		);

		const response = await attachmentResponse(ID, "2");

		expect(response.status).toBe(200);
		expect(seen.at(-1)?.url).toBe(
			`http://127.0.0.1:8025/jmap/download/admin/${listedBlob}/blob`,
		);
	});

	it("never serves a hostile file inline: HTML and SVG become octet-stream downloads", async () => {
		for (const type of [
			"text/html",
			"image/svg+xml",
			"application/xhtml+xml",
		]) {
			stubJmap(
				{
					"Email/get": {
						list: [withAttachment({ type, name: "x.html" })],
					},
				},
				new Response("<script>alert(1)</script>"),
			);
			const response = await attachmentResponse(ID, "2");
			expect(response.headers.get("content-type")).toBe(
				"application/octet-stream",
			);
			expect(response.headers.get("content-disposition")).toStartWith(
				"attachment;",
			);
		}
	});

	it("cleans a traversal, a quote, a bidi override and a line break out of the name", async () => {
		stubJmap(
			{
				"Email/get": {
					list: [
						withAttachment({
							name: '../../x"\r\nSet-Cookie: a=b‮gpj.exe',
						}),
					],
				},
			},
			new Response("x"),
		);
		const response = await attachmentResponse(ID, "2");
		const disposition = response.headers.get("content-disposition") ?? "";
		expect(disposition).not.toMatch(/[\r\n"]\S*Set-Cookie|\.\.|‮/u);
		expect(disposition).toStartWith('attachment; filename="');
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("serves only a part the message lists as an attachment", async () => {
		stubJmap(
			{ "Email/get": { list: [withAttachment({})] } },
			new Response("x"),
		);
		expect((await attachmentResponse(ID, "1")).status).toBe(404);
		expect((await attachmentResponse(ID, "9")).status).toBe(404);
		stubJmap(
			{ "Email/get": { list: [withAttachment({ blobId: null })] } },
			new Response("x"),
		);
		expect((await attachmentResponse(ID, "2")).status).toBe(404);
		stubJmap({ "Email/get": { list: [] } });
		expect((await attachmentResponse(ID, "2")).status).toBe(404);
	});

	it("refuses a hostile id or part without asking JMAP", async () => {
		const seen = stubJmap({});
		for (const [id, part] of [
			["x", "2"],
			[ID, "../2"],
			[ID, "2/.."],
			[ID, ""],
			[`${ID}.2`, "2"],
			[ID, "1234567"],
		] as const) {
			expect((await attachmentResponse(id, part)).status).toBe(404);
		}
		expect(seen).toHaveLength(0);
	});

	it("is a 401 without a session", async () => {
		cookies.reset();
		const seen = stubJmap({});
		expect((await attachmentResponse(ID, "2")).status).toBe(401);
		expect(seen).toHaveLength(0);
	});

	it("answers 404 when the blob is gone and 502 when the download fails or is too large", async () => {
		stubJmap({ "Email/get": { list: [withAttachment({})] } });
		expect((await attachmentResponse(ID, "2")).status).toBe(404);
		stubJmap(
			{ "Email/get": { list: [withAttachment({})] } },
			new Response("x", {
				headers: { "content-length": String(MAX_ATTACHMENT_BYTES + 1) },
			}),
		);
		expect((await attachmentResponse(ID, "2")).status).toBe(502);
		stubJmap(
			{ "Email/get": { list: [withAttachment({})] } },
			new Response("no", { status: 500 }),
		);
		expect((await attachmentResponse(ID, "2")).status).toBe(502);
		stubFetchResponse(new Response("no", { status: 500 }));
		expect((await attachmentResponse(ID, "2")).status).toBe(502);
	});
});
