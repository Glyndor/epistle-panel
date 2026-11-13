import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { THEME_CHOICES } from "@/features/theme/config/choices";
import { ThemeChoiceProvider, useServerThemeChoice } from ".";

afterEach(cleanup);

function Reader() {
	return <output>{useServerThemeChoice()}</output>;
}

describe("ThemeChoiceProvider", () => {
	it("hands the server's choice to the components below it, on the server and in the browser", () => {
		for (const choice of THEME_CHOICES) {
			expect(
				renderToStaticMarkup(
					<ThemeChoiceProvider choice={choice}>
						<Reader />
					</ThemeChoiceProvider>,
				),
			).toBe(`<output>${choice}</output>`);

			render(
				<ThemeChoiceProvider choice={choice}>
					<Reader />
				</ThemeChoiceProvider>,
			);
			expect(screen.getByRole("status")).toHaveTextContent(choice);
			cleanup();
		}
	});

	it("is the system's choice for a component with no provider above it", () => {
		render(<Reader />);

		expect(screen.getByRole("status")).toHaveTextContent("system");
	});

	it("renders its children and nothing of its own", () => {
		expect(
			renderToStaticMarkup(
				<ThemeChoiceProvider choice="dark">
					<p>page</p>
				</ThemeChoiceProvider>,
			),
		).toBe("<p>page</p>");
	});
});
