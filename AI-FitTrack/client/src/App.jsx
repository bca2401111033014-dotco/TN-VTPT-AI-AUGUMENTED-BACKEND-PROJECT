import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Workouts from "./pages/Workouts";
import AddWorkout from "./pages/AddWorkout";
import EditWorkout from "./pages/EditWorkout";
import WorkoutDetail from "./pages/WorkoutDetail";
import Goals from "./pages/Goals";
import Progress from "./pages/Progress";
import Attendance from "./pages/Attendance";
import Recommendation from "./pages/Recommendation";
import FitnessInsights from "./pages/FitnessInsights";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import Members from "./pages/Members";
import MemberDetails from "./pages/MemberDetails";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/workouts" element={<ProtectedRoute><Workouts /></ProtectedRoute>} />
          <Route path="/workouts/new" element={<ProtectedRoute><AddWorkout /></ProtectedRoute>} />
          <Route path="/workouts/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/workouts/:id/edit" element={<ProtectedRoute><EditWorkout /></ProtectedRoute>} />
          <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
          <Route path="/recommendation" element={<ProtectedRoute><Recommendation /></ProtectedRoute>} />
          <Route path="/fitness-insights" element={<ProtectedRoute><FitnessInsights /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          {/* Kept for backward compatibility with the previous /admin bookmark; the
              nav now links to "/" (Dashboard), which shows the same admin view. */}
          <Route path="/admin" element={<ProtectedRoute><RoleRoute roles={["admin"]}><AdminDashboard /></RoleRoute></ProtectedRoute>} />
          <Route path="/admin/members" element={<ProtectedRoute><RoleRoute roles={["admin"]}><Members /></RoleRoute></ProtectedRoute>} />
          <Route path="/admin/members/:id" element={<ProtectedRoute><RoleRoute roles={["admin"]}><MemberDetails /></RoleRoute></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
