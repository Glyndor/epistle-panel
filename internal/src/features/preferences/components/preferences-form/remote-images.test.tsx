import { afterEach, beforeEach, expect, it } from "bun:test";
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
	remoteImages: "never",
	timeZone: "UTC",
	pageSize: "50",
	refresh: "normal",
} as const;
it("offers exactly the three modes as a fourth required labelled field", () => {
	render(<PreferencesForm values={values} />);
	const field = screen.getByRole("combobox", { name: "remoteImages" });
	expect(screen.getAllByRole("combobox")).toHaveLength(7);
	expect(field).toBeRequired();
	expect(field).toHaveValue("never");
	expect(
		Array.from(field.querySelectorAll("option")).map((o) => [
			o.value,
			o.textContent,
		]),
	).toEqual([
		["ask", "remoteImages_ask"],
		["always", "remoteImages_always"],
		["never", "remoteImages_never"],
	]);
	expect(
		document.getElementById(field.getAttribute("aria-describedby") ?? ""),
	).toHaveTextContent("remoteImagesHelp");
});
it("uses ask when older values omit the fourth preference", () => {
	render(
		<PreferencesForm
			values={{
				language: "en",
				theme: "system",
				density: "comfortable",
				remoteImages: "ask",
				timeZone: "UTC",
				pageSize: "50",
				refresh: "normal",
			}}
		/>,
	);
	expect(screen.getByRole("combobox", { name: "remoteImages" })).toHaveValue(
		"ask",
	);
});
it("submits to the action when older values omit the fourth preference, posting ask", async () => {
	const posted: unknown[] = [];
	render(
		<PreferencesForm
			values={{
				language: "en",
				theme: "system",
				density: "comfortable",
				remoteImages: "ask",
				timeZone: "UTC",
				pageSize: "50",
				refresh: "normal",
			}}
			save={async (_previous, formData) => {
				posted.push(formData.get("remoteImages"));
				return { outcome: "idle" };
			}}
		/>,
	);
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "save" }));
	});
	expect(posted).toEqual(["ask"]);
	expect(screen.queryByText("required")).toBeNull();
});
it("keeps the focus where it is when an operator-fixed field is refused", async () => {
	render(
		<PreferencesForm
			values={values}
			operatorRemoteImagesMode="never"
			save={async () => ({
				outcome: "refused",
				fields: { remoteImages: "notInList" },
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
it("renders the operator statement as accessible text and posts no remote image field", () => {
	for (const mode of ["ask", "always", "never"] as const) {
		const { container } = render(
			<PreferencesForm values={values} operatorRemoteImagesMode={mode} />,
		);
		expect(screen.getAllByRole("combobox")).toHaveLength(6);
		expect(container.querySelector('[name="remoteImages"]')).toBeNull();
		const group = screen.getByRole("group", { name: "remoteImages" });
		expect(group).toHaveTextContent("remoteImagesSetByOperator");
		expect(
			document.getElementById(
				group.getAttribute("aria-describedby") ?? "",
			),
		).toHaveTextContent("remoteImagesHelp");
		expect(clientSaid).toContainEqual({
			key: "remoteImagesSetByOperator",
			values: { mode: `remoteImages_${mode}` },
		});
		cleanup();
	}
});
it("sends the changed fourth field through the real action", async () => {
	cookies.reset();
	await cookies.signIn();
	render(<PreferencesForm values={values} />);
	await act(async () => {
		fireEvent.change(
			screen.getByRole("combobox", { name: "remoteImages" }),
			{ target: { value: "always" } },
		);
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "save" }));
	});
	expect(await screen.findByRole("status")).toHaveTextContent("saved");
	expect(
		cookies.writes.find((w) => w.name === "__Host-remote-images")?.value,
	).toBe("always");
});
it("shows and focuses the server refusal of the fourth field", async () => {
	render(
		<PreferencesForm
			values={values}
			save={async () => ({
				outcome: "refused",
				fields: { remoteImages: "notInList" },
			})}
		/>,
	);
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "save" }));
	});
	expect(await screen.findByText("notInList")).toBeInTheDocument();
	expect(
		screen.getByRole("combobox", { name: "remoteImages" }),
	).toHaveFocus();
	expect(screen.getByText("refused")).toBeInTheDocument();
});
