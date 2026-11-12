import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { AppToaster } from ".";

afterEach(cleanup);

describe("AppToaster", () => {
	it("renders the toast region named in the user's language", async () => {
		render(await AppToaster());

		expect(
			screen.getByRole("region", { name: "notifications" }),
		).toBeInTheDocument();
	});
});
