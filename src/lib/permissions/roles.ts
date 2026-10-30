import { AppRole } from '@/types/database';

export const ROLE_PERMISSIONS = {
  viewer: {
    canSearch: true,
    canCompare: true,
    canViewPublished: true,
    canViewDocuments: true,
    canEditDraft: false,
    canSubmitReview: false,
    canReview: false,
    canPublish: false,
    canManageUsers: false,
    canViewAudit: false,
  },
  editor: {
    canSearch: true,
    canCompare: true,
    canViewPublished: true,
    canViewDocuments: true,
    canEditDraft: true,
    canSubmitReview: true,
    canReview: false,
    canPublish: false,
    canManageUsers: false,
    canViewAudit: false,
  },
  reviewer: {
    canSearch: true,
    canCompare: true,
    canViewPublished: true,
    canViewDocuments: true,
    canEditDraft: false,
    canSubmitReview: false,
    canReview: true,
    canPublish: true,
    canManageUsers: false,
    canViewAudit: true,
  },
  admin: {
    canSearch: true,
    canCompare: true,
    canViewPublished: true,
    canViewDocuments: true,
    canEditDraft: true,
    canSubmitReview: true,
    canReview: true,
    canPublish: true,
    canManageUsers: true,
    canViewAudit: true,
  },
} as const;

export function hasPermission(
  roles: AppRole[],
  permission: keyof typeof ROLE_PERMISSIONS['admin']
): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.[permission] ?? false);
}

export function getRoleBadgeClass(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'reviewer':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'editor':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'viewer':
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
}

export function getRoleLabelThai(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'ผู้ดูแลระบบ (Admin)';
    case 'reviewer':
      return 'ผู้ตรวจสอบ (Reviewer)';
    case 'editor':
      return 'ผู้กรอกข้อมูล (Editor)';
    case 'viewer':
      return 'สมาชิกทั่วไป (Viewer)';
    default:
      return role;
  }
}
