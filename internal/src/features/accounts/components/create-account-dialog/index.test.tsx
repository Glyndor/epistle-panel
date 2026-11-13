import { afterEach, describe, expect, it } from "bun:test";
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
import { sentRequests } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const cookies = mockRequestCookies();
const { CreateAccountDialog } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
});

describe("CreateAccountDialog", () => {
	useActionEnvironment(cookies);

	it("is a button until used, and asks the server nothing by being there", () => {
		render(withQuery(<CreateAccountDialog />));

		expect(screen.getByRole("button", { name: "create" })).toBeVisible();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(sentRequests()).toHaveLength(0);
	});

	it("opens a dialog named and described, with the form loaded into it", async () => {
		render(withQuery(<CreateAccountDialog />));

		fireEvent.click(screen.getByRole("button", { name: "create" }));

		const dialog = await screen.findByRole("dialog", {
			name: "createTitle",
		});
		expect(dialog).toHaveAccessibleDescription("createHelp");
		expect(await screen.findByLabelText("nameLabel")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "createSubmit" }),
		).toBeInTheDocument();
	});

	it("closes by itself once the account exists, and says so", async () => {
		stubRoutes([["POST", /accounts$/, { body: { created: "carol" } }]]);
		render(
			withQuery(
				<>
					<CreateAccountDialog />
					<Toaster label="toasts" closeLabel="closeToast" />
				</>,
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "create" }));
		const type = (label: string, value: string) =>
			fireEvent.change(screen.getByLabelText(label), {
				target: { value },
			});
		await screen.findByLabelText("nameLabel");
		type("nameLabel", "carol");
		type("addressesLabel", "carol@example.test");
		type("passwordLabel", "correct horse battery");

		await act(async () => {
			fireEvent.click(
				screen.getByRole("button", { name: "createSubmit" }),
			);
		});

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(screen.getByText("created")).toBeInTheDocument();
	});

	it("closes with its close button and gives the focus back to the button", async () => {
		render(withQuery(<CreateAccountDialog />));
		const trigger = screen.getByRole("button", { name: "create" });

		fireEvent.click(trigger);
		await screen.findByRole("dialog");
		fireEvent.click(screen.getByRole("button", { name: "close" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(trigger).toHaveFocus();
	});
});
