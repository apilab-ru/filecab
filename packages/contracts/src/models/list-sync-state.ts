/** Describes whether a list connection accepts new export and import jobs. */
export enum ListSyncState {
  Active = 'active',
  Paused = 'paused',
  AuthorizationRequired = 'authorization-required',
}
