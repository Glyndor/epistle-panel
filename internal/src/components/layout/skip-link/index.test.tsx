import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

const { SkipLink } = await import(".");

afterEach(cleanup);

describe("SkipLink", () => {
	it("targets the main landmark and stays out of sight until focused", async () => {
		render(await SkipLink());

		const link = screen.getByRole("link", { name: "skip" });
		expect(link).toHaveAttribute("href", "#main-content");
		expect(link).toHaveClass("sr-only", "focus:not-sr-only");
	});
});
