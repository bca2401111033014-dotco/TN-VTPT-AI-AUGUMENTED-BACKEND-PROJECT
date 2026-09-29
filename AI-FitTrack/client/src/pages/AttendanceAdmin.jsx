import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/endpoints";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import MemberSelect from "../components/MemberSelect";
import { errorText, formatDate, formatDateTime } from "../utils/format";

const STATUS_OPTIONS = ["", "Present", "Absent", "Checked In", "Checked Out"];

// Admin-only view of /attendance: attendance for every registered member,
// not just the signed-in user. The backend independently enforces the
// admin-only rule on GET /api/admin/attendance (401/403), this page only
// decides what to *show*.
export default function AttendanceAdmin() {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await adminApi.attendance({
        q: userId ? undefined : q.trim() || undefined,
        date: date || undefined,
        status: status || undefined,
        userId: userId || undefined,
        limit: 100,
      });
      setSummary(res.data.data.summary);
      setRecords(res.data.data.records);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [q, date, status, userId]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Attendance Management</h1>
          <p className="page-header__subtitle">View and manage attendance for all members. (Admin)</p>
        </div>
        <button className="btn btn--ghost" onClick={() => { setIsLoading(true); load(); }}>
          Refresh
        </button>
      </div>

      <Banner type="error" onClose={() => setError("")}>{error}</Banner>

      {summary && (
        <div className="stats-grid">
          <StatCard label="Total Members" value={summary.totalMembers} accent />
          <StatCard label="Present Today" value={summary.presentToday} />
          <StatCard label="Absent Today" value={summary.absentToday} />
          <StatCard label="Currently Checked In" value={summary.checkedInNow} />
        </div>
      )}

      <div className="search-bar">
        <MemberSelect value={userId} onChange={setUserId} />
        {!userId && (
          <input
            type="text"
            placeholder="Search member by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Loader label="Loading attendance…" />
      ) : records.length === 0 ? (
        <EmptyState title="No members found" description="Try a different search or filter." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Email</th>
                <th>Date</th>
                <th>Check-in Time</th>
                <th>Check-out Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.userId}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.checkInTime ? formatDateTime(r.checkInTime) : "-"}</td>
                  <td>{r.checkOutTime ? formatDateTime(r.checkOutTime) : "-"}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
