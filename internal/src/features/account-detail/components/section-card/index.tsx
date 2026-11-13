import { Card } from "@/components/ui/card";

/**
 * One section of the account page: a card with its own named region, so each
 * section is a landmark a screen reader can jump to, and a heading and an
 * optional line of help above the content.
 */
export function SectionCard({
	id,
	title,
	description,
	children,
}: {
	/** A stable id for the section, used to name its region. */
	id: string;
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<Card>
			<section
				aria-labelledby={`${id}-title`}
				className="flex flex-col gap-3"
			>
				<div className="flex flex-col gap-1">
					<h2 id={`${id}-title`} className="font-semibold text-base">
						{title}
					</h2>
					{description ? (
						<p className="text-muted-foreground text-sm">
							{description}
						</p>
					) : null}
				</div>
				{children}
			</section>
		</Card>
	);
}
