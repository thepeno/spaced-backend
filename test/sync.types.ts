import { Operation } from '@/operation';
import { ServerToClient } from '@/server2client';

export type SyncResponsePOST = {
	success: boolean;
};

export type SyncResponseGET = {
	ops: ServerToClient<Operation>[];
};
