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

  // Sanitize quiz questions to ensure answer keys are NEVER leaked to client DOM/props
  const sanitizedCourse = {
    ...course,
    modules: course.modules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((lesson) => ({
        ...lesson,
        quiz: lesson.quiz?.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          // correctAnswer and explanation are excluded for client security!
        })),
      })),
    })),
  };

  return <ClassroomClient course={sanitizedCourse as any} />;
}
