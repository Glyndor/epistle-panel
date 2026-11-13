import { BrandMark } from "@/features/branding/components/brand-mark";
import { CopyrightNotice } from "@/features/branding/components/copyright-notice";
import { getBrand } from "@/features/branding/queries/brand";

/**
 * Minimal frame of a page that is a single card: the brand above the page, the
 * `main` landmark the skip target needs, and the copyright notice. The sign-in
 * page and the mail area's placeholder use it.
 */
export function PublicFrame({ children }: { children: React.ReactNode }) {
	const brand = getBrand();
	return (
		<main
			id="main-content"
			className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-4 p-4"
		>
			<p className="flex items-center gap-2 font-semibold">
				<BrandMark hasLogo={brand.hasLogo} />
				{brand.name}
			</p>
			{children}
			<CopyrightNotice className="text-muted-foreground text-xs" />
		</main>
	);
}
