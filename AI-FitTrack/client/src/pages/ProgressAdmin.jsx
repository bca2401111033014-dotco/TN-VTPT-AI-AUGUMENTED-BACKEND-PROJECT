import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/endpoints";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import ProgressBar from "../components/ProgressBar";
import MemberSelect from "../components/MemberSelect";
import { errorText, formatDate } from "../utils/format";

// Admin-only view of /progress: an overview row per member, or (once a
// member is selected) that member's own Progress summary + weekly chart.
// The backend independently enforces the admin-only rule on GET
// /api/admin/progress (401/403); this page only decides what to *show*.
export default function ProgressAdmin() {
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const [overview, setOverview] = useState([]);
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      if (userId) {
        const res = await adminApi.progress({ userId, weeks: 8 });
        setDetail(res.data.data);
      } else {
        const res = await adminApi.progress({ q: q.trim() || undefined, limit: 100 });
        setOverview(res.data.data.progress);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [userId, q]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Progress</h1>
          <p className="page-header__subtitle">Progress calculated from every member's workouts and attendance. (Admin)</p>
        </div>
      </div>

      <Banner type="error" onClose={() => setError("")}>{error}</Banner>

      <div className="search-bar">
        <MemberSelect value={userId} onChange={setUserId} />
        {!userId && (
          <input type="text" placeholder="Search member by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>

      {isLoading ? (
        <Loader label="Loading progress…" />
      ) : userId ? (
        detail && (
          <div className="stack">
            <div className="stats-grid">
              <StatCard label="Total workouts" value={detail.summary.totals.workouts} accent />
              <StatCard label="Total time" value={detail.summary.totals.totalDuration} unit="min" />
              <StatCard label="Calories burned" value={detail.summary.totals.totalCalories} unit="kcal" />
              <StatCard label="Current streak" value={detail.summary.streak.current} unit="days" />
              <StatCard label="Longest streak" value={detail.summary.streak.longest} unit="days" />
              <StatCard label="Consistency (30 days)" value={detail.summary.consistency.percentage} unit="%" />
              <StatCard label="Workouts per week" value={detail.summary.frequency.workoutsPerWeek} />
              <StatCard label="Gym visits (30 days)" value={detail.summary.attendance.visitsLast30Days} />
            </div>

            <div className="card">
              <h2 className="section-title">Weekly progress</h2>
              {detail.weekly.map((w) => (
                <div className="bar-row" key={w.weekStart}>
                  <span>{formatDate(w.weekStart)}</span>
                  <ProgressBar value={(w.workouts / Math.max(1, ...detail.weekly.map((x) => x.workouts))) * 100} label={`Week of ${w.weekStart}`} />
                  <span className="numeral">{w.workouts} · {w.duration} min</span>
                </div>
              ))}
            </div>

            {detail.summary.categoryDistribution.length > 0 && (
              <div className="card">
                <h2 className="section-title">Category distribution</h2>
                {detail.summary.categoryDistribution.map((c) => (
                  <div className="bar-row" key={c.category}>
                    <span>{c.category}</span>
                    <ProgressBar value={c.percentage} label={c.category} />
                    <span className="numeral">{c.count} ({c.percentage}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : overview.length === 0 ? (
        <EmptyState title="No members found" description="Try a different search." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Workouts</th>
                <th>Total Duration</th>
                <th>Calories</th>
                <th>Gym visits (30 days)</th>
                <th>Last workout</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => (
                <tr key={row.user.id}>
                  <td>{row.user.name}</td>
                  <td>{row.user.email}</td>
                  <td className="numeral">{row.totals.workouts}</td>
                  <td className="numeral">{row.totals.totalDuration} min</td>
                  <td className="numeral">{row.totals.totalCalories} kcal</td>
                  <td className="numeral">{row.attendance.visitsLast30Days}</td>
                  <td>{row.lastWorkoutDate ? formatDate(row.lastWorkoutDate) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
