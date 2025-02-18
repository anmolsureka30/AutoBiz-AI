export interface ChangeListOptions {
  pageSize?: number;
  includeRemoved?: boolean;
  includeItemsFromAllDrives?: boolean;
  supportsAllDrives?: boolean;
  spaces?: ('drive' | 'appDataFolder' | 'photos')[];
  restrictToMyDrive?: boolean;
  fields?: string[];
}

export interface ChangeList {
  kind: 'drive#changeList';
  nextPageToken?: string;
  newStartPageToken?: string;
  changes: DriveChange[];
}

export interface DriveChange {
  kind: 'drive#change';
  type: 'file' | 'drive';
  changeType: 'created' | 'modified' | 'deleted';
  time: string;
  removed: boolean;
  fileId: string;
  file?: {
    id: string;
    name: string;
    mimeType: string;
    parents: string[];
    trashed: boolean;
    modifiedTime: string;
    version: string;
    md5Checksum?: string;
  };
  driveId?: string;
}

export interface ChangeTrackerConfig {
  pollInterval?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  batchSize?: number;
}

export interface ChangeTrackerState {
  startPageToken: string;
  lastChecked: number;
  lastChangeId?: string;
} 