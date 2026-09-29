const Attendance = require("../models/Attendance");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getPagination, buildPagination } = require("../utils/pagination");
const { startOfUtcDay, addDays } = require("../utils/dateUtils");
const { escapeRegex } = require("../utils/text");

// Row-level status for one member on one day. "Present" (used only in the
// summary cards and as a filter value) means either of the two below.
const ATTENDANCE_STATUSES = ["Present", "Absent", "Checked In", "Checked Out"];

// A visit that was never checked out is treated as abandoned after this long,
// so a forgotten check-out cannot block the member from checking in again.
const STALE_VISIT_HOURS = 12;
const ALREADY_CHECKED_IN = "You are already checked in. Check out first.";

/**
 * Gym check-in. A user can have only one open visit at a time
 * (also enforced by a unique index, so simultaneous requests cannot both succeed).
 */
const checkIn = async (actor) => {
  const open = await Attendance.findOne({ user: actor._id, isOpen: true });
  if (open) {
    const ageHours = (Date.now() - new Date(open.checkInTime).getTime()) / 3600000;
    if (ageHours < STALE_VISIT_HOURS) throw new AppError(ALREADY_CHECKED_IN, 409);
    await Attendance.updateOne({ _id: open._id, isOpen: true }, { $set: { isOpen: false } }); // close the abandoned visit
  }

  try {
    return await Attendance.create({ user: actor._id, checkInTime: new Date() });
  } catch (err) {
    if (err.code === 11000) throw new AppError(ALREADY_CHECKED_IN, 409);
    throw err;
  }
};

/** Closes the caller's open visit and records its length. */
const checkOut = async (actor) => {
  const open = await Attendance.findOne({ user: actor._id, isOpen: true });
  if (!open) throw new AppError("You are not checked in.", 409);

  const now = new Date();
  const updated = await Attendance.findOneAndUpdate(
    { _id: open._id, isOpen: true }, // atomic: a second simultaneous check-out finds nothing
    { $set: { isOpen: false, checkOutTime: now, durationMinutes: Math.round((now - new Date(open.checkInTime)) / 60000) } },
    { new: true }
  );
  if (!updated) throw new AppError("You are not checked in.", 409);
  return updated;
};

/** The caller's own attendance history (newest first) and the visit currently open, if any. */
const listAttendance = async (actor, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: actor._id };
  if (query.from || query.to) {
    filter.checkInTime = {};
    if (query.from) filter.checkInTime.$gte = query.from;
    if (query.to) filter.checkInTime.$lt = new Date(query.to.getTime() + 24 * 3600000); // "to" is inclusive
  }

  const [attendance, total, currentVisit] = await Promise.all([
    Attendance.find(filter).sort({ checkInTime: -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
    Attendance.findOne({ user: actor._id, isOpen: true }),
  ]);
  return { attendance, currentVisit, pagination: buildPagination(total, page, limit) };
};

/**
 * Admin-only: attendance for EVERY registered member on a given day, plus
 * today's summary counts. Reuses the same Attendance collection as the
 * member-facing endpoints - no separate "admin attendance" model or
 * duplicated records are created.
 *
 * Absent members are never written to the database; "Absent" is derived by
 * comparing the registered-users list against that day's attendance
 * records, purely for display.
 */
const listAllAttendance = async (query = {}) => {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 100, maxLimit: 500 });

  // The table's date filter (defaults to today). validateQuery's "dateOnly"
  // type already turns this into a UTC-midnight Date, if present.
  const day = query.date || startOfUtcDay(new Date());
  const nextDay = addDays(day, 1);

  // The summary cards always reflect the real "today", independent of the
  // table's date filter, per the "Present Today / Absent Today" wording.
  const today = startOfUtcDay(new Date());
  const tomorrow = addDays(today, 1);

  const userFilter = {};
  if (query.userId) userFilter._id = query.userId; // member-selector filter ("All Members" = omitted)
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    userFilter.$or = [{ name: regex }, { email: regex }];
  }

  const [members, totalMembers, presentTodayIds, checkedInNow] = await Promise.all([
    User.find(userFilter).sort({ name: 1 }),
    User.countDocuments({}),
    Attendance.distinct("user", { checkInTime: { $gte: today, $lt: tomorrow } }),
    Attendance.countDocuments({ isOpen: true }),
  ]);

  // One attendance lookup for the filtered date, covering only the members
  // matched by the search above.
  const memberIds = members.map((u) => u._id);
  const dayVisits = await Attendance.find({ user: { $in: memberIds }, checkInTime: { $gte: day, $lt: nextDay } }).sort({
    checkInTime: -1,
  });
  const latestVisitByUser = new Map();
  dayVisits.forEach((visit) => {
    const key = String(visit.user);
    if (!latestVisitByUser.has(key)) latestVisitByUser.set(key, visit); // already sorted newest-first
  });

  let records = members.map((member) => {
    const visit = latestVisitByUser.get(String(member._id));
    const status = !visit ? "Absent" : visit.isOpen ? "Checked In" : "Checked Out";
    return {
      userId: member._id,
      name: member.name,
      email: member.email,
      date: day,
      checkInTime: visit ? visit.checkInTime : null,
      checkOutTime: visit && visit.checkOutTime ? visit.checkOutTime : null,
      status,
    };
  });

  if (query.status) {
    records = records.filter((r) => (query.status === "Present" ? r.status !== "Absent" : r.status === query.status));
  }

  const total = records.length;
  const paged = records.slice(skip, skip + limit);

  return {
    date: day,
    summary: {
      totalMembers,
      presentToday: presentTodayIds.length,
      absentToday: totalMembers - presentTodayIds.length,
      checkedInNow,
    },
    records: paged,
    pagination: buildPagination(total, page, limit),
  };
};

module.exports = { checkIn, checkOut, listAttendance, listAllAttendance, ATTENDANCE_STATUSES };
