import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const cookies = mockRequestCookies();
const { ProfileSection } = await import(".");
const { displayNameFormSchema } = await import(
	"@/features/account-detail/schemas/display-name-form"
);

afterEach(() => {
	cleanup();
	clearToasts();
});

const account: AccountRow = {
	name: "alice",
	displayName: "Alice",
	addresses: ["alice@example.org"],
	dynamic: true,
};
const field = () =>
	screen.getByLabelText("displayNameLabel") as HTMLInputElement;
const type = (value: string) =>
	act(async () => {
		fireEvent.change(field(), { target: { value } });
	});
const save = () =>
	act(async () => {
		fireEvent.click(
			screen.getByRole("button", { name: "displayNameSave" }),
		);
	});
const puts = () => sentRequests().filter((r) => r.method === "PUT");
const setup = (row: AccountRow = account) =>
	render(
		withQuery(
			<>
				<ProfileSection account={row} />
				<Toaster label="toasts" closeLabel="close" />
			</>,
		),
	);

describe("ProfileSection", () => {
	useActionEnvironment(cookies);

	it("starts from the current display name", () => {
		setup();

		expect(field().value).toBe("Alice");
	});

	it("saves the trimmed name, announces it and reads the accounts again", async () => {
		stubRoutes([
			["PUT", /display_name$/, { body: { display_name: "Alice A." } }],
			["GET", /\/accounts$/, { body: { accounts: [] } }],
		]);
		setup();

		await type("  Alice A.  ");
		await save();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"displayNameSaved",
			),
		);
		expect(JSON.parse(puts()[0]?.body ?? "")).toEqual({
			display_name: "Alice A.",
		});
		expect(field().value).toBe("Alice A.");
	});

	it("clears the name with an empty value and says so", async () => {
		stubRoutes([
			["PUT", /display_name$/, { body: { display_name: null } }],
		]);
		setup();

		await type("");
		await save();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"displayNameCleared",
			),
		);
		expect(JSON.parse(puts()[0]?.body ?? "")).toEqual({ display_name: "" });
	});

	it("gives the browser the name's rules: no control character, and a length it cannot count exactly", () => {
		setup();

		expect(field()).not.toBeRequired();
		// The help describes the field; the title is the hint a browser shows
		// with its own message, not the error.
		expect(field()).toHaveAccessibleDescription("displayNameHelp");
		expect(field()).toHaveAttribute("title", "displayNameFormat");
		// `maxlength` counts UTF-16 units and the server counts code points, so
		// the input allows twice the limit and the schema does the exact count.
		expect(field()).toHaveAttribute("maxlength", "256");
		const pattern = new RegExp(
			`^(?:${field().getAttribute("pattern") ?? ""})$`,
			"v",
		);
		for (const [value, accepted] of [
			["Alice", true],
			["", true],
			["Ana María 👩‍💻", true],
			["a\u0007b", false],
			["a\nb", false],
			["a\u0000", false],
		] as const) {
			expect([value, pattern.test(value)]).toEqual([value, accepted]);
			expect([
				value,
				displayNameFormSchema.safeParse({ displayName: value }).success,
			]).toEqual([value, accepted]);
		}
		// The one value they read differently: the schema trims first, so a tab
		// at an end is gone before it looks; the browser asks for it to be removed.
		expect(pattern.test("\tAlice")).toBe(false);
		expect(
			displayNameFormSchema.safeParse({ displayName: "\tAlice" }).success,
		).toBe(true);
	});

	it("the browser stops a control character before any script", async () => {
		stubRoutes([
			["PUT", /display_name$/, { body: { display_name: null } }],
		]);
		setup();

		await type("a\u0007b");
		expect(field().validity.patternMismatch).toBe(true);
		await save();

		expect(screen.queryByText("displayNameControl")).toBeNull();
		expect(puts()).toHaveLength(0);
	});

	it("the schema counts what the browser cannot: 129 characters fit the input and are named too long", async () => {
		stubRoutes([
			["PUT", /display_name$/, { body: { display_name: null } }],
		]);
		setup();

		await type("a".repeat(129));
		expect(field().checkValidity()).toBe(true);
		await save();

		expect(
			await screen.findByText("displayNameTooLong"),
		).toBeInTheDocument();
		expect(puts()).toHaveLength(0);
	});

	it("a form submitted past the browser's check is stopped by the schema, which names the control character", async () => {
		stubRoutes([
			["PUT", /display_name$/, { body: { display_name: null } }],
		]);
		setup();

		await type("a\u0007b");
		await act(async () => {
			fireEvent.submit(field().closest("form") as HTMLFormElement);
		});

		expect(
			await screen.findByText("displayNameControl"),
		).toBeInTheDocument();
		expect(puts()).toHaveLength(0);
	});

	it("shows the server's refusal under the field and a missing account as a toast", async () => {
		stubRoutes([
			[
				"PUT",
				/display_name$/,
				{
					status: 400,
					body: { error: { code: "invalid_input", message: "x" } },
				},
			],
		]);
		setup();
		await type("Bob");
		await save();
		expect(
			await screen.findByText("displayNameRefused"),
		).toBeInTheDocument();

		stubRoutes([
			[
				"PUT",
				/display_name$/,
				{
					status: 404,
					body: { error: { code: "not_found", message: "x" } },
				},
			],
		]);
		await save();
		await waitFor(() =>
			expect(screen.getByRole("alert", { name: "" })).toBeInTheDocument(),
		);
	});

	it("is read-only text, with no form, for an account declared in the configuration file", () => {
		setup({ ...account, dynamic: false, displayName: null });

		expect(screen.queryByLabelText("displayNameLabel")).toBeNull();
		expect(screen.getByText("displayNameNone")).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("reports an unreachable server as an error toast and keeps what was typed", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		setup();

		await type("Bob");
		await save();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("unavailable"),
		);
		expect(field().value).toBe("Bob");
		errors.mockRestore();
	});
});
