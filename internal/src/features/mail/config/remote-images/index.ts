export const REMOTE_IMAGE_MODES = ["ask", "always", "never"] as const;
export type RemoteImageMode = (typeof REMOTE_IMAGE_MODES)[number];

export const DEFAULT_REMOTE_IMAGE_MODE: RemoteImageMode = "ask";

/**
 * The remote-images consent is a security decision, so its cookie carries the
 * `__Host-` prefix: a browser accepts it only with `Secure`, `Path=/` and no
 * `Domain`, and refuses a copy planted from a sibling domain (`Domain=<parent>`)
 * that would otherwise shadow the panel's own and turn the mode into `always`.
 * The old unprefixed `remote-images` cookie is not read any more.
 */
export const REMOTE_IMAGES_COOKIE = "__Host-remote-images";
/** `__Host-` requires `Path=/`. */
export const REMOTE_IMAGES_COOKIE_PATH = "/";

export function isRemoteImageMode(value: unknown): value is RemoteImageMode {
	return REMOTE_IMAGE_MODES.some((mode) => mode === value);
}

export function parseRemoteImageMode(value: unknown): RemoteImageMode {
	return isRemoteImageMode(value) ? value : DEFAULT_REMOTE_IMAGE_MODE;
}

export function allowsRemoteImages(
	mode: RemoteImageMode,
	requested: boolean,
): boolean {
	return mode === "always" || (mode === "ask" && requested);
}
