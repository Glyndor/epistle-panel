import { useEffect, useRef } from "react";

import {
	CAPTCHA_ACTION,
	type PublicCaptcha,
} from "@/features/auth/captcha/providers";
import {
	mountWidget,
	type WidgetHandle,
} from "@/features/auth/captcha/widget-adapters";

/**
 * The CAPTCHA widget of the sign-in form. It draws the enabled provider's
 * challenge into a box that keeps its height while the script loads, so the form
 * does not jump, and hands the form a handle to read the token and to draw a new
 * challenge. It exists on the sign-in page only: no other page loads the script.
 */
export function CaptchaWidget({
	config,
	label,
	handle,
	onToken,
	onError,
}: {
	config: PublicCaptcha;
	/** Accessible name of the group, already translated. */
	label: string;
	/** Receives the handle once the widget is drawn, and `null` when it is removed. */
	handle: (value: WidgetHandle | null) => void;
	onToken: (token: string) => void;
	onError: () => void;
}) {
	const container = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the widget is drawn once per config; the callbacks are read through refs below
	useEffect(() => {
		const element = container.current;
		if (!element) {
			return;
		}
		let mounted: WidgetHandle | null = null;
		let cancelled = false;
		mountWidget(config, element, {
			action: CAPTCHA_ACTION,
			theme: window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light",
			onToken,
			onError,
		})
			.then((value) => {
				if (cancelled) {
					value.destroy();
					return;
				}
				mounted = value;
				handle(value);
			})
			.catch(() => {
				if (!cancelled) {
					onError();
				}
			});
		return () => {
			cancelled = true;
			handle(null);
			mounted?.destroy();
		};
	}, [config]);

	return (
		<fieldset className="min-h-20 min-w-0">
			<legend className="sr-only">{label}</legend>
			<div ref={container} className="captcha-widget" />
		</fieldset>
	);
}
