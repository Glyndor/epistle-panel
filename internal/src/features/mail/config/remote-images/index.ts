export const REMOTE_IMAGE_MODES = ["ask", "always", "never"] as const;
export type RemoteImageMode = (typeof REMOTE_IMAGE_MODES)[number];

export const DEFAULT_REMOTE_IMAGE_MODE: RemoteImageMode = "ask";

export const REMOTE_IMAGES_COOKIE = "remote-images";
export const REMOTE_IMAGES_COOKIE_PATH = "/app";

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
