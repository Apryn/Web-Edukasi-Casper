import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  getDrillById,
  getDrillSubmissions,
  computeStudentDrillSummary,
} from "@/lib/drill-storage";
import { sanitizeDrillForStudent } from "@/lib/drill-evaluation-engine";
import StudentDrillWorkspace from "@/components/drills/StudentDrillWorkspace";

export const dynamic = "force-dynamic";

export default async function StudentDrillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  // Authentication Required: redirect to login if no active session
  if (!user) {
    redirect(`/login?redirect=/belajar/drill/${encodeURIComponent(id)}`);
  }

  const drill = getDrillById(id);
  if (!drill) {
    notFound();
  }

  // Restrict DRAFT drills strictly to Admins
  if (drill.status === "DRAFT" && !isAdmin(user)) {
    notFound();
  }

  // User submissions & summary
  const submissions = getDrillSubmissions(user.id, drill.id);
  const userSummary = computeStudentDrillSummary(user.id, drill.id, submissions);
  const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;

  const history = submissions.map((s) => ({
    id: s.id,
    attemptNumber: s.attempt_number,
    score: s.score,
    invalidationScore: s.invalidation_score,
    safetyGatePassed: s.safety_gate_passed,
    evaluationStatus: s.evaluation_status,
    createdAt: s.created_at,
  }));

  // Sanitize drill case (zero secrets sent to client)
  const publicDrill = sanitizeDrillForStudent(drill, userSummary);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ flex: 1 }}>
        <StudentDrillWorkspace
          drill={publicDrill}
          initialSummary={userSummary}
          initialLatestSubmission={latestSubmission}
          initialHistory={history}
        />
      </div>
      <Footer />
    </div>
  );
}

