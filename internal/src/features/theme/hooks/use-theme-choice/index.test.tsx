import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { ThemeChoiceProvider } from "@/features/theme/components/theme-choice-provider";
import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { useDocumentTheme, useThemeChoice } = await import(".");

const root = () => document.documentElement;
const themeWrites = () => cookies.writes.filter((w) => w.name === "theme");
const originalGet = cookies.jar.get.bind(cookies.jar);

beforeEach(() => {
	cookies.reset();
});
afterEach(() => {
	cleanup();
	clearToasts();
	root().removeAttribute("data-theme");
	cookies.jar.get = originalGet;
});

/** Shows the hook's state and offers a button per value to choose. */
function Probe({ values }: { values: readonly string[] }) {
	const theme = useThemeChoice();
	return (
		<>
			<output data-pending={theme.pending}>{theme.choice}</output>
			{values.map((value, index) => (
				<button
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
					key={index}
					type="button"
					onClick={() => theme.choose(value)}
				>
					{`pick ${index}`}
				</button>
			))}
			<Toaster label="toasts" closeLabel="close" />
		</>
	);
}

function Reader() {
	return <output>{useDocumentTheme()}</output>;
}

describe("useDocumentTheme", () => {
	it("is the server's choice while rendering on the server", () => {
		root().setAttribute("data-theme", "light");

		expect(
			renderToString(
				<ThemeChoiceProvider choice="dark">
					<Reader />
				</ThemeChoiceProvider>,
			),
		).toContain("dark");
		expect(renderToString(<Reader />)).toContain("system");
	});

	it("is the document's attribute in the browser, and follows it", async () => {
		root().setAttribute("data-theme", "light");
		render(
			<ThemeChoiceProvider choice="light">
				<Reader />
			</ThemeChoiceProvider>,
		);
		expect(screen.getByRole("status")).toHaveTextContent("light");

		root().setAttribute("data-theme", "dark");
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("dark"),
		);

		root().removeAttribute("data-theme");
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("system"),
		);
	});
});

describe("useThemeChoice", () => {
	it("changes nothing and asks the server nothing for a value that is not a choice", async () => {
		await cookies.signIn();
		render(<Probe values={HOSTILE_THEME_VALUES} />);

		for (const button of screen.getAllByRole("button", { name: /^pick/ })) {
			fireEvent.click(button);
		}
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(root().hasAttribute("data-theme")).toBe(false);
		expect(themeWrites()).toEqual([]);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("stores a choice and keeps it on the document", async () => {
		await cookies.signIn();
		render(<Probe values={["light"]} />);

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));

		expect(root().getAttribute("data-theme")).toBe("light");
		await waitFor(() =>
			expect(themeWrites().map((w) => w.value)).toEqual(["light"]),
		);
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("light"),
		);
		expect(root().getAttribute("data-theme")).toBe("light");
	});

	it("puts the previous theme back when the action cannot be reached", async () => {
		await cookies.signIn();
		root().setAttribute("data-theme", "dark");
		render(<Probe values={["light"]} />);
		cookies.jar.get = () => {
			throw new Error("the request failed");
		};

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));
		expect(root().getAttribute("data-theme")).toBe("light");

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"themeFailed",
		);
		expect(root().getAttribute("data-theme")).toBe("dark");
		expect(themeWrites()).toEqual([]);
	});

	it("takes one choice at a time: a second pick made while the first is being stored is dropped", async () => {
		await cookies.signIn();
		render(<Probe values={["dark", "light"]} />);

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));
		fireEvent.click(screen.getByRole("button", { name: "pick 1" }));

		await waitFor(() => expect(themeWrites()).toHaveLength(1));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(themeWrites().map((w) => w.value)).toEqual(["dark"]);
		expect(root().getAttribute("data-theme")).toBe("dark");
	});
});
