import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FileUploader } from '../FileUploader';
import { ThemeProvider } from 'styled-components';

const theme = {
  colors: {
    primary: '#1890ff',
    primaryLight: '#e6f7ff',
    error: '#ff4d4f',
    success: '#52c41a',
    text: '#333333',
    textLight: '#666666',
    border: '#d9d9d9',
    background: '#ffffff'
  }
};

describe('FileUploader', () => {
  const mockOnUpload = jest.fn();
  const mockOnProgress = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderUploader = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <FileUploader
          onUpload={mockOnUpload}
          onProgress={mockOnProgress}
          onError={mockOnError}
          {...props}
        />
      </ThemeProvider>
    );
  };

  it('should render upload zone', () => {
    renderUploader();
    expect(screen.getByText(/drag and drop files/i)).toBeInTheDocument();
  });

  it('should handle file drop', async () => {
    renderUploader();
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      const dropzone = screen.getByText(/drag and drop files/i);
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      });
    });

    expect(mockOnUpload).toHaveBeenCalledWith(file);
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('should validate file size', async () => {
    renderUploader({
      config: { maxSize: 5 }
    });

    const file = new File(['test'], 'large.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 10 });

    await act(async () => {
      const dropzone = screen.getByText(/drag and drop files/i);
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      });
    });

    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'size'
      })
    );
  });

  it('should validate file type', async () => {
    renderUploader({
      config: { allowedTypes: ['image/jpeg'] }
    });

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      const dropzone = screen.getByText(/drag and drop files/i);
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      });
    });

    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'type'
      })
    );
  });

  it('should handle file removal', async () => {
    renderUploader();
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      const dropzone = screen.getByText(/drag and drop files/i);
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      });
    });

    const removeButton = screen.getByTitle('Remove file');
    fireEvent.click(removeButton);

    expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
  });
}); 