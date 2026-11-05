import { connection } from 'next/server';
import { isDemoAuthEnabled } from '@/lib/auth/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  // Read the flag per request so it follows the runtime environment, not the build.
  await connection();
  return <LoginForm demoAuthEnabled={isDemoAuthEnabled()} />;
}
