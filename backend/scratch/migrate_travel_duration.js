const db = require("../config/database");

console.log("Checking DB auto migration...");
setTimeout(() => {
  const cols = [
    { name: "travel_duration", def: "ADD COLUMN travel_duration INT DEFAULT NULL" },
    { name: "start_km", def: "ADD COLUMN start_km DECIMAL(10,2) DEFAULT NULL" },
    { name: "end_km", def: "ADD COLUMN end_km DECIMAL(10,2) DEFAULT NULL" }
  ];

  let completed = 0;
  cols.forEach((col) => {
    db.query(`SHOW COLUMNS FROM call_reports LIKE '${col.name}'`, (err, rows) => {
      if (err) {
        console.error(`Error checking ${col.name}:`, err.message);
      } else if (rows && rows.length > 0) {
        console.log(`Column ${col.name} already exists.`);
      } else {
        db.query(`ALTER TABLE call_reports ${col.def}`, (err2) => {
          if (err2) console.error(`Error adding ${col.name}:`, err2.message);
          else console.log(`SUCCESS: ${col.name} column added to call_reports!`);
        });
      }
      completed++;
      if (completed === cols.length) {
        setTimeout(() => process.exit(0), 1000);
      }
    });
  });
}, 2000);
