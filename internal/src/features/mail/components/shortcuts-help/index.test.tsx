import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ShortcutsHelp } from ".";

afterEach(cleanup);

describe("ShortcutsHelp", () => {
	it("lists the keys the list answers to", async () => {
		render(await ShortcutsHelp());
		expect(screen.getByText("shortcutsTitle")).toBeInTheDocument();
		expect(
			Array.from(document.querySelectorAll("kbd")).map(
				(k) => k.textContent,
			),
		).toEqual(["j", "k", "/", "u"]);
	});
});
