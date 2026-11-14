import { PaperclipIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_COMPOSE_ATTACHMENTS,
} from "@/features/mail/schemas/compose-input-limits";

/** One file stored for the message. */
export interface ComposeAttachment {
	readonly blobId: string;
	readonly name: string;
	readonly type: string;
	readonly size: number;
}

/** Where attachments are uploaded. */
export const UPLOAD_ENDPOINT = "/app/mail/upload";

/**
 * The composer's attachments: a file input that stores each file as soon as it is
 * chosen (so sending sends only ids), and the list of what is attached with a
 * remove control each. A file over 25 MB, or more than 20 files, is refused here
 * before anything is sent; the route refuses them too. A failed upload names the
 * file and attaches nothing.
 */
export function ComposeAttachments({
	attachments,
	onChange,
}: {
	attachments: readonly ComposeAttachment[];
	onChange: (next: ComposeAttachment[]) => void;
}) {
	const t = useTranslations("mail");
	const inputId = useId();
	const input = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState<string[]>([]);

	const upload = async (files: FileList | null) => {
		let next = [...attachments];
		for (const file of Array.from(files ?? [])) {
			if (next.length >= MAX_COMPOSE_ATTACHMENTS) {
				toast.error(t("tooManyFiles"));
				break;
			}
			if (file.size > MAX_ATTACHMENT_BYTES) {
				toast.error(t("tooLargeFile", { name: file.name }));
				continue;
			}
			setUploading((names) => [...names, file.name]);
			try {
				const response = await fetch(
					`${UPLOAD_ENDPOINT}?name=${encodeURIComponent(file.name)}`,
					{
						method: "POST",
						headers: {
							"Content-Type":
								file.type || "application/octet-stream",
						},
						body: file,
					},
				);
				const body = (await response.json()) as {
					ok?: boolean;
					attachment?: ComposeAttachment;
				};
				if (
					!response.ok ||
					body.ok !== true ||
					body.attachment === undefined
				) {
					throw new Error("upload refused");
				}
				next = [...next, body.attachment];
				onChange(next);
			} catch {
				toast.error(t("uploadFailed", { name: file.name }));
			} finally {
				setUploading((names) =>
					names.filter((name) => name !== file.name),
				);
			}
		}
		if (input.current) {
			input.current.value = "";
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<div>
				<input
					ref={input}
					id={inputId}
					type="file"
					multiple
					// The field is what takes the focus and it is not drawn: its
					// label, right after it, shows the ring in its place.
					className="peer sr-only"
					onChange={(event) => void upload(event.target.files)}
				/>
				<Button
					asChild
					variant="ghost"
					size="sm"
					className="peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2"
				>
					<label htmlFor={inputId} className="cursor-pointer">
						<PaperclipIcon aria-hidden="true" />
						{t("attach")}
					</label>
				</Button>
			</div>
			{uploading.length > 0 ? (
				<ul role="status" className="text-muted-foreground text-xs">
					{uploading.map((name) => (
						<li key={name}>
							<bdi>{t("attaching", { name })}</bdi>
						</li>
					))}
				</ul>
			) : null}
			{attachments.length > 0 ? (
				<ul className="flex flex-wrap gap-2">
					{attachments.map((attachment) => (
						<li
							key={attachment.blobId}
							className="inline-flex items-center gap-1 rounded-lg bg-muted py-1 pr-1 pl-3 text-sm"
						>
							<bdi className="max-w-48 truncate">
								{attachment.name}
							</bdi>
							<Tooltip
								label={t("removeAttachment", {
									name: attachment.name,
								})}
							>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() =>
										onChange(
											attachments.filter(
												(a) =>
													a.blobId !==
													attachment.blobId,
											),
										)
									}
								>
									<XIcon aria-hidden="true" />
									<span className="sr-only">
										{t("removeAttachment", {
											name: attachment.name,
										})}
									</span>
								</Button>
							</Tooltip>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
