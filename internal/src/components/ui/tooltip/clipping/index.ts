/** What a pointer can press: a tooltip lying over one of these gives way to it. */
export const CONTROLS =
	"a[href], button, input, select, textarea, summary, label, [role='button'], [role='menuitem'], [role='tab']";

/** The values of `overflow` under which a box cuts off what leaves it. */
const CLIPS = new Set(["auto", "scroll", "hidden", "clip"]);

/**
 * Whether a control has been scrolled wholly out of a box that clips it: any
 * ancestor whose overflow is not `visible`. A control that is partly in view
 * is still there to be named.
 */
export function scrolledAway(element: HTMLElement, box: DOMRect): boolean {
	for (
		let parent = element.parentElement;
		parent !== null;
		parent = parent.parentElement
	) {
		const style = getComputedStyle(parent);
		if (!CLIPS.has(style.overflowX) && !CLIPS.has(style.overflowY)) {
			continue;
		}
		const clip = parent.getBoundingClientRect();
		if (clip.width === 0 && clip.height === 0) {
			// Not laid out: it clips nothing that can be measured.
			continue;
		}
		if (
			box.bottom <= clip.top ||
			box.top >= clip.bottom ||
			box.right <= clip.left ||
			box.left >= clip.right
		) {
			return true;
		}
	}
	return false;
}
