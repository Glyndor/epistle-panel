"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { NavSection } from "@/components/layout/nav-section";
import { SidebarMenu } from "@/components/ui/sidebar/menu";
import { FolderRow } from "@/features/mail/components/folder-tree/row";
import { type FolderEntry, folderEntries } from "@/features/mail/folder-fold";
import { activeFolder } from "@/features/mail/links/active-folder";
import { mailHref } from "@/features/mail/links/mail-href";
import type { MailboxView } from "@/features/mail/schemas/mail-view";

/**
 * The folders of the account, in the mail area's sidebar: one link per
 * mailbox under a heading that opens and closes them, the system folders named
 * in the reader's language, the unread counter beside each. The current folder
 * is the one the address shows, marked with `aria-current`. Collapsed to
 * icons, a folder is its icon and a tooltip says its name, what is unread and
 * whether it is the one that is open. With the heading closed, the current
 * folder is the one entry still drawn.
 * It is a `nav` landmark with its own name, so it can be reached from the
 * landmark list as well as by Tab.
 *
 * A folder that has folders under it also has a control that folds them: the
 * link still opens the folder and the control only folds the branch. Which
 * branches are folded is kept in memory, in this component: the tree the
 * server sends has every branch open, and the browser folds from there, so
 * the first paint is the one the server drew and the choice does not outlive
 * the visit.
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
	// Which branches are folded. Nothing is folded to start with, so the page
	// the server sends and the page the browser draws are the same.
	const [folded, setFolded] = React.useState<ReadonlySet<string>>(
		() => new Set<string>(),
	);
	const entries = folderEntries(boxes, activeId, folded);

	const toggle = (id: string, open: boolean) => {
		setFolded((current) => {
			const next = new Set(current);
			if (open) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const row = (entry: FolderEntry) => {
		const box = entry.box;
		const name = box.role === null ? box.name : t(`role_${box.role}`);
		return (
			<FolderRow
				key={box.id}
				entry={entry}
				name={name}
				href={mailHref({
					box: box.id,
					role:
						box.role !== null && byRole.get(box.role) === box.id
							? box.role
							: null,
				})}
				active={box.id === activeId}
				onToggle={(open) => toggle(box.id, open)}
			/>
		);
	};
	const current = entries.find((entry) => entry.box.id === activeId);

	return (
		<nav aria-label={t("folders")}>
			<NavSection
				id="folders"
				label={t("folders")}
				current={
					current === undefined ? undefined : (
						<SidebarMenu>{row(current)}</SidebarMenu>
					)
				}
			>
				<SidebarMenu>{entries.map(row)}</SidebarMenu>
			</NavSection>
		</nav>
	);
}
