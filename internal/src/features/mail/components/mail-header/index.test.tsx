import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveServerTree } from "@/test/server-tree";

import { MailHeader } from ".";

afterEach(cleanup);

describe("MailHeader", () => {
	it("holds the page's one h1, the theme button and the profile menu of the account", async () => {
		render(
			await resolveServerTree(
				await MailHeader({ name: "ana", sessionRole: "user" }),
			),
		);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"heading",
		);
		const banner = screen.getByRole("banner");
		expect(
			[...banner.querySelectorAll("button")].map(
				(b) => b.querySelector(".sr-only")?.textContent,
			),
		).toEqual(["themeCurrent", "account"]);
		expect(
			screen.getByRole("button", { name: "account" }),
		).toHaveTextContent("ana");
		// The language is in the profile menu now: no select in the bar.
		expect(screen.queryByRole("combobox")).toBeNull();
	});

	it("hands the way into the administration on only when it is given one", async () => {
		const html = async (adminHref?: string) =>
			renderToStaticMarkup(
				await resolveServerTree(
					await MailHeader({
						name: "ops",
						sessionRole: "admin",
						adminHref,
					}),
				),
			);

		expect(await html("/app/abc")).toContain('href="/app/abc"');
		expect(await html()).not.toContain("/app/abc");
		expect(await html()).not.toContain("administration");
	});
});
