import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { resolveServerTree } from "@/test/server-tree";

import { MailHeader } from ".";

afterEach(cleanup);

describe("MailHeader", () => {
	it("holds the page's one h1, who is signed in, the language and a sign-out form", async () => {
		render(await resolveServerTree(await MailHeader({ name: "ana" })));
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"heading",
		);
		expect(screen.getByText("signedInAs")).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "signOut" })).toHaveAttribute(
			"type",
			"submit",
		);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "admin" })).toBeNull();
	});

	it("offers the way into the administration only when it is given one", async () => {
		render(
			await resolveServerTree(
				await MailHeader({ name: "ops", adminHref: "/app/abc" }),
			),
		);
		expect(screen.getByRole("link", { name: "admin" })).toHaveAttribute(
			"href",
			"/app/abc",
		);
	});
});
