import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";
import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import { stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { answerConfirm } from "@/test/confirm-dialog";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const SECRET = "JBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/example.org:alice?secret=${SECRET}&issuer=example.org`;
const cookies = mockRequestCookies();
const { AccountSection } = await import(".");

const account = (over: object = {}) => ({
	name: "alice",
	display_name: "Alice",
	addresses: ["alice@example.org", "a@example.org"],
	dynamic: true,
	...over,
});
const api = (accounts: unknown[]) =>
	stubRoutes([
		["GET", /\/accounts$/, { body: { accounts } }],
		["GET", /mailboxes$/, { body: { mailboxes: [], tree: [] } }],
		["GET", /masked$/, { body: { addresses: [] } }],
		["GET", /archive$/, { body: { entries: [] } }],
		["POST", /totp$/, { body: { secret: SECRET, otpauth_uri: URI } }],
	]);

const show = (section: Section) =>
	render(
		withQuery(
			<>
				<AccountSection section={section} name="alice" />
				<Toaster label="toasts" closeLabel="close" />
			</>,
		),
	);

afterEach(async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	cleanup();
	clearToasts();
});

describe("AccountSection", () => {
	useActionEnvironment(cookies);

	it("draws the section the address names, and only that one", async () => {
		const seen: Array<[Section, string]> = [
			["overview", "sectionOverview"],
			["profile", "profileTitle"],
			["security", "passwordTitle"],
			["mailboxes", "mailboxesTitle"],
			["masked", "maskedTitle"],
			["archive", "archiveTitle"],
		];

		for (const [section, title] of seen) {
			api([account()]);
			const { unmount } = show(section);

			expect(
				await screen.findByRole("region", { name: title }),
			).toBeInTheDocument();
			unmount();
		}
	});

	it("shows the addresses and the profile summary on the overview", async () => {
		api([account()]);

		show("overview");

		expect(
			await screen.findByText("alice@example.org"),
		).toBeInTheDocument();
		expect(screen.getByText("a@example.org")).toBeInTheDocument();
		expect(screen.getByText("Alice")).toBeInTheDocument();
	});

	it("takes the two-factor secret away when the security section is left", async () => {
		api([account()]);
		const { rerender } = show("security");
		await screen.findByRole("region", { name: "totpTitle" });

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "totpEnroll" }));
		});
		await answerConfirm(true);
		expect(await screen.findByText(SECRET)).toBeInTheDocument();

		rerender(
			withQuery(
				<>
					<AccountSection section="overview" name="alice" />
					<Toaster label="toasts" closeLabel="close" />
				</>,
			),
		);
		await screen.findByText("alice@example.org");
		expect(screen.queryByText(SECRET)).toBeNull();

		rerender(
			withQuery(
				<>
					<AccountSection section="security" name="alice" />
					<Toaster label="toasts" closeLabel="close" />
				</>,
			),
		);
		await screen.findByRole("region", { name: "totpTitle" });
		expect(screen.queryByText(SECRET)).toBeNull();
	});

	it("says the account is gone when the list no longer has it", async () => {
		api([account({ name: "bob" })]);

		show("overview");

		expect(await screen.findByText("gone")).toBeInTheDocument();
	});

	it("shows a summary that follows a profile change", async () => {
		let saved = account();
		stubRoutes([
			["GET", /\/accounts$/, () => ({ body: { accounts: [saved] } })],
			["GET", /mailboxes$/, { body: { mailboxes: [], tree: [] } }],
			["GET", /masked$/, { body: { addresses: [] } }],
			["GET", /archive$/, { body: { entries: [] } }],
		]);
		const client = testQueryClient();
		render(
			withQuery(
				<AccountSection section="overview" name="alice" />,
				client,
			),
		);
		expect(await screen.findByText("Alice")).toBeInTheDocument();

		// The profile section invalidates the list when it saves, and the
		// summary of the overview reads that same list.
		saved = account({ display_name: "Alice Renamed" });
		await client.invalidateQueries({ queryKey: accountsKeys.all });

		expect(await screen.findByText("Alice Renamed")).toBeInTheDocument();
	});

	it("shows the unreachable notice as a warning when the list cannot be read", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		show("overview");

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
		expect(
			screen.queryByRole("region", { name: "sectionOverview" }),
		).toBeNull();
		errors.mockRestore();
	});

	it("shows a loading block while the list is on its way", () => {
		api([account()]);

		const { container } = show("overview");

		expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
	});
});
