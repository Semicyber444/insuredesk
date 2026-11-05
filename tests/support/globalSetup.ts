import { execFileSync } from 'node:child_process';

/** Rebuilds the throwaway test database before the run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Set TEST_DATABASE_URL, e.g. mysql://root:root@127.0.0.1:3306/insuredesk_test');
  }
  if (!/_test(\?|$)/.test(url)) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  }
  execFileSync('node', ['scripts/db.mjs', 'reset'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
