import { describe, expect, it } from "bun:test";
import { cursorFailures, RULES } from "./base";
import { contentFailures, selectionFailures } from "./selection";
import { elements, productionFiles, read } from "./source";
import { utilityFailures } from "./utilities";

/** Each exception identifies one part, never an entire file, and explains why. */
const ALLOWLIST: Readonly<Record<string, string>> = {
	"components/ui/alert-dialog/index.tsx:29 <AlertDialogPrimitive.Trigger>: missing select-none in base classes":
		"Existing unstyled asChild adapter; callers supply the shared Button. Retained by this test-only change; give the adapter its own base before removing this exception.",
	"components/ui/dialog/index.tsx:29 <DialogPrimitive.Trigger>: missing select-none in base classes":
		"Existing unstyled asChild adapter; callers supply the shared Button. Retained by this test-only change; give the adapter its own base before removing this exception.",
	"components/ui/dialog/index.tsx:36 <DialogPrimitive.Close>: missing select-none in base classes":
		"Existing unstyled asChild close adapter delegates chrome to its child. Retained by this test-only change; its styled close button has a separate exception.",
	"components/ui/dropdown-menu/index.tsx:34 <DropdownMenuPrimitive.Trigger>: missing select-none in base classes":
		"Existing unstyled asChild menu adapter delegates to Button or SidebarMenuButton. Retained by this test-only change; new adapters need their own base or a reviewed exception.",
	"components/ui/breadcrumb/index.tsx:48 <Comp>: missing select-none in base classes":
		"Existing breadcrumb links can display message subjects and folder names; keep these data labels copyable until the breadcrumb selection policy is decided.",
	"components/ui/dialog/index.tsx:73 <DialogPrimitive.Close>: missing select-none in base classes":
		"Legacy icon close control omitted by the two rule commits. Retained by this test-only change; migrate its chrome to Button and remove this exception.",
	"components/ui/sheet/index.tsx:118 <button>: missing select-none in base classes":
		"Legacy sheet close control omitted by the two rule commits. Retained by this test-only change; migrate its chrome to Button and remove this exception.",
	"components/ui/radio-group/index.tsx:36 <RadioGroupPrimitive.Item>: missing select-none in base classes":
		"The existing radio draws only an indicator; its text is in the separate Label with select-none. An item that starts rendering text needs its own selection base.",
	"components/layout/skip-link/index.tsx:8 <a>: missing select-none in base classes":
		"Legacy keyboard skip link omitted by the two rule commits. Retained by this test-only change; add its own selection class when this control is migrated.",
	"components/layout/trail/index.tsx:102 <Link>: missing select-none in base classes":
		"Breadcrumb content can be a message subject or folder name; matches the explicit BreadcrumbLink content exception rather than disabling selection of those data labels.",
	"features/accounts/components/accounts-table/index.tsx:31 <Link>: missing select-none in base classes":
		"The linked account name is a table value and identifier; the content rule requires it to remain copyable even though it also navigates.",
	"features/mail/components/attachment-list/index.tsx:43 <a>: missing select-none in base classes":
		"The download link contains the original attachment filename and size; these message data values remain copyable in the reader.",
};

function unexcused(failures: string[]): string[] {
	return failures.filter((failure) => !(failure in ALLOWLIST));
}

const files = productionFiles();
const uiFiles = files.filter(
	(file) => file.startsWith("components/ui/") && file.endsWith(".tsx"),
);
const composingFiles = files.filter(
	(file) =>
		/^(features\/|components\/layout\/)/.test(file) &&
		file.endsWith(".tsx"),
);
const contentFiles = [
	"features/mail/components/body-view/index.tsx",
	"features/mail/components/body-frame/index.tsx",
	"features/mail/components/reader-header/index.tsx",
	"features/mail/components/reader-header/addresses/index.tsx",
	"components/ui/table/index.tsx",
	"components/data-table/index.tsx",
	"components/error-notice/index.tsx",
	"components/ui/alert/index.tsx",
];

describe("the cursor and selection rule (docs/maintainers/cursor-and-selection.md)", () => {
	it("keeps every documented cursor selector and its precedence in @layer base", () => {
		expect(cursorFailures(read("app/globals.css"))).toEqual([]);
	});

	it("shared interactive parts carry select-none in their own base classes", () => {
		expect(
			unexcused(
				uiFiles.flatMap((file) =>
					selectionFailures(file, read(file), true),
				),
			),
		).toEqual([]);
	});

	it("hand-made controls carry select-none or compose a guarded shared part", () => {
		expect(
			unexcused(
				composingFiles.flatMap((file) =>
					selectionFailures(file, read(file), false),
				),
			),
		).toEqual([]);
	});

	it("reader content, addresses, table values and errors stay selectable", () => {
		expect(
			contentFiles.flatMap((file) => contentFailures(file, read(file))),
		).toEqual([]);
	});

	it("interactive parts leave hover pointer and default cursors to the base layer", () => {
		expect(
			unexcused(
				[...uiFiles, ...composingFiles].flatMap((file) =>
					utilityFailures(file, read(file)),
				),
			),
		).toEqual([]);
	});

	it("walks production sources and includes the named shared parts and content cells", () => {
		expect(composingFiles.length).toBeGreaterThan(80);
		for (const part of [
			"button",
			"badge",
			"sidebar/menu",
			"tooltip",
			"collapsible",
		])
			expect(uiFiles).toContain(`components/ui/${part}/index.tsx`);
		expect(
			elements(read("components/ui/table/index.tsx")).some(
				(element) => element.tag === "td",
			),
		).toBe(true);
	});

	it("every exception has a written reason and still needs it", () => {
		const failures = [
			...uiFiles.flatMap((file) =>
				selectionFailures(file, read(file), true),
			),
			...composingFiles.flatMap((file) =>
				selectionFailures(file, read(file), false),
			),
			...[...uiFiles, ...composingFiles].flatMap((file) =>
				utilityFailures(file, read(file)),
			),
		];
		for (const [failure, reason] of Object.entries(ALLOWLIST)) {
			expect(reason.trim().length).toBeGreaterThan(20);
			expect(failures).toContain(failure);
		}
	});

	it("control: all base rules can fail, including either wait rule and a missing selector", () => {
		const css = read("app/globals.css");
		for (const [, cursor] of RULES)
			expect(
				cursorFailures(
					css.replaceAll(`cursor: ${cursor};`, "cursor: auto;"),
				).length,
			).toBeGreaterThan(0);
		expect(
			cursorFailures(css.replace("a[href],", "")).length,
		).toBeGreaterThan(0);
		expect(
			cursorFailures(css.replace("@layer base", "@layer utilities"))
				.length,
		).toBeGreaterThan(0);
	});
});
