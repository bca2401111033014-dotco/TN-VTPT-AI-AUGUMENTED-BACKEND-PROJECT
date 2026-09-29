import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/endpoints";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { errorText, formatDate } from "../utils/format";

// Admin-only view of "/": real gym-wide statistics from MongoDB (no
// hardcoded numbers) plus a short preview of the full Members table.
// The backend independently enforces the admin-only rule on GET
// /api/admin/dashboard (401/403); this page only decides what to *show*.
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .dashboard()
      .then((res) => {
        setStats(res.data.data.stats);
        setMembers(res.data.data.membersOverview.members);
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Layout><Loader label="Loading admin dashboard…" /></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="page-header__subtitle">Gym-wide statistics across every registered member.</p>
        </div>
        <Link to="/admin/members" className="btn btn--primary">View all members</Link>
      </div>

      <Banner type="error" onClose={() => setError("")}>{error}</Banner>

      {stats && (
        <div className="stack">
          <div className="stats-grid">
            <StatCard label="Total Members" value={stats.members.total} accent />
            <StatCard label="Total Workouts" value={stats.workouts.total} />
            <StatCard label="Total Goals" value={stats.goals.total} />
            <StatCard label="Total Progress Records" value={stats.progress.totalRecords} />
            <StatCard label="Total Attendance Records" value={stats.attendance.totalRecords} />
            <StatCard label="Members Checked In Today" value={stats.attendance.membersCheckedInToday} />
            <StatCard label="Active Goals" value={stats.goals.active} />
            <StatCard label="Completed Goals" value={stats.goals.completed} />
          </div>

          <div>
            <div className="page-header" style={{ marginBottom: 8 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Members Overview</h2>
              <Link to="/admin/members" className="link-btn">See all members →</Link>
            </div>
            {members.length === 0 ? (
              <p className="muted">No members registered yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Email</th>
                      <th>Workouts</th>
                      <th>Goals</th>
                      <th>Progress</th>
                      <th>Attendance</th>
                      <th>Last Activity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td><Link to={`/admin/members/${m.id}`}>{m.name}</Link></td>
                        <td>{m.email}</td>
                        <td className="numeral">{m.workouts}</td>
                        <td className="numeral">{m.goals.total}</td>
                        <td className="numeral">{m.progress.daysLogged}</td>
                        <td className="numeral">{m.attendance}</td>
                        <td>{m.lastActivity ? formatDate(m.lastActivity) : "-"}</td>
                        <td><StatusBadge status={m.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
