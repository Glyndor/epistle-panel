import { getTranslations } from "next-intl/server";

import { MailBreadcrumbs } from "@/features/mail/components/mail-breadcrumbs";
import {
	COMPOSE_TITLE,
	composeRequest,
} from "@/features/mail/links/compose-mode";

/**
 * The trail of the composer: the mail area, then what the composer was opened
 * for (a new message, a reply, a forward, a draft), read from its address by
 * the same rule as the page.
 */
export default async function Trail({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const t = await getTranslations("mail");
	const { mode } = composeRequest(await searchParams);

	return (
		<MailBreadcrumbs
			place={{ kind: "page", title: t(COMPOSE_TITLE[mode]) }}
		/>
	);
}
