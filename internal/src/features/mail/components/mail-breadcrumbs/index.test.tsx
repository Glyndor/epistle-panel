import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { MailBreadcrumbs } from ".";

afterEach(cleanup);

const trail = () => screen.getByRole("navigation", { name: "breadcrumb" });
const steps = () =>
	within(trail())
		.getAllByRole("listitem")
		.map((item) => item.textContent);
const links = () =>
	within(trail())
		.queryAllByRole("link")
		.map((link) => link.getAttribute("href"));
const current = () => [...trail().querySelectorAll('[aria-current="page"]')];

const inbox = { kind: "role", role: "inbox" } as const;
const q4 = { kind: "folder", box: "Work/Q4", name: "Q4" } as const;

describe("MailBreadcrumbs", () => {
	it("is the mail area alone, as the current page, when no place is given", () => {
		render(<MailBreadcrumbs />);

		expect(steps()).toEqual(["heading"]);
		expect(current().map((step) => step.textContent)).toEqual(["heading"]);
		expect(links()).toEqual([]);
	});

	it("leads from the mail to a folder the account has by role, named in the reader's language", () => {
		render(<MailBreadcrumbs place={inbox} />);

		expect(steps()).toEqual(["heading", "role_inbox"]);
		expect(links()).toEqual(["/app/mail"]);
		expect(current().map((step) => step.textContent)).toEqual([
			"role_inbox",
		]);
	});

	it("names any other folder by the name it is given, kept apart from the text around it", () => {
		render(<MailBreadcrumbs place={q4} />);

		expect(steps()).toEqual(["heading", "Q4"]);
		expect(current()[0]?.querySelector("bdi")?.textContent).toBe("Q4");
	});

	it("adds the subject of the open message as the current page, and the folder becomes a link on the folder's own path", () => {
		render(<MailBreadcrumbs place={inbox} subject="Quarterly numbers" />);

		expect(steps()).toEqual(["heading", "role_inbox", "Quarterly numbers"]);
		expect(links()).toEqual(["/app/mail", "/app/mail/inbox"]);
		expect(current().map((step) => step.textContent)).toEqual([
			"Quarterly numbers",
		]);
		cleanup();

		render(<MailBreadcrumbs place={q4} subject="Hi" />);
		expect(links()).toEqual(["/app/mail", "/app/mail/folder/Work_2FQ4"]);
	});

	it("keeps what narrows the folder's list in the folder's link", () => {
		render(
			<MailBreadcrumbs
				place={inbox}
				list={{ page: 3, filter: "unread", q: "invoice" }}
				subject="Hi"
			/>,
		);

		expect(links()).toEqual([
			"/app/mail",
			"/app/mail/inbox?page=3&filter=unread&q=invoice",
		]);
	});

	it("shows a subject as text inside a bdi, whatever it holds", () => {
		const subject = '<img src=x onerror="alert(1)">‮exe.gnp';
		render(<MailBreadcrumbs place={inbox} subject={subject} />);

		const step = current()[0];
		expect(step?.textContent).toBe(subject);
		expect(step?.firstElementChild?.tagName).toBe("BDI");
		expect(trail().querySelector("img")).toBeNull();
		expect(step).toHaveClass("truncate");
	});

	it("says so for a message with no subject, in the panel's own words", () => {
		render(<MailBreadcrumbs place={inbox} subject="" />);

		expect(steps()).toEqual(["heading", "role_inbox", "noSubject"]);
		expect(current()[0]?.querySelector("bdi")).toBeNull();
	});

	it("holds the place of a subject it does not know yet, with no current page", () => {
		render(<MailBreadcrumbs place={inbox} subject={null} />);

		expect(steps()).toEqual(["heading", "role_inbox", ""]);
		expect(current()).toEqual([]);
		expect(trail().querySelector('[data-slot="skeleton"]')).not.toBeNull();
		expect(links()).toEqual(["/app/mail", "/app/mail/inbox"]);
	});

	it("names nothing for a message that could not be read: the folder stays a link", () => {
		render(<MailBreadcrumbs place={inbox} subject={false} />);

		expect(steps()).toEqual(["heading", "role_inbox"]);
		expect(current()).toEqual([]);
		expect(trail().querySelector('[data-slot="skeleton"]')).toBeNull();
		expect(links()).toEqual(["/app/mail", "/app/mail/inbox"]);
	});

	it("leads to a page that is no folder by its title", () => {
		render(
			<MailBreadcrumbs place={{ kind: "page", title: "New message" }} />,
		);

		expect(steps()).toEqual(["heading", "New message"]);
		expect(links()).toEqual(["/app/mail"]);
		expect(current().map((step) => step.textContent)).toEqual([
			"New message",
		]);
	});

	it("uses no inline style", () => {
		const { container } = render(
			<MailBreadcrumbs place={q4} subject={null} />,
		);

		expect(container.querySelector("[style]")).toBeNull();
	});
});
