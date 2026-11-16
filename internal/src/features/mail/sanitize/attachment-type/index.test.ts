import { expect, it } from "bun:test";
import { safeAttachmentType } from ".";

it("falls back for missing attachment MIME", () => {
	for (const type of [null, undefined])
		expect(safeAttachmentType(type)).toBe("application/octet-stream");
});
it("neutralizes every named active MIME", () => {
	for (const type of [
		"text/html",
		"text/html-sandboxed",
		"application/xhtml",
		"application/xhtml+xml",
		"image/svg",
		"image/svg+xml",
		"text/xml",
		"application/xml",
		"text/xsl",
		"application/xslt+xml",
		"text/javascript",
		"application/javascript",
		"text/ecmascript",
		"application/ecmascript",
	]) {
		expect([type, safeAttachmentType(type)]).toEqual([
			type,
			"application/octet-stream",
		]);
	}
});
it("neutralizes every WHATWG JavaScript MIME alias, with or without parameters", () => {
	for (const type of [
		"application/x-javascript",
		"text/x-javascript",
		"text/jscript",
		"text/livescript",
		"text/javascript1.0",
		"text/javascript1.1",
		"text/javascript1.2",
		"text/javascript1.3",
		"text/javascript1.4",
		"text/javascript1.5",
		"application/x-ecmascript",
		"text/x-ecmascript",
		"text/javascript;charset=utf-8",
		"text/javascript; charset=utf-8",
		"application/x-javascript;charset=utf-8",
	]) {
		expect([type, safeAttachmentType(type)]).toEqual([
			type,
			"application/octet-stream",
		]);
	}
});
it("keeps the types it did not change", () => {
	expect(safeAttachmentType("application/x-httpd-php")).toBe(
		"application/x-httpd-php",
	);
});
it("neutralizes an unlisted structured XML suffix", () => {
	expect(safeAttachmentType("application/vnd.example+xml")).toBe(
		"application/octet-stream",
	);
});
it("preserves ordinary MIME including non-XML structured suffixes", () => {
	for (const type of [
		"application/pdf",
		"image/png",
		"application/zip",
		"text/plain",
		"text/csv",
		"message/rfc822",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/ld+json",
		"application/xmlish",
	]) {
		expect(safeAttachmentType(type)).toBe(type);
	}
});
it("neutralizes malformed MIME without normalizing the claim", () => {
	for (const type of [
		"",
		"text",
		"text/",
		"/plain",
		"text/plain; charset=utf-8",
		"text/plain\n",
		"text/pla\0in",
		"text/plain\r\nX-Evil: yes",
		" text/plain",
		"text/plain ",
		"TEXT/PLAIN",
		`text/${"a".repeat(102)}`,
		`${"a".repeat(62)}/plain`,
	]) {
		expect([type, safeAttachmentType(type)]).toEqual([
			type,
			"application/octet-stream",
		]);
	}
});
