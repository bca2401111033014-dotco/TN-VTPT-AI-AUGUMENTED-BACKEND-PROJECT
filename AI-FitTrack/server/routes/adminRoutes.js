const express = require("express");
const c = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { validateBody, validateQuery, validateObjectId, PAGE_QUERY } = require("../middleware/validate");
const { ROLES } = require("../models/User");
const { GOAL_STATUSES } = require("../models/FitnessGoal");
const { ALLOWED_CATEGORIES } = require("../models/Workout");
const { ATTENDANCE_STATUSES } = require("../services/attendanceService");

const router = express.Router();

// authenticate -> authorize("admin") -> controller, for EVERY admin route.
// A normal (authenticated) user gets 403 here; no token gets 401 from
// authenticate. Nothing below is reachable by anyone but an admin.
router.use(authenticate, authorize("admin"));

// A 24-character hex Mongo ObjectId, used to validate the optional ?userId=
// member-selector filter shared by the workouts/goals/progress/attendance endpoints.
const OBJECT_ID_QUERY = { type: "string", pattern: /^[a-f\d]{24}$/i, patternMessage: "userId must be a valid resource ID." };

router.get("/stats", c.getStats);
router.get("/dashboard", c.getDashboard);

router.get("/users", validateQuery({ ...PAGE_QUERY, q: { type: "string", max: 100 }, role: { type: "enum", enum: ROLES } }), c.getUsers);
router.get("/users/:id", validateObjectId("id"), c.getUserById);
router.put("/users/:id/role", validateObjectId("id"), validateBody({ role: { type: "enum", enum: ROLES, required: true } }), c.changeUserRole);
router.delete("/users/:id", validateObjectId("id"), c.deleteUser);

// Members Overview / Member Details (real per-member statistics, computed on demand)
router.get("/members", validateQuery({ ...PAGE_QUERY, q: { type: "string", max: 100 }, role: { type: "enum", enum: ROLES } }), c.getMembers);
router.get("/members/:id", validateObjectId("id"), c.getMemberDetails);

router.get(
  "/workouts",
  validateQuery({
    ...PAGE_QUERY,
    q: { type: "string", max: 100 },
    workoutName: { type: "string", max: 100 },
    category: { type: "enum", enum: ALLOWED_CATEGORIES },
    date: { type: "date" },
    userId: OBJECT_ID_QUERY,
  }),
  c.getWorkouts
);

router.get(
  "/goals",
  validateQuery({ ...PAGE_QUERY, q: { type: "string", max: 100 }, status: { type: "enum", enum: GOAL_STATUSES }, userId: OBJECT_ID_QUERY }),
  c.getGoals
);

router.get(
  "/progress",
  validateQuery({ ...PAGE_QUERY, q: { type: "string", max: 100 }, userId: OBJECT_ID_QUERY, weeks: { type: "integer", min: 1, max: 52 } }),
  c.getProgress
);

router.get(
  "/attendance",
  validateQuery({
    ...PAGE_QUERY,
    q: { type: "string", max: 100 },
    date: { type: "dateOnly" },
    status: { type: "enum", enum: ATTENDANCE_STATUSES },
    userId: OBJECT_ID_QUERY,
  }),
  c.getAttendance
);

module.exports = router;
