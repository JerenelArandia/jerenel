require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error("Missing critical environment variables.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../public")));

// JWT Authentication Middleware for Admin routes
const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized access. Token missing." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// Helper: Generate Unique Reference Number (e.g., REPAIR-8A2F9B)
const generateReference = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomStr = "";
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REPAIR-${randomStr}`;
};

// ==========================================
// VISITOR ROUTES
// ==========================================

// GET /api/services - Fetch active repair services
app.get("/api/services", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings - Submit a new repair booking
app.post("/api/bookings", async (req, res) => {
  try {
    const { service_id, name, contact, email, booking_date, booking_time, guests, notes } = req.body;

    if (!service_id || !name || !contact || !email || !booking_date || !booking_time) {
      return res.status(400).json({ error: "Please fill out all required fields." });
    }

    const reference = generateReference();

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          reference: reference,
          service_id: service_id,
          name: name,
          contact: contact,
          email: email,
          booking_date: booking_date,
          booking_time: booking_time,
          guests: guests ? parseInt(guests, 10) : 1,
          notes: notes || "",
          status: "pending"
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: "Booking submitted successfully.",
      reference: data.reference,
      booking: data
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/reference/:ref - Lookup booking details by reference code
app.get("/api/bookings/reference/:ref", async (req, res) => {
  try {
    const { ref } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name, description, price)")
      .eq("reference", ref)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Booking not found with that reference number." });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ADMIN AUTHENTICATION ROUTES
// ==========================================

// POST /api/admin/login - Authenticate admin user
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    return res.status(200).json({ message: "Login successful.", username: admin.username });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/logout - Clear session cookie
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  return res.status(200).json({ message: "Logged out successfully." });
});

// GET /api/admin/me - Check current admin session
app.get("/api/admin/me", authenticateAdmin, (req, res) => {
  return res.status(200).json({ username: req.admin.username });
});

// ==========================================
// ADMIN BOOKING MANAGEMENT ROUTES
// ==========================================

// GET /api/admin/bookings - View all bookings
app.get("/api/admin/bookings", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name, price)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/bookings/:id/confirm - Confirm booking
app.patch("/api/admin/bookings/:id/confirm", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ message: "Booking confirmed.", booking: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/bookings/:id/cancel - Cancel booking
app.patch("/api/admin/bookings/:id/cancel", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ message: "Booking cancelled.", booking: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/bookings/:id - Delete booking record
app.delete("/api/admin/bookings/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return res.status(200).json({ message: "Booking deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Export Express app for Vercel serverless deployment
module.exports = app;

// Local development server listener
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running locally on http://localhost:${PORT}`);
  });
}