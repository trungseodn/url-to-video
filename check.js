const Database = require('better-sqlite3');
const db = new Database('D:/projects/ztteam-pipeline.db');
const rows = db.prepare('SELECT id, audio_path, image_new, status FROM ztteam_articles').all();
console.log(rows);
db.close();
