import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { intl, resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { useLocaleChoice } = await import(".");

const localeWrites = () => cookies.writes.filter((w) => w.name === "locale");
const originalGet = cookies.jar.get.bind(cookies.jar);

beforeEach(() => {
	resetIntl();
	cookies.reset();
	cookies.jar.get = originalGet;
});
afterEach(() => {
	cleanup();
	clearToasts();
});

function Probe({ values }: { values: readonly string[] }) {
	const language = useLocaleChoice();
	return (
		<>
			<output>{language.locale}</output>
			<Toaster label="toasts" closeLabel="close" />
			{values.map((value, index) => (
				<button
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
					key={index}
					type="button"
					onClick={() => language.choose(value)}
				>
					{`pick ${index}`}
				</button>
			))}
		</>
	);
}

describe("useLocaleChoice", () => {
	it("is the language of the page", () => {
		intl.locale = "pt";
		render(<Probe values={[]} />);

		expect(screen.getByRole("status")).toHaveTextContent("pt");
	});

	it("stores another language through the Server Action", async () => {
		await cookies.signIn();
		render(<Probe values={["es"]} />);

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));

		await waitFor(() =>
			expect(localeWrites().map((w) => w.value)).toEqual(["es"]),
		);
	});

	it("says so, and keeps the page, when the session has ended and the action refuses", async () => {
		render(<Probe values={["es"]} />);

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"languageFailed",
		);
		expect(localeWrites()).toEqual([]);
		expect(screen.getByRole("status")).toHaveTextContent("en");
	});

	it("says so, and keeps the page, when the action cannot be reached", async () => {
		await cookies.signIn();
		render(<Probe values={["es"]} />);
		cookies.jar.get = () => {
			throw new Error("the request failed");
		};

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));

		// The rejection stays inside the hook: thrown out of the transition it
		// would reach the error boundary and take the page with it.
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"languageFailed",
		);
		expect(localeWrites()).toEqual([]);
		expect(
			screen.getByRole("button", { name: "pick 0" }),
		).toBeInTheDocument();
	});

	it("asks the server nothing for the current language or for a value that is not a language", async () => {
		await cookies.signIn();
		render(
			<Probe
				values={[
					"en",
					"",
					"ES",
					"pt-BR",
					"../es",
					"es; Path=/",
					"__proto__",
					"e".repeat(5_000),
				]}
			/>,
		);

		for (const button of screen.getAllByRole("button", { name: /^pick/ })) {
			fireEvent.click(button);
		}
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(localeWrites()).toEqual([]);
	});

	it("takes one choice at a time: a second pick made while the first is being stored is dropped", async () => {
		await cookies.signIn();
		render(<Probe values={["es", "fr"]} />);

		fireEvent.click(screen.getByRole("button", { name: "pick 0" }));
		fireEvent.click(screen.getByRole("button", { name: "pick 1" }));

		await waitFor(() => expect(localeWrites()).toHaveLength(1));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(localeWrites().map((w) => w.value)).toEqual(["es"]);
	});
});
