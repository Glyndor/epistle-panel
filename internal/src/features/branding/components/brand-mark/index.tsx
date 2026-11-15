import { EpistleMark } from "@/components/icons/epistle-mark";
import { brandImagePath } from "@/features/branding/queries/brand-image-path";

/**
 * The brand's mark: the operator's logo when one is configured, otherwise the
 * Epistle mark. The logo is an image from `/brand/logo`, on the panel's own
 * origin or on the operator's brand origin, decorative
 * because the product name is written beside it. Its box is the same 16 px as
 * an icon, so swapping it changes no layout.
 */
export function BrandMark({ hasLogo }: { hasLogo: boolean }) {
	if (hasLogo) {
		return (
			// biome-ignore lint/performance/noImgElement: an operator image of unknown size, not a Next-optimised asset
			<img
				src={brandImagePath("logo")}
				alt=""
				className="size-4 shrink-0 object-contain"
			/>
		);
	}
	return <EpistleMark />;
}
