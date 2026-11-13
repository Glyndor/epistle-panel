import { PublicFrame } from "@/components/layout/public-frame";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Layout of the mail area: a session of any role is required, and the area
 * loads nothing of the admin area. The real mail client will replace this
 * frame with its own three-pane layout; today it is the placeholder's card.
 */
export default async function MailLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	await requireSession();
	return <PublicFrame>{children}</PublicFrame>;
}
