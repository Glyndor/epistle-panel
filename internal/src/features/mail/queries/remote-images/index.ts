import "server-only";

import { cookies } from "next/headers";

import {
	parseRemoteImageMode,
	REMOTE_IMAGES_COOKIE,
	type RemoteImageMode,
} from "@/features/mail/config/remote-images";
import { readOperatorRemoteImagesMode } from "@/lib/config/remote-images";

export async function readRemoteImagesPreference(): Promise<RemoteImageMode> {
	return parseRemoteImageMode(
		(await cookies()).get(REMOTE_IMAGES_COOKIE)?.value,
	);
}

export async function readEffectiveRemoteImagesMode(): Promise<RemoteImageMode> {
	const operatorMode = readOperatorRemoteImagesMode();
	if (operatorMode !== null) {
		return operatorMode;
	}
	return readRemoteImagesPreference();
}
