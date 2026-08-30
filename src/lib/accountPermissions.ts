import { Account } from '../types';

export type AccountAccessRole = 'owner' | 'admin' | 'edit' | 'view' | 'none';

export interface AccountAccess {
  role: AccountAccessRole;
  isOwner: boolean;
  canView: boolean;
  canEdit: boolean;              // Can edit account details (name, bank, color, credit limit, etc.)
  canDelete: boolean;            // Can delete the account (only owner)
  canManagePermissions: boolean; // Can invite/revoke shared access (owner or admin)
  canTransact: boolean;          // Can create/edit transactions, transfer money out, pay credit card bills
}

/**
 * Computes the access rights for a specific user on a given account.
 */
export function getAccountAccess(
  account: Account | null | undefined,
  currentUserEmail?: string | null
): AccountAccess {
  if (!account || !currentUserEmail || !currentUserEmail.trim()) {
    return {
      role: 'none',
      isOwner: false,
      canView: false,
      canEdit: false,
      canDelete: false,
      canManagePermissions: false,
      canTransact: false,
    };
  }

  const userEmail = currentUserEmail.trim().toLowerCase();
  const ownerEmail = (account.ownerEmail || '').trim().toLowerCase();

  // If user is explicitly the owner
  if (ownerEmail && ownerEmail === userEmail) {
    return {
      role: 'owner',
      isOwner: true,
      canView: true,
      canEdit: true,
      canDelete: true,
      canManagePermissions: true,
      canTransact: true,
    };
  }

  // Check if user is in sharedWith list
  const sharedPerm = Array.isArray(account.sharedWith)
    ? account.sharedWith.find((p) => (p.email || '').trim().toLowerCase() === userEmail)
    : undefined;

  if (sharedPerm) {
    if (sharedPerm.role === 'admin') {
      return {
        role: 'admin',
        isOwner: false,
        canView: true,
        canEdit: true,
        canDelete: false,
        canManagePermissions: true,
        canTransact: true,
      };
    }

    if (sharedPerm.role === 'edit') {
      return {
        role: 'edit',
        isOwner: false,
        canView: true,
        canEdit: true,
        canDelete: false,
        canManagePermissions: false,
        canTransact: true,
      };
    }

    // View Only ('view' role)
    return {
      role: 'view',
      isOwner: false,
      canView: true,
      canEdit: false,
      canDelete: false,
      canManagePermissions: false,
      canTransact: false,
    };
  }

  // Fallback for legacy accounts where ownerEmail was not populated
  if (!ownerEmail) {
    return {
      role: 'owner',
      isOwner: true,
      canView: true,
      canEdit: true,
      canDelete: true,
      canManagePermissions: true,
      canTransact: true,
    };
  }

  // Not owner and not in shared list
  return {
    role: 'none',
    isOwner: false,
    canView: false,
    canEdit: false,
    canDelete: false,
    canManagePermissions: false,
    canTransact: false,
  };
}

export function canUserEditAccount(account: Account | null | undefined, currentUserEmail?: string | null): boolean {
  return getAccountAccess(account, currentUserEmail).canEdit;
}

export function canUserTransactAccount(account: Account | null | undefined, currentUserEmail?: string | null): boolean {
  return getAccountAccess(account, currentUserEmail).canTransact;
}

export function canUserDeleteAccount(account: Account | null | undefined, currentUserEmail?: string | null): boolean {
  return getAccountAccess(account, currentUserEmail).canDelete;
}

export function canUserManageAccountPermissions(account: Account | null | undefined, currentUserEmail?: string | null): boolean {
  return getAccountAccess(account, currentUserEmail).canManagePermissions;
}

/**
 * Checks whether an account is shared with other users, is a joint account,
 * or is shared with the current user by another account owner.
 */
export function isSharedOrJointAccount(
  account: Account | null | undefined,
  currentUserEmail?: string | null
): boolean {
  if (!account) return false;

  // Has other members in the sharedWith list
  if (Array.isArray(account.sharedWith) && account.sharedWith.length > 0) {
    return true;
  }

  // Account is owned by someone else and shared with the current user
  if (
    account.ownerEmail &&
    currentUserEmail &&
    currentUserEmail.trim() &&
    account.ownerEmail.trim().toLowerCase() !== currentUserEmail.trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}
