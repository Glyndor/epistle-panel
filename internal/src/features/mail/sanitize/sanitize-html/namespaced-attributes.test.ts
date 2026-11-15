import { expect, it } from "bun:test";
import { sanitizeHtml } from ".";

// Audit 14: parse5 preserves the colon on HTML attributes.
it("drops xlink attributes without shadowing the ordinary safe href or src", () => {
	const { html, blockedImages } = sanitizeHtml(
		'<a href="https://ok.test/" xlink:href="javascript:alert(1)" xlink:title="shadow">link</a><img xlink:src="https://evil.test/x.png" alt="hidden"><img src="https://ok.test/x.png" xlink:src="https://evil.test/y.png">',
		{ remoteImages: true },
	);
	expect(html).toContain('href="https://ok.test/"');
	expect(html).toContain('src="https://ok.test/x.png"');
	expect(html).toContain("<span>hidden</span>");
	expect(html).not.toMatch(/xlink|javascript|evil.test|shadow/);
	expect((html.match(/<img /g) ?? []).length).toBe(1);
	expect(blockedImages).toBe(0);
});
