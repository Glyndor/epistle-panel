import { afterEach, describe, expect, it, mock } from "bun:test";
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
import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const PASSWORD = "correct horse battery";
const cookies = mockRequestCookies();
const { CreateAccountForm } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
});

const field = (label: string) =>
	screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
const type = (label: string, value: string) =>
	act(async () => {
		fireEvent.change(field(label), { target: { value } });
	});
const submit = () =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "createSubmit" }));
	});
const posts = () => sentRequests().filter((r) => r.method === "POST");
const fill = async (over: Partial<Record<string, string>> = {}) => {
	await type("nameLabel", over["name"] ?? "alice");
	await type("displayNameLabel", over["displayName"] ?? "Alice A");
	await type(
		"addressesLabel",
		over["addresses"] ?? "alice@example.test\nalias@example.test",
	);
	await type("passwordLabel", over["password"] ?? PASSWORD);
};

function setup(onDone = mock(() => {})) {
	const client = testQueryClient();
	client.setQueryData(accountsKeys.all, []);
	render(
		withQuery(
			<>
				<CreateAccountForm onDone={onDone} />
				<Toaster label="toasts" closeLabel="close" />
			</>,
			client,
		),
	);
	return { client, onDone };
}

describe("CreateAccountForm", () => {
	useActionEnvironment(cookies);

	it("gives the browser the same limits the schema has, and describes each field by its help", () => {
		setup();

		const name = field("nameLabel");
		expect(name).toBeRequired();
		// Each length is one over the schema's: a paste the browser cuts is then
		// over the limit and named, not sent short.
		expect(name).toHaveAttribute("maxlength", "65");
		expect(name).toHaveAttribute("pattern", "[a-z0-9][a-z0-9\\-]{0,63}");
		// A browser compiles the attribute with the `v` flag; it must be valid there.
		expect(
			() => new RegExp(name.getAttribute("pattern") ?? "", "v"),
		).not.toThrow();
		expect(name).toHaveAttribute("autocapitalize", "none");
		expect(name).toHaveAccessibleDescription("nameHelp");
		// The server counts a name by code point and the attribute by UTF-16
		// unit: twice the limit, so a name of 128 emoji is not cut.
		expect(field("displayNameLabel")).toHaveAttribute("maxlength", "256");
		expect(field("displayNameLabel")).toHaveAttribute(
			"pattern",
			"[^\\p{Cc}]*",
		);
		expect(field("addressesLabel")).toBeRequired();
		expect(field("addressesLabel")).toHaveAttribute("maxlength", "5161");
		expect(field("addressesLabel")).toHaveAccessibleDescription(
			"addressesHelp",
		);
		const password = field("passwordLabel");
		expect(password).toHaveAttribute("type", "password");
		expect(password).toBeRequired();
		expect(password).toHaveAttribute("minlength", "12");
		expect(password).toHaveAttribute("maxlength", "65");
		expect(password).toHaveAttribute("autocomplete", "new-password");
	});

	it("the browser's own check stops a name or a password outside its attributes, before any script", async () => {
		setup();

		await fill({
			name: "Alice",
			displayName: "a\u0007b",
			password: "short",
		});
		expect(field("nameLabel").validity.patternMismatch).toBe(true);
		expect(field("displayNameLabel").validity.patternMismatch).toBe(true);
		expect(field("passwordLabel").validity.tooShort).toBe(true);
		await submit();

		expect(field("nameLabel").checkValidity()).toBe(false);
		expect(screen.queryByText("displayNameControl")).toBeNull();
		expect(posts()).toHaveLength(0);
	});

	it("the schema names what the attributes cannot express, and sends nothing", async () => {
		setup();

		// A list of addresses has no pattern a browser can check, and a name is
		// counted by code point: 129 letters fit the input's 256 units.
		await fill({
			addresses: "not-an-address",
			displayName: "a".repeat(129),
		});
		await submit();

		expect(await screen.findByText("addressesInvalid")).toBeInTheDocument();
		expect(screen.getByText("displayNameTooLong")).toBeInTheDocument();
		expect(field("addressesLabel")).toHaveAttribute("aria-invalid", "true");
		expect(posts()).toHaveLength(0);
	});

	it("a form submitted past the browser's check is still stopped by the schema, field by field", async () => {
		setup();

		await fill({
			name: "Alice",
			displayName: "a\u0007b",
			password: "short",
		});
		// What a script does when it submits without the browser's validation.
		await act(async () => {
			fireEvent.submit(
				screen
					.getByRole("button", { name: "createSubmit" })
					.closest("form") as HTMLFormElement,
			);
		});

		expect(await screen.findByText("nameInvalid")).toBeInTheDocument();
		expect(screen.getByText("displayNameControl")).toBeInTheDocument();
		expect(screen.getByText("passwordTooShort")).toBeInTheDocument();
		expect(posts()).toHaveLength(0);
	});

	it("creates the account with the addresses read from the field, says so, refreshes the list and is done", async () => {
		stubRoutes([["POST", /accounts$/, { body: { created: "alice" } }]]);
		const { client, onDone } = setup();
		const invalidated = mock(() => {});
		client.getQueryCache().subscribe((event) => {
			if (
				event.type === "updated" &&
				event.action.type === "invalidate"
			) {
				invalidated();
			}
		});

		await fill();
		await submit();

		await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
		expect(screen.getByText("created")).toBeInTheDocument();
		expect(invalidated).toHaveBeenCalled();
		const [post, ...rest] = posts();
		expect(rest).toHaveLength(0);
		expect(JSON.parse(post?.body ?? "")).toEqual({
			name: "alice",
			addresses: ["alice@example.test", "alias@example.test"],
			password: PASSWORD,
			display_name: "Alice A",
		});
	});

	it("says the server refused it, keeps what was typed except the password, and is not done", async () => {
		stubRoutes([
			[
				"POST",
				/accounts$/,
				{
					status: 400,
					body: {
						error: {
							code: "invalid_input",
							message: `password ${PASSWORD} is breached`,
						},
					},
				},
			],
		]);
		const { onDone } = setup();

		await fill();
		await submit();

		expect(await screen.findByText("createRefused")).toBeInTheDocument();
		expect(document.body.textContent).not.toContain(PASSWORD);
		expect(field("passwordLabel")).toHaveValue("");
		expect(field("nameLabel")).toHaveValue("alice");
		expect(onDone).not.toHaveBeenCalled();
	});

	it("says the account limit is reached when the server answers a conflict", async () => {
		stubRoutes([
			[
				"POST",
				/accounts$/,
				{
					status: 409,
					body: { error: { code: "conflict", message: "cap" } },
				},
			],
		]);
		setup();

		await fill();
		await submit();

		expect(await screen.findByText("createCap")).toBeInTheDocument();
	});

	it("reports a server that does not answer and empties the password", async () => {
		stubFetchReject();
		const { onDone } = setup();

		await fill();
		await submit();

		expect(await screen.findByText("unavailable")).toBeInTheDocument();
		expect(field("passwordLabel")).toHaveValue("");
		expect(onDone).not.toHaveBeenCalled();
	});
});
