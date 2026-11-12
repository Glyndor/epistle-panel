import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { COPYRIGHT_NOTICE } from "@/features/branding/copyright";

import AuthLayout from "./layout";

afterEach(cleanup);

describe("AuthLayout", () => {
	it("is a bare frame with the single main landmark and no navigation", () => {
		render(
			<AuthLayout>
				<p>form</p>
			</AuthLayout>,
		);

		const main = screen.getByRole("main");
		expect(main).toHaveAttribute("id", "main-content");
		expect(main).toContainElement(screen.getByText("form"));
		expect(screen.queryByRole("navigation")).toBeNull();
		expect(screen.queryByRole("banner")).toBeNull();
	});

	it("shows the brand and the original copyright notice", () => {
		render(
			<AuthLayout>
				<p>form</p>
			</AuthLayout>,
		);

		expect(screen.getByText("Epistle")).toBeInTheDocument();
		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});
});
