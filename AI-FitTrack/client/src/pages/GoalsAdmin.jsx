import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/endpoints";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ProgressBar from "../components/ProgressBar";
import StatusBadge from "../components/StatusBadge";
import MemberSelect from "../components/MemberSelect";
import { errorText, formatDate } from "../utils/format";

const STATUS_OPTIONS = ["", "active", "completed", "cancelled", "expired"];

// Admin-only view of /goals: goals for every registered member. The backend
// independently enforces the admin-only rule on GET /api/admin/goals
// (401/403); this page only decides what to *show*.
export default function GoalsAdmin() {
  const [goals, setGoals] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await adminApi.goals({
        q: userId ? undefined : q.trim() || undefined,
        status: status || undefined,
        userId: userId || undefined,
        limit: 100,
      });
      setGoals(res.data.data.goals);
      setPagination(res.data.data.pagination);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [q, status, userId]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Goals</h1>
          <p className="page-header__subtitle">Goals set by every member. (Admin)</p>
        </div>
      </div>

      <Banner type="error" onClose={() => setError("")}>{error}</Banner>

      <div className="search-bar">
        <MemberSelect value={userId} onChange={setUserId} />
        {!userId && (
          <input type="text" placeholder="Search member by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
      </div>

      {isLoading ? (
        <Loader label="Loading goals…" />
      ) : goals.length === 0 ? (
        <EmptyState title="No goals found" description="Try a different search or filter." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Goal</th>
                  <th>Progress</th>
                  <th>Target date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g._id}>
                    <td>{g.user?.name || "Unknown member"}</td>
                    <td>{g.user?.email || "-"}</td>
                    <td>{g.title}<br /><span className="muted">{g.currentValue} / {g.targetValue} {g.unit}</span></td>
                    <td style={{ minWidth: 150 }}><ProgressBar value={g.progress} label={g.title} /><span className="muted">{g.progress}%</span></td>
                    <td>{formatDate(g.targetDate)}</td>
                    <td><StatusBadge status={g.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && <p className="muted">Showing {goals.length} of {pagination.total} goal(s).</p>}
        </>
      )}
    </Layout>
  );
}
