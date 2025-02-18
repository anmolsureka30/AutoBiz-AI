import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SlidingMenu } from '../SlidingMenu';
import { Home, Settings, Users } from 'react-feather';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('SlidingMenu', () => {
  const mockItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: <Home />
    },
    {
      id: 'users',
      label: 'Users',
      icon: <Users />,
      children: [
        {
          id: 'user-list',
          label: 'User List',
          path: '/users'
        },
        {
          id: 'user-settings',
          label: 'Settings',
          path: '/users/settings',
          disabled: true
        }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings />,
      badge: {
        count: 3,
        variant: 'warning' as const
      }
    }
  ];

  const renderMenu = (props = {}) => {
    return render(
      <MemoryRouter>
        <SlidingMenu items={mockItems} {...props} />
      </MemoryRouter>
    );
  };

  it('should render all menu items', () => {
    renderMenu();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should toggle menu expansion', () => {
    renderMenu();
    const toggleButton = screen.getByRole('button');
    
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    
    fireEvent.click(toggleButton);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('should expand/collapse submenu items', () => {
    renderMenu();
    const usersItem = screen.getByText('Users');
    
    fireEvent.click(usersItem);
    expect(screen.getByText('User List')).toBeInTheDocument();
    
    fireEvent.click(usersItem);
    expect(screen.queryByText('User List')).not.toBeInTheDocument();
  });

  it('should navigate when clicking menu items', () => {
    renderMenu();
    fireEvent.click(screen.getByText('Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should not navigate when clicking disabled items', () => {
    renderMenu();
    fireEvent.click(screen.getByText('Users'));
    fireEvent.click(screen.getByText('Settings'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should display badges', () => {
    renderMenu();
    const badge = screen.getByText('3');
    expect(badge).toHaveStyle({ background: '#faad14' });
  });
}); 