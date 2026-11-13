import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ShortcutsHelp } from ".";

afterEach(cleanup);

describe("ShortcutsHelp", () => {
	it("is a button, closed to start with, that says so", async () => {
		render(await ShortcutsHelp());

		expect(
			screen.getByRole("button", { name: "shortcutsTitle" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(document.querySelectorAll("kbd")).toHaveLength(0);
	});

	it("lists the keys the list answers to once opened", async () => {
		render(await ShortcutsHelp());

		fireEvent.click(screen.getByRole("button", { name: "shortcutsTitle" }));

		expect(
			Array.from(document.querySelectorAll("kbd")).map(
				(k) => k.textContent,
			),
		).toEqual(["j", "k", "/", "u"]);
	});
});
