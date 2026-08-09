require("dotenv").config();
const db = require("./config/database");

async function updateDatabase() {
  console.log("\n======================================================");
  console.log("⚙️  UPDATING DATABASE SCHEMA & MIGRATING CLIENT COMPANIES");
  console.log("======================================================\n");

  // Step 1: Create client_companies table
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS \`client_companies\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`client_id\` int NOT NULL,
      \`company_name\` varchar(255) DEFAULT NULL,
      \`gst_number\` varchar(50) DEFAULT NULL,
      \`phone\` varchar(50) DEFAULT NULL,
      \`email\` varchar(150) DEFAULT NULL,
      \`address\` text DEFAULT NULL,
      \`address_2\` text DEFAULT NULL,
      \`city\` varchar(100) DEFAULT NULL,
      \`state\` varchar(100) DEFAULT NULL,
      \`pincode\` varchar(20) DEFAULT NULL,
      \`is_primary\` tinyint(1) DEFAULT '0',
      \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_client_id\` (\`client_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await new Promise((resolve, reject) => {
    db.query(createTableSql, (err) => {
      if (err) {
        console.error("❌ Failed to create table 'client_companies':", err.message);
        return reject(err);
      }
      console.log("✅ Table 'client_companies' created or verified successfully.");
      resolve();
    });
  });

  // Step 2: Backfill existing clients into client_companies table as primary company
  console.log("🔄 Checking for existing clients to backfill into 'client_companies'...");

  const existingClients = await new Promise((resolve, reject) => {
    db.query("SELECT * FROM clients", (err, rows) => {
      if (err) {
        console.error("❌ Error fetching clients:", err.message);
        return reject(err);
      }
      resolve(rows || []);
    });
  });

  console.log(`📋 Found ${existingClients.length} clients in database.`);

  let insertedCount = 0;
  for (const client of existingClients) {
    // Check if client already has entry in client_companies
    const existing = await new Promise((resolve) => {
      db.query("SELECT id FROM client_companies WHERE client_id = ?", [client.id], (err, rows) => {
        if (err || !rows || rows.length === 0) resolve(null);
        else resolve(rows);
      });
    });

    if (!existing) {
      const companyName = client.company_name || client.name || "Primary Company";
      await new Promise((resolve) => {
        db.query(
          `INSERT INTO client_companies 
           (client_id, company_name, gst_number, phone, email, address, address_2, city, state, pincode, is_primary) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            client.id,
            companyName,
            client.gst_number || "",
            client.phone || "",
            client.email || "",
            client.address || "",
            client.address_2 || "",
            client.city || "",
            client.state || "",
            client.pincode || ""
          ],
          (insertErr) => {
            if (!insertErr) insertedCount++;
            resolve();
          }
        );
      });
    }
  }

  console.log(`✅ Migration Complete! Created ${insertedCount} primary company branch entries.`);
  console.log("\n======================================================");
  console.log("🎉 DATABASE IS NOW FULLY UPDATED AND READY!");
  console.log("======================================================\n");
  process.exit(0);
}

updateDatabase().catch((err) => {
  console.error("Database update error:", err);
  process.exit(1);
});
