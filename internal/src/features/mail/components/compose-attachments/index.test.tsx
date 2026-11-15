import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import {
	type ComposeLimits,
	FALLBACK_COMPOSE_LIMITS,
} from "@/features/mail/schemas/compose-input-limits";
import { type ComposeAttachment, ComposeAttachments } from ".";

/**
 * The limits the test works with: small ones of their own, so what is checked
 * is that the component reads the limits it is given and not the numbers the
 * panel holds by default.
 */
const limits: ComposeLimits = {
	...FALLBACK_COMPOSE_LIMITS,
	maxAttachmentBytes: 1_000,
	maxAttachments: 2,
};

const originalFetch = globalThis.fetch;
beforeEach(() => clearToasts());
afterEach(clearToasts);
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

/** The content type an upload was sent with. */
const contentType = (init: RequestInit | undefined) =>
	(init?.headers as Record<string, string> | undefined)?.["Content-Type"];
const attached = (n: number): ComposeAttachment => ({
	blobId: `b${n}`,
	name: `f${n}.txt`,
	type: "text/plain",
	size: 3,
});
const file = (name = "a.pdf", type = "application/pdf", size = 3) => {
	const f = new File(["abc"], name, { type });
	Object.defineProperty(f, "size", { value: size });
	return f;
};
const choose = (files: File[]) => {
	const input = document.querySelector(
		"input[type=file]",
	) as HTMLInputElement;
	Object.defineProperty(input, "files", { value: files, configurable: true });
	fireEvent.change(input);
};

describe("ComposeAttachments", () => {
	it("shows the keyboard's focus on the label, since the field that takes it is not drawn", () => {
		const { container } = render(
			<ComposeAttachments
				attachments={[]}
				limits={limits}
				onChange={() => {}}
			/>,
		);
		const field = container.querySelector('input[type="file"]');
		const label = container.querySelector("label");

		expect(field).toHaveClass("peer", "sr-only");
		// `peer-focus-visible` reads the field before it: the label must be the next one.
		expect(field?.nextElementSibling).toBe(label);
		expect(label).toHaveAttribute("for", field?.id ?? "");
		expect(label).toHaveClass(
			"peer-focus-visible:outline-2",
			"peer-focus-visible:outline-ring",
			"peer-focus-visible:outline-offset-2",
		);
	});

	it("uploads each chosen file to the panel's route with its name and type, and lists what came back", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		globalThis.fetch = mock(
			async (url: string | URL, init?: RequestInit) => {
				calls.push({ url: String(url), init: init ?? {} });
				return new Response(
					JSON.stringify({
						ok: true,
						attachment: {
							blobId: "b-new",
							name: "a b.pdf",
							type: "application/pdf",
							size: 3,
						},
					}),
					{ status: 200 },
				);
			},
		) as unknown as typeof fetch;
		const seen: ComposeAttachment[][] = [];
		render(
			<ComposeAttachments
				attachments={[]}
				limits={limits}
				onChange={(next) => seen.push(next)}
			/>,
		);
		choose([file("a b.pdf")]);
		await waitFor(() => expect(seen).toHaveLength(1));
		expect(calls[0]?.url).toBe(
			"/app/mail/upload?name=a%20b.pdf&attachedBytes=0",
		);
		expect(contentType(calls[0]?.init)).toBe("application/pdf");
		expect(seen[0]).toEqual([
			{
				blobId: "b-new",
				name: "a b.pdf",
				type: "application/pdf",
				size: 3,
			},
		]);
	});

	it("sends octet-stream for a file with no type and says which file could not be attached", async () => {
		const calls: RequestInit[] = [];
		globalThis.fetch = mock(
			async (_url: string | URL, init?: RequestInit) => {
				calls.push(init ?? {});
				return new Response(JSON.stringify({ ok: false }), {
					status: 502,
				});
			},
		) as unknown as typeof fetch;
		const seen: ComposeAttachment[][] = [];
		render(
			<ComposeAttachments
				attachments={[]}
				limits={limits}
				onChange={(next) => seen.push(next)}
			/>,
		);
		choose([file("raw", "")]);
		await waitFor(() => expect(calls).toHaveLength(1));
		expect(contentType(calls[0])).toBe("application/octet-stream");
		await new Promise((r) => setTimeout(r, 20));
		expect(seen).toEqual([]);
	});

	it("treats a network failure as a failed upload", async () => {
		globalThis.fetch = mock(async () => {
			throw new TypeError("network");
		}) as unknown as typeof fetch;
		const seen: ComposeAttachment[][] = [];
		render(
			<ComposeAttachments
				attachments={[]}
				limits={limits}
				onChange={(next) => seen.push(next)}
			/>,
		);
		choose([file()]);
		await new Promise((r) => setTimeout(r, 30));
		expect(seen).toEqual([]);
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("refuses a file over the limit and any past the count of files, before anything is sent", async () => {
		const fetched = mock(async () => new Response("{}"));
		globalThis.fetch = fetched as unknown as typeof fetch;
		render(
			<ComposeAttachments
				attachments={Array.from(
					{ length: limits.maxAttachments - 1 },
					(_, i) => attached(i),
				)}
				limits={limits}
				onChange={() => {}}
			/>,
		);
		choose([
			file(
				"big.bin",
				"application/octet-stream",
				limits.maxAttachmentBytes + 1,
			),
		]);
		await new Promise((r) => setTimeout(r, 20));
		expect(fetched).not.toHaveBeenCalled();
		cleanup();
		render(
			<ComposeAttachments
				attachments={Array.from(
					{ length: limits.maxAttachments },
					(_, i) => attached(i),
				)}
				limits={limits}
				onChange={() => {}}
			/>,
		);
		choose([file()]);
		await new Promise((r) => setTimeout(r, 20));
		expect(fetched).not.toHaveBeenCalled();
	});

	it("lists what is attached and removes one on request, naming it for assistive technology", () => {
		const changes: ComposeAttachment[][] = [];
		render(
			<ComposeAttachments
				attachments={[attached(1), attached(2)]}
				limits={limits}
				onChange={(next) => changes.push(next)}
			/>,
		);
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
		fireEvent.click(
			screen.getAllByRole("button", {
				name: "removeAttachment",
			})[0] as HTMLElement,
		);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.length).toBe(1);
	});

	it("names the button that removes a file, an icon alone, in a tooltip", () => {
		render(
			<ComposeAttachments
				attachments={[attached(1)]}
				limits={limits}
				onChange={() => {}}
			/>,
		);

		fireEvent.pointerEnter(
			screen.getByRole("button", { name: "removeAttachment" }),
		);

		expect(
			document.querySelector("[data-slot='tooltip']"),
		).toHaveTextContent("removeAttachment");
	});
});

