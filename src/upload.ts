
const VALID_FILETYPES = ['image/png', 'image/jpeg'];

export function isValidUploadFileType(fileType: string) {
	return VALID_FILETYPES.includes(fileType);
}

export function generateFileKey(userId: string) {
	const id = crypto.randomUUID();
	return `${userId}/${id}`;
}
