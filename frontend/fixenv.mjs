import { execSync } from 'child_process';
import fs from 'fs';

fs.writeFileSync('url.txt', 'https://duvnfeuinxbrnmcslugm.supabase.co');
execSync('vercel env rm SUPABASE_URL production --yes', { stdio: 'inherit' });
execSync('Get-Content url.txt -Raw | vercel env add SUPABASE_URL production', { shell: 'powershell.exe', stdio: 'inherit' });
