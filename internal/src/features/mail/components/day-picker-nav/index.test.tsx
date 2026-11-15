import { afterEach, describe, expect, it, mock, setSystemTime } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

let pathname = "/app/mail/inbox";
let search = "";
const pushed: string[] = [];
mock.module("next/navigation", () => ({
	usePathname: () => pathname,
	useSearchParams: () => new URLSearchParams(search),
	useRouter: () => ({
		push: (href: string) => pushed.push(href),
		replace: () => {},
		refresh: () => {},
	}),
}));

const { DayPickerNav } = await import(".");

afterEach(() => {
	cleanup();
	setSystemTime();
	pathname = "/app/mail/inbox";
	search = "";
	pushed.length = 0;
});

const folder = (id: string, role: MailboxView["role"] = null): MailboxView => ({
	id,
	name: id,
	role,
	parentId: null,
	depth: 0,
	unread: 0,
	total: 0,
});

function tree({
	today = "2026-11-15",
	timeZone = "UTC",
	weekStartsOn = 1,
	closed = false,
	open = true,
}: {
	today?: string;
	timeZone?: string;
	weekStartsOn?: 0 | 1;
	closed?: boolean;
	open?: boolean;
} = {}) {
	const client = testQueryClient();
	client.setQueryData(mailKeys.mailboxes, [
		folder("INBOX", "inbox"),
		folder("Work"),
	]);
	return withQuery(
		<SidebarProvider
			defaultOpen={open}
			defaultClosedGroups={closed ? ["calendar"] : []}
		>
			<DayPickerNav
				today={today}
				timeZone={timeZone}
				weekStartsOn={weekStartsOn}
			/>
		</SidebarProvider>,
		client,
	);
}

/** The button of a day of November 2026 (the stand-in says every day's name is the same key). */
const day = (n: number): HTMLElement => {
	const button = document.querySelector<HTMLElement>(
		`td[data-day="2026-11-${String(n).padStart(2, "0")}"] button`,
	);
	if (button === null) {
		throw new Error(`no button for day ${n}`);
	}
	return button;
};

