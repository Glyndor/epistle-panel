import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The reader while its message is on its way. `children` is what stays usable
 * meanwhile, the way back to the list on a narrow screen.
 */
export function ReaderSkeleton({ children }: { children?: React.ReactNode }) {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col" aria-busy="true">
			{children}
			<span className="sr-only" role="status">
				{t("readerLoading")}
			</span>
			<Skeleton className="m-4 h-24" />
			<Skeleton className="m-4 h-48" />
		</div>
	);
}
