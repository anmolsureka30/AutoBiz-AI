import styled, { css } from 'styled-components';
import { MenuTheme } from './types';

export const MenuContainer = styled.div<{ isOpen: boolean; theme: MenuTheme }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: ${({ isOpen }) => (isOpen ? '280px' : '60px')};
  background: ${({ theme }) => theme.background};
  box-shadow: ${({ theme }) => theme.shadow};
  transition: ${({ theme }) => theme.transition};
  z-index: 1000;
  overflow-x: hidden;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.border};
    border-radius: 3px;
  }
`;

export const MenuHeader = styled.div`
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${({ theme }) => theme.border};
`;

export const MenuToggle = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.text};
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: ${({ theme }) => theme.transition};

  &:hover {
    color: ${({ theme }) => theme.hover};
  }
`;

export const MenuList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

export const MenuItem = styled.li<{ 
  level: number; 
  isActive: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
}>`
  position: relative;

  ${({ level }) => css`
    padding-left: ${level * 16}px;
  `}

  ${({ isActive, theme }) => isActive && css`
    background: ${theme.active};
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: ${theme.hover};
    }
  `}
`;

export const MenuItemContent = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  color: ${({ theme }) => theme.text};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  transition: ${({ theme }) => theme.transition};

  &:hover {
    background: ${({ theme, disabled }) => !disabled && theme.hover};
  }
`;

export const MenuItemIcon = styled.span`
  width: 24px;
  height: 24px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const MenuItemLabel = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const MenuItemBadge = styled.span<{ variant: string }>`
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  margin-left: 8px;
  
  ${({ variant }) => {
    switch (variant) {
      case 'error':
        return css`
          background: #ff4d4f;
          color: white;
        `;
      case 'warning':
        return css`
          background: #faad14;
          color: white;
        `;
      default:
        return css`
          background: #1890ff;
          color: white;
        `;
    }
  }}
`;

export const MenuItemExpand = styled.span<{ isExpanded: boolean }>`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  transform: rotate(${({ isExpanded }) => (isExpanded ? '90deg' : '0deg')});
`; 