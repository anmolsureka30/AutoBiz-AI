import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  MenuContainer,
  MenuHeader,
  MenuToggle,
  MenuList,
  MenuItem,
  MenuItemContent,
  MenuItemIcon,
  MenuItemLabel,
  MenuItemBadge,
  MenuItemExpand 
} from './styles';
import { MenuItem as MenuItemType, MenuState, MenuTheme } from './types';
import { ChevronRight, Menu as MenuIcon } from 'react-feather';

interface SlidingMenuProps {
  items: MenuItemType[];
  theme?: Partial<MenuTheme>;
  defaultOpen?: boolean;
  onStateChange?: (state: MenuState) => void;
}

const defaultTheme: MenuTheme = {
  background: '#ffffff',
  text: '#333333',
  hover: '#f5f5f5',
  active: '#e6f7ff',
  border: '#e8e8e8',
  shadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  transition: 'all 0.3s ease'
};

export const SlidingMenu: React.FC<SlidingMenuProps> = ({
  items,
  theme: customTheme,
  defaultOpen = true,
  onStateChange
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = { ...defaultTheme, ...customTheme };

  const [state, setState] = useState<MenuState>({
    isOpen: defaultOpen,
    expandedIds: new Set(),
    selectedId: undefined
  });

  useEffect(() => {
    // Find and select menu item based on current path
    const findItemByPath = (items: MenuItemType[]): string | undefined => {
      for (const item of items) {
        if (item.path === location.pathname) {
          return item.id;
        }
        if (item.children) {
          const childId = findItemByPath(item.children);
          if (childId) return childId;
        }
      }
      return undefined;
    };

    const selectedId = findItemByPath(items);
    if (selectedId !== state.selectedId) {
      setState(prev => ({ ...prev, selectedId }));
    }
  }, [location.pathname, items]);

  const toggleMenu = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setState(prev => {
      const expandedIds = new Set(prev.expandedIds);
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
      } else {
        expandedIds.add(id);
      }
      return { ...prev, expandedIds };
    });
  }, []);

  const handleItemClick = useCallback((item: MenuItemType) => {
    if (item.disabled) return;

    if (item.children) {
      toggleExpand(item.id);
    } else if (item.path) {
      navigate(item.path);
      setState(prev => ({ ...prev, selectedId: item.id }));
    } else if (item.action) {
      item.action();
    }
  }, [navigate, toggleExpand]);

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const renderMenuItem = (item: MenuItemType, level = 0) => {
    const isActive = item.id === state.selectedId;
    const isExpanded = state.expandedIds.has(item.id);
    const hasChildren = Boolean(item.children?.length);

    return (
      <MenuItem
        key={item.id}
        level={level}
        isActive={isActive}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
      >
        <MenuItemContent
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
        >
          {item.icon && <MenuItemIcon>{item.icon}</MenuItemIcon>}
          {state.isOpen && (
            <>
              <MenuItemLabel>{item.label}</MenuItemLabel>
              {item.badge && (
                <MenuItemBadge variant={item.badge.variant}>
                  {item.badge.count}
                </MenuItemBadge>
              )}
              {hasChildren && (
                <MenuItemExpand isExpanded={isExpanded}>
                  <ChevronRight size={16} />
                </MenuItemExpand>
              )}
            </>
          )}
        </MenuItemContent>
        {hasChildren && isExpanded && state.isOpen && (
          <MenuList>
            {item.children!.map(child => renderMenuItem(child, level + 1))}
          </MenuList>
        )}
      </MenuItem>
    );
  };

  return (
    <MenuContainer isOpen={state.isOpen} theme={theme}>
      <MenuHeader>
        <MenuToggle onClick={toggleMenu}>
          <MenuIcon size={24} />
        </MenuToggle>
      </MenuHeader>
      <MenuList>
        {items.map(item => renderMenuItem(item))}
      </MenuList>
    </MenuContainer>
  );
}; 