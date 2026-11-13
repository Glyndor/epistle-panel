import { describe, expect, it } from "bun:test";

import {
	attachmentDisposition,
	FALLBACK_FILENAME,
	MAX_FILENAME_LENGTH,
	safeFilename,
} from ".";

describe("safeFilename", () => {
	it("keeps an ordinary name", () => {
		expect(safeFilename("Quarterly report 2026.pdf")).toBe(
			"Quarterly report 2026.pdf",
		);
		expect(safeFilename("café-menú.txt")).toBe("café-menú.txt");
	});

	it("keeps only the last path segment so a name is never a path", () => {
		expect(safeFilename("../../etc/passwd")).toBe("passwd");
		expect(safeFilename("C:\\Windows\\system32\\cmd.exe")).toBe("cmd.exe");
		expect(safeFilename("a/b/c.txt")).toBe("c.txt");
		expect(safeFilename("..")).toBe(FALLBACK_FILENAME);
		expect(safeFilename("/")).toBe(FALLBACK_FILENAME);
	});

	it("replaces what a shell or a header gives a meaning to", () => {
		expect(safeFilename('a"b;c`d$e&f|g<h>i%j.txt')).toBe(
			"a_b_c_d_e_f_g_h_i_j.txt",
		);
	});

	it("takes out bidi controls, controls and line breaks so the extension cannot be disguised", () => {
		expect(safeFilename("photo\u202Egpj.exe")).toBe("photogpj.exe");
		expect(safeFilename("a\r\nContent-Type: text/html\r\n.txt")).toBe(
			"html .txt",
		);
		expect(safeFilename("a\u0000b.txt")).toBe("a b.txt");
	});

	it("strips leading and trailing dots and spaces", () => {
		expect(safeFilename(" .hidden. ")).toBe("hidden");
		expect(safeFilename("...")).toBe(FALLBACK_FILENAME);
	});

	it("refuses a device name, with or without an extension", () => {
		for (const name of ["CON", "nul.txt", "com1", "LPT9.log", "aux"]) {
			expect(safeFilename(name)).toBe(FALLBACK_FILENAME);
		}
		expect(safeFilename("console.txt")).toBe("console.txt");
	});

	it("falls back when there is nothing usable", () => {
		expect(safeFilename(null)).toBe(FALLBACK_FILENAME);
		expect(safeFilename(undefined)).toBe(FALLBACK_FILENAME);
		expect(safeFilename("")).toBe(FALLBACK_FILENAME);
		expect(safeFilename("\u202E\u0000")).toBe(FALLBACK_FILENAME);
	});

	it("shortens a long name and keeps its extension", () => {
		const name = safeFilename(`${"a".repeat(500)}.pdf`);
		expect(name).toHaveLength(MAX_FILENAME_LENGTH);
		expect(name.endsWith(".pdf")).toBe(true);
		expect(safeFilename("b".repeat(500))).toHaveLength(MAX_FILENAME_LENGTH);
		expect(
			safeFilename(`${"c".repeat(300)}.${"d".repeat(40)}`),
		).toHaveLength(MAX_FILENAME_LENGTH);
	});
});

describe("attachmentDisposition", () => {
	it("is always an attachment, with an ASCII fallback and the exact UTF-8 name", () => {
		expect(attachmentDisposition("report.pdf")).toBe(
			"attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf",
		);
		expect(attachmentDisposition("café.txt")).toBe(
			"attachment; filename=\"caf_.txt\"; filename*=UTF-8''caf%C3%A9.txt",
		);
	});
});
