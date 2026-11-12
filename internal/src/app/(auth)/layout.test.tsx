import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

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
});
