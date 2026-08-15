const nodemailer = require("nodemailer");
const db = require("../config/database");
const { decrypt } = require("./cryptoHelper");

// nodemailer defaults to a 2-minute connect and a 10-minute socket timeout, both of which
// outlast nginx's 120s proxy_read_timeout — an unreachable or wedged SMTP host turns
// "email this invoice" into a 504 instead of a readable error. Fail fast enough that the
// route can still answer.
const SMTP_TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
};

function getDefaultTransporter() {
  const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: emailPass,
    },
    tls: { rejectUnauthorized: false },
    ...SMTP_TIMEOUTS,
  });
}

/**
 * Retrieves the custom SMTP transport options for a given user.
 * If the user has a configured SMTP, it returns the custom nodemailer transporter.
 * Otherwise, it falls back to the default process.env.EMAIL_USER and EMAIL_PASS.
 * 
 * @param {number} userId - The ID of the logged-in user.
 * @returns {Promise<Object>} - Nodemailer Transporter instance and from address.
 */
async function getTransporterForUser(userId) {
  return new Promise((resolve) => {
    if (!userId) {
      // Fallback if no user ID provided (e.g. registration OTP)
      return resolve({
        transporter: getDefaultTransporter(),
        fromAddress: `"Achme Communication" <${process.env.EMAIL_USER}>`,
      });
    }

    db.query(
      "SELECT * FROM user_email_configs WHERE user_id = ?",
      [userId],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          // Fallback to global config
          return resolve({
            transporter: getDefaultTransporter(),
            fromAddress: `"Achme Communication" <${process.env.EMAIL_USER}>`,
          });
        }

        const config = rows[0];
        
        // If the configuration is explicitly disabled, fall back to global config
        if (config.is_enabled === 0) {
          return resolve({
            transporter: getDefaultTransporter(),
            fromAddress: `"Achme Communication" <${process.env.EMAIL_USER}>`,
          });
        }

        const secureMode = config.smtp_secure === "SSL/TLS" || Number(config.smtp_port) === 465 || config.smtp_secure === "true";
        const fromAddress = config.from_email_address || config.email_user;
        const senderName = config.sender_name || "Achme Communication";

        const decryptedPass = decrypt(config.email_pass);

        const userTransporter = nodemailer.createTransport({
          host: config.smtp_host || "smtp.gmail.com",
          port: Number(config.smtp_port) || 587,
          secure: secureMode,
          auth: {
            user: config.email_user,
            pass: decryptedPass,
          },
          tls: { rejectUnauthorized: false },
          ...SMTP_TIMEOUTS,
        });
        return resolve({
          transporter: userTransporter,
          fromAddress: `"${senderName}" <${fromAddress}>`,
        });
      }
    );
  });
}

module.exports = {
  getTransporterForUser,
  SMTP_TIMEOUTS,
};
