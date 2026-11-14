"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { FolderSkeleton } from "@/features/mail/components/folder-skeleton";
import { FolderTree } from "@/features/mail/components/folder-tree";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { mailboxesQueryOptions } from "@/features/mail/queries/mail-query-options";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());

/**
 * The folder tree of the sidebar with its own waiting and unreachable states;
 * the counters refresh in the background.
 */
export function FolderPane() {
	const t = useTranslations("mail");
	const { data, isPending } = useQuery(mailboxesQueryOptions(fetchMailboxes));

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
