import { useTranslations } from "next-intl";

import { Trail, type TrailStep } from "@/components/layout/trail";
import { type MailView, mailHref } from "@/features/mail/links/mail-href";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";
import { PUBLIC_ROUTES } from "@/lib/routes";

/** What a page of the mail area is, for its trail. */
export type MailTrailPlace =
	/** The account's folder of a role, named in the reader's language. */
	| { readonly kind: "role"; readonly role: MailboxRole }
	/**
	 * Any other folder: its id, its name already cleaned and cut to its last
	 * part, and the names of the folders above it, outermost first, cleaned
	 * the same way (`Work/Q4` is "Q4" under "Work").
	 */
	| {
			readonly kind: "folder";
			readonly box: string;
			readonly name: string;
			readonly above?: readonly string[] | undefined;
	  }
	/** A page that is no folder, such as the composer, by its title already translated. */
	| { readonly kind: "page"; readonly title: string };

/**
 * The trail of a page of the mail area, in the bar above the content: the
 * mail, the folder and, with a message open, its subject. The folder follows
 * the same paths the folder links do, and carries what narrows its list back
 * to it. A folder inside another is preceded by the folders above it, as
 * words and not links: the address of a folder says nothing of whether the
 * one above it can be opened. The last step is where the person is, marked
 * with `aria-current` and not a link. Where the bar is narrow only the folder
 * and the subject are drawn.
 *
 * `subject` is the open message's, already cleaned: `undefined` with no
 * message open, `null` while it is not known yet (a bar holds its place and no
 * step is the current one) and `false` for a message that could not be read,
 * which leaves the folder as a link and names nothing. A folder's name and a
 * subject are somebody else's text, so each is kept apart from the direction
 * of the text around it.
 */
export function MailBreadcrumbs({
	place,
	list,
	subject,
}: {
	/** Left out, the trail is the mail area alone. */
	place?: MailTrailPlace | undefined;
	/** What narrows the folder's list, kept in the folder's link. */
	list?: Pick<MailView, "page" | "filter" | "q"> | undefined;
	subject?: string | null | false | undefined;
}) {
	const t = useTranslations("mail");
	const tNav = useTranslations("nav");
	const steps: TrailStep[] = [
		{
			key: "area",
			text: t("heading"),
			href: PUBLIC_ROUTES.mail,
			current: place === undefined,
			collapse: true,
		},
	];
	if (place?.kind === "page") {
		steps.push({ key: "page", text: place.title, current: true });
	} else if (place !== undefined) {
		if (place.kind === "folder") {
			for (const [index, name] of (place.above ?? []).entries()) {
				steps.push({
					key: `above-${index}`,
					text: name,
					foreign: true,
					collapse: true,
				});
			}
		}
		steps.push({
			key: "folder",
			text: place.kind === "role" ? t(`role_${place.role}`) : place.name,
			href: mailHref(
				place.kind === "role"
					? { ...list, role: place.role }
					: { ...list, box: place.box },
			),
			current: subject === undefined,
			foreign: place.kind === "folder",
		});
		if (subject !== undefined && subject !== false) {
			steps.push({
				key: "message",
				text: subject === "" ? t("noSubject") : subject,
				current: subject !== null,
				foreign: subject !== "",
			});
		}
	}

	return <Trail label={tNav("breadcrumb")} steps={steps} />;
}
