import type { ResourceIdentity } from "./model";
import { isEditableObject, parseObjectFields } from "./object-fields";
import { isEditablePermissions, validPermissionFields } from "./permissions";

export const isEditableResource = (identity: ResourceIdentity) => isEditableObject(identity) || isEditablePermissions(identity);
export const validResourceFields = (identity: ResourceIdentity, fields: Record<string, string>) =>
  isEditablePermissions(identity) ? validPermissionFields(identity, fields) : parseObjectFields(identity, fields) !== null;
