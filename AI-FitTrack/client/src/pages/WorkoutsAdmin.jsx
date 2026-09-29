import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/endpoints";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import MemberSelect from "../components/MemberSelect";
import { errorText, formatDate } from "../utils/format";

const CATEGORIES = ["", "Cardio", "Strength", "Flexibility", "Balance", "Sports", "HIIT", "Yoga", "Other"];

// Admin-only view of /workouts: workouts for every registered member, not
// just the signed-in user. The backend independently enforces the
// admin-only rule on GET /api/admin/workouts (401/403); this page only
// decides what to *show*.
export default function WorkoutsAdmin() {
  const [workouts, setWorkouts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [q, setQ] = useState("");
  const [workoutName, setWorkoutName] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await adminApi.workouts({
        q: userId ? undefined : q.trim() || undefined,
        workoutName: workoutName.trim() || undefined,
        category: category || undefined,
        date: date || undefined,
        userId: userId || undefined,
        limit: 100,
      });
      setWorkouts(res.data.data.workouts);
      setPagination(res.data.data.pagination);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [q, workoutName, category, date, userId]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Workouts</h1>
          <p className="page-header__subtitle">Workouts logged by every member. (Admin)</p>
        </div>
      </div>

      <Banner type="error" onClose={() => setError("")}>{error}</Banner>

      <div className="search-bar">
        <MemberSelect value={userId} onChange={setUserId} />
        {!userId && (
          <input type="text" placeholder="Search member by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        <input type="text" placeholder="Search workout name…" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c || "All categories"}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {isLoading ? (
        <Loader label="Loading workouts…" />
      ) : workouts.length === 0 ? (
        <EmptyState title="No workouts found" description="Try a different search or filter." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Workout</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Calories</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {workouts.map((w) => (
                  <tr key={w._id}>
                    <td>{w.user?.name || "Unknown member"}</td>
                    <td>{w.user?.email || "-"}</td>
                    <td>{w.workoutName}</td>
                    <td><span className="badge">{w.category}</span></td>
                    <td className="numeral">{w.duration} min</td>
                    <td className="numeral">{w.caloriesBurned} kcal</td>
                    <td>{formatDate(w.workoutDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && <p className="muted">Showing {workouts.length} of {pagination.total} workout(s).</p>}
        </>
      )}
    </Layout>
  );
}
