/** Updates one local state field using a value or its previous value. */
export type LocalStateSetter<Value> = (next: Value | ((previous: Value) => Value)) => void;

/** Provides stable update actions for a component's state fields. */
export type LocalStateSetters<State> = {
  [Key in keyof State]: LocalStateSetter<State[Key]>;
};

/** Keeps component values and stable actions in one scoped Zustand store. */
export interface LocalStore<State> {
  values: State;
  setters: LocalStateSetters<State>;
}
