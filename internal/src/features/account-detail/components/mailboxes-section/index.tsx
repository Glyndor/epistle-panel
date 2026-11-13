"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getMailboxesAction } from "@/features/account-detail/actions/get-mailboxes";
import { SectionCard } from "@/features/account-detail/components/section-card";
import { mailboxesQueryOptions } from "@/features/account-detail/queries/account-queries";
import { unwrap } from "@/lib/query/action-result";

/** Indentation by depth, as classes: the policy has no inline style. */
const INDENT = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16"] as const;

/** The mailboxes of the account, as the tree the server reports. */
export function MailboxesSection({ name }: { name: string }) {
	const t = useTranslations("accountDetail");
	const { data, isPending } = useQuery(
		mailboxesQueryOptions(name, async () =>
			unwrap(await getMailboxesAction({ name })),
		),
	);

	return (
		<SectionCard id="mailboxes" title={t("mailboxesTitle")}>
			{isPending ? (
				<Skeleton className="h-12" aria-busy="true" />
			) : data === undefined ? (
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			) : data.length === 0 ? (
				<Empty className="p-3">
					<EmptyDescription>{t("mailboxesEmpty")}</EmptyDescription>
				</Empty>
			) : (
				<ul className="flex flex-col gap-1 font-mono text-sm">
					{data.map((mailbox) => (
						<li
							key={mailbox.id}
							className={`break-all ${INDENT[Math.min(mailbox.depth, INDENT.length - 1)]}`}
						>
							{mailbox.name}
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}
