const User = require("../models/User");
const Workout = require("../models/Workout");
const FitnessGoal = require("../models/FitnessGoal");
const Attendance = require("../models/Attendance");
const AppError = require("../utils/AppError");
const { escapeRegex } = require("../utils/text");
const { addDays, startOfUtcDay } = require("../utils/dateUtils");
const { sameId } = require("../utils/ids");
const { getPagination, buildPagination } = require("../utils/pagination");

const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
const groupCount = (model, field) => model.aggregate([{ $group: { _id: field, count: { $sum: 1 } } }]);

// A member counts as "checked in today" / "active" using this window, and a
// visit that was never checked out is treated as abandoned after this long
// (kept in sync with attendanceService.STALE_VISIT_HOURS's intent).
const RECENT_ACTIVITY_DAYS = 30;

/**
 * System overview for the Admin Dashboard cards. Everything is counted (or
 * derived) from the existing MongoDB collections - no hardcoded numbers, no
 * separate "progress record" collection. Additive-only: existing fields are
 * never removed so /api/admin/stats keeps its original shape.
 */
const getStats = async () => {
  const weekAgo = addDays(startOfUtcDay(new Date()), -7);
  const today = startOfUtcDay(new Date());
  const tomorrow = addDays(today, 1);

  const [usersByRole, newUsers, workouts, goalsByStatus, visits, openVisits, checkedInTodayIds, progressDayRows] = await Promise.all([
    // accounts created before roles existed have no role field: they count as "user"
    groupCount(User, { $ifNull: ["$role", "user"] }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    Workout.countDocuments({}),
    groupCount(FitnessGoal, "$status"),
    Attendance.countDocuments({}),
    Attendance.countDocuments({ isOpen: true }),
    Attendance.distinct("user", { checkInTime: { $gte: today, $lt: tomorrow } }),
    // "Progress records" = distinct (member, day) pairs with a logged workout - the same
    // per-day rollup the Progress page itself is built from (there is no separate model for it).
    Workout.aggregate([{ $group: { _id: { user: "$user", day: { $dateToString: { format: "%Y-%m-%d", date: "$workoutDate" } } } } }, { $count: "total" }]),
  ]);

  const roles = countBy(usersByRole);
  const goalStatusCounts = countBy(goalsByStatus);
  const totalGoals = Object.values(goalStatusCounts).reduce((a, b) => a + b, 0);

  return {
    users: { total: Object.values(roles).reduce((a, b) => a + b, 0), byRole: roles, newInLast7Days: newUsers },
    // "Members" = registered normal users (excludes admin accounts), for the "Total Members" card.
    members: { total: roles.user || 0 },
    workouts: { total: workouts },
    goals: { total: totalGoals, byStatus: goalStatusCounts, active: goalStatusCounts.active || 0, completed: goalStatusCounts.completed || 0 },
    progress: { totalRecords: progressDayRows[0]?.total || 0 },
    attendance: {
      totalVisits: visits,
      totalRecords: visits,
      currentlyCheckedIn: openVisits,
      membersCheckedInToday: checkedInTodayIds.length,
    },
  };
};

const listUsers = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.role) filter.role = query.role === "user" ? { $in: ["user", null] } : query.role; // null also matches a missing role
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { users: users.map((u) => u.toSafeObject()), pagination: buildPagination(total, page, limit) };
};

const getUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found.", 404);
  const [workouts, goals, visits] = await Promise.all([
    Workout.countDocuments({ user: user._id }),
    FitnessGoal.countDocuments({ user: user._id }),
    Attendance.countDocuments({ user: user._id }),
  ]);
  return { ...user.toSafeObject(), counts: { workouts, goals, visits } };
};

/**
 * Per-member counts (workouts, goals, progress days, attendance, last
 * activity) for exactly the given member ids, in a handful of aggregations
 * rather than one query per member. Used by the Admin "Members Overview".
 */
const getMemberCountsMap = async (userIds) => {
  if (userIds.length === 0) return new Map();

  const [workoutRows, goalRows, attendanceRows] = await Promise.all([
    Workout.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: "$user",
          count: { $sum: 1 },
          lastDate: { $max: "$workoutDate" },
          days: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$workoutDate" } } },
        },
      },
    ]),
    FitnessGoal.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: "$user",
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          lastDate: { $max: "$createdAt" },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 }, lastDate: { $max: "$checkInTime" } } },
    ]),
  ]);

  const map = new Map();
  userIds.forEach((id) => {
    map.set(String(id), {
      workouts: 0,
      goals: { total: 0, active: 0, completed: 0 },
      progressDays: 0,
      attendance: 0,
      lastActivity: null,
    });
  });
  const bumpLast = (entry, date) => {
    if (date && (!entry.lastActivity || new Date(date) > new Date(entry.lastActivity))) entry.lastActivity = date;
  };
  workoutRows.forEach((r) => {
    const entry = map.get(String(r._id));
    if (!entry) return;
    entry.workouts = r.count;
    entry.progressDays = (r.days || []).length;
    bumpLast(entry, r.lastDate);
  });
  goalRows.forEach((r) => {
    const entry = map.get(String(r._id));
    if (!entry) return;
    entry.goals = { total: r.total, active: r.active, completed: r.completed };
    bumpLast(entry, r.lastDate);
  });
  attendanceRows.forEach((r) => {
    const entry = map.get(String(r._id));
    if (!entry) return;
    entry.attendance = r.count;
    bumpLast(entry, r.lastDate);
  });
  return map;
};

