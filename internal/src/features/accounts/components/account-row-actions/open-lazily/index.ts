/**
 * Wait for the code of a part that loads on demand, and hand it over; when it
 * does not come, say so and leave the page as it was.
 *
 * A part awaited here, in a handler, cannot suspend the page around it (a
 * suspended page hides everything under its nearest boundary) and cannot take
 * the page to its error screen. Each call asks for the code again: a rejected
 * promise kept by the caller would fail on every later press, and one that is
 * asked for anew can succeed once the network is back.
 */
export async function openLazily<T>(
	load: () => Promise<T>,
	onLoaded: (loaded: T) => void,
	onFailed: () => void,
): Promise<void> {
	let loaded: T;
	try {
		loaded = await load();
	} catch {
		onFailed();
		return;
	}
	onLoaded(loaded);
}
