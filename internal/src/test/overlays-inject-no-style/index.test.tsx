import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { setNonce } from "get-nonce";
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
import { withAdminArea } from "@/test/admin-routes";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

/**
 * The panel's CSP has no `'unsafe-inline'`: a `<style>` element is accepted only
 * with the request's nonce (`style-src-elem 'self' 'nonce-…'`). An overlay that
 * injects one when it opens (Radix's modal scroll lock does) is refused unless
 * `StyleNonce` handed the nonce to the library. The menu and the sheet must
 * leave `document.head` as they found it; the alert dialog may add a style
 * element only with the nonce. A new overlay goes in this file. The last test
 * is the control: a modal Radix menu does inject one, so a green result above
 * means something.
 */
const cookies = mockRequestCookies();
const { LanguageMenu } = await import("@/components/layout/language-menu");
const { RemoveEntryButton } = await import(
	"@/features/queue/components/remove-entry-button"
);
const { CreateAccountDialog } = await import(
	"@/features/accounts/components/create-account-dialog"
);
const { AccountRowActions } = await import(
	"@/features/accounts/components/account-row-actions"
);

afterEach(() => {
	cleanup();
	setNonce("");
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

	it("the remove confirmation injects a style element only with the request's nonce", async () => {
		await cookies.signIn();
		setNonce("request-nonce");
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
		await screen.findByRole("alertdialog");

		const styles = [...document.head.querySelectorAll("style")];
		expect(styles.length).toBeGreaterThan(0);
		for (const style of styles) {
			expect(style.getAttribute("nonce")).toBe("request-nonce");
		}
	});

	it("without the nonce the same dialog injects a style element the policy would refuse", async () => {
		await cookies.signIn();
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
		await screen.findByRole("alertdialog");

		const styles = [...document.head.querySelectorAll("style")];
		expect(styles.some((style) => !style.getAttribute("nonce"))).toBe(true);
	});

	it("the new-account dialog injects a style element only with the request's nonce", async () => {
		await cookies.signIn();
		setNonce("request-nonce");
		render(withQuery(<CreateAccountDialog />, testQueryClient()));
		fireEvent.click(screen.getByRole("button", { name: "create" }));
		await screen.findByRole("dialog");

		const styles = [...document.head.querySelectorAll("style")];
		expect(styles.length).toBeGreaterThan(0);
		for (const style of styles) {
			expect(style.getAttribute("nonce")).toBe("request-nonce");
		}
	});

	it("the actions menu of an account row adds no style element when opened", async () => {
		const before = styleElements();
		render(
			withAdminArea(
				<main id="main-content">
					<AccountRowActions
						row={{
							name: "alice",
							displayName: null,
							addresses: [],
							dynamic: true,
						}}
					/>
				</main>,
			),
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "actionsFor" }), {
			key: "Enter",
		});
		await screen.findByRole("menu");

		expect(styleElements()).toBe(before);
		expect(document.body).not.toHaveAttribute("data-scroll-locked");
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
