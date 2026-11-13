import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { intl, resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { useLocaleChoice } = await import(".");

const localeWrites = () => cookies.writes.filter((w) => w.name === "locale");

beforeEach(() => {
	resetIntl();
	cookies.reset();
});
afterEach(cleanup);

function Probe({ values }: { values: readonly string[] }) {
	const language = useLocaleChoice();
	return (
		<>
			<output>{language.locale}</output>
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
