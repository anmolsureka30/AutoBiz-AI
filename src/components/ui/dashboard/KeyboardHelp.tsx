import React from 'react';
import styled from 'styled-components';
import { HelpCircle } from 'react-feather';

const HelpContainer = styled.div`
  position: fixed;
  bottom: 16px;
  right: 16px;
`;

const HelpButton = styled.button`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.hover};
  }
`;

const HelpDialog = styled.div`
  position: absolute;
  bottom: 48px;
  right: 0;
  width: 300px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.medium};
`;

const ShortcutList = styled.dl`
  margin: 0;
  
  dt {
    font-weight: 600;
    margin-top: 8px;
  }
  
  dd {
    margin-left: 0;
    color: ${({ theme }) => theme.colors.textLight};
  }
`;

export const KeyboardHelp: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <HelpContainer>
      <HelpButton
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Keyboard shortcuts help"
        aria-expanded={isOpen}
      >
        <HelpCircle size={24} />
      </HelpButton>
      {isOpen && (
        <HelpDialog role="dialog" aria-label="Keyboard shortcuts">
          <ShortcutList>
            <dt>↑/↓</dt>
            <dd>Navigate through tasks</dd>
            <dt>Enter</dt>
            <dd>Select task / Retry failed task</dd>
            <dt>Escape</dt>
            <dd>Clear selection</dd>
            <dt>Space</dt>
            <dd>Toggle task details</dd>
          </ShortcutList>
        </HelpDialog>
      )}
    </HelpContainer>
  );
}; 