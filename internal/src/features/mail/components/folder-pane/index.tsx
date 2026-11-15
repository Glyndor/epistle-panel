"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { FolderSkeleton } from "@/features/mail/components/folder-skeleton";
import { FolderTree } from "@/features/mail/components/folder-tree";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { MAIL_REFRESH_MS } from "@/features/mail/queries/mail-query-keys";
import { mailboxesQueryOptions } from "@/features/mail/queries/mail-query-options";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { useRefreshInterval } from "@/features/refresh/components/refresh-provider";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());

/**
 * The folder tree of the sidebar with its own waiting and unreachable states;
 * the counters refresh in the background.
 *
 * The folders the server read are the tree's first paint: they are what the
 * query starts with, so the tree is in the page the server sends. The browser
 * owns the list from then on and refreshes it.
 */
export function FolderPane({
	boxes,
}: {
	/** The folders the server read, when it could read them. */
	boxes: MailboxView[] | undefined;
}) {
	const t = useTranslations("mail");
	const refreshMs = useRefreshInterval(MAIL_REFRESH_MS);
	const { data, isPending } = useQuery({
		...mailboxesQueryOptions(fetchMailboxes, refreshMs),
		initialData: () => boxes,
	});

	if (isPending) {
		return <FolderSkeleton />;
	}
	if (data === undefined) {
		// The rail collapsed to icons has no room for a sentence: it is kept
		// for a screen reader there, and drawn once the sidebar is expanded.
		return (
			<div className="group-data-[collapsible=icon]:sr-only">
				<MailNotice tone="error">{t("unavailable")}</MailNotice>
			</div>
		);
	}
	return <FolderTree boxes={data} />;
}
