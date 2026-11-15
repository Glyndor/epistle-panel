import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";

import { LIST_DENSITIES } from "@/features/mail/config/list-density";
import type { PreferencesValues } from "@/features/preferences/schemas/preferences";
import type { PreferencesState } from "@/features/preferences/schemas/preferences-state";
import { THEME_CHOICES } from "@/features/theme/config/choices";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

// The real action runs here. Nothing mocks the action's module: `mock.module`
// is process-wide and made the action's own tests fail in some orders.
const cookies = mockRequestCookies();
const { PreferencesForm } = await import(".");

const VALUES: PreferencesValues = {
	language: "es",
	theme: "light",
	density: "compact",
	remoteImages: "ask",
};

beforeEach(() => {
	cookies.reset();
});
afterEach(() => {
	cleanup();
	document.documentElement.removeAttribute("data-theme");
});

const select = (label: string) =>
	screen.getByLabelText(label) as HTMLSelectElement;
const pick = (label: string, value: string) =>
	act(async () => {
		fireEvent.change(select(label), { target: { value } });
	});
const submit = () =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "save" }));
	});
const writes = () => cookies.writes.map((w) => [w.name, w.value]);

describe("PreferencesForm", () => {
	it("is a labelled form with a real select for each field, showing the values the server read", () => {
		render(<PreferencesForm values={VALUES} />);

		expect(
			screen.getByRole("form", { name: "formLabel" }),
		).toBeInTheDocument();
		for (const label of ["language", "theme", "density", "remoteImages"]) {
			expect(select(label).tagName).toBe("SELECT");
			expect(select(label)).toBeRequired();
		}
		expect(select("language").value).toBe("es");
		expect(select("theme").value).toBe("light");
		expect(select("density").value).toBe("compact");
	});

	it("offers each list whole and nothing else: the names in their own language, the themes and the densities", () => {
		render(<PreferencesForm values={VALUES} />);

		const options = (label: string) =>
			within(select(label))
				.getAllByRole("option")
				.map((option) => [
					(option as HTMLOptionElement).value,
					option.textContent,
				]);
		expect(options("language")).toEqual(
			SUPPORTED_LOCALES.map((code) => [code, LOCALE_NAMES[code]]),
		);
		expect(options("theme")).toEqual(
			THEME_CHOICES.map((choice) => [choice, `theme_${choice}`]),
		);
		expect(options("density")).toEqual(
			LIST_DENSITIES.map((density) => [density, `density_${density}`]),
		);
		for (const code of SUPPORTED_LOCALES) {
			expect(
				screen.getByRole("option", { name: LOCALE_NAMES[code] }),
			).toHaveAttribute("lang", code);
		}
	});

	it("keeps the browser's own check on and is a real form action, so it posts with no script", () => {
		const { container } = render(<PreferencesForm values={VALUES} />);

		const form = container.querySelector("form");
		expect(form).not.toHaveAttribute("novalidate");
		// React gives a form whose action is a function a placeholder address
		// and the hidden fields the server reads; without script the browser
		// posts them. A button of type submit is what sends it.
		expect(screen.getByRole("button", { name: "save" })).toHaveAttribute(
			"type",
			"submit",
		);
	});

	it("saves what was chosen, says so, and shows the theme at once", async () => {
		await cookies.signIn();
		render(<PreferencesForm values={VALUES} />);

		await pick("language", "de");
		await pick("theme", "dark");
		await pick("density", "comfortable");
		await submit();

		expect(await screen.findByRole("status")).toHaveTextContent("saved");
		expect(writes()).toEqual([
			["locale", "de"],
			["theme", "dark"],
			["list-density", "comfortable"],
			["remote-images", "ask"],
		]);
		expect(document.documentElement.getAttribute("data-theme")).toBe(
			"dark",
		);
	});

	it("saves the system's theme by taking the attribute off", async () => {
		await cookies.signIn();
		document.documentElement.setAttribute("data-theme", "light");
		render(<PreferencesForm values={VALUES} />);

		await pick("theme", "system");
		await submit();

		await screen.findByRole("status");
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	});

	it("says the save did not go through, and leaves the theme alone, when the session is gone", async () => {
		render(<PreferencesForm values={VALUES} />);
		await pick("theme", "dark");

		await submit();

		expect(await screen.findByRole("alert")).toHaveTextContent("failed");
		expect(writes()).toEqual([]);
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	});

	it("sends nothing and names the field when a value is past the browser's check, which no list can hold", async () => {
		await cookies.signIn();
		render(<PreferencesForm values={VALUES} />);
		// What a script does with a value the select never offered.
		const option = document.createElement("option");
		option.value = "klingon";
		select("language").append(option);
		await pick("language", "klingon");

		await act(async () => {
			fireEvent.submit(
				select("language").closest("form") as HTMLFormElement,
			);
		});

		expect(await screen.findByText("notInList")).toBeInTheDocument();
		expect(select("language")).toHaveAttribute("aria-invalid", "true");
		expect(select("language")).toHaveFocus();
		expect(writes()).toEqual([]);
	});

	it("shows the server's refusal under each field it names, focuses the first and says nothing was saved", async () => {
		const refusing = async (): Promise<PreferencesState> => ({
			outcome: "refused",
			fields: { theme: "notInList", density: "required" },
		});
		render(<PreferencesForm values={VALUES} save={refusing} />);

		await submit();

		expect(await screen.findByText("notInList")).toBeInTheDocument();
		expect(screen.getByText("required")).toBeInTheDocument();
		expect(screen.getByText("refused")).toBeInTheDocument();
		expect(select("theme")).toHaveAttribute("aria-invalid", "true");
		expect(select("density")).toHaveAttribute("aria-invalid", "true");
		expect(select("language")).not.toHaveAttribute("aria-invalid");
		await waitFor(() => expect(select("theme")).toHaveFocus());
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	});

	it("shows no notice before the first save", () => {
		render(<PreferencesForm values={VALUES} />);

		expect(screen.queryByRole("status")).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("keeps the focus on the save button while the server answers, and does not send twice", async () => {
		let release: () => void = () => undefined;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		let sent = 0;
		const save = (async () => {
			sent += 1;
			await held;
			return { outcome: "saved", values: VALUES };
		}) as unknown as typeof import("@/features/preferences/actions/save-preferences").savePreferences;
		render(<PreferencesForm values={VALUES} save={save} />);
		const button = screen.getByRole("button", { name: "save" });
		button.focus();

		await act(async () => {
			fireEvent.click(button);
		});
		const busy = screen.getByRole("button", { name: "saving" });
		expect(busy).toHaveAttribute("aria-disabled", "true");
		expect(busy).not.toBeDisabled();
		expect(document.activeElement).toBe(busy);

		await act(async () => {
			fireEvent.click(busy);
		});
		expect(sent).toBe(1);

		await act(async () => {
			release();
		});
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "save" }),
		);
	});
});
