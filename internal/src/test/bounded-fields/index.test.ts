import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * The first of a field's three checks is the browser's own, from the field's
 * attributes; the form's schema and the server are the other two. A field with
 * no `maxLength` leaves that first check out, and lets a paste of any size
 * into the page before the schema ever sees it. So every field a person types
 * into declares its length, from the same constant its schema holds.
 */
const FIELD = /<(Input|Textarea|MailTextarea)\b[\s\S]*?\/>/g;

/** Fields that hold no typed text. */
const NOT_TEXT = /type="(?:file|hidden|checkbox)"/;

/** A component that wraps a field and hands on what it was given: its caller declares the length. */
const FORWARDS = /\{\.\.\.props\}/;

/** Production components outside `components/ui`: the files that use a field, not the ones that define it. */
function composingFiles(): string[] {
	return Array.from(new Bun.Glob("**/*.tsx").scanSync(SRC))
		.filter(
			(file) =>
				!file.startsWith("components/ui/") &&
				!file.startsWith("test/") &&
				!file.includes("/test-support/") &&
				!file.endsWith(".test.tsx"),
		)
		.sort();
}

/** The source with comments taken out, so a sentence that names a field is not a use of it. */
function code(file: string): string {
	return readFileSync(join(SRC, file), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");
}

/** The typed-text fields of a source that declare no length. */
function unbounded(source: string): string[] {
	return (source.match(FIELD) ?? []).filter(
		(field) =>
			!NOT_TEXT.test(field) &&
			!FORWARDS.test(field) &&
			!/\bmaxLength=/.test(field),
	);
}

describe("every field a person types into is bounded in the page", () => {
	it("no text field is left without a maxLength", () => {
		const found: string[] = [];
		let fields = 0;
		for (const file of composingFiles()) {
			const source = code(file);
			fields += (source.match(FIELD) ?? []).length;
			for (const field of unbounded(source)) {
				found.push(
					`${file}: ${field.replace(/\s+/g, " ").slice(0, 60)}`,
				);
			}
		}

		expect(found).toEqual([]);
		// It reads the screens: the forms of the panel hold more fields than this.
		expect(fields).toBeGreaterThan(10);
	});

	it("finds a field with no length, and leaves alone one that has it or holds no text", () => {
		expect(
			unbounded('<Input {...field} type="text" autoComplete="off" />'),
		).toHaveLength(1);
		expect(
			unbounded("<MailTextarea\n\t{...field}\n\trows={12}\n/>"),
		).toHaveLength(1);
		expect(
			unbounded('<Input {...field} type="text" maxLength={NAME_MAX} />'),
		).toEqual([]);
		expect(
			unbounded(
				"<Textarea className={cn(tall, className)} {...props} />",
			),
		).toEqual([]);
		expect(
			unbounded('<Input type="file" multiple onChange={pick} />'),
		).toEqual([]);
	});
});
