"use client";

import {
	ArchiveIcon,
	ChevronDownIcon,
	FileEditIcon,
	FolderIcon,
	InboxIcon,
	SendIcon,
	ShieldAlertIcon,
	Trash2Icon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSidebar } from "@/components/ui/sidebar/context";
import {
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { Tooltip } from "@/components/ui/tooltip";
import type { FolderEntry } from "@/features/mail/folder-fold";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";
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
 * One folder of the tree: the control that folds the folders under it, and
 * the link that opens the folder itself. They are two things, so they are two
 * stops of the keyboard: the control is pressed with Enter or Space and only
 * folds, and the link is followed and only opens.
 *
 * The control is the panel's own collapsible, as the heading of a group of the
 * navigation is: a button that says whether the branch is open
 * (`aria-expanded`) and what it controls. The tree is a flat list indented by
 * depth, so the folders under a folded one are left out of the list instead of
 * being held by a collapsible's content: there is no element for the button
 * to point at, and it says only whether the branch is open.
 *
 * The column the control sits in is kept for every folder, so the names of a
 * level line up whether the folder has folders under it or not. Collapsed to
 * icons there is no room for a tree, so the column is not drawn and every
 * folder is its icon; with the group of the folders closed the branch is not
 * on the page either, and there is nothing to fold.
 *
 * The unread count beside a folder is its own while the branch is open and the
 * whole branch's while it is folded: a folded folder still says what waits
 * under it.
 */
export function FolderRow({
	entry,
	name,
	href,
	active,
	onToggle,
}: {
	/** The folder as the tree holds it: its branch, its place and what it has unread. */
	entry: FolderEntry;
	/** The name the folder shows: a system folder is named in the reader's language. */
	name: string;
	/** Where the link goes. */
	href: Route;
	/** True when the address shows this folder. */
	active: boolean;
	/** Open or close the branch of this folder. */
	onToggle: (open: boolean) => void;
}) {
	const t = useTranslations("mail");
	const tNav = useTranslations("nav");
	const { state, isMobile, closedGroups } = useSidebar();
	const rail = state === "collapsed" && !isMobile;
	const box = entry.box;
	const Icon = box.role === null ? FolderIcon : ICONS[box.role];
	const said =
		entry.unread > 0
			? t("folderWithUnread", { name, count: entry.unread })
			: name;
	// The button says what it would do: fold the branch, or open it again.
	const label = entry.open
		? t("foldFolder", { name })
		: t("unfoldFolder", { name });
	// With the group of the folders closed the branch is not on the page, so
	// there is nothing to fold; on the rail there is no room for a tree.
	const groupClosed = closedGroups.includes("folders");
	const drawn = !rail && !groupClosed;

	return (
		<SidebarMenuItem>
			<div
				data-slot="folder-row"
				className={cn(
					"flex items-center",
					INDENT[Math.min(box.depth, INDENT.length - 1)],
				)}
			>
				{drawn ? (
					<div
						data-slot="folder-twisty"
						className="flex w-8 shrink-0 items-center justify-center"
					>
						{entry.hasChildren ? (
							<Collapsible
								open={entry.open}
								onOpenChange={(next) => {
									// The branch that holds the folder the
									// address shows stays open: the sidebar
									// does not hide where the person is.
									if (!entry.held) {
										onToggle(next);
									}
								}}
							>
								<CollapsibleTrigger asChild>
									<Tooltip label={label} side="right">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											aria-label={label}
											aria-disabled={
												entry.held || undefined
											}
											// Radix would point the button at the
											// content it holds; the tree holds
											// none.
											aria-controls={undefined}
											className="group/folder-toggle hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground"
										>
											<ChevronDownIcon
												aria-hidden="true"
												className="size-4 group-data-[state=closed]/folder-toggle:-rotate-90"
											/>
										</Button>
									</Tooltip>
								</CollapsibleTrigger>
							</Collapsible>
						) : null}
					</div>
				) : null}
				<SidebarMenuButton
					asChild
					isActive={active}
					// On the rail the fill and the mark say which folder is
					// open; the tooltip says it in words.
					tooltip={
						active ? tNav("currentEntry", { name: said }) : said
					}
					className="min-w-0"
				>
					<Link
						href={href}
						aria-current={active ? "page" : undefined}
					>
						<Icon aria-hidden="true" />
						<span className="min-w-0 flex-1 truncate">
							<bdi>{name}</bdi>
						</span>
						{entry.unread > 0 ? (
							<Badge
								variant="default"
								className="px-2 py-0 font-normal"
							>
								<span aria-hidden="true">{entry.unread}</span>
								<span className="sr-only">
									{t("unreadCount", { count: entry.unread })}
								</span>
							</Badge>
						) : null}
					</Link>
				</SidebarMenuButton>
			</div>
		</SidebarMenuItem>
	);
}
