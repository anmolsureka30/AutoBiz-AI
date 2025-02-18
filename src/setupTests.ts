import '@testing-library/jest-dom';
import 'jest-extended';

// Mock IndexedDB
const indexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

const IDBKeyRange = {
  bound: jest.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDB,
});

Object.defineProperty(window, 'IDBKeyRange', {
  value: IDBKeyRange,
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 