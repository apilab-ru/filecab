import type { SelectOption } from '@filecab/ui';

/** Configures the shared Sort by and Order selects. */
export interface SortControlsProps<Field extends string, Direction extends string> {
  field: Field;
  fields: SelectOption<Field>[];
  fieldPlaceholder: string;
  direction: Direction | '';
  directions: SelectOption<Direction>[];
  fieldDisabled?: boolean;
  directionDisabled?: boolean;
  onFieldChange: (value: Field) => void;
  onDirectionChange: (value: Direction) => void;
}
