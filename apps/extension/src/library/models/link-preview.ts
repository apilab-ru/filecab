/** Binds a linking confirmation to exact local contents and the owner's remote revision. */
export interface LinkPreview {
  ownerId: string;
  localDigest: string;
  remoteRevision: string;
  localCount: number;
  remoteCount: number;
  conflicts: number;
}
