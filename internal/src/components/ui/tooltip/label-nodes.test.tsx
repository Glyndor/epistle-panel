import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { forgetInput, renderTip, tip } from "./test-support";

afterEach(() => {
	forgetInput();
	cleanup();
});

describe("Tooltip with nodes for its text", () => {
	it("draws the nodes it is given, so a name from a message stays isolated", () => {
		const button = renderTip({
			label: (
				<>
					<bdi>Work</bdi>, <bdi>Home</bdi>
				</>
			),
		});

		fireEvent.pointerEnter(button);

		expect(tip()).toHaveTextContent("Work, Home");
		expect(
			Array.from(tip()?.querySelectorAll("bdi") ?? []).map(
				(name) => name.textContent,
			),
		).toEqual(["Work", "Home"]);
	});

	it("still leaves the control's name to the control", () => {
		const button = renderTip({ label: <bdi>Work</bdi> });

		fireEvent.pointerEnter(button);

		// The tooltip is hidden from assistive technology whatever it holds.
		expect(tip()).toHaveAttribute("aria-hidden", "true");
		expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBe(
			button,
		);
	});
});
