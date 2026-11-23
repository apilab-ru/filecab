import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { BrowserFilters } from './browser-filters';
import type { BrowserFiltersProps } from './model-browser-filters';

const STATUS_OPTIONS = [
  { value: null, label: 'Status' },
  { value: 'planned', label: 'Planned' },
  { value: 'process', label: 'Watching' },
  { value: 'complete', label: 'Completed' },
];

/** Keeps the query and filter values in story state so that the toolbar responds to input. */
function StatefulFilters({ onQueryChange, ...props }: BrowserFiltersProps) {
  const [query, setQuery] = useState(props.query);
  const [values, setValues] = useState(
    () => new Map(props.filters.map((filter) => [filter.key, filter.value])),
  );

  return (
    <BrowserFilters
      {...props}
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        onQueryChange(value);
      }}
      filters={props.filters.map((filter) => ({
        ...filter,
        value: values.get(filter.key) ?? null,
        onChange: (value) => {
          setValues(new Map(values).set(filter.key, value));
          filter.onChange(value);
        },
      }))}
    />
  );
}

const meta = {
  title: 'Library/BrowserFilters',
  component: BrowserFilters,
  render: (args) => <StatefulFilters {...args} />,
  args: {
    query: '',
    queryLabel: 'Search',
    onQueryChange: fn(),
    onAdd: fn(),
    filters: [
      { key: 'status', label: 'Status', value: null, options: STATUS_OPTIONS, onChange: fn() },
      { key: 'year', label: 'Year', value: null, onChange: fn() },
    ],
  },
} satisfies Meta<typeof BrowserFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValues: Story = {
  args: {
    query: 'star',
    filters: [
      { key: 'status', label: 'Status', value: 'process', options: STATUS_OPTIONS, onChange: fn() },
      { key: 'year', label: 'Year', value: '2024', onChange: fn() },
    ],
  },
};

export const DisabledFilter: Story = {
  args: {
    filters: [
      { key: 'status', label: 'Status', value: null, options: STATUS_OPTIONS, onChange: fn() },
      { key: 'year', label: 'Year', value: null, disabled: true, onChange: fn() },
    ],
  },
};

export const WithoutAddButton: Story = {
  args: { onAdd: undefined },
};

export const Disabled: Story = {
  args: { disabled: true },
};
