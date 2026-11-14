"use client";

import {
	ArchiveIcon,
	FileEditIcon,
	FolderIcon,
	InboxIcon,
	SendIcon,
	ShieldAlertIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { NavSection } from "@/components/layout/nav-section";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { activeFolder } from "@/features/mail/links/active-folder";
import { mailHref } from "@/features/mail/links/mail-href";
import type {
	MailboxRole,
	MailboxView,
} from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

const ICONS = {
	inbox: InboxIcon,
	drafts: FileEditIcon,
	sent: SendIcon,
	archive: ArchiveIcon,
	junk: ShieldAlertIcon,
	trash: Trash2Icon,
} as const satisfies Record<MailboxRole, unknown>;

/**
 * Indent per tree level, as classes so no style attribute is needed. Collapsed
 * to icons the rail has no room for a tree, so every folder sits in one column.
 */
const INDENT = [
	"",
	"pl-5 group-data-[collapsible=icon]:pl-0",
	"pl-8 group-data-[collapsible=icon]:pl-0",
	"pl-11 group-data-[collapsible=icon]:pl-0",
	"pl-14 group-data-[collapsible=icon]:pl-0",
] as const;

/**
 * The folders of the account, in the mail area's sidebar: one link per
 * mailbox under a heading that opens and closes them, the system folders named
 * in the reader's language, the unread counter beside each. The current folder
 * is the one the address shows, marked with `aria-current`. Collapsed to
 * icons, a folder is its icon and a tooltip says its name and what is unread.
 * It is a `nav` landmark with its own name, so it can be reached from the
 * landmark list as well as by Tab.
 */
export function FolderTree({ boxes }: { boxes: readonly MailboxView[] }) {
	const t = useTranslations("mail");
	const activeId = activeFolder(usePathname(), boxes);
	// A role's path opens the first folder with that role, so only that one is addressed by it.
	const byRole = new Map<string, string>();
	for (const box of boxes) {
		if (box.role !== null && !byRole.has(box.role)) {
			byRole.set(box.role, box.id);
		}
	}

	return (
		<nav aria-label={t("folders")}>
			<NavSection label={t("folders")}>
				<SidebarMenu>
					{boxes.map((box) => {
						const Icon =
							box.role === null ? FolderIcon : ICONS[box.role];
						const active = box.id === activeId;
						const name =
							box.role === null
								? box.name
								: t(`role_${box.role}`);
						return (
							<SidebarMenuItem key={box.id}>
								<SidebarMenuButton
									asChild
									isActive={active}
									tooltip={
										box.unread > 0
											? t("folderWithUnread", {
													name,
													count: box.unread,
												})
											: name
									}
									className={cn(
										INDENT[
											Math.min(
												box.depth,
												INDENT.length - 1,
											)
										],
									)}
								>
									<Link
										href={mailHref({
											box: box.id,
											role:
												box.role !== null &&
												byRole.get(box.role) === box.id
													? box.role
													: null,
										})}
										aria-current={
											active ? "page" : undefined
										}
									>
										<Icon aria-hidden="true" />
										<span className="min-w-0 flex-1 truncate">
											<bdi>{name}</bdi>
										</span>
										{box.unread > 0 ? (
											<span className="shrink-0 rounded-full bg-primary px-2 font-normal text-primary-foreground text-xs">
												<span aria-hidden="true">
													{box.unread}
												</span>
												<span className="sr-only">
													{t("unreadCount", {
														count: box.unread,
													})}
												</span>
											</span>
										) : null}
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</NavSection>
		</nav>
	);
}
