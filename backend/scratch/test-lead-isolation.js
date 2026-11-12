const request = require("supertest");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const app = require("../server");
const db = require("../config/database");

const adminToken = jwt.sign({ id: 708, role: "admin", name: "Admin" }, process.env.JWT_SECRET);
const employeeAToken = jwt.sign({ id: 709, role: "employee", name: "Princee" }, process.env.JWT_SECRET);
const employeeBToken = jwt.sign({ id: 710, role: "employee", name: "Vimal" }, process.env.JWT_SECRET);

const queryPromise = (sql, params = []) => new Promise((resolve, reject) => {
  db.query(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

async function runTests() {
  console.log("=== Starting Lead Visibility & Isolation Verification ===");

  // Cleanup before starting
  await queryPromise("DELETE FROM telecalls WHERE customer_name LIKE 'TEST_ISOLATION_%'");
  await queryPromise("DELETE FROM walkins WHERE customer_name LIKE 'TEST_ISOLATION_%'");
  await queryPromise("DELETE FROM fields WHERE customer_name LIKE 'TEST_ISOLATION_%'");

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: TELECALL LEAD ISOLATION
    // -------------------------------------------------------------
    console.log("\n--- Testing Telecall Isolation ---");
    const createTcRes = await request(app)
      .post("/api/Telecalls")
      .set("Authorization", `Bearer ${employeeAToken}`)
      .send({
        customer_name: "TEST_ISOLATION_TC_A",
        mobile_number: "9999900001",
        location_city: "Chennai",
        call_outcome: "New"
      });

    assert(createTcRes.status === 200, `Employee A created Telecall lead (Status: ${createTcRes.status})`);
    const tcId = createTcRes.body.id;

    // Check DB ownership
    const [tcDb] = await queryPromise("SELECT created_by, assigned_to, staff_name FROM telecalls WHERE id = ?", [tcId]);
    assert(tcDb.created_by === 709, `Lead created_by is Employee A (709)`);
    assert(tcDb.assigned_to === 709, `Lead assigned_to is locked to Employee A (709)`);

    // Employee A lists telecalls
    const listTcA = await request(app)
      .get("/api/Telecalls")
      .set("Authorization", `Bearer ${employeeAToken}`);
    const foundByA = (listTcA.body || []).some(x => x.id === tcId);
    assert(foundByA, `Employee A CAN see their own telecall lead in list`);

    // Employee B lists telecalls
    const listTcB = await request(app)
      .get("/api/Telecalls")
      .set("Authorization", `Bearer ${employeeBToken}`);
    const foundByB = (listTcB.body || []).some(x => x.id === tcId);
    assert(!foundByB, `Employee B CANNOT see Employee A's telecall lead in list`);

    // Employee B attempts direct access
    const getTcB = await request(app)
      .get(`/api/Telecalls/${tcId}`)
      .set("Authorization", `Bearer ${employeeBToken}`);
    assert(getTcB.status === 403, `Employee B direct GET returns 403 Access denied (Status: ${getTcB.status})`);

    // Employee B attempts edit
    const putTcB = await request(app)
      .put(`/api/Telecalls/${tcId}`)
      .set("Authorization", `Bearer ${employeeBToken}`)
      .send({ customer_name: "HACKED_BY_B" });
    assert(putTcB.status === 403, `Employee B direct PUT returns 403 Access denied (Status: ${putTcB.status})`);

    // Admin lists telecalls
    const listTcAdmin = await request(app)
      .get("/api/Telecalls")
      .set("Authorization", `Bearer ${adminToken}`);
    const foundByAdmin = (listTcAdmin.body || []).some(x => x.id === tcId);
    assert(foundByAdmin, `Admin CAN see Employee A's telecall lead`);

    // -------------------------------------------------------------
    // TEST 2: WALKIN LEAD ISOLATION
    // -------------------------------------------------------------
    console.log("\n--- Testing Walkin Isolation ---");
    const createWkRes = await request(app)
      .post("/api/Walkins")
      .set("Authorization", `Bearer ${employeeAToken}`)
      .send({
        customer_name: "TEST_ISOLATION_WK_A",
        mobile_number: "9999900002",
        location_city: "Chennai",
        purpose: "Inquiry"
      });

    assert(createWkRes.status === 200, `Employee A created Walkin lead (Status: ${createWkRes.status})`);
    const wkId = createWkRes.body.id;

    // Check DB ownership
    const [wkDb] = await queryPromise("SELECT created_by, assigned_to FROM walkins WHERE id = ?", [wkId]);
    assert(wkDb.created_by === 709, `Walkin created_by is Employee A (709)`);
    assert(wkDb.assigned_to === 709, `Walkin assigned_to is Employee A (709)`);

    // Employee A lists walkins
    const listWkA = await request(app)
      .get("/api/Walkins")
      .set("Authorization", `Bearer ${employeeAToken}`);
    const foundWkByA = (listWkA.body || []).some(x => x.id === wkId);
    assert(foundWkByA, `Employee A CAN see their own walkin lead`);

    // Employee B lists walkins
    const listWkB = await request(app)
      .get("/api/Walkins")
      .set("Authorization", `Bearer ${employeeBToken}`);
    const foundWkByB = (listWkB.body || []).some(x => x.id === wkId);
    assert(!foundWkByB, `Employee B CANNOT see Employee A's walkin lead`);

    // Employee B direct GET
    const getWkB = await request(app)
      .get(`/api/Walkins/${wkId}`)
      .set("Authorization", `Bearer ${employeeBToken}`);
    assert(getWkB.status === 403, `Employee B direct GET returns 403 Access denied (Status: ${getWkB.status})`);

    // Admin lists walkins
    const listWkAdmin = await request(app)
      .get("/api/Walkins")
      .set("Authorization", `Bearer ${adminToken}`);
    const foundWkAdmin = (listWkAdmin.body || []).some(x => x.id === wkId);
    assert(foundWkAdmin, `Admin CAN see Employee A's walkin lead`);

    // -------------------------------------------------------------
    // TEST 3: FIELD LEAD ISOLATION
    // -------------------------------------------------------------
    console.log("\n--- Testing Field Work Isolation ---");
    const createFdRes = await request(app)
      .post("/api/fields/new")
      .set("Authorization", `Bearer ${employeeAToken}`)
      .send({
        customer_name: "TEST_ISOLATION_FD_A",
        mobile_number: "9999900003",
        location_city: "Chennai",
        visit_date: "2026-09-11",
        purpose: "Site visit"
      });

    assert(createFdRes.status === 200, `Employee A created Field lead (Status: ${createFdRes.status})`);
    const fdId = createFdRes.body.id;

    // Check DB ownership
    const [fdDb] = await queryPromise("SELECT created_by, assigned_to FROM fields WHERE id = ?", [fdId]);
    assert(fdDb.created_by === 709, `Field created_by is Employee A (709)`);
    assert(fdDb.assigned_to === 709, `Field assigned_to is Employee A (709)`);

    // Employee A lists fields
    const listFdA = await request(app)
      .get("/api/fields")
      .set("Authorization", `Bearer ${employeeAToken}`);
    const foundFdByA = (listFdA.body || []).some(x => x.id === fdId);
    assert(foundFdByA, `Employee A CAN see their own field lead`);

    // Employee B lists fields
    const listFdB = await request(app)
      .get("/api/fields")
      .set("Authorization", `Bearer ${employeeBToken}`);
    const foundFdByB = (listFdB.body || []).some(x => x.id === fdId);
    assert(!foundFdByB, `Employee B CANNOT see Employee A's field lead`);

    // Employee B direct GET
    const getFdB = await request(app)
      .get(`/api/fields/${fdId}`)
      .set("Authorization", `Bearer ${employeeBToken}`);
    assert(getFdB.status === 403, `Employee B direct GET returns 403 Access denied (Status: ${getFdB.status})`);

    // Admin lists fields
    const listFdAdmin = await request(app)
      .get("/api/fields")
      .set("Authorization", `Bearer ${adminToken}`);
    const foundFdAdmin = (listFdAdmin.body || []).some(x => x.id === fdId);
    assert(foundFdAdmin, `Admin CAN see Employee A's field lead`);

    // -------------------------------------------------------------
    // TEST 4: ADMIN ASSIGNMENT TO EMPLOYEE B
    // -------------------------------------------------------------
    console.log("\n--- Testing Admin Assignment to Employee B ---");
    const adminAssignRes = await request(app)
      .post("/api/Telecalls")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customer_name: "TEST_ISOLATION_ADMIN_TO_B",
        mobile_number: "9999900004",
        staff_name: "Vimal", // resolves to 710
        call_outcome: "New"
      });

    assert(adminAssignRes.status === 200, `Admin created telecall assigned to Vimal (Employee B)`);
    const adminLeadId = adminAssignRes.body.id;

    // Check DB
    const [adminDb] = await queryPromise("SELECT created_by, assigned_to FROM telecalls WHERE id = ?", [adminLeadId]);
    assert(adminDb.assigned_to === 710, `Admin lead assigned_to is Employee B (710)`);

    // Employee B lists telecalls -> SHOULD see it
    const listBAdminAssigned = await request(app)
      .get("/api/Telecalls")
      .set("Authorization", `Bearer ${employeeBToken}`);
    const bSeesAdminLead = (listBAdminAssigned.body || []).some(x => x.id === adminLeadId);
    assert(bSeesAdminLead, `Employee B CAN see lead assigned to them by Admin`);

    // Employee A lists telecalls -> MUST NOT see it
    const listAAdminAssigned = await request(app)
      .get("/api/Telecalls")
      .set("Authorization", `Bearer ${employeeAToken}`);
    const aSeesAdminLead = (listAAdminAssigned.body || []).some(x => x.id === adminLeadId);
    assert(!aSeesAdminLead, `Employee A CANNOT see lead assigned to Employee B by Admin`);

    // -------------------------------------------------------------
    // TEST 5: REMINDERS & ACTIVITY ACCESS CONTROL
    // -------------------------------------------------------------
    console.log("\n--- Testing Reminders & Activity Authorization ---");
    const remindersB = await request(app)
      .get(`/api/leads/reminders/telecall/${tcId}`)
      .set("Authorization", `Bearer ${employeeBToken}`);
    assert(remindersB.status === 403, `Employee B cannot fetch reminders for Employee A's lead (Status: ${remindersB.status})`);

    const activityB = await request(app)
      .get(`/api/leads/activity/telecall/${tcId}`)
      .set("Authorization", `Bearer ${employeeBToken}`);
    assert(activityB.status === 403, `Employee B cannot fetch activity for Employee A's lead (Status: ${activityB.status})`);

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passCount} Passed, ${failCount} Failed`);
    console.log(`========================================`);

  } finally {
    // Cleanup test data
    await queryPromise("DELETE FROM telecalls WHERE customer_name LIKE 'TEST_ISOLATION_%'");
    await queryPromise("DELETE FROM walkins WHERE customer_name LIKE 'TEST_ISOLATION_%'");
    await queryPromise("DELETE FROM fields WHERE customer_name LIKE 'TEST_ISOLATION_%'");
    process.exit(failCount === 0 ? 0 : 1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
