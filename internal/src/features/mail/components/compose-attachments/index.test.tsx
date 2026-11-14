import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts } from "@/components/ui/toaster";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_COMPOSE_ATTACHMENTS,
} from "@/features/mail/schemas/compose-input-limits";
import { type ComposeAttachment, ComposeAttachments } from ".";

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
				onChange={(next) => seen.push(next)}
			/>,
		);
		choose([file("a b.pdf")]);
		await waitFor(() => expect(seen).toHaveLength(1));
		expect(calls[0]?.url).toBe("/app/mail/upload?name=a%20b.pdf");
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
				onChange={(next) => seen.push(next)}
			/>,
		);
		choose([file()]);
		await new Promise((r) => setTimeout(r, 30));
		expect(seen).toEqual([]);
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("refuses a file over 25 MB and any past 20 files before anything is sent", async () => {
		const fetched = mock(async () => new Response("{}"));
		globalThis.fetch = fetched as unknown as typeof fetch;
		render(
			<ComposeAttachments
				attachments={Array.from(
					{ length: MAX_COMPOSE_ATTACHMENTS - 1 },
					(_, i) => attached(i),
				)}
				onChange={() => {}}
			/>,
		);
		choose([
			file(
				"big.bin",
				"application/octet-stream",
				MAX_ATTACHMENT_BYTES + 1,
			),
		]);
		await new Promise((r) => setTimeout(r, 20));
		expect(fetched).not.toHaveBeenCalled();
		cleanup();
		render(
			<ComposeAttachments
				attachments={Array.from(
					{ length: MAX_COMPOSE_ATTACHMENTS },
					(_, i) => attached(i),
				)}
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
