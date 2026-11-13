import { PenLineIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { composeHref } from "@/features/mail/links/mail-href";

/** The way into the composer, from the folder column and from the narrow-screen bar. */
export function WriteLink() {
	const t = useTranslations("mail");

	return (
		<Button asChild size="sm">
			<Link href={composeHref()}>
				<PenLineIcon aria-hidden="true" />
				{t("compose")}
			</Link>
		</Button>
	);
}
