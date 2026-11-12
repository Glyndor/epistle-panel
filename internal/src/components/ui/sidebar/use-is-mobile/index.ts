import * as React from "react";

/** Viewport width, in px, below which the sidebar becomes a sheet. */
export const MOBILE_BREAKPOINT = 768;

/**
 * Whether the viewport is narrower than {@link MOBILE_BREAKPOINT}. It is
 * `false` on the server and for the first client render, so the server markup
 * and the first hydration pass agree; the real value arrives in an effect.
 */
export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const query = window.matchMedia(
			`(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
		);
		const sync = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		query.addEventListener("change", sync);
		sync();
		return () => query.removeEventListener("change", sync);
	}, []);

	return isMobile;
}
