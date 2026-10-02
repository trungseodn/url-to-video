const Database = require('better-sqlite3');
const db = new Database('D:/projects/ztteam-pipeline.db');
const cols = [
  "ALTER TABLE ztteam_articles ADD COLUMN large_title TEXT",
  "ALTER TABLE ztteam_articles ADD COLUMN small_title TEXT",
  "ALTER TABLE ztteam_articles ADD COLUMN content_new TEXT",
  "ALTER TABLE ztteam_articles ADD COLUMN video_folder TEXT",
  "ALTER TABLE ztteam_articles ADD COLUMN wp_link TEXT",
  "ALTER TABLE ztteam_articles ADD COLUMN fanpage_done INTEGER DEFAULT 0",
];
for (const sql of cols) {
  try { db.prepare(sql).run(); console.log('OK:', sql); }
  catch(e) { console.log('Skip:', e.message); }
}
console.log('Migration done!');
db.close();
