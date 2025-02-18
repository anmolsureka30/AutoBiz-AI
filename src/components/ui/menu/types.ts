export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItem[];
  action?: () => void;
  disabled?: boolean;
  badge?: {
    count: number;
    variant: 'info' | 'warning' | 'error';
  };
}

export interface MenuState {
  isOpen: boolean;
  selectedId?: string;
  expandedIds: Set<string>;
}

export interface MenuTheme {
  background: string;
  text: string;
  hover: string;
  active: string;
  border: string;
  shadow: string;
  transition: string;
} 