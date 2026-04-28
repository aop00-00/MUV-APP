// app/routes/staff/_index.tsx
// Redirect /staff → /staff/checkin (main screen)
import { redirect } from "react-router";
export function loader() {
    throw redirect("/staff/checkin");
}
export default function StaffIndex() { return null; }
