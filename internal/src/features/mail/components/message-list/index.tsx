"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { getMessageListAction } from "@/features/mail/actions/get-message-list";
import { ListPager } from "@/features/mail/components/list-pager";
import { ListSkeleton } from "@/features/mail/components/list-skeleton";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { MessageGroups } from "@/features/mail/components/message-groups";
import { listMemory } from "@/features/mail/components/message-list/list-memory";
import { useKeptFocus } from "@/features/mail/components/message-list/use-kept-focus";
import { useMailShortcuts } from "@/features/mail/components/message-list/use-mail-shortcuts";
import type { ListAddress } from "@/features/mail/links/mail-href";
import { mailHref } from "@/features/mail/links/mail-href";
import { messageListQueryOptions } from "@/features/mail/queries/mail-query-options";
import {
	EMPTY_CONDITIONS,
	hasConditions,
} from "@/features/mail/schemas/list-conditions-model";
import { unwrap } from "@/lib/query/action-result";

const fetchList = async (input: Parameters<typeof getMessageListAction>[0]) =>
	unwrap(await getMessageListAction(input));

/** What selects the list on screen, and how its folder is addressed. */
export type ListView = ListAddress;

/**
 * The messages of the folder, one page. The page is prefetched on the server
 * and then owned by Query, which refreshes it while the tab is in view and
 * keeps the previous page on screen while the next one loads. It shows what
 * there is to show in every state: waiting, unreachable (with a retry), an
 * empty folder and a search or filter that matches nothing.
 */
export function MessageList({
	view,
	selectedId,
}: {
	view: ListView;
	selectedId: string | undefined;
}) {
	const t = useTranslations("mail");
	const { data, isPending, isError, refetch, isFetching, isPlaceholderData } =
		useQuery(
			messageListQueryOptions(
				// The folder's role addresses it and is no part of what is asked.
				{
					box: view.box,
					page: view.page,
					conditions: view.conditions,
				},
				fetchList,
			),
		);
	const ids = data?.items.map((item) => item.id) ?? [];
	useMailShortcuts({ ids, selectedId });
	// What names this list among the lists of the page: its scroll is kept
	// by it. The previous page, left on screen while this one is on its way,
	// is not this list yet.
	const focus = useKeptFocus(
		ids,
		data !== undefined && !isPlaceholderData && !isError,
		[view.box, view.page, JSON.stringify(view.conditions)].join("\n"),
	);
	// The list's own heading, for assistive technology: the pane is named for
	// the eye by the folder it shows. The date headings are one level under it.
	const frame = (body: React.ReactNode) => (
		<div ref={focus.list} data-slot="message-list" className="contents">
			<h2 className="sr-only">{t("listLabel")}</h2>
			{body}
		</div>
	);

	if (isPending) {
		return frame(<ListSkeleton />);
	}
	if (data === undefined || isError) {
		return frame(
			<MailNotice
				tone="error"
				action={
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isFetching}
						onClick={() => void refetch()}
					>
						{t("retry")}
					</Button>
				}
			>
				{t("unavailable")}
			</MailNotice>,
		);
	}
	if (data.items.length === 0) {
		const filtered = hasConditions(view.conditions);
		// The notice takes the focus when the last row leaves under it: it is
		// in view and draws the ring, which a heading for assistive technology
		// alone would not.
		return frame(
			<div
				ref={focus.empty}
				tabIndex={-1}
				data-slot="empty-list"
				className="m-1 rounded-xl outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2"
			>
				<MailNotice
					tone="empty"
					action={
						filtered ? (
							<Button asChild variant="outline" size="sm">
								<Link
									href={mailHref({
										box: view.box,
										role: view.role,
										conditions: EMPTY_CONDITIONS,
									})}
									onClick={() => {
										// Every condition goes, and the chips are
										// drawn again without any: the focus
										// goes to the search field.
										listMemory.chips = "all";
									}}
								>
									{t("clearAll")}
								</Link>
							</Button>
						) : null
					}
				>
					{filtered
						? `${t("emptyMatches")} ${t("emptyHint")}`
						: t("emptyFolder")}
				</MailNotice>
			</div>,
		);
	}
	return frame(
		<>
			<MessageGroups
				items={data.items}
				today={data.today}
				selectedId={selectedId}
				view={view}
			/>
			<ListPager
				view={view}
				page={data.page}
				hasNext={data.hasNext}
				total={data.total}
			/>
		</>,
	);
}
