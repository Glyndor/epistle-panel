import { useTranslations } from "next-intl";

import type { HeaderView } from "@/features/mail/schemas/mail-view";

/**
 * Every header of the message as text, behind a disclosure. The values are the
 * cleaned ones (no control or bidi character), so a header cannot fake a second
 * line here; they are shown in a monospace face and wrap anywhere.
 */
export function HeadersDisclosure({
	headers,
}: {
	headers: readonly HeaderView[];
}) {
	const t = useTranslations("mail");

	if (headers.length === 0) {
		return null;
	}
	return (
		<details className="m-4 rounded-xl bg-muted p-4 text-sm">
			<summary className="min-h-8 cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11">
				{t("allHeaders")}
			</summary>
			<dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
				{headers.map((header, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: headers repeat (Received) and the list never reorders
					<div key={`${header.name}-${index}`} className="contents">
						<dt className="text-muted-foreground">{header.name}</dt>
						<dd className="break-all">
							<bdi>{header.value}</bdi>
						</dd>
					</div>
				))}
			</dl>
		</details>
	);
}
