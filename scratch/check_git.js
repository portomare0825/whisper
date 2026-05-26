const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('git ls-files src/components/dashboard').toString();
  fs.writeFileSync('git_ls.txt', output);
} catch (e) {
  fs.writeFileSync('git_ls.txt', e.toString());
}
