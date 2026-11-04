import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  getCourseBySlug,
  getAllCourses,
  countCourseLessons,
  sanitizeCourseForClient,
} from "@/lib/courses-data";
import CourseSyllabusClient from "./CourseSyllabusClient";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  const courses = getAllCourses();
  return courses.map((course) => ({
    slug: course.slug,
  }));
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  const actualTotalLessons = countCourseLessons(course);
  const safeCourse = sanitizeCourseForClient(course);

  return (
    <main>
      <Navbar />
      <CourseSyllabusClient course={safeCourse} actualTotalLessons={actualTotalLessons} />
      <Footer />
    </main>
  );
}
