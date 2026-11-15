import "server-only";

import {
	isRemoteImageMode,
	type RemoteImageMode,
} from "@/features/mail/config/remote-images";

import { ConfigError } from "../config-error";

export const REMOTE_IMAGES_VARIABLE = "EPISTLE_PANEL_REMOTE_IMAGES";

export function readOperatorRemoteImagesMode(): RemoteImageMode | null {
	const value = (process.env[REMOTE_IMAGES_VARIABLE] ?? "").trim();
	if (value === "") {
		return null;
	}
	if (!isRemoteImageMode(value)) {
		throw new ConfigError(
			`${REMOTE_IMAGES_VARIABLE} is set to a mode the panel does not support`,
		);
	}
	return value;
}
