// src/lib/permissions.ts
//
// One source of truth for what a staff member can be granted. Previously the
// list lived only in the user form, the middleware knew a different subset,
// and the route handlers each spelled their own checks by hand -- which is how
// permissions that nothing enforces (and permissions nothing can be granted)
// got into the product.
//
// Everything that grants, stores, gates, or renders a permission imports from
// here.

export const PERMISSIONS = [
  'VIEW_DASHBOARD',
  'VIEW_PRODUCTS',
  'EDIT_PRODUCTS',
  'DELETE_PRODUCTS',
  'VIEW_LEADS',
  'CREATE_LEADS',
  'EDIT_LEADS',
  'DELETE_LEADS',
  'VIEW_ORDERS',
  'CREATE_ORDERS',
  'EDIT_ORDERS',
  'DELETE_ORDERS',
  'VIEW_SHIPPING',
  'UPDATE_SHIPPING_STATUS',
  'VIEW_REPORTS',
  'EXPORT_REPORTS',
  'MANAGE_USERS',
  'MANAGE_SETTINGS',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/// Drops anything that is not a real permission and de-duplicates the rest, so
/// a typo in a payload can never be stored as a grant that silently means
/// nothing.
export function sanitizePermissions(values: readonly string[] | undefined | null): Permission[] {
  if (!values) return [];
  return Array.from(new Set(values.filter(isPermission)));
}

/// Groups shown in the staff form, so the checkbox list stays readable as the
/// catalogue grows.
export const PERMISSION_GROUPS: { label: string; permissions: readonly Permission[] }[] = [
  { label: 'Dashboard', permissions: ['VIEW_DASHBOARD'] },
  { label: 'Products', permissions: ['VIEW_PRODUCTS', 'EDIT_PRODUCTS', 'DELETE_PRODUCTS'] },
  { label: 'Leads', permissions: ['VIEW_LEADS', 'CREATE_LEADS', 'EDIT_LEADS', 'DELETE_LEADS'] },
  { label: 'Orders', permissions: ['VIEW_ORDERS', 'CREATE_ORDERS', 'EDIT_ORDERS', 'DELETE_ORDERS'] },
  { label: 'Shipping', permissions: ['VIEW_SHIPPING', 'UPDATE_SHIPPING_STATUS'] },
  { label: 'Reports', permissions: ['VIEW_REPORTS', 'EXPORT_REPORTS'] },
  { label: 'Administration', permissions: ['MANAGE_USERS', 'MANAGE_SETTINGS'] },
];

/// Human wording for the staff form. Without this the UI renders raw enum
/// names, which read as shouting and hide what the grant actually allows.
export const PERMISSION_LABELS: Record<Permission, string> = {
  VIEW_DASHBOARD: 'View dashboard',
  VIEW_PRODUCTS: 'View products and stock',
  EDIT_PRODUCTS: 'Create and edit products',
  DELETE_PRODUCTS: 'Delete products',
  VIEW_LEADS: 'View leads',
  CREATE_LEADS: 'Create and import leads',
  EDIT_LEADS: 'Edit leads',
  DELETE_LEADS: 'Delete leads',
  VIEW_ORDERS: 'View orders and returns',
  CREATE_ORDERS: 'Confirm leads into orders',
  EDIT_ORDERS: 'Edit orders',
  DELETE_ORDERS: 'Cancel and delete orders',
  VIEW_SHIPPING: 'View shipping',
  UPDATE_SHIPPING_STATUS: 'Update shipping status',
  VIEW_REPORTS: 'View reports',
  EXPORT_REPORTS: 'Export reports',
  MANAGE_USERS: 'Manage staff accounts',
  MANAGE_SETTINGS: 'Manage business settings',
};

type PermissionSubject = {
  role?: string | null;
  permissions?: readonly string[] | null;
};

/// The single answer to "is this person allowed to do X".
///
/// A tenant ADMIN implicitly holds every permission -- their permissions array
/// is deliberately empty in the database, so any check that only looked at the
/// array would lock admins out of their own tenant. SUPER_ADMIN is included
/// because impersonation and platform tooling run through the same handlers.
export function can(subject: PermissionSubject | undefined | null, permission: Permission): boolean {
  if (!subject?.role) return false;
  if (subject.role === 'ADMIN' || subject.role === 'SUPER_ADMIN') return true;
  return Boolean(subject.permissions?.includes(permission));
}

/// True when the subject holds at least one of the listed permissions.
export function canAny(
  subject: PermissionSubject | undefined | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.some(permission => can(subject, permission));
}
