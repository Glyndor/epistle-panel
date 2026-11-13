"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { FolderTree } from "@/features/mail/components/folder-tree";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { mailboxesQueryOptions } from "@/features/mail/queries/mail-query-options";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());

/** The folder tree with its own waiting and unreachable states; the counters refresh in the background. */
export function FolderPane({ activeId }: { activeId: string }) {
	const t = useTranslations("mail");
	const { data, isPending } = useQuery(mailboxesQueryOptions(fetchMailboxes));

	if (isPending) {
		return (
			<div className="flex flex-col gap-2 p-2" aria-busy="true">
				<Skeleton className="h-8" />
				<Skeleton className="h-8" />
			</div>
		);
	}
	if (data === undefined) {
		return <MailNotice tone="error">{t("unavailable")}</MailNotice>;
	}
	return <FolderTree boxes={data} activeId={activeId} />;
}
