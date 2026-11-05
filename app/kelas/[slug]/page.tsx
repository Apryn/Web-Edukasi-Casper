import { notFound } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  getCourseBySlug,
  getAllCourses,
  sanitizeCourseForClient,
} from "@/lib/courses-data";
import ClassroomClient from "./ClassroomClient";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  const courses = getAllCourses();
  return courses.map((course) => ({
    slug: course.slug,
  }));
}

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let course = getCourseBySlug(slug);

  if (!course) {
    const sessionUser = await getSessionUser();
    if (sessionUser && isAdmin(sessionUser)) {
      course = getCourseBySlug(slug, { includeDrafts: true, includeArchived: true });
    }
  }

  if (!course) {
    notFound();
  }

  // Sanitize quiz questions to ensure answer keys are NEVER leaked to client DOM/props
  const sanitizedCourse = sanitizeCourseForClient(course);

  return <ClassroomClient course={sanitizedCourse} />;
}
