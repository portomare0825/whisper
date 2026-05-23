const { execSync } = require('child_process');

try {
  console.log('--- GIT STATUS ---');
  const status = execSync('git status', { encoding: 'utf8' });
  console.log(status);

  console.log('--- GIT CONFIG CHECK ---');
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
    console.log(`Configured as: ${name} <${email}>`);
  } catch (e) {
    console.log('Git user identity not fully configured. Configuring default identity for commit...');
    execSync('git config --global user.email "portomare0825@gmail.com"');
    execSync('git config --global user.name "portomare0825"');
    console.log('Identity configured.');
  }

  console.log('--- STAGING FILES ---');
  execSync('git add next.config.ts src/app/api/avatar/pose/route.ts src/app/api/chat/route.ts src/app/api/user/appearance/route.ts supabase/db_migration.sql src/components/chat/ChatContainer.tsx', { stdio: 'inherit' });

  console.log('--- COMMITING ---');
  try {
    const commitOut = execSync('git commit -m "fix: next.config.ts eslint and user appearance memory integration"', { encoding: 'utf8' });
    console.log(commitOut);
  } catch (err) {
    console.log('Commit failed or nothing to commit. Details:', err.message);
  }

  console.log('--- PUSHING ---');
  const pushOut = execSync('git push origin main', { encoding: 'utf8' });
  console.log(pushOut);

} catch (error) {
  console.error('Fatal error in git helper:', error.message);
  if (error.stdout) console.log('Stdout:', error.stdout);
  if (error.stderr) console.log('Stderr:', error.stderr);
}