// Existing files and earlier uploads in the same selection both spend the budget.
it("counts the running total, accepts equality, refuses one byte over and sends the existing bytes", async () => {
	const seen: ComposeAttachment[][] = [];
	const urls: string[] = [];
	globalThis.fetch = (async (url: string | URL | Request) => {
		urls.push(String(url));
		return new Response(
			JSON.stringify({ ok: true, attachment: attached(2) }),
		);
	}) as unknown as typeof fetch;
	render(
		<>
			<Toaster label="Notifications" closeLabel="Close" />
			<ComposeAttachments
				attachments={[attached(1)]}
				limits={{
					...limits,
					maxAttachments: 5,
					maxTotalAttachmentBytes: 6,
				}}
				onChange={(next) => seen.push(next)}
			/>
		</>,
	);
	choose([file(), file("over.txt", "text/plain", 1)]);
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"tooLargeAttachments",
	);
	expect(urls).toEqual(["/app/mail/upload?name=a.pdf&attachedBytes=3"]);
	expect(seen).toHaveLength(1);
	expect(seen[0]?.reduce((sum, a) => sum + a.size, 0)).toBe(6);
	expect(screen.queryByRole("status")).toBeNull();
});

it("has no total cap when unpublished, even when the sum exceeds the file cap", async () => {
	const seen: ComposeAttachment[][] = [];
	globalThis.fetch = (async () =>
		new Response(
			JSON.stringify({
				ok: true,
				attachment: { ...attached(2), size: 1000 },
			}),
		)) as unknown as typeof fetch;
	render(
		<ComposeAttachments
			attachments={[{ ...attached(1), size: 1000 }]}
			limits={limits}
			onChange={(next) => seen.push(next)}
		/>,
	);
	choose([file("new", "text/plain", 1000)]);
	await waitFor(() => expect(seen).toHaveLength(1));
	expect(seen[0]?.reduce((sum, a) => sum + a.size, 0)).toBe(2000);
});

it("names the total budget when the upload route reports a changed limit", async () => {
	const changes = mock(() => {});
	globalThis.fetch = (async () =>
		new Response(
			JSON.stringify({
				ok: false,
				reason: "tooLargeAttachments",
				limit: 2_000_000,
			}),
			{ status: 413 },
		)) as unknown as typeof fetch;
	render(
		<>
			<Toaster label="Notifications" closeLabel="Close" />
			<ComposeAttachments
				attachments={[]}
				limits={limits}
				onChange={changes}
			/>
		</>,
	);
	choose([file()]);
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"tooLargeAttachments",
	);
	expect(changes).not.toHaveBeenCalled();
	await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
});
