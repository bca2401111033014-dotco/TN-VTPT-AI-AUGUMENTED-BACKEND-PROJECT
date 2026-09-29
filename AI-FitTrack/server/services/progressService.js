const Workout = require("../models/Workout");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { addDays, startOfUtcDay, toDayKey } = require("../utils/dateUtils");
const { computeStreaks, bucketWeekly, computeConsistency } = require("../utils/progressCalc");
const { escapeRegex } = require("../utils/text");
const { getPagination, buildPagination } = require("../utils/pagination");

/**
 * Per-day totals of one user's workouts (MongoDB aggregation).
 * Returns [{ day: "YYYY-MM-DD", workouts, duration, calories }] oldest first.
 */
const getDailyRollup = async (userId, from = null, to = null) => {
  const match = { user: userId };
  if (from || to) {
    match.workoutDate = {};
    if (from) match.workoutDate.$gte = from;
    if (to) match.workoutDate.$lt = to;
  }
  const rows = await Workout.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$workoutDate" } },
        workouts: { $sum: 1 },
        duration: { $sum: "$duration" },
        calories: { $sum: "$caloriesBurned" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ day: r._id, workouts: r.workouts, duration: r.duration, calories: r.calories }));
};

const round1 = (n) => Math.round((n || 0) * 10) / 10;

const sumRows = (rows) =>
  rows.reduce(
    (acc, r) => ({ workouts: acc.workouts + r.workouts, duration: acc.duration + r.duration, calories: acc.calories + r.calories }),
    { workouts: 0, duration: 0, calories: 0 }
  );

/**
 * Progress summary for one user: totals, category distribution, recent
 * frequency, workout streaks, consistency and gym visits. All numbers are
 * calculated from the user's own stored workouts / attendance.
 */
const getSummary = async (userId, today = new Date()) => {
  const [allDays, categories, visits] = await Promise.all([
    getDailyRollup(userId),
    Workout.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Attendance.countDocuments({ user: userId, checkInTime: { $gte: addDays(startOfUtcDay(today), -29) } }),
  ]);

  const totals = sumRows(allDays);
  const dayKeys = allDays.map((r) => r.day);
  const tomorrow = addDays(startOfUtcDay(today), 1);
  const inLast = (days) => allDays.filter((r) => r.day >= toDayKey(addDays(tomorrow, -days)) && r.day < toDayKey(tomorrow));
  const categoryTotal = categories.reduce((n, c) => n + c.count, 0);

  return {
    totals: {
      workouts: totals.workouts,
      totalDuration: totals.duration,
      averageDuration: totals.workouts ? round1(totals.duration / totals.workouts) : 0,
      totalCalories: totals.calories,
    },
    categoryDistribution: categories.map((c) => ({
      category: c._id,
      count: c.count,
      percentage: categoryTotal ? round1((c.count / categoryTotal) * 100) : 0,
    })),
    frequency: {
      last7Days: sumRows(inLast(7)).workouts,
      last30Days: sumRows(inLast(30)).workouts,
      workoutsPerWeek: round1(sumRows(inLast(28)).workouts / 4), // average over the last 4 weeks
    },
    streak: computeStreaks(dayKeys, today),
    consistency: computeConsistency(dayKeys, 30, today),
    attendance: { visitsLast30Days: visits },
  };
};

/** Last `weeks` weeks (Mon-Sun, UTC), oldest first, empty weeks included. */
const getWeekly = async (userId, weeks = 8, today = new Date()) => {
  const from = addDays(startOfUtcDay(today), -(7 * weeks + 7)); // covers the first (partial) week
  const rows = await getDailyRollup(userId, from, addDays(startOfUtcDay(today), 1));
  return bucketWeekly(rows, weeks, today);
};

/**
 * Admin-only: a progress summary row (totals + streak) for every registered
 * member, computed from the SAME workout/attendance data as a member's own
 * Progress page - no separate "progress record" collection exists or is
 * created. Supports the same member search used elsewhere in the admin UI.
 */
const getAdminOverview = async (query = {}, today = new Date()) => {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 50, maxLimit: 200 });
  const userFilter = {};
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    userFilter.$or = [{ name: regex }, { email: regex }];
  }

  const [members, total] = await Promise.all([
    User.find(userFilter).sort({ name: 1 }).skip(skip).limit(limit),
    User.countDocuments(userFilter),
  ]);
  const memberIds = members.map((m) => m._id);

  const [workoutTotals, visitCounts] = await Promise.all([
    Workout.aggregate([
      { $match: { user: { $in: memberIds } } },
      {
        $group: {
          _id: "$user",
          workouts: { $sum: 1 },
          duration: { $sum: "$duration" },
          calories: { $sum: "$caloriesBurned" },
          lastWorkoutDate: { $max: "$workoutDate" },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: { user: { $in: memberIds }, checkInTime: { $gte: addDays(startOfUtcDay(today), -29) } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]),
  ]);
  const totalsMap = new Map(workoutTotals.map((r) => [String(r._id), r]));
  const visitsMap = new Map(visitCounts.map((r) => [String(r._id), r.count]));

  const rows = members.map((member) => {
    const t = totalsMap.get(String(member._id));
    return {
      user: { id: member._id, name: member.name, email: member.email },
      totals: {
        workouts: t?.workouts || 0,
        totalDuration: t?.duration || 0,
        totalCalories: t?.calories || 0,
      },
      lastWorkoutDate: t?.lastWorkoutDate || null,
      attendance: { visitsLast30Days: visitsMap.get(String(member._id)) || 0 },
    };
  });

  return { progress: rows, pagination: buildPagination(total, page, limit) };
};

module.exports = { getSummary, getWeekly, getAdminOverview };
