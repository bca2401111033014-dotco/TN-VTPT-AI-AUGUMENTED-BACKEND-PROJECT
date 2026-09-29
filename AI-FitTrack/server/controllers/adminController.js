const mongoose = require("mongoose");
const service = require("../services/adminService");
const attendanceService = require("../services/attendanceService");
const goalService = require("../services/goalService");
const progressService = require("../services/progressService");
const workoutController = require("./workoutController");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const getStats = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "System statistics fetched successfully.", { stats: await service.getStats() })
);

// Dashboard = the same stats cards, plus a short preview of the Members
// Overview table (the full, searchable table lives at GET /api/admin/members).
const getDashboard = asyncHandler(async (req, res) => {
  const [stats, membersPreview] = await Promise.all([service.getStats(), service.listMembersOverview({ limit: 5 })]);
  return sendSuccess(res, 200, "Admin dashboard fetched successfully.", { stats, membersOverview: membersPreview });
});

const getUsers = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Users fetched successfully.", await service.listUsers(req.query))
);
const getUserById = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "User fetched successfully.", { user: await service.getUser(req.params.id) })
);
const changeUserRole = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "User role updated successfully.", { user: await service.changeRole(req.user, req.params.id, req.body.role) })
);
const deleteUser = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "User and their data deleted successfully.", { deleted: await service.deleteUser(req.user, req.params.id) })
);
const getAttendance = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Attendance fetched successfully.", await attendanceService.listAllAttendance(req.query))
);

// --- Member-management endpoints (new) ---

const getMembers = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Members fetched successfully.", await service.listMembersOverview(req.query))
);
const getMemberDetails = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Member details fetched successfully.", await service.getMemberDetails(req.params.id))
);
const getWorkouts = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Workouts fetched successfully.", await workoutController.adminListWorkouts(req.query))
);
const getGoals = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Goals fetched successfully.", await goalService.listAllGoals(req.query))
);
// With ?userId=, returns that one member's own summary + weekly breakdown
// (identical shape to their own Progress page). Without it, an overview row
// per member.
const getProgress = asyncHandler(async (req, res) => {
  if (req.query.userId) {
    // getSummary/getWeekly use raw aggregation $match, which (unlike .find())
    // does not auto-cast a string to ObjectId - it must be cast explicitly here.
    const userId = new mongoose.Types.ObjectId(req.query.userId);
    const [summary, weekly] = await Promise.all([
      progressService.getSummary(userId),
      progressService.getWeekly(userId, req.query.weeks || 8),
    ]);
    return sendSuccess(res, 200, "Member progress fetched successfully.", { summary, weekly });
  }
  return sendSuccess(res, 200, "Progress overview fetched successfully.", await progressService.getAdminOverview(req.query));
});

module.exports = {
  getStats,
  getDashboard,
  getUsers,
  getUserById,
  changeUserRole,
  deleteUser,
  getAttendance,
  getMembers,
  getMemberDetails,
  getWorkouts,
  getGoals,
  getProgress,
};
