import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload as UploadIcon,
  X as RemoveIcon,
  Pause as PauseIcon,
  Play as ResumeIcon 
} from 'react-feather';
import {
  UploadContainer,
  DropZone,
  UploadMessage,
  FileList,
  FileItem,
  FileInfo,
  FileName,
  FileSize,
  ProgressBar,
  FileActions,
  ActionButton,
  ErrorMessage,
  TotalProgress
} from './styles';
import { 
  FileUploadConfig, 
  FileUploadState, 
  UploadProgress,
  FileValidationError 
} from './types';

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: FileValidationError) => void;
  config?: FileUploadConfig;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onUpload,
  onProgress,
  onError,
  config = {},
  disabled = false
}) => {
  const {
    maxSize = 100 * 1024 * 1024, // 100MB
    allowedTypes = [],
    maxFiles = 10
  } = config;

  const [state, setState] = useState<FileUploadState>({
    files: new Map(),
    totalProgress: 0,
    isUploading: false
  });

  const activeUploads = useRef<Map<string, boolean>>(new Map());

  const validateFile = (file: File): FileValidationError | null => {
    if (maxSize && file.size > maxSize) {
      return {
        file,
        error: 'size',
        message: `File size exceeds ${formatBytes(maxSize)}`
      };
    }

    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(file.type)
    ) {
      return {
        file,
        error: 'type',
        message: `File type ${file.type} not allowed`
      };
    }

    if (
      maxFiles &&
      state.files.size + 1 > maxFiles
    ) {
      return {
        file,
        error: 'count',
        message: `Maximum ${maxFiles} files allowed`
      };
    }

    return null;
  };

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const error = validateFile(file);
      if (error) {
        onError?.(error);
        continue;
      }

      const fileId = `${file.name}-${Date.now()}`;
      setState(prev => ({
        ...prev,
        files: new Map(prev.files).set(fileId, {
          loaded: 0,
          total: file.size,
          percentage: 0,
          status: 'pending',
          fileName: file.name,
          fileSize: file.size
        })
      }));

      try {
        activeUploads.current.set(fileId, true);
        await onUpload(file);

        if (activeUploads.current.get(fileId)) {
          setState(prev => {
            const files = new Map(prev.files);
            files.set(fileId, {
              ...files.get(fileId)!,
              status: 'completed',
              percentage: 100
            });
            return { ...prev, files };
          });
        }
      } catch (error) {
        if (activeUploads.current.get(fileId)) {
          setState(prev => {
            const files = new Map(prev.files);
            files.set(fileId, {
              ...files.get(fileId)!,
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload failed'
            });
            return { ...prev, files };
          });
        }
      } finally {
        activeUploads.current.delete(fileId);
      }
    }
  }, [maxFiles, maxSize, allowedTypes, onUpload, onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    disabled
  });

  const removeFile = (fileId: string) => {
    activeUploads.current.delete(fileId);
    setState(prev => {
      const files = new Map(prev.files);
      files.delete(fileId);
      return { ...prev, files };
    });
  };

  const togglePause = (fileId: string) => {
    setState(prev => {
      const files = new Map(prev.files);
      const file = files.get(fileId)!;
      files.set(fileId, {
        ...file,
        status: file.status === 'uploading' ? 'paused' : 'uploading'
      });
      return { ...prev, files };
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <UploadContainer>
      <DropZone {...getRootProps()} isDragActive={isDragActive} disabled={disabled}>
        <input {...getInputProps()} />
        <UploadMessage>
          <UploadIcon size={32} />
          <p>
            {isDragActive
              ? 'Drop files here'
              : 'Drag and drop files here, or click to select'}
          </p>
          {allowedTypes.length > 0 && (
            <p>Allowed types: {allowedTypes.join(', ')}</p>
          )}
          <p>Maximum size: {formatBytes(maxSize)}</p>
        </UploadMessage>
      </DropZone>

      {state.files.size > 0 && (
        <FileList>
          {Array.from(state.files.entries()).map(([id, file]) => (
            <FileItem key={id}>
              <FileInfo>
                <FileName>{file.fileName}</FileName>
                <FileSize>{formatBytes(file.fileSize)}</FileSize>
                <ProgressBar
                  progress={file.percentage}
                  status={file.status}
                />
                {file.error && (
                  <ErrorMessage>{file.error}</ErrorMessage>
                )}
              </FileInfo>
              <FileActions>
                {file.status === 'uploading' && (
                  <ActionButton
                    onClick={() => togglePause(id)}
                    title="Pause upload"
                  >
                    <PauseIcon size={16} />
                  </ActionButton>
                )}
                {file.status === 'paused' && (
                  <ActionButton
                    onClick={() => togglePause(id)}
                    title="Resume upload"
                  >
                    <ResumeIcon size={16} />
                  </ActionButton>
                )}
                <ActionButton
                  onClick={() => removeFile(id)}
                  title="Remove file"
                  variant="error"
                >
                  <RemoveIcon size={16} />
                </ActionButton>
              </FileActions>
            </FileItem>
          ))}
        </FileList>
      )}

      {state.files.size > 0 && (
        <TotalProgress>
          Total Progress: {Math.round(state.totalProgress)}%
        </TotalProgress>
      )}
    </UploadContainer>
  );
}; 