const memberStatus = (lastActivity) => {
  if (!lastActivity) return "Inactive";
  const ageDays = (Date.now() - new Date(lastActivity).getTime()) / (24 * 3600000);
  return ageDays <= RECENT_ACTIVITY_DAYS ? "Active" : "Inactive";
};

/**
 * Admin "Members" page: every registered member (role "user" by default,
 * pass ?role= to include admins too) with real per-member statistics.
 * Counts are computed only for the current page's members - never for the
 * whole collection - so this stays fast regardless of how many members exist.
 */
const listMembersOverview = async (query = {}) => {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const role = query.role || "user";
  const filter = { role: role === "user" ? { $in: ["user", null] } : role }; // null also matches a missing role, same as listUsers
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  const countsMap = await getMemberCountsMap(users.map((u) => u._id));

  const members = users.map((u) => {
    const counts = countsMap.get(String(u._id)) || { workouts: 0, goals: { total: 0, active: 0, completed: 0 }, progressDays: 0, attendance: 0, lastActivity: null };
    return {
      ...u.toSafeObject(),
      workouts: counts.workouts,
      goals: counts.goals,
      progress: { daysLogged: counts.progressDays },
      attendance: counts.attendance,
      lastActivity: counts.lastActivity,
      status: memberStatus(counts.lastActivity),
    };
  });

  return { members, pagination: buildPagination(total, page, limit) };
};

/**
 * Admin "Member Details": everything about one member that already exists in
 * the database - profile, fitness totals, and recent activity. Nothing here
 * is invented; a member with no workouts/goals/attendance simply gets 0s and
 * empty lists.
 */
const getMemberDetails = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("Member not found.", 404);

  const [workoutTotals, goalCounts, attendanceCount, lastVisit, recentWorkouts, recentGoals, recentAttendance] = await Promise.all([
    Workout.aggregate([{ $match: { user: user._id } }, { $group: { _id: null, count: { $sum: 1 }, duration: { $sum: "$duration" }, calories: { $sum: "$caloriesBurned" } } }]),
    FitnessGoal.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]),
    Attendance.countDocuments({ user: user._id }),
    Attendance.findOne({ user: user._id }).sort({ checkInTime: -1 }),
    Workout.find({ user: user._id }).sort({ workoutDate: -1 }).limit(5),
    FitnessGoal.find({ user: user._id }).sort({ createdAt: -1 }).limit(5),
    Attendance.find({ user: user._id }).sort({ checkInTime: -1 }).limit(5),
  ]);

  const workouts = workoutTotals[0] || { count: 0, duration: 0, calories: 0 };
  const goals = goalCounts[0] || { total: 0, active: 0, completed: 0 };
  const lastActivity = [workouts.count && recentWorkouts[0]?.workoutDate, recentGoals[0]?.createdAt, lastVisit?.checkInTime]
    .filter(Boolean)
    .reduce((max, d) => (!max || new Date(d) > new Date(max) ? d : max), null);

  return {
    member: user.toSafeObject(),
    fitness: {
      workouts: { total: workouts.count, totalDuration: workouts.duration, totalCalories: workouts.calories },
      goals: { total: goals.total, active: goals.active, completed: goals.completed },
      attendance: { total: attendanceCount, lastCheckIn: lastVisit ? lastVisit.checkInTime : null },
    },
    status: memberStatus(lastActivity),
    lastActivity,
    recent: { workouts: recentWorkouts, goals: recentGoals, attendance: recentAttendance },
  };
};

const changeRole = async (actor, id, role) => {
  if (sameId(id, actor._id)) throw new AppError("You cannot change your own role.", 400);
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found.", 404);
  user.role = role;
  await user.save();
  return user.toSafeObject();
};

/** Deletes a user together with their workouts, goals and attendance. */
const deleteUser = async (actor, id) => {
  if (sameId(id, actor._id)) throw new AppError("You cannot delete your own account.", 400);
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found.", 404);

  const [workouts, goals, visits] = await Promise.all([
    Workout.deleteMany({ user: user._id }),
    FitnessGoal.deleteMany({ user: user._id }),
    Attendance.deleteMany({ user: user._id }),
  ]);
  await user.deleteOne();
  return { workouts: workouts.deletedCount, goals: goals.deletedCount, visits: visits.deletedCount };
};

module.exports = { getStats, listUsers, getUser, changeRole, deleteUser, listMembersOverview, getMemberDetails };
