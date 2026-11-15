import { expect, it } from "bun:test";
import { legacyMailTarget } from ".";

// Audit 16: query delimiters must stay data through the legacy redirect.
it.each(["a&page=9", "a#fragment", "a%26page%3D9", "a=q&filter=unread"])(
	"encodes %s as one q value",
	(q) => {
		const target = legacyMailTarget(
			"/app/mail",
			new URLSearchParams({ box: "Sent", q }),
		);
		expect(target).not.toBeNull();
		const url = new URL(target ?? "", "https://panel.test");
		expect([...url.searchParams]).toEqual([["q", q]]);
		expect(url.hash).toBe("");
		expect(url.search).toBe(`?${new URLSearchParams({ q })}`);
		expect(url.origin).toBe("https://panel.test");
	},
);
