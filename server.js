const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcrypt');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DB = new DatabaseSync(path.join(ROOT, 'firequiz.db'));
const limits = new Map();
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};

DB.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','admin')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, topic TEXT NOT NULL, label TEXT NOT NULL, text TEXT NOT NULL, answers TEXT NOT NULL, correct_index INTEGER NOT NULL, explanation TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), provider_customer_id TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'none', current_period_end INTEGER);`);

const seed = [
 ['materiel','MATÉRIEL','Quel élément permet de relier un tuyau à une prise d’eau ?',['Un raccord','Une lance','Un dévidoir','Un casque'],0,'Un raccord assure l’assemblage entre les éléments d’une ligne d’eau. Relis la fiche matériel avec ton animateur.'],
 ['incendie','INCENDIE','Le triangle du feu réunit trois éléments. Lequel n’en fait pas partie ?',['Un combustible','Un comburant','Une énergie d’activation','Un point d’eau'],3,'Le triangle du feu associe combustible, comburant et énergie d’activation. Cette fiche sert à comprendre le phénomène du feu.'],
 ['secours','SECOURS À PERSONNE','Lors d’un entraînement JSP, quelle règle reste prioritaire ?',['Aller le plus vite possible','Suivre les consignes de l’encadrant','Finir avant les autres','Utiliser son téléphone'],1,'La sécurité et les consignes de l’encadrement passent toujours avant la vitesse ou le score.'],
 ['organisation','ORGANISATION','Pourquoi une communication claire est-elle importante pendant une manœuvre ?',['Pour faire plus de bruit','Pour coordonner le groupe','Pour gagner des points','Pour impressionner'],1,'Une communication claire aide le groupe à se coordonner pendant les exercices.']
];
if (DB.prepare('SELECT COUNT(*) AS total FROM questions').get().total === 0) {
  const insert = DB.prepare('INSERT INTO questions(topic,label,text,answers,correct_index,explanation) VALUES(?,?,?,?,?,?)');
  for (const q of seed) insert.run(q[0],q[1],q[2],JSON.stringify(q[3]),q[4],q[5]);
}

function json(res, status, body, extra={}) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}); res.end(JSON.stringify(body)); }
function secureHeaders(res) { res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()'); res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"); if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains'); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2)); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function passwordBytes(password) { return crypto.createHash('sha256').update(password,'utf8').digest(); }
function validEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
function validPassword(password) { return typeof password === 'string' && password.length >= 12 && password.length <= 256; }
function clientIp(req) { return req.socket.remoteAddress || 'unknown'; }
function limited(req, bucket, max, ms) { const key=`${bucket}:${clientIp(req)}`; const now=Date.now(); const row=limits.get(key)||{count:0,until:now+ms}; if(row.until<now){row.count=0;row.until=now+ms;} row.count++; limits.set(key,row); return row.count>max; }
async function body(req) { let raw=''; for await (const chunk of req) { raw += chunk; if(raw.length > 50_000) throw Error('Payload trop volumineux'); } try { return JSON.parse(raw || '{}'); } catch { throw Error('JSON invalide'); } }
function issueSession(res, userId) { const raw=crypto.randomBytes(32).toString('base64url'); const expires=Date.now()+1000*60*60*24*7; DB.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()); DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sha(raw),userId,expires); const secure=IS_PRODUCTION ? '; Secure' : ''; res.setHeader('Set-Cookie',`firequiz_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`); }
function currentUser(req) { const token=parseCookies(req).firequiz_session; if(!token) return null; return DB.prepare('SELECT users.id,users.email,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(sha(token),Date.now()) || null; }
function requireUser(req,res,admin=false) { const user=currentUser(req); if(!user){json(res,401,{error:'Connexion requise'});return null;} if(admin && user.role!=='admin'){json(res,403,{error:'Accès administrateur requis'});return null;} return user; }
function enforceOrigin(req,res) { const origin=req.headers.origin; if(!origin) return true; const host=`${IS_PRODUCTION?'https':'http'}://${req.headers.host}`; if(origin===host) return true; json(res,403,{error:'Origine non autorisée'}); return false; }
function questionPayload(q) { return {...q,answers:JSON.parse(q.answers),published:Boolean(q.published)}; }
async function askLocalLlm(prompt, sources) {
  if (!process.env.FIREQUIZ_LLM_URL) return null;
  const context=sources.map((item,index)=>`SOURCE ${index+1}\nThème : ${item.q.label}\nQuestion : ${item.q.text}\nExplication validée : ${item.q.explanation}`).join('\n\n');
  const instruction=`Tu es le Coach Fire Quiz. Réponds uniquement avec les informations contenues dans les SOURCES ci-dessous. Si elles ne suffisent pas, réponds exactement : « Je ne possède pas de fiche validée permettant de répondre à cette question. » N’invente aucune règle, procédure ou consigne d’intervention. Réponse courte, niveau JSP.\n\n${context}\n\nQUESTION ÉLÈVE : ${prompt}`;
  try { const response=await fetch(process.env.FIREQUIZ_LLM_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.FIREQUIZ_LLM_MODEL||'llama3.1:8b-instruct-q4_K_M',prompt:instruction,stream:false,options:{temperature:0,max_tokens:180}}),signal:AbortSignal.timeout(12_000)}); if(!response.ok)return null; const data=await response.json(); const answer=typeof data.response==='string'?data.response.trim():''; return answer && answer.length<=1200 ? answer : null; } catch { return null; }
}

