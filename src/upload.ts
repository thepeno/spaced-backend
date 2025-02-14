import { DB } from '@/db';
import { files } from '@/db/schema';
import logger from '@/logger';
import crc32 from 'crc-32';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const VALID_FILETYPES = ['image/png', 'image/jpeg'];

const imageMetadataSchema = z.object({
	altText: z.string().optional(),
});

export function isValidUploadFileType(fileType: string) {
	return VALID_FILETYPES.includes(fileType);
}

/**
 * Parses the file metadata from depending on the file type
 * If the file type is not supported, it returns an empty object
 */
export function parseFileMetadata(file: File, metadata: unknown) {
	if (typeof metadata !== 'string') {
		logger.info('Metadata is not a string');
		return {};
	}

	try {
		const jsonMetadata = JSON.parse(metadata);
		const fileType = file.type;

		switch (fileType) {
			case 'image/png':
			case 'image/jpeg':
				return imageMetadataSchema.parse(jsonMetadata);
			default:
				return {};
		}
	} catch (error) {
		logger.info('Metadata is not a valid JSON', { error });
		return {};
	}
}

/**
 * Computes the checksum of a given file using CRC32
 * We use CRC32 because it's fast and we don't need a secure hash
 *
 * @returns the checksum of the file
 */
export async function computeFileChecksum(file: File): Promise<string> {
	const arrayBuffer = await file.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);
	// Library uses signed 32-bit integers
	// we use >>> 0 to force it to be signed
	const checksum = crc32.buf(uint8Array) >>> 0;
	return checksum.toString(16);
}

type CheckIfFileExistsResponse =
	| {
			success: true;
			fileKey: string;
	  }
	| {
			success: false;
			checksum: string;
	  };

/**
 * Checks if a given file already exists in the database by comparing the checkusm of the file
 *
 * @returns the file key if the file exists, false otherwise
 */
export async function checkIfFileExists(
	file: File,
	userId: string,
	db: DB
): Promise<CheckIfFileExistsResponse> {
	const fileChecksum = await computeFileChecksum(file);
	logger.info('Checking if file exists', { fileChecksum });

	const fileExists = await db.query.files.findFirst({
		where: and(eq(files.userId, userId), eq(files.checksum, fileChecksum)),
	});

	if (!fileExists) {
		return {
			success: false,
			checksum: fileChecksum,
		};
	}

	return {
		success: true,
		fileKey: `${userId}/${fileExists.id}`,
	};
}

const STORAGE_LIMIT_EXCEEDED_ERROR = 'Storage limit exceeded';
type InsertFileEntryIntoDbResponse =
	| {
			success: true;
	  }
	| {
			success: false;
			error: string;
	  };

export async function insertFileEntryIntoDb(
	file: File,
	fileChecksum: string,
	userId: string,
	fileId: string,
	metadata: Record<string, unknown>,
	db: DB
): Promise<InsertFileEntryIntoDbResponse> {
	try {
		await db.insert(files).values({
			userId,
			id: fileId,
			checksum: fileChecksum,
			fileType: file.type,
			sizeInBytes: file.size,
			metadata,
		});
		return {
			success: true,
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes(STORAGE_LIMIT_EXCEEDED_ERROR)) {
			return {
				success: false,
				error: STORAGE_LIMIT_EXCEEDED_ERROR,
			};
		}

		logger.error('Unknown error inserting file entry into db', { error });
		throw error;
	}
}
