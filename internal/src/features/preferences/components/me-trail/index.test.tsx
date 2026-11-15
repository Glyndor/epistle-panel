import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { stepText } from "@/test/trail-steps";

import { MeTrail } from ".";

afterEach(cleanup);

describe("MeTrail", () => {
	it("is the page alone, as the current step, with no link to itself", () => {
		render(<MeTrail />);

		const trail = screen.getByRole("navigation", { name: "breadcrumb" });
		const steps = within(trail).getAllByRole("listitem");
		expect(steps.map(stepText)).toEqual(["preferences"]);
		expect(trail.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
		expect(within(trail).queryAllByRole("link")).toEqual([]);
	});
});
