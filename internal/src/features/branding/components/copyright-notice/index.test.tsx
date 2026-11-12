import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { COPYRIGHT_NOTICE } from "@/features/branding/copyright";

import { CopyrightNotice } from ".";

afterEach(cleanup);

describe("CopyrightNotice", () => {
	it("shows the original notice, which is not configurable", () => {
		render(<CopyrightNotice />);

		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
		expect(COPYRIGHT_NOTICE).toBe("© 2026 Glyndor");
	});

	it("takes a class for placement", () => {
		render(<CopyrightNotice className="text-xs" />);

		expect(screen.getByText(COPYRIGHT_NOTICE)).toHaveClass("text-xs");
	});
});
