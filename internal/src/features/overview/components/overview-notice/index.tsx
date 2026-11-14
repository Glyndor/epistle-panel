import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { firstUnreachable } from "@/features/overview/queries/first-unreachable";
import { requestDeliveryOverview } from "@/features/overview/queries/load-delivery-overview";
import { requestQueueOverview } from "@/features/overview/queries/load-queue-overview";
import { requestSuppressionOverview } from "@/features/overview/queries/load-suppression-overview";
import { requestStatus } from "@/features/overview/queries/request-status";
import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";

/**
 * The one warning of the overview when the API did not answer: at the top of
 * the page, once, with a way out. The cards that could not be drawn say so in
 * a quiet line each and do not repeat it.
 *
 * It asks for the same reads as the cards (each is cached for the request, so
 * the API is not asked twice) and is there as soon as one of them fails. With
 * every read answered it draws nothing.
 *
 * The link is the text colour of the warning in every state. The panel's
 * links dim to 70 % while pressed, which on the warning's fill measured 4.05:1
 * in the light theme; this one shows its press with a thicker line under it.
 *
 * The way out is a plain link to the address the reader is on, not a router
 * link: the browser loads the page again and the server reads again, where a
 * router link to the current address may answer from what it already has.
 */
export async function OverviewNotice({
	period,
	href,
}: {
	period: OverviewPeriod;
	/** The address of the page as the reader has it, period included. */
	href: Route;
}) {
	const failed = (overview: { kind: string }) =>
		overview.kind === "unreachable";
	const unreachable = await firstUnreachable([
		requestStatus().then(
			() => false,
			() => true,
		),
		requestDeliveryOverview(period).then(failed),
		requestQueueOverview().then(failed),
		requestSuppressionOverview().then(failed),
	]);
	if (!unreachable) {
		return null;
	}
	const t = await getTranslations("overview");
	return (
		<Alert variant="warning" data-slot="overview-notice">
			<AlertDescription>{t("unreachable")}</AlertDescription>
			<Button
				asChild
				variant="link"
				className="justify-start self-start px-0 text-warning-foreground active:text-warning-foreground active:underline active:decoration-2 pointer-coarse:px-0"
			>
				<a href={href}>{t("retry")}</a>
			</Button>
		</Alert>
	);
}
