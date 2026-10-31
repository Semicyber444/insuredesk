import { AppRole, Profile } from '@/types/database';

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  profile: Profile;
  roles: AppRole[];
}

export const DEMO_USERS: Record<string, UserSession> = {
  admin: {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@insuredesk.team',
      name: 'สมชาย ผู้ดูแลระบบ (Admin)',
    },
    profile: {
      user_id: '00000000-0000-0000-0000-000000000001',
      display_name: 'สมชาย ผู้ดูแลระบบ',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    roles: ['admin', 'reviewer'],
  },
  reviewer: {
    user: {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'reviewer@insuredesk.team',
      name: 'ปวีณา ผู้ตรวจสอบข้อมูล (Reviewer)',
    },
    profile: {
      user_id: '00000000-0000-0000-0000-000000000004',
      display_name: 'ปวีณา ผู้ตรวจสอบข้อมูล',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    roles: ['reviewer'],
  },
  editor: {
    user: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'editor@insuredesk.team',
      name: 'กัญญา เจ้าหน้าที่กรอกข้อมูล (Editor)',
    },
    profile: {
      user_id: '00000000-0000-0000-0000-000000000002',
      display_name: 'กัญญา เจ้าหน้าที่กรอกข้อมูล',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    roles: ['editor'],
  },
  viewer: {
    user: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'viewer@insuredesk.team',
      name: 'วิชัย ทีมงานฝ่ายขาย (Viewer)',
    },
    profile: {
      user_id: '00000000-0000-0000-0000-000000000003',
      display_name: 'วิชัย ทีมงานฝ่ายขาย',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    roles: ['viewer'],
  },
};
