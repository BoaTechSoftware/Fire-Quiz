const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const path = require('node:path');
const [email,password] = process.argv.slice(2);
if(!email || !password || password.length < 12) { console.error('Usage: node create-admin.js admin@exemple.fr mot-de-passe-de-12-caracteres-minimum'); process.exit(1); }
const passwordBytes=crypto.createHash('sha256').update(password,'utf8').digest();
(async()=>{const db=new DatabaseSync(path.join(__dirname,'firequiz.db')); const hash=await bcrypt.hash(passwordBytes,12); db.prepare("INSERT INTO users(email,password_hash,role) VALUES(?,?,'admin') ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,role='admin'").run(email.trim().toLowerCase(),hash); console.log(`Administrateur créé : ${email.trim().toLowerCase()}`);})();
