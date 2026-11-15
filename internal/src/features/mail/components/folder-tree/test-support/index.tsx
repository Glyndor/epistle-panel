import { mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { clientStandIn } from "@/test/next-intl";
import { navigationStandIn } from "@/test/next-navigation";
import { FolderTree } from "..";

let pathname = "/app/mail/compose";

export const box = (
	id: string,
	parentId: string | null = null,
	unread = 0,
): MailboxView => ({
	id,
	name: id,
	parentId,
	unread,
	role: null,
	depth: parentId === null ? 0 : 1,
	total: unread,
});

export const boxes = [box("Work", null, 1), box("Q4", "Work", 2), box("Other")];

/** Keep real components; only the framework boundary and translations are stood in. */
export function install() {
	pathname = "/app/mail/compose";
	mock.module("next/navigation", () => ({
		...navigationStandIn(),
		usePathname: () => pathname,
	}));
	mock.module("next-intl", () => ({
		...clientStandIn(),
		useTranslations:
			() => (key: string, values?: Record<string, unknown>) => {
				if (key === "foldFolder") return `Fold ${values?.["name"]}`;
				if (key === "unfoldFolder") return `Unfold ${values?.["name"]}`;
				if (key === "unreadCount") return `${values?.["count"]} unread`;
				return key;
			},
	}));
}

export function reset() {
	cleanup();
	pathname = "/app/mail/compose";
	mock.module("next/navigation", navigationStandIn);
	mock.module("next-intl", clientStandIn);
}

export function tree(list: readonly MailboxView[] = boxes, open = true) {
	const ui = (next: readonly MailboxView[]) => (
		<SidebarProvider defaultOpen={open}>
			<FolderTree boxes={next} />
		</SidebarProvider>
	);
	const result = render(ui(list));
	return {
		...result,
		load: (next: readonly MailboxView[]) => result.rerender(ui(next)),
		navigate: (path: string) => {
			pathname = path;
			result.rerender(ui(list));
		},
	};
}

export const disclosure = (name = "Work", open = true) =>
	screen.getByRole("button", { name: `${open ? "Fold" : "Unfold"} ${name}` });
