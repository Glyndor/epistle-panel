import { Mark } from "@/components/charts/mark";

/** How the measured value reads: within its range, close to its end, or at it. */
export type MeterTone = "ok" | "near" | "full";

const FILL = {
	ok: "bg-primary",
	near: "bg-warning-foreground",
	full: "bg-destructive",
} as const satisfies Record<MeterTone, string>;

/**
 * A measurement inside a known range, such as storage used. What a screen
 * reader gets is the native `meter` element, with its value as a percentage
 * and the words to say for it; what is seen is a track and its filled part,
 * drawn beside it and hidden from assistive tech. The tone is never the only
 * cue: the caller writes the figures, and the state when it matters, next to
 * the meter.
 *
 * The filled part is an empty `svg` sized by its `width` attribute
 * (`components/charts/mark`), since the panel's policy refuses a `style`
 * attribute; that is also why this is not Radix's `Progress`, which moves its
 * indicator with an inline transform. The native element is not the one drawn
 * because its bar is styled through vendor pseudo-elements that differ by
 * browser, so its colours could not be tied to the theme's tokens in all of
 * them.
 */
export function Meter({
	share,
	label,
	valueText,
	tone = "ok",
	className,
}: {
	/** The measured part of the range, from 0 to 1; anything outside is brought in. */
	share: number;
	/** Accessible name, already translated. */
	label: string;
	/** What a screen reader says for the value, already translated ("1.2 GB of 5 GB"). */
	valueText: string;
	tone?: MeterTone;
	className?: string | undefined;
}) {
	const percent =
		Math.round(Math.min(1, Math.max(0, share || 0)) * 1000) / 10;

	return (
		<div data-slot="meter" data-tone={tone} className={className}>
			<meter
				className="sr-only"
				aria-label={label}
				aria-valuetext={valueText}
				min={0}
				max={100}
				value={percent}
			>
				{valueText}
			</meter>
			<div
				aria-hidden="true"
				data-slot="meter-track"
				className="flex h-2 w-full overflow-hidden rounded-full bg-sidebar"
			>
				<Mark width={`${percent}%`} height={8} className={FILL[tone]} />
			</div>
		</div>
	);
}
