// Exécuté par Vercel à chaque déploiement : écrit public/config.js avec les 2 valeurs publiques de Supabase.
const fs=require('fs');
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
if(!url||!key){console.error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans Vercel (Settings > Environment Variables).');process.exit(1)}
fs.writeFileSync('public/config.js','window.CG_CONFIG='+JSON.stringify({url,key})+';\n');
console.log('config.js écrit.');
