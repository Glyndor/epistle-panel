import { EpistleMark } from "@/components/icons/epistle-mark";

/**
 * The brand's mark: the operator's logo when one is configured, otherwise the
 * Epistle mark. The logo is a same-origin image from `/brand/logo`, decorative
 * because the product name is written beside it. Its box is the same 16 px as
 * an icon, so swapping it changes no layout.
 */
export function BrandMark({ hasLogo }: { hasLogo: boolean }) {
	if (hasLogo) {
		// biome-ignore lint/performance/noImgElement: a same-origin operator image of unknown size, not a Next-optimised asset
		return (
			<img
				src="/brand/logo"
				alt=""
				className="size-4 shrink-0 object-contain"
			/>
		);
	}
	return <EpistleMark />;
}
