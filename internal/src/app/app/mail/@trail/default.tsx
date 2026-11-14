import { MailBreadcrumbs } from "@/features/mail/components/mail-breadcrumbs";

/**
 * The trail of the header for an address of the mail area that has no trail
 * of its own: the mail area alone.
 */
export default function Trail() {
	return <MailBreadcrumbs />;
}