async function api(req,res,url) {
 const route=url.pathname, method=req.method;
 if(method !== 'GET' && !enforceOrigin(req,res)) return;
 if(route==='/api/me' && method==='GET'){ const user=currentUser(req); return json(res,200,{user}); }
 if(route==='/api/auth/register' && method==='POST') { if(limited(req,'register',5,60*60*1000)) return json(res,429,{error:'Trop de tentatives. Réessaie plus tard.'}); const data=await body(req); const email=(data.email||'').trim().toLowerCase(); if(!validEmail(email)||!validPassword(data.password)) return json(res,400,{error:'Email invalide ou mot de passe de 12 caractères minimum requis.'}); try { const hash=await bcrypt.hash(passwordBytes(data.password),12); const created=DB.prepare("INSERT INTO users(email,password_hash,role) VALUES(?,?,'user')").run(email,hash); issueSession(res,Number(created.lastInsertRowid)); return json(res,201,{ok:true}); } catch { return json(res,409,{error:'Cet email possède déjà un compte.'}); } }
 if(route==='/api/auth/login' && method==='POST') { if(limited(req,'login',8,15*60*1000)) return json(res,429,{error:'Trop de tentatives. Réessaie dans 15 minutes.'}); const data=await body(req); const email=(data.email||'').trim().toLowerCase(); const user=validEmail(email) ? DB.prepare('SELECT * FROM users WHERE email=?').get(email) : null; const match=user && validPassword(data.password) && await bcrypt.compare(passwordBytes(data.password),user.password_hash); if(!match) return json(res,401,{error:'Email ou mot de passe incorrect.'}); issueSession(res,user.id); return json(res,200,{ok:true,role:user.role}); }
 if(route==='/api/auth/logout' && method==='POST') { const token=parseCookies(req).firequiz_session; if(token) DB.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token)); res.setHeader('Set-Cookie','firequiz_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res,200,{ok:true}); }
 if(route==='/api/questions' && method==='GET') { const viewer=currentUser(req); const rows=DB.prepare(viewer?.role==='admin'?'SELECT * FROM questions ORDER BY topic,id':'SELECT * FROM questions WHERE published=1 ORDER BY topic,id').all(); return json(res,200,{questions:rows.map(questionPayload)}); }
 if(route==='/api/admin/questions' && method==='POST') { if(!requireUser(req,res,true))return; const q=await body(req); if(!['incendie','secours','materiel','organisation'].includes(q.topic)||typeof q.text!=='string'||q.text.length<8||q.text.length>500||!Array.isArray(q.answers)||q.answers.length!==4||q.answers.some(a=>typeof a!=='string'||!a.trim())||!Number.isInteger(q.correct_index)||q.correct_index<0||q.correct_index>3||typeof q.explanation!=='string'||q.explanation.length<8||q.explanation.length>1000) return json(res,400,{error:'Question incomplète ou invalide.'}); const label={incendie:'INCENDIE',secours:'SECOURS À PERSONNE',materiel:'MATÉRIEL',organisation:'ORGANISATION'}[q.topic]; const result=DB.prepare('INSERT INTO questions(topic,label,text,answers,correct_index,explanation,published) VALUES(?,?,?,?,?,?,?)').run(q.topic,label,q.text.trim(),JSON.stringify(q.answers.map(a=>a.trim())),q.correct_index,q.explanation.trim(),q.published===false?0:1); return json(res,201,{question:questionPayload(DB.prepare('SELECT * FROM questions WHERE id=?').get(result.lastInsertRowid))}); }
 const match=route.match(/^\/api\/admin\/questions\/(\d+)$/);
 if(match && method==='DELETE') { if(!requireUser(req,res,true))return; DB.prepare('DELETE FROM questions WHERE id=?').run(Number(match[1])); return json(res,200,{ok:true}); }
 if(route==='/api/ai/chat' && method==='POST') { const user=requireUser(req,res); if(!user)return; if(limited(req,'ai',20,60*60*1000))return json(res,429,{error:'Limite du coach atteinte pour cette heure.'}); const data=await body(req); const prompt=typeof data.prompt==='string'?data.prompt.trim().slice(0,300):''; if(!prompt)return json(res,400,{error:'Question vide.'}); const docs=DB.prepare('SELECT * FROM questions WHERE published=1').all().map(questionPayload); const terms=prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/).filter(x=>x.length>2); const ranked=docs.map(q=>({q,score:terms.reduce((score,t)=>score+(`${q.topic} ${q.label} ${q.text} ${q.explanation}`.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,2); if(!ranked.length)return json(res,200,{answer:'Je ne possède pas de fiche validée permettant de répondre à cette question. Demande à ton animateur JSP ou ajoute une fiche validée dans l’administration.',sources:[]}); const source=ranked[0].q; const answer=await askLocalLlm(prompt,ranked)||`D’après la fiche « ${source.label} » : ${source.explanation} Je peux aussi te poser une question sur ce thème.`; return json(res,200,{answer,sources:ranked.map(x=>({id:x.q.id,label:x.q.label,text:x.q.text}))}); }
 if(route==='/api/billing/checkout' && method==='POST') { const user=requireUser(req,res); if(!user)return; return json(res,503,{error:'Le paiement n’est pas encore configuré. Fire Quiz ne collecte aucune donnée bancaire.'}); }
 return json(res,404,{error:'Route inconnue'});
}
function staticFile(req,res,url) { let relative=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname); if(relative.includes('..')){res.writeHead(400);return res.end('Requête invalide');} const file=path.join(ROOT,relative); if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('Introuvable');} secureHeaders(res); res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream'); res.setHeader('Cache-Control',path.extname(file)==='.html'?'no-cache':'public, max-age=3600'); fs.createReadStream(file).pipe(res); }
const server=http.createServer(async(req,res)=>{ secureHeaders(res); const url=new URL(req.url,`http://${req.headers.host}`); try { if(url.pathname.startsWith('/api/')) await api(req,res,url); else staticFile(req,res,url); } catch(err) { console.error(err.message); if(!res.headersSent) json(res,400,{error:'Requête non valide'}); } });
server.listen(PORT,()=>console.log(`Fire Quiz démarre sur http://localhost:${PORT}`));
