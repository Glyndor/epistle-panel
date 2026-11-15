import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { useToday } from ".";

afterEach(() => {
	cleanup();
	setSystemTime();
});

function Today({ server, zone }: { server: string; zone: string }) {
	return <p>{useToday(server, zone)}</p>;
}

describe("useToday", () => {
	it("is the server's day for the page the server sends", () => {
		setSystemTime(new Date("2026-11-20T12:00:00Z"));

		expect(
			renderToString(<Today server="2026-11-15" zone="UTC" />),
		).toContain("2026-11-15");
	});

	it("is the day it is in the person's zone, not in Greenwich", () => {
		// 21:30 in Greenwich: already tomorrow in Kolkata and on Kiritimati, still today in Los Angeles.
		setSystemTime(new Date("2026-11-15T21:30:00Z"));
		const days: Record<string, string> = {};
		for (const zone of [
			"UTC",
			"Asia/Kolkata",
			"Pacific/Kiritimati",
			"America/Los_Angeles",
		]) {
			const { unmount } = render(<Today server="x" zone={zone} />);
			days[zone] =
				screen.getByText(/\d{4}-\d{2}-\d{2}/).textContent ?? "";
			unmount();
		}

		expect(days).toEqual({
			UTC: "2026-11-15",
			"Asia/Kolkata": "2026-11-16",
			"Pacific/Kiritimati": "2026-11-16",
			"America/Los_Angeles": "2026-11-15",
		});
	});

	it("reads UTC for a zone this browser does not know", () => {
		setSystemTime(new Date("2026-11-15T21:30:00Z"));
		render(<Today server="x" zone="Mars/Olympus" />);

		expect(screen.getByText("2026-11-15")).toBeInTheDocument();
	});

	it("reads the clock again when the window comes back after midnight", () => {
		setSystemTime(new Date("2026-11-15T23:59:00Z"));
		render(<Today server="2026-11-15" zone="UTC" />);
		expect(screen.getByText("2026-11-15")).toBeInTheDocument();

		setSystemTime(new Date("2026-11-16T00:01:00Z"));
		act(() => {
			window.dispatchEvent(new Event("focus"));
		});
		expect(screen.getByText("2026-11-16")).toBeInTheDocument();

		setSystemTime(new Date("2026-11-17T00:01:00Z"));
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(screen.getByText("2026-11-17")).toBeInTheDocument();
	});

	it("stops listening when it is taken out of the page", () => {
		setSystemTime(new Date("2026-11-15T10:00:00Z"));
		const added: string[] = [];
		const removed: string[] = [];
		const [add, remove] = [
			window.addEventListener,
			window.removeEventListener,
		];
		window.addEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
		) => {
			added.push(type);
			return add.call(window, type, listener);
		}) as typeof window.addEventListener;
		window.removeEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
		) => {
			removed.push(type);
			return remove.call(window, type, listener);
		}) as typeof window.removeEventListener;
		try {
			render(<Today server="x" zone="UTC" />).unmount();
		} finally {
			window.addEventListener = add;
			window.removeEventListener = remove;
		}

		expect(added).toContain("focus");
		expect(removed).toContain("focus");
	});
});
