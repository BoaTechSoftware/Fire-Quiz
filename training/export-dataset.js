const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname,'..','firequiz.db'));
const rows = db.prepare('SELECT label,text,answers,correct_index,explanation FROM questions WHERE published=1').all();
const examples = rows.map(row => ({messages:[{role:'system',content:'Tu es le Coach Fire Quiz. Utilise uniquement les fiches JSP validées fournies par Fire Quiz. Si une information manque, indique-le et oriente vers un animateur JSP.'},{role:'user',content:row.text},{role:'assistant',content:`Réponse attendue : ${JSON.parse(row.answers)[row.correct_index]}\nExplication validée : ${row.explanation}`}]}));
fs.mkdirSync(path.join(__dirname,'output'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'output','firequiz-training.jsonl'),examples.map(JSON.stringify).join('\n')+'\n',{mode:0o600});
console.log(`${examples.length} exemples exportés vers training/output/firequiz-training.jsonl`);
