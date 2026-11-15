import { afterEach, beforeEach, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import {
	TIME_ZONE_GROUPS,
	TIME_ZONES,
} from "@/features/time-zone/config/zones";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clientSaid } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { PreferencesForm } = await import(".");
let previousTheme: string | null;
beforeEach(() => {
	previousTheme = document.documentElement.getAttribute("data-theme");
});
afterEach(() => {
	if (previousTheme === null)
		document.documentElement.removeAttribute("data-theme");
	else document.documentElement.setAttribute("data-theme", previousTheme);
	cleanup();
	cookies.reset();
});
const values = {
	language: "en",
	theme: "system",
	density: "comfortable",
	remoteImages: "ask",
	timeZone: "America/Bogota",
	pageSize: "50",
	refresh: "normal",
} as const;
it("offers exactly the closed zone list as a fifth required labelled field", () => {
	render(<PreferencesForm values={values} />);
	const field = screen.getByRole("combobox", { name: "timeZone" });
	expect(screen.getAllByRole("combobox")).toHaveLength(7);
	expect(field).toBeRequired();
	expect(field).toHaveValue("America/Bogota");
	expect(
		Array.from(field.querySelectorAll("option")).map((o) => o.value),
	).toEqual(["UTC", ...TIME_ZONES.filter((zone) => zone !== "UTC")]);
	expect(field.querySelector("option")?.parentElement).toBe(field);
	expect(
		Array.from(field.querySelectorAll("optgroup")).map((g) => g.label),
	).toEqual(TIME_ZONE_GROUPS.slice(1).map((g) => g.region));
	for (const group of field.querySelectorAll("optgroup"))
		for (const option of group.querySelectorAll("option"))
			expect(option.value.split("/")[0]).toBe(group.label);
	expect(
		document.getElementById(field.getAttribute("aria-describedby") ?? ""),
	).toHaveTextContent("timeZoneHelp");
});
it("keeps the focus where it is when an operator-fixed field is refused", async () => {
	render(
		<PreferencesForm
			values={values}
			operatorTimeZone="America/Bogota"
			save={async () => ({
				outcome: "refused",
				fields: { timeZone: "notInList" },
			})}
		/>,
	);
	const button = screen.getByRole("button", { name: "save" });
	button.focus();
	await act(async () => {
		fireEvent.click(button);
	});
	expect(await screen.findByText("refused")).toBeInTheDocument();
	expect(button).toHaveFocus();
});
it("renders the operator statement as accessible text and posts no time zone field", () => {
	for (const mode of [
		"UTC",
		"Pacific/Kiritimati",
		"America/Bogota",
	] as const) {
		const { container } = render(
			<PreferencesForm values={values} operatorTimeZone={mode} />,
		);
		expect(screen.getAllByRole("combobox")).toHaveLength(6);
		expect(container.querySelector('[name="timeZone"]')).toBeNull();
		const group = screen.getByRole("group", { name: "timeZone" });
		expect(group).toHaveTextContent("timeZoneSetByOperator");
		expect(
			document.getElementById(
				group.getAttribute("aria-describedby") ?? "",
			),
		).toHaveTextContent("timeZoneHelp");
		expect(clientSaid).toContainEqual({
			key: "timeZoneSetByOperator",
			values: { zone: mode },
		});
		cleanup();
	}
});
it("sends the changed fifth field through the real action", async () => {
	cookies.reset();
	await cookies.signIn();
	render(<PreferencesForm values={values} />);
	await act(async () => {
		fireEvent.change(screen.getByRole("combobox", { name: "timeZone" }), {
			target: { value: "Pacific/Kiritimati" },
		});
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "save" }));
	});
	expect(await screen.findByRole("status")).toHaveTextContent("saved");
	expect(cookies.writes.find((w) => w.name === "time-zone")?.value).toBe(
		"Pacific/Kiritimati",
	);
});
it("shows and focuses the server refusal of the fifth field", async () => {
	render(
		<PreferencesForm
			values={values}
			save={async () => ({
				outcome: "refused",
				fields: { timeZone: "notInList" },
			})}
		/>,
	);
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "save" }));
	});
	expect(await screen.findByText("notInList")).toBeInTheDocument();
	expect(screen.getByRole("combobox", { name: "timeZone" })).toHaveFocus();
	expect(screen.getByText("refused")).toBeInTheDocument();
});
