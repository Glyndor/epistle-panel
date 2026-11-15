import { expect, it } from "bun:test";
import { saidWith } from "@/test/next-intl";
import { skeletonWords } from ".";

it("names the effective clock in hourly and daily placeholders", async () => {
	for (const zone of ["UTC", "Asia/Kolkata", "Pacific/Kiritimati"])
		for (const period of ["24h", "7d", "30d"] as const) {
			await skeletonWords(period, zone);
			expect(
				saidWith(
					`timeline.note.${period === "24h" ? "hour" : "day"}`,
				).at(-1),
			).toEqual({ time: "00:00", zone });
		}
});
