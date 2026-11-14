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
import { useTranslations } from "next-intl";

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

/** Indent per tree level, as classes so no style attribute is needed. */
const INDENT = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14"] as const;

/**
 * The folder tree: one link per mailbox, the system folders named in the
 * reader's language, the unread counter beside each. The current folder is
 * marked with `aria-current`. It is a `nav` landmark with its own name, so it
 * can be reached from the landmark list as well as by Tab.
 */
export function FolderTree({
	boxes,
	activeId,
}: {
	boxes: readonly MailboxView[];
	activeId: string;
}) {
	const t = useTranslations("mail");
	// A role's path opens the first folder with that role, so only that one is addressed by it.
	const byRole = new Map<string, string>();
	for (const box of boxes) {
		if (box.role !== null && !byRole.has(box.role)) {
			byRole.set(box.role, box.id);
		}
	}

	return (
		<nav aria-label={t("folders")} className="p-2">
			<ul className="flex flex-col gap-0.5">
				{boxes.map((box) => {
					const Icon =
						box.role === null ? FolderIcon : ICONS[box.role];
					const active = box.id === activeId;
					return (
						<li key={box.id}>
							<Link
								href={mailHref({
									box: box.id,
									role:
										box.role !== null &&
										byRole.get(box.role) === box.id
											? box.role
											: null,
								})}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex min-h-8 items-center gap-2 rounded-md py-1 pr-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11",
									INDENT[
										Math.min(box.depth, INDENT.length - 1)
									],
									active &&
										"bg-accent font-medium text-accent-foreground",
								)}
							>
								<Icon
									aria-hidden="true"
									className="size-4 shrink-0"
								/>
								<span className="min-w-0 flex-1 truncate">
									{box.role === null
										? box.name
										: t(`role_${box.role}`)}
								</span>
								{box.unread > 0 ? (
									<span className="shrink-0 rounded-full bg-primary px-2 text-primary-foreground text-xs">
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
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
