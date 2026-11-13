import { describe, expect, it } from "bun:test";

import { plainTextOf } from ".";

describe("plainTextOf", () => {
	it("turns blocks and breaks into lines and drops the tags", () => {
		expect(
			plainTextOf(
				"<p>Hello <b>there</b></p><p>Line<br>two</p><ul><li>a</li><li>b</li></ul>",
			),
		).toBe("Hello there\nLine\ntwo\na\nb");
	});

	it("decodes the entities the sanitiser writes and never leaves markup behind", () => {
		expect(
			plainTextOf("<p>1 &lt; 2 &amp; 3 &gt; 2 &quot;q&quot;</p>"),
		).toBe('1 < 2 & 3 > 2 "q"');
		const hostile = plainTextOf(
			'<script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:x">t</a><p>ok</p>',
		);
		expect(hostile).toBe("tok");
		expect(hostile).not.toMatch(/<|alert/u);
	});

	it("keeps text a sender wrote as escaped markup as text, and nests blocks", () => {
		expect(plainTextOf("<p>&lt;script&gt;x&lt;/script&gt;</p>")).toBe(
			"<script>x</script>",
		);
		expect(
			plainTextOf("<blockquote><div>a<br>b</div><div>c</div></blockquote>"),
		).toBe("a\nb\nc");
	});

	it("removes bidi controls and collapses runs of blank lines", () => {
		expect(plainTextOf("<p>a‮b</p><br><br><br><br><p>c</p>")).toBe(
			"ab\n\nc",
		);
	});

	it("is empty for nothing", () => {
		expect(plainTextOf("")).toBe("");
		expect(plainTextOf("<script>x</script>")).toBe("");
	});
});
