import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
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
	timeZone: "UTC",
	pageSize: "100",
	refresh: "slow",
} as const;

describe("PreferencesForm page size", () => {
	it("offers exactly the three sizes as a required labelled select on the value the server read", () => {
		render(<PreferencesForm values={values} />);
		const field = screen.getByRole("combobox", { name: "pageSize" });

		expect(field).toBeRequired();
		expect(field).toHaveValue("100");
		expect(
			Array.from(field.querySelectorAll("option")).map((o) => [
				o.value,
				o.textContent,
			]),
		).toEqual([
			["25", "pageSizeOption"],
			["50", "pageSizeOption"],
			["100", "pageSizeOption"],
		]);
		expect(clientSaid).toContainEqual({
			key: "pageSizeOption",
			values: { count: 25 },
		});
		expect(
			document.getElementById(
				field.getAttribute("aria-describedby") ?? "",
			),
		).toHaveTextContent("pageSizeHelp");
	});

	it("says the operator's size as text and posts no field when the operator fixed it", () => {
		for (const size of ["25", "50", "100"] as const) {
			const { container } = render(
				<PreferencesForm values={values} operatorPageSize={size} />,
			);

			expect(screen.getAllByRole("combobox")).toHaveLength(6);
			expect(container.querySelector('[name="pageSize"]')).toBeNull();
			const group = screen.getByRole("group", { name: "pageSize" });
			expect(group).toHaveTextContent("pageSizeSetByOperator");
			expect(
				document.getElementById(
					group.getAttribute("aria-describedby") ?? "",
				),
			).toHaveTextContent("pageSizeHelp");
			expect(clientSaid).toContainEqual({
				key: "pageSizeOption",
				values: { count: Number(size) },
			});
			cleanup();
		}
	});

	it("sends the changed size through the real action", async () => {
		await cookies.signIn();
		render(<PreferencesForm values={values} />);

		await act(async () => {
			fireEvent.change(
				screen.getByRole("combobox", { name: "pageSize" }),
				{
					target: { value: "25" },
				},
			);
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "save" }));
		});

		expect(await screen.findByRole("status")).toHaveTextContent("saved");
		expect(cookies.writes.find((w) => w.name === "page-size")?.value).toBe(
			"25",
		);
	});

	it("shows and focuses the server's refusal of the size, and keeps the focus when the operator fixed it", async () => {
		const refusing = async () => ({
			outcome: "refused" as const,
			fields: { pageSize: "notInList" as const },
		});
		render(<PreferencesForm values={values} save={refusing} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "save" }));
		});
		expect(await screen.findByText("notInList")).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "pageSize" }),
		).toHaveFocus();
		cleanup();

		render(
			<PreferencesForm
				values={values}
				operatorPageSize="25"
				save={refusing}
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
});

describe("PreferencesForm refresh pace", () => {
	it("offers exactly the three paces, and no off, as a required labelled select", () => {
		render(<PreferencesForm values={values} />);
		const field = screen.getByRole("combobox", { name: "refresh" });

		expect(field).toBeRequired();
		expect(field).toHaveValue("slow");
		expect(
			Array.from(field.querySelectorAll("option")).map((o) => [
				o.value,
				o.textContent,
			]),
		).toEqual([
			["normal", "refresh_normal"],
			["slow", "refresh_slow"],
			["fast", "refresh_fast"],
		]);
		expect(
			document.getElementById(
				field.getAttribute("aria-describedby") ?? "",
			),
		).toHaveTextContent("refreshHelp");
	});

	it("says the operator's pace as text and posts no field when the operator fixed it", () => {
		for (const pace of ["normal", "slow", "fast"] as const) {
			const { container } = render(
				<PreferencesForm values={values} operatorRefresh={pace} />,
			);

			expect(screen.getAllByRole("combobox")).toHaveLength(6);
			expect(container.querySelector('[name="refresh"]')).toBeNull();
			const group = screen.getByRole("group", { name: "refresh" });
			expect(group).toHaveTextContent("refreshSetByOperator");
			expect(clientSaid).toContainEqual({
				key: "refreshSetByOperator",
				values: { pace: `refresh_${pace}` },
			});
			cleanup();
		}
	});

	it("sends the changed pace through the real action", async () => {
		await cookies.signIn();
		render(<PreferencesForm values={values} />);

		await act(async () => {
			fireEvent.change(
				screen.getByRole("combobox", { name: "refresh" }),
				{
					target: { value: "fast" },
				},
			);
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "save" }));
		});

		expect(await screen.findByRole("status")).toHaveTextContent("saved");
		expect(cookies.writes.find((w) => w.name === "refresh")?.value).toBe(
			"fast",
		);
	});

	it("shows and focuses the server's refusal of the pace, and keeps the focus when the operator fixed it", async () => {
		const refusing = async () => ({
			outcome: "refused" as const,
			fields: { refresh: "notInList" as const },
		});
		render(<PreferencesForm values={values} save={refusing} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "save" }));
		});
		expect(await screen.findByText("notInList")).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "refresh" })).toHaveFocus();
		cleanup();

		render(
			<PreferencesForm
				values={values}
				operatorRefresh="fast"
				save={refusing}
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
});
