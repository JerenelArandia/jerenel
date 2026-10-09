require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey || !username || !password) {
  console.error("Error: Missing required environment variables in .env file.");
  console.error("Please ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, and ADMIN_PASSWORD are defined.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from("admins")
      .insert([
        {
          username: username,
          password_hash: passwordHash
        }
      ])
      .select();

    if (error) {
      if (error.code === "23505") {
        console.error(`Error: Admin username "${username}" already exists.`);
      } else {
        console.error("Error creating admin account:", error.message);
      }
      process.exit(1);
    }

    console.log(`Success: Admin account "${username}" created successfully.`);
  } catch (err) {
    console.error("Unexpected error:", err.message);
    process.exit(1);
  }
}

createAdmin();