import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { summary } from "@/features/mail/test-support/fixtures";
import { testQueryClient, withQuery } from "@/test/query-wrapper";
import { firstPaint } from "@/test/server-tree";

import { MailNav } from ".";

afterEach(cleanup);

/** The navigation as it is first sent: the folders give way to their skeleton. */
async function renderNav(open = true) {
	return render(
		withQuery(
			<SidebarProvider defaultOpen={open}>
				{firstPaint(await MailNav())}
			</SidebarProvider>,
		),
	);
}

describe("MailNav", () => {
	it("starts with the way into the composer, an icon and its name", async () => {
		await renderNav();

		const write = screen.getByRole("link", { name: "compose" });
		expect(write).toHaveAttribute("href", "/app/mail/compose");
		expect(write.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(document.querySelector("a, button")).toBe(write);
	});

	it("draws the composer as the filled entry of the rail, its ring off the fill", async () => {
		await renderNav();

		expect(screen.getByRole("link", { name: "compose" })).toHaveClass(
			"bg-primary",
			"text-primary-foreground",
			"hover:bg-primary/90",
			"active:bg-primary/80",
			"focus-visible:outline-2",
			"focus-visible:outline-offset-2",
			"min-h-8",
			"pointer-coarse:min-h-11",
		);
	});

	it("names the composer in a tooltip while the rail is collapsed to icons", async () => {
		await renderNav(false);

		fireEvent.pointerEnter(screen.getByRole("link", { name: "compose" }));

		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toHaveTextContent("compose");
	});

	it("sends the skeleton of the folders before the mail server is asked", async () => {
		const { container } = await renderNav();

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(
			screen.queryByRole("navigation", { name: "folders" }),
		).toBeNull();
	});

	it("draws the skeleton of the folders open or closed, as the folders will come", async () => {
		const bars = (container: HTMLElement) =>
			container.querySelectorAll(
				"[data-slot='folder-skeleton'] [data-slot='skeleton']",
			).length;

		const open = render(
			withQuery(
				<SidebarProvider>
					{firstPaint(await MailNav({ foldersOpen: true }))}
				</SidebarProvider>,
			),
		);
		// The heading's place and, under it, the folders'.
		expect(bars(open.container)).toBe(2);
		open.unmount();

		const closed = render(
			withQuery(
				<SidebarProvider>
					{firstPaint(await MailNav({ foldersOpen: false }))}
				</SidebarProvider>,
			),
		);
		// Closed, the tree will be its heading alone: so is its skeleton.
		expect(bars(closed.container)).toBe(1);
		expect(
			closed.container.querySelector("[data-slot='folder-skeleton']"),
		).toHaveAttribute("data-state", "closed");
	});

	it("draws no group of labels in the page the server sends: the browser fills it from the lists it loads", async () => {
		await renderNav();

		expect(
			screen.queryByRole("navigation", { name: "labelsNav" }),
		).toBeNull();
	});

	it("draws the labels of the lists the browser holds, after the folders", async () => {
		const client = testQueryClient();
		client.setQueryData(mailKeys.list("INBOX", 1, EMPTY_CONDITIONS), {
			items: [
				summary({
					labels: [{ keyword: "Work", name: "Work", tone: 1 }],
				}),
			],
			page: 1,
			total: 1,
			hasNext: false,
			partial: false,
			today: "2026-11-15",
		});
		render(
			withQuery(
				<SidebarProvider>
					{firstPaint(await MailNav())}
				</SidebarProvider>,
				client,
			),
		);

		expect(
			screen.getByRole("navigation", { name: "labelsNav" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();
	});
});
