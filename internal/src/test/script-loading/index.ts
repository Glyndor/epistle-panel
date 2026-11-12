/**
 * Keep happy-dom from fetching the scripts a component adds to the page, and
 * make it report each as loaded. Without this a `<script src>` is fetched, fails
 * on the network and fires `error`. Import it for its effect, in a test that
 * loads a script; a test that wants a failure calls `scriptsFinishWith("error")`
 * first and puts it back afterwards.
 */
const settings = (
	window as unknown as {
		happyDOM: {
			settings: {
				disableJavaScriptFileLoading: boolean;
				handleDisabledFileLoadingAsSuccess: boolean;
			};
		};
	}
).happyDOM.settings;

settings.disableJavaScriptFileLoading = true;
settings.handleDisabledFileLoadingAsSuccess = true;

export const scriptLoadingStubbed = true;

/** What an added script does from now on: fire `load` (the default here) or `error`. */
export function scriptsFinishWith(outcome: "load" | "error"): void {
	settings.handleDisabledFileLoadingAsSuccess = outcome === "load";
}
