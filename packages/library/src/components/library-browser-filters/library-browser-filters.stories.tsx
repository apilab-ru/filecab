import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Status } from '@filecab/contracts';
import { GENRES } from '../../../.storybook/fixtures';
import { LibraryLayout } from '../../models/library-layout';
import { LibraryBrowserFilters } from './library-browser-filters';
import type { LibraryBrowserFiltersProps } from './model-library-browser-filters';

/** Keeps the filter values in story state so that the toolbar responds to input. */
function StatefulLibraryFilters(props: LibraryBrowserFiltersProps) {
  const [query, setQuery] = useState(props.query);
  const [status, setStatus] = useState(props.status);
  const [rating, setRating] = useState(props.rating);
  const [genre, setGenre] = useState(props.genre);

  return (
    <LibraryBrowserFilters
      {...props}
      query={query}
      status={status}
      rating={rating}
      genre={genre}
      onQueryChange={(value) => {
        setQuery(value);
        props.onQueryChange(value);
      }}
      onStatusChange={(value) => {
        setStatus(value);
        props.onStatusChange(value);
      }}
      onRatingChange={(value) => {
        setRating(value);
        props.onRatingChange(value);
      }}
      onGenreChange={(value) => {
        setGenre(value);
        props.onGenreChange(value);
      }}
    />
  );
}

const meta = {
  title: 'Library/LibraryBrowserFilters',
  component: LibraryBrowserFilters,
  render: (args) => <StatefulLibraryFilters {...args} />,
  args: {
    query: '',
    status: null,
    rating: '',
    genre: '',
    genres: GENRES,
    layout: LibraryLayout.Grid,
    available: true,
    onQueryChange: fn(),
    onStatusChange: fn(),
    onRatingChange: fn(),
    onGenreChange: fn(),
    onLayoutChange: fn(),
    onAdd: fn(),
  },
} satisfies Meta<typeof LibraryBrowserFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelectedFilters: Story = {
  args: {
    query: 'wind',
    status: Status.Process,
    rating: '7',
    genre: GENRES[2].genreId,
  },
};

export const NoGenres: Story = {
  args: { genres: [] },
};

export const Unavailable: Story = {
  args: { available: false },
};