describe("DayPickerNav", () => {
	it("is a group named Calendar, open to start with, that describes what a day does", () => {
		render(tree());

		const heading = screen.getByRole("button", { name: "calendarNav" });
		expect(heading).toHaveAttribute("aria-expanded", "true");
		expect(
			document.querySelector("[data-slot='day-picker-nav']"),
		).not.toBeNull();
		const group = screen.getByRole("group", { name: "calendarNav" });
		const hint = group.getAttribute("aria-describedby") ?? "";
		expect(document.querySelector(`[id="${hint}"]`)).toHaveTextContent(
			"calendarHint",
		);
	});

	it("shows the month of today, with today marked", () => {
		render(tree({ today: "2026-11-15" }));

		expect(document.querySelector("[role=status]")).toHaveTextContent(
			"November 2026",
		);
		expect(document.querySelectorAll("[aria-current=date]")).toHaveLength(
			1,
		);
		expect(
			document.querySelector("[aria-current=date]")?.closest("td"),
		).toHaveAttribute("data-day", "2026-11-15");
	});

	it("marks the day it is in the person's zone, which in Kolkata is already tomorrow", () => {
		setSystemTime(new Date("2025-02-03T23:30:00Z"));
		const { unmount } = render(
			tree({ today: "2025-02-03", timeZone: "UTC" }),
		);
		expect(
			document.querySelector("[aria-current=date]")?.closest("td"),
		).toHaveAttribute("data-day", "2025-02-03");
		unmount();
		render(tree({ today: "2025-02-03", timeZone: "Asia/Kolkata" }));

		expect(document.querySelector("[role=status]")).toHaveTextContent(
			"February 2025",
		);
		expect(
			document.querySelector("[aria-current=date]")?.closest("td"),
		).toHaveAttribute("data-day", "2025-02-04");
	});

	it("starts the week on the day it is told", () => {
		const { unmount } = render(tree({ weekStartsOn: 1 }));
		expect(document.querySelector("th")).toHaveAttribute(
			"aria-label",
			"Monday",
		);
		unmount();
		render(tree({ weekStartsOn: 0 }));
		expect(document.querySelector("th")).toHaveAttribute(
			"aria-label",
			"Sunday",
		);
	});

	it("opens the folder the person is in with the day pressed", () => {
		render(tree());
		fireEvent.click(day(10));

		expect(pushed).toEqual([
			"/app/mail/inbox?after=2026-11-10&before=2026-11-10",
		]);
	});

	it("addresses another folder by its own path", () => {
		pathname = "/app/mail/folder/Work";
		render(tree());
		fireEvent.click(day(3));

		expect(pushed).toEqual([
			"/app/mail/folder/Work?after=2026-11-03&before=2026-11-03",
		]);
	});

	it("opens the inbox from the composer, which has no folder", () => {
		pathname = "/app/mail/compose";
		render(tree());
		fireEvent.click(day(3));

		expect(pushed).toEqual([
			"/app/mail/inbox?after=2026-11-03&before=2026-11-03",
		]);
	});

	it("shows as chosen the day the address names, and nothing for a range", () => {
		search = "after=2026-11-10&before=2026-11-10";
		const { unmount } = render(tree());
		expect(
			document.querySelectorAll("td[aria-selected=true]"),
		).toHaveLength(1);
		expect(day(10).closest("td")).toHaveAttribute("aria-selected", "true");
		unmount();

		search = "after=2026-11-10&before=2026-11-12";
		render(tree());
		expect(
			document.querySelectorAll("td[aria-selected=true]"),
		).toHaveLength(0);
	});

	it("starts on the month of the chosen day, not today's", () => {
		search = "after=2026-03-04&before=2026-03-04";
		render(tree({ today: "2026-11-15" }));

		expect(document.querySelector("[role=status]")).toHaveTextContent(
			"March 2026",
		);
	});

	it("takes the day off when it is pressed again", () => {
		search = "after=2026-11-10&before=2026-11-10";
		pathname = "/app/mail/folder/Work";
		render(tree());
		fireEvent.click(day(10));

		expect(pushed).toEqual(["/app/mail/folder/Work"]);
	});

	it("walks the months with its two arrows, named, without leaving the page", () => {
		render(tree());
		fireEvent.click(screen.getByRole("button", { name: "calendarNext" }));
		expect(document.querySelector("[role=status]")).toHaveTextContent(
			"December 2026",
		);
		fireEvent.click(
			screen.getByRole("button", { name: "calendarPrevious" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "calendarPrevious" }),
		);

		expect(document.querySelector("[role=status]")).toHaveTextContent(
			"October 2026",
		);
		expect(pushed).toEqual([]);
	});

	it("keeps the weeks to six whatever the month, so the group never changes height", () => {
		const rows = () => document.querySelectorAll("tbody tr").length;
		render(tree({ today: "2026-02-10" }));
		const february = rows();
		fireEvent.click(screen.getByRole("button", { name: "calendarNext" }));

		expect([february, rows()]).toEqual([6, 6]);
	});

	it("names each day with its date and what it is, for a screen reader", () => {
		render(tree());

		expect(
			screen.getAllByRole("button", { name: "calendarDay" }).length,
		).toBeGreaterThan(27);
		const said = document.querySelectorAll(".rdp-root button[aria-label]");
		expect(said.length).toBeGreaterThan(27);
	});

	it("hides the whole group in the rail collapsed to icons, and keeps it out of the tab order", () => {
		render(tree({ open: false }));

		expect(
			document.querySelector("[data-slot='day-picker-nav']"),
		).toHaveClass("group-data-[collapsible=icon]:hidden");
	});

	it("keeps its entries out of the page while the group is closed", () => {
		render(tree({ closed: true }));

		expect(
			screen.getByRole("button", { name: "calendarNav" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("grid")).toBeNull();
	});

	it("draws in the server's page the same month, today and heading as in the browser's", () => {
		const html = renderToString(tree({ today: "2026-11-15" }));

		expect(html).toContain('data-day="2026-11-15"');
		expect(html).toContain("calendarNav");
		expect(html).not.toMatch(/\sstyle=/);
		expect(html).not.toContain("<style");
	});
});
