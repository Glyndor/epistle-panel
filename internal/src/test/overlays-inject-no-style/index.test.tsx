import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet } from "@/components/ui/sheet";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { queueEntryIdSchema } from "@/features/queue/schemas/queue-input";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

/**
 * The panel's CSP has no `style-src-elem 'unsafe-inline'`, so an overlay that
 * injects a `<style>` element when it opens (Radix's modal scroll lock does)
 * is refused by the browser and breaks. Each overlay the panel has is opened
 * here and must leave `document.head` as it found it; a new overlay goes in
 * this file. The last test is the control: a modal Radix menu does inject one,
 * so a green result above means something.
 */
const cookies = mockRequestCookies();
const { LanguageMenu } = await import("@/components/layout/language-menu");
const { RemoveEntryButton } = await import(
	"@/features/queue/components/remove-entry-button"
);

const originalConfirm = window.confirm;
afterEach(() => {
	cleanup();
	window.confirm = originalConfirm;
});

const styleElements = () => document.head.querySelectorAll("style").length;

describe("overlays and the CSP", () => {
	it("the language menu adds no style element when opened", async () => {
		const before = styleElements();
		render(
			<SidebarProvider>
				<LanguageMenu defaultOpen={false} />
			</SidebarProvider>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: /language/ }), {
			key: "Enter",
		});
		await screen.findByRole("menu");

		expect(styleElements()).toBe(before);
		expect(document.body).not.toHaveAttribute("data-scroll-locked");
	});

	it("the sheet adds no style element when opened, and none while open", () => {
		const before = styleElements();
		const view = render(
			<Sheet
				open={false}
				onOpenChange={() => {}}
				title="Menu"
				description="Pages"
				closeLabel="Shut"
			>
				<p>content</p>
			</Sheet>,
		);
		view.rerender(
			<Sheet
				open
				onOpenChange={() => {}}
				title="Menu"
				description="Pages"
				closeLabel="Shut"
			>
				<p>content</p>
			</Sheet>,
		);

		expect(
			(view.container.querySelector("dialog") as HTMLDialogElement).open,
		).toBe(true);
		expect(styleElements()).toBe(before);
		expect(document.body).not.toHaveAttribute("data-scroll-locked");
	});

	it("the remove confirmation is the browser's own and adds no style element", async () => {
		await cookies.signIn();
		const confirm = mock(() => false);
		window.confirm = confirm;
		const before = styleElements();
		render(
			withQuery(
				<RemoveEntryButton
					id={queueEntryIdSchema.parse(
						"01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
					)}
					recipients="r@x"
					cursor={undefined}
				/>,
				testQueryClient(),
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "removeLabel" }));

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(styleElements()).toBe(before);
	});

	it("control: a modal Radix menu does inject one, so the checks above can fail", async () => {
		const before = styleElements();
		render(
			<DropdownMenu modal>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuLabel>One</DropdownMenuLabel>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), {
			key: "Enter",
		});
		await screen.findByRole("menu");

		expect(styleElements()).toBeGreaterThan(before);
	});
});
