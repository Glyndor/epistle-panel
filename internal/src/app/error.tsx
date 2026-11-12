"use client";

import { useTranslations } from "next-intl";

import { ErrorNotice } from "@/components/error-notice";

/**
 * Page for an error thrown while rendering a route. Next's built-in error page
 * styles itself inline, which the panel's `style-src 'self'` policy blocks, so
 * the panel renders its own. It sits inside the root layout, so the translation
 * provider is available. The error itself is not shown: its message can carry
 * internals, and the server log already has it.
 */
export default function ErrorPage({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const t = useTranslations("error");
	return (
		<ErrorNotice
			labels={{
				heading: t("heading"),
				body: t("body"),
				retry: t("retry"),
				home: t("home"),
			}}
			onRetry={reset}
		/>
	);
}
