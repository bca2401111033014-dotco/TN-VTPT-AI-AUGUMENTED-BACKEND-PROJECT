const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Fresh installations get a ready-to-use admin account. Override these in
// server/.env before sharing/deploying the project.
const DEFAULT_ADMIN_NAME = "Administrator";
const DEFAULT_ADMIN_EMAIL = "admin@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Admin@12345";

/**
 * Ensures the configured default admin exists after MongoDB connects.
 * This is intentionally a bootstrap operation: it does not reset the
 * password of an account that is already an admin.
 */
const ensureDefaultAdmin = async () => {
  const name = String(process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME).trim();
  const email = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);

  if (!email || password.length < 8) {
    throw new Error("Default admin configuration is invalid. ADMIN_PASSWORD must be at least 8 characters.");
  }

  const existing = await User.findOne({ email }).select("+password role name");

  if (existing) {
    if (existing.role === "admin") {
      console.log(`Default admin ready: ${email}`);
      return;
    }

    existing.role = "admin";
    // This is only for the first bootstrap of an existing user with the
    // configured admin email, so the published default credentials work.
    existing.password = await bcrypt.hash(password, 12);
    await existing.save();
    console.log(`Existing account promoted to default admin: ${email}`);
    return;
  }

  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "admin",
  });

  console.log(`Default admin created: ${email}`);
};

module.exports = ensureDefaultAdmin;
