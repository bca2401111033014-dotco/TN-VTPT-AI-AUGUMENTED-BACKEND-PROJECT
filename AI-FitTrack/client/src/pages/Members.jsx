import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { errorText, formatDate } from "../utils/format";

const ROLES = ["user", "admin"];

// Admin-only "Members" page: every registered member with real per-member
// statistics (workouts, goals, progress, attendance, last activity, status),
// search, and the existing role-change / delete actions.
export default function Members() {
  const { user: me } = useAuth();
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await adminApi.members({ q: q.trim() || undefined, limit: 50 });
      setMembers(res.data.data.members);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  const run = async (action, message) => {
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const changeRole = (m, role) => run(() => adminApi.setRole(m.id, role), `${m.name} is now ${role}.`);
  const remove = (m) =>
    window.confirm(`Delete ${m.name} and all their workouts, goals and visits?`) && run(() => adminApi.deleteUser(m.id), `${m.name} was deleted.`);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Members</h1>
          <p className="page-header__subtitle">Every registered member, with real statistics from the database.</p>
        </div>
      </div>

      <Banner type="error" onClose={() => setError("")}>{error}</Banner>
      <Banner type="success" onClose={() => setSuccess("")}>{success}</Banner>

      <div className="search-bar">
        <input type="text" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Loader label="Loading members…" />
      ) : members.length === 0 ? (
        <EmptyState title="No members found" description="Try a different search." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Workouts</th>
                <th>Goals</th>
                <th>Progress</th>
                <th>Attendance</th>
                <th>Last Activity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/admin/members/${m.id}`}>{m.name}</Link></td>
                  <td>{m.email}</td>
                  <td>
                    <select value={m.role} disabled={m.id === me?.id} onChange={(e) => changeRole(m, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>{formatDate(m.createdAt)}</td>
                  <td className="numeral">{m.workouts}</td>
                  <td className="numeral">{m.goals.total}</td>
                  <td className="numeral">{m.progress.daysLogged}</td>
                  <td className="numeral">{m.attendance}</td>
                  <td>{m.lastActivity ? formatDate(m.lastActivity) : "-"}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>
                    <div className="table-actions">
                      <Link to={`/admin/members/${m.id}`} className="btn btn--ghost btn--sm">View Details</Link>
                      {m.id !== me?.id && <button className="btn btn--danger btn--sm" onClick={() => remove(m)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
