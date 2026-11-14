import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { ListToolbar } from "@/features/mail/components/list-toolbar";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { MessageList } from "@/features/mail/components/message-list";
import { folderPath } from "@/features/mail/links/mail-href";
import { loadMessageList } from "@/features/mail/queries/load-message-list";
import { messageListQueryOptions } from "@/features/mail/queries/mail-query-options";
import {
	type PlaceRef,
	requestMailSession,
	resolvePlace,
} from "@/features/mail/queries/request-mail";
import type { ListFilter } from "@/features/mail/schemas/mail-input";
import { prefetch } from "@/lib/query/prefetch";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The list pane, streamed: the search and the filters of the open folder, and
 * its page of messages, read on the server and then owned by Query in the
 * browser. A folder asked for by its role waits for the folders first; one
 * asked for by its id does not. An account with no folder of the role asked
 * for is told so. A list that cannot be read is logged and left to the client
 * component, which asks for itself. The caller checks the session first.
 */
export async function ListBoundary({
	place,
	page,
	filter,
	q,
	selectedId,
}: {
	place: PlaceRef;
	page: number;
	filter: ListFilter;
	q: string;
	selectedId: string | undefined;
}) {
	const client = makeQueryClient();
	const [session, resolved, t] = await Promise.all([
		requestMailSession(),
		resolvePlace(place),
		getTranslations("mail"),
	]);
	if (resolved.box === null) {
		// Not being able to read the folders is not the same as having none.
		return resolved.unreadable ? (
			<MailNotice
				tone="error"
				action={
					<Button asChild variant="outline" size="sm">
						<a href={folderPath({ role: resolved.role })}>
							{t("retry")}
						</a>
					</Button>
				}
			>
				{t("unavailable")}
			</MailNotice>
		) : (
			<MailNotice tone="empty">{t("noFolder")}</MailNotice>
		);
	}
	const input = { box: resolved.box, page, filter, q };
	if (session !== null) {
		await prefetch(
			client,
			messageListQueryOptions(input, (asked) =>
				loadMessageList(session, asked),
			),
			"mail list",
		);
	}

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<ListToolbar
				box={resolved.box}
				folderRole={resolved.role}
				filter={filter}
				q={q}
			/>
			<div className="relative min-h-0 flex-1 overflow-y-auto">
				<MessageList
					view={{ ...input, role: resolved.role }}
					selectedId={selectedId}
				/>
			</div>
		</HydrationBoundary>
	);
}
