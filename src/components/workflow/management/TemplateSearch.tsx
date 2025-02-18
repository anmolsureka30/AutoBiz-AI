import React, { useState, useCallback } from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import styles from './TemplateSearch.module.css';

interface TemplateSearchProps {
  onSearch: (filters: TemplateFilters) => void;
  categories: string[];
  tags: string[];
}

export interface TemplateFilters {
  searchTerm: string;
  categories: string[];
  tags: string[];
  status?: 'active' | 'deprecated' | 'all';
}

export const TemplateSearch: React.FC<TemplateSearchProps> = ({
  onSearch,
  categories,
  tags,
}) => {
  const [filters, setFilters] = useState<TemplateFilters>({
    searchTerm: '',
    categories: [],
    tags: [],
    status: 'active',
  });

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFilters = {
        ...filters,
        searchTerm: e.target.value,
      };
      setFilters(newFilters);
      onSearch(newFilters);
    },
    [filters, onSearch]
  );

  const handleCategoryChange = useCallback(
    (category: string) => {
      const newCategories = filters.categories.includes(category)
        ? filters.categories.filter(c => c !== category)
        : [...filters.categories, category];

      const newFilters = {
        ...filters,
        categories: newCategories,
      };
      setFilters(newFilters);
      onSearch(newFilters);
    },
    [filters, onSearch]
  );

  const handleTagChange = useCallback(
    (tag: string) => {
      const newTags = filters.tags.includes(tag)
        ? filters.tags.filter(t => t !== tag)
        : [...filters.tags, tag];

      const newFilters = {
        ...filters,
        tags: newTags,
      };
      setFilters(newFilters);
      onSearch(newFilters);
    },
    [filters, onSearch]
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFilters = {
        ...filters,
        status: e.target.value as TemplateFilters['status'],
      };
      setFilters(newFilters);
      onSearch(newFilters);
    },
    [filters, onSearch]
  );

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search templates..."
          value={filters.searchTerm}
          onChange={handleSearchChange}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.filters}>
        <div className={styles.filterSection}>
          <h3>Categories</h3>
          <div className={styles.filterOptions}>
            {categories.map(category => (
              <label key={category} className={styles.filterOption}>
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.filterSection}>
          <h3>Tags</h3>
          <div className={styles.filterOptions}>
            {tags.map(tag => (
              <label key={tag} className={styles.filterOption}>
                <input
                  type="checkbox"
                  checked={filters.tags.includes(tag)}
                  onChange={() => handleTagChange(tag)}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.filterSection}>
          <h3>Status</h3>
          <select
            value={filters.status}
            onChange={handleStatusChange}
            className={styles.statusSelect}
          >
            <option value="active">Active</option>
            <option value="deprecated">Deprecated</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
    </div>
  );
}; 