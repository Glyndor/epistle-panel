import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { ComposeForm } from "@/features/mail/components/compose-form";
import {
	currentMailSession,
	type MailSession,
} from "@/features/mail/jmap/credentials";
import {
	COMPOSE_TITLE,
	composeRequest,
} from "@/features/mail/links/compose-mode";
import { mailHref } from "@/features/mail/links/mail-href";
import { loadComposeLimits } from "@/features/mail/queries/compose-limits";
import { composePrefill } from "@/features/mail/queries/compose-prefill";
import { loadSender } from "@/features/mail/queries/load-identity";
import { loadEmailRecord } from "@/features/mail/queries/message-body";
import {
	type ComposeLimits,
	FALLBACK_COMPOSE_LIMITS,
} from "@/features/mail/schemas/compose-input-limits";
import { logApiFailure } from "@/lib/api/log-failure";
import { requireSession } from "@/lib/auth/require-session";

/**
 * The composer page. `?mode=reply|replyAll|forward|draft&msg=<id>` opens it
 * filled from a message, each parameter checked on its own; a message that
 * cannot be read opens an empty composer instead of an error. Prefill is built
 * here on the server, from cleaned text only.
 *
 * The limits the composer works with are the ones the mail server publishes in
 * its JMAP session, so the browser, the form and the route hold the same
 * numbers. A session that cannot be read leaves the panel's own.
 */
export default async function ComposePage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const t = await getTranslations("mail");
	const locale = await getLocale();
	const { mode, message } = composeRequest(await searchParams);

	let session: MailSession | null = null;
	let limits: ComposeLimits = FALLBACK_COMPOSE_LIMITS;
	try {
		session = await currentMailSession();
		limits =
			session === null
				? FALLBACK_COMPOSE_LIMITS
				: await loadComposeLimits(session);
	} catch (error) {
		logApiFailure("mail compose limits", error);
	}

	let initial = {
		to: "",
		cc: "",
		bcc: "",
		subject: "",
		text: "",
	} as ReturnType<typeof composePrefill>;
	if (message !== undefined) {
		try {
			const email =
				session === null
					? null
					: await loadEmailRecord(session, message);
			// A draft is edited only if it is one (`$draft`): anything else named in
			// `mode=draft` opens an empty composer, so its id never reaches the
			// replace-and-destroy of a save (which checks the folder again).
			const editable =
				mode !== "draft" || email?.keywords?.["$draft"] === true;
			if (session !== null && email !== null && editable) {
				const self = (await loadSender(session))?.email;
				const date = new Intl.DateTimeFormat(locale, {
					dateStyle: "medium",
					timeStyle: "short",
					timeZone: "UTC",
				});
				initial = composePrefill(
					mode,
					email,
					self,
					{
						quoteHeader: (name, when) =>
							t("quoteHeader", { name, date: when }),
						forwardHeader: t("forwardHeader"),
						from: t("from"),
						to: t("to"),
						date: t("date"),
						subject: t("fieldSubject"),
					},
					(iso) =>
						Number.isNaN(new Date(iso).getTime())
							? ""
							: date.format(new Date(iso)),
				);
			}
		} catch (error) {
			logApiFailure("mail compose prefill", error);
		}
	}
	const title = t(COMPOSE_TITLE[mode]);

	return (
		<div className="h-full overflow-y-auto p-2">
			<section
				aria-label={title}
				className="mx-auto max-w-3xl rounded-2xl bg-surface"
			>
				<div className="flex items-center gap-2 p-2">
					<Button asChild variant="ghost" size="sm">
						<Link href={mailHref({})}>
							<ArrowLeftIcon aria-hidden="true" />
							{t("backToMail")}
						</Link>
					</Button>
					<h1 className="font-semibold text-lg">{title}</h1>
				</div>
				<ComposeForm initial={initial} limits={limits} />
			</section>
		</div>
	);
}
