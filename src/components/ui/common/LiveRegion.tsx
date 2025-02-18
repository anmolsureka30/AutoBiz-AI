import React from 'react';
import styled from 'styled-components';

const LiveContainer = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

interface LiveRegionProps {
  children: React.ReactNode;
  'aria-live'?: 'polite' | 'assertive';
  'aria-atomic'?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  'aria-live': ariaLive = 'polite',
  'aria-atomic': ariaAtomic = true
}) => (
  <LiveContainer
    role="status"
    aria-live={ariaLive}
    aria-atomic={ariaAtomic}
  >
    {children}
  </LiveContainer>
); 