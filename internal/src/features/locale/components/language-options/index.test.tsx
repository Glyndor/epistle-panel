import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";
import { LanguageOptions } from ".";

afterEach(cleanup);

function renderOptions(
	locale: string,
	onChoose: (value: string) => void = () => {},
) {
	return render(
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger>open</DropdownMenuTrigger>
			<DropdownMenuContent>
				<LanguageOptions locale={locale} onChoose={onChoose} />
			</DropdownMenuContent>
		</DropdownMenu>,
	);
}

describe("LanguageOptions", () => {
	it("lists every shipped language by its own name and code, in a named group, the current one checked", async () => {
		renderOptions("fr");

		const items = await screen.findAllByRole("menuitemradio");
		expect(items.map((item) => item.getAttribute("lang"))).toEqual([
			...SUPPORTED_LOCALES,
		]);
		expect(items.map((item) => item.textContent)).toEqual(
			SUPPORTED_LOCALES.map((code) => LOCALE_NAMES[code]),
		);
		expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual(
			SUPPORTED_LOCALES.map((code) => String(code === "fr")),
		);
		expect(
			screen.getByRole("group", { name: "language" }),
		).toBeInTheDocument();
	});

	it("reports the code of the language that is picked", async () => {
		const onChoose = mock((_value: string) => {});
		renderOptions("en", onChoose);

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "Español" }),
		);

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose.mock.calls[0]?.[0]).toBe("es");
	});

	it("checks nothing for a language the panel does not have", async () => {
		renderOptions("xx");

		for (const item of await screen.findAllByRole("menuitemradio")) {
			expect(item).toHaveAttribute("aria-checked", "false");
		}
	});

	it("makes its items wait while a choice is being stored", async () => {
		const onChoose = mock((_value: string) => {});
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<LanguageOptions locale="en" onChoose={onChoose} disabled />
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		const items = await screen.findAllByRole("menuitemradio");
		for (const item of items) {
			expect(item).toHaveAttribute("aria-disabled", "true");
		}
		fireEvent.click(items[1] as HTMLElement);
		expect(onChoose).not.toHaveBeenCalled();
	});
});
