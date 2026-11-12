import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const cookies = mockRequestCookies();
const { MailboxesSection } = await import(".");

afterEach(cleanup);

describe("MailboxesSection", () => {
	useActionEnvironment(cookies);

	it("lists the mailboxes, indented by depth with classes and no inline style", async () => {
		stubRoutes([
			[
				"GET",
				/\/accounts\/alice\/mailboxes$/,
				{
					body: {
						mailboxes: ["INBOX", "INBOX/Work"],
						tree: [
							{ id: "INBOX", name: "INBOX", parent_id: null },
							{
								id: "INBOX/Work",
								name: "Work",
								parent_id: "INBOX",
							},
						],
					},
				},
			],
		]);

		const { container } = render(
			withQuery(<MailboxesSection name="alice" />),
		);

		expect(await screen.findByText("Work")).toHaveClass("pl-4");
		expect(screen.getByText("INBOX")).toHaveClass("pl-0");
		expect(
			screen.getByRole("region", { name: "mailboxesTitle" }),
		).toBeInTheDocument();
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("says there are no mailboxes yet", async () => {
		stubRoutes([
			["GET", /mailboxes$/, { body: { mailboxes: [], tree: [] } }],
		]);

		render(withQuery(<MailboxesSection name="alice" />));

		expect(await screen.findByText("mailboxesEmpty")).toBeInTheDocument();
	});

	it("shows a loading block first and the unreachable notice as a warning when the API fails", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const { container } = render(
			withQuery(<MailboxesSection name="alice" />),
		);
		expect(container.querySelector("[aria-busy='true']")).not.toBeNull();

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
		errors.mockRestore();
	});
});
