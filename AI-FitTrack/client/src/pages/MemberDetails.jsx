import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "../api/endpoints";
import Layout from "../components/Layout";
import Banner from "../components/Banner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import { errorText, formatDate, formatDateTime } from "../utils/format";

// Admin-only "Member Details": everything that already exists in the
// database about one member. Fields that don't apply (e.g. no goals yet)
// show 0 / an empty state rather than being hidden or faked.
export default function MemberDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");
    adminApi
      .memberDetails(id)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(errorText(err)))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <Layout><Loader label="Loading member details…" /></Layout>;
  if (error) return <Layout><Banner type="error">{error}</Banner></Layout>;
  if (!data) return null;

  const { member, fitness, status, lastActivity, recent } = data;

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{member.name}</h1>
          <p className="page-header__subtitle">{member.email}</p>
        </div>
        <Link to="/admin/members" className="btn btn--ghost">← Back to Members</Link>
      </div>

      <div className="stack">
        <div className="card">
          <h2 className="section-title">Member Information</h2>
          <div className="stats-grid">
            <StatCard label="Role" value={member.role} />
            <StatCard label="Registered" value={formatDate(member.createdAt)} />
            <StatCard label="Status" value={status} />
            <StatCard label="Last Activity" value={lastActivity ? formatDate(lastActivity) : "None yet"} />
          </div>
          {(member.fitnessProfile?.age || member.fitnessProfile?.heightCm || member.fitnessProfile?.weightKg || member.fitnessProfile?.experienceLevel || member.fitnessProfile?.fitnessGoal) && (
            <div className="stats-grid" style={{ marginTop: 12 }}>
              {member.fitnessProfile?.age && <StatCard label="Age" value={member.fitnessProfile.age} />}
              {member.fitnessProfile?.heightCm && <StatCard label="Height" value={member.fitnessProfile.heightCm} unit="cm" />}
              {member.fitnessProfile?.weightKg && <StatCard label="Weight" value={member.fitnessProfile.weightKg} unit="kg" />}
              {member.fitnessProfile?.experienceLevel && <StatCard label="Experience" value={member.fitnessProfile.experienceLevel} />}
              {member.fitnessProfile?.fitnessGoal && <StatCard label="Fitness Goal" value={member.fitnessProfile.fitnessGoal} />}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Fitness Information</h2>
          <div className="stats-grid">
            <StatCard label="Total Workouts" value={fitness.workouts.total} accent />
            <StatCard label="Total Duration" value={fitness.workouts.totalDuration} unit="min" />
            <StatCard label="Calories Burned" value={fitness.workouts.totalCalories} unit="kcal" />
            <StatCard label="Total Goals" value={fitness.goals.total} />
            <StatCard label="Active Goals" value={fitness.goals.active} />
            <StatCard label="Completed Goals" value={fitness.goals.completed} />
            <StatCard label="Attendance Records" value={fitness.attendance.total} />
            <StatCard label="Last Check-in" value={fitness.attendance.lastCheckIn ? formatDate(fitness.attendance.lastCheckIn) : "Never"} />
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Recent Workouts</h2>
          {recent.workouts.length === 0 ? (
            <EmptyState title="No workouts logged" description="This member hasn't logged any workouts yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Workout</th><th>Category</th><th>Duration</th><th>Calories</th><th>Date</th></tr></thead>
                <tbody>
                  {recent.workouts.map((w) => (
                    <tr key={w._id}>
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
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Recent Goals</h2>
          {recent.goals.length === 0 ? (
            <EmptyState title="No goals set" description="This member hasn't created any goals yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Goal</th><th>Progress</th><th>Target date</th><th>Status</th></tr></thead>
                <tbody>
                  {recent.goals.map((g) => (
                    <tr key={g._id}>
                      <td>{g.title}<br /><span className="muted">{g.currentValue} / {g.targetValue} {g.unit}</span></td>
                      <td style={{ minWidth: 150 }}><ProgressBar value={g.progress} label={g.title} /><span className="muted">{g.progress}%</span></td>
                      <td>{formatDate(g.targetDate)}</td>
                      <td><StatusBadge status={g.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Recent Attendance</h2>
          {recent.attendance.length === 0 ? (
            <EmptyState title="No attendance records" description="This member hasn't checked in yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Check-in</th><th>Check-out</th><th>Duration</th></tr></thead>
                <tbody>
                  {recent.attendance.map((a) => (
                    <tr key={a._id}>
                      <td>{formatDateTime(a.checkInTime)}</td>
                      <td>{a.checkOutTime ? formatDateTime(a.checkOutTime) : a.isOpen ? "in progress" : "-"}</td>
                      <td className="numeral">{a.durationMinutes !== undefined && a.durationMinutes !== null ? `${a.durationMinutes} min` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
