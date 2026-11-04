import { notFound } from "next/navigation";
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
  const course = getCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  // Sanitize quiz questions to ensure answer keys are NEVER leaked to client DOM/props
  const sanitizedCourse = sanitizeCourseForClient(course);

  return <ClassroomClient course={sanitizedCourse} />;
}
