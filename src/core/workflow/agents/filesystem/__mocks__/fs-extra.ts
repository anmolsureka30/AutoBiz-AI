import { Stats } from 'fs-extra';

// Mock file system state
const mockFS = new Map<string, {
  content: string | Buffer;
  stats: Partial<Stats>;
}>();

// Mock Stats class
class MockStats implements Stats {
  dev = 0;
  ino = 0;
  mode = 0o666;
  nlink = 1;
  uid = 0;
  gid = 0;
  rdev = 0;
  size = 0;
  blksize = 4096;
  blocks = 0;
  atimeMs = Date.now();
  mtimeMs = Date.now();
  ctimeMs = Date.now();
  birthtimeMs = Date.now();
  atime = new Date();
  mtime = new Date();
  ctime = new Date();
  birthtime = new Date();

  constructor(partial: Partial<Stats> = {}) {
    Object.assign(this, partial);
  }

  isFile(): boolean {
    return true;
  }

  isDirectory(): boolean {
    return false;
  }

  isBlockDevice(): boolean {
    return false;
  }

  isCharacterDevice(): boolean {
    return false;
  }

  isSymbolicLink(): boolean {
    return false;
  }

  isFIFO(): boolean {
    return false;
  }

  isSocket(): boolean {
    return false;
  }
}

// Mock file system operations
export const mockFileSystem = {
  reset() {
    mockFS.clear();
  },

  addFile(path: string, content: string | Buffer, stats: Partial<Stats> = {}) {
    mockFS.set(path, {
      content,
      stats: new MockStats(stats),
    });
  },

  getFile(path: string) {
    return mockFS.get(path);
  },

  removeFile(path: string) {
    mockFS.delete(path);
  },

  getAllFiles() {
    return Array.from(mockFS.entries());
  },
};

// Mock fs-extra functions
export const stat = jest.fn(async (path: string) => {
  const file = mockFS.get(path);
  if (!file) {
    throw new Error('ENOENT: no such file or directory');
  }
  return file.stats;
});

export const readFile = jest.fn(async (path: string, encoding?: BufferEncoding) => {
  const file = mockFS.get(path);
  if (!file) {
    throw new Error('ENOENT: no such file or directory');
  }
  return encoding ? file.content.toString(encoding) : file.content;
});

export const writeFile = jest.fn(async (path: string, content: string | Buffer) => {
  mockFS.set(path, {
    content,
    stats: new MockStats({ size: content.length }),
  });
});

export const unlink = jest.fn(async (path: string) => {
  if (!mockFS.has(path)) {
    throw new Error('ENOENT: no such file or directory');
  }
  mockFS.delete(path);
});

export const mkdir = jest.fn(async (path: string, options?: { recursive?: boolean }) => {
  // Mock directory creation
});

export const rm = jest.fn(async (path: string, options?: { recursive?: boolean; force?: boolean }) => {
  if (!mockFS.has(path) && !options?.force) {
    throw new Error('ENOENT: no such file or directory');
  }
  mockFS.delete(path);
});

export const copyFile = jest.fn(async (src: string, dest: string, flags?: number) => {
  const file = mockFS.get(src);
  if (!file) {
    throw new Error('ENOENT: no such file or directory');
  }
  if (mockFS.has(dest) && flags === 0) {
    throw new Error('EEXIST: file already exists');
  }
  mockFS.set(dest, { ...file });
});

export const rename = jest.fn(async (oldPath: string, newPath: string) => {
  const file = mockFS.get(oldPath);
  if (!file) {
    throw new Error('ENOENT: no such file or directory');
  }
  mockFS.set(newPath, file);
  mockFS.delete(oldPath);
});

export const constants = {
  COPYFILE_EXCL: 0,
}; 