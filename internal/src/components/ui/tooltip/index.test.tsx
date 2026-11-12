import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from ".";

afterEach(cleanup);

describe("Tooltip", () => {
	it("renders nothing for its content until it opens", () => {
		render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Save</TooltipTrigger>
					<TooltipContent>Saves the form</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		expect(
			screen.getByRole("button", { name: "Save" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Saves the form")).toBeNull();
	});

	it("opens on keyboard focus and describes the trigger", async () => {
		render(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Save</TooltipTrigger>
					<TooltipContent>Saves the form</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		fireEvent.focus(screen.getByRole("button", { name: "Save" }));

		expect(await screen.findAllByText("Saves the form")).not.toHaveLength(
			0,
		);
		expect(await screen.findByRole("tooltip")).toBeInTheDocument();
	});
});
