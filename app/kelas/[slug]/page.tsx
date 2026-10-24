import { notFound } from "next/navigation";
import { getCourseBySlug, getAllCourses } from "@/lib/courses-data";
import ClassroomClient from "./ClassroomClient";

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

  return <ClassroomClient course={course} />;
}
