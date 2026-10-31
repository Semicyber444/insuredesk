import { AppRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { DEMO_USERS, UserSession } from './demoUsers';

export { DEMO_USERS, type UserSession };

export async function getCurrentSession(): Promise<UserSession | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isRealSupabase =
    Boolean(supabaseUrl) &&
    !supabaseUrl!.includes('example') &&
    !supabaseUrl!.includes('mock') &&
    !supabaseUrl!.includes('xyzcompany');

  const allowDemoFallback = process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH !== 'false';

  if (isRealSupabase) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // Section 14: Deactivated accounts must be strictly denied even with a valid session
        if (!profile || !profile.is_active) {
          return null;
        }

        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const roles = (
          roleRows && roleRows.length > 0 ? roleRows.map((r) => r.role as AppRole) : ['viewer']
        ) as AppRole[];

        return {
          user: {
            id: user.id,
            email: user.email || '',
            name: profile.display_name || user.email || 'ผู้ใช้งาน',
          },
          profile,
          roles,
        };
      }

      if (!allowDemoFallback) {
        return null;
      }
    } catch (e) {
      console.error('Error fetching Supabase session:', e);
      if (!allowDemoFallback) {
        return null;
      }
    }
  }

  return allowDemoFallback ? DEMO_USERS.admin : null;
}
