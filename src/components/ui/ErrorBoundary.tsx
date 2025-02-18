import React, { Component, ErrorInfo } from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  padding: 24px;
  background: ${({ theme }) => theme.colors.errorLight};
  border: 1px solid ${({ theme }) => theme.colors.error};
  border-radius: 8px;
  margin: 16px;
`;

const ErrorTitle = styled.h2`
  color: ${({ theme }) => theme.colors.error};
  margin: 0 0 16px;
`;

const ErrorMessage = styled.pre`
  background: ${({ theme }) => theme.colors.background};
  padding: 16px;
  border-radius: 4px;
  overflow: auto;
  max-height: 200px;
`;

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorContainer>
          <ErrorTitle>Something went wrong</ErrorTitle>
          <ErrorMessage>
            {this.state.error?.message}
          </ErrorMessage>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
} 