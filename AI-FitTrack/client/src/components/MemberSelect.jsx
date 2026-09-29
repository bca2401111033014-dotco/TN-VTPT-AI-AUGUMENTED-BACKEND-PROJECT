import { useEffect, useState } from "react";
import { adminApi } from "../api/endpoints";

/**
 * "All Members" / one-member dropdown shared by the admin Workouts, Goals,
 * Progress and Attendance pages (requirement: a single way to switch between
 * viewing every member and drilling into one). Loads the member list once.
 */
export default function MemberSelect({ value, onChange }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let isMounted = true;
    adminApi
      .members({ limit: 100 })
      .then((res) => {
        if (isMounted) setMembers(res.data.data.members);
      })
      .catch(() => {}); // the page's own error banner covers load failures elsewhere
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by member">
      <option value="">All Members</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.email})
        </option>
      ))}
    </select>
  );
}
