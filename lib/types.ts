export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseCategory = 
  | 'Trading Foundation'
  | 'Technical Analysis'
  | 'Market Structure'
  | 'Risk & Psychology'
  | 'Specialized Asset';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  duration: string; // e.g. "10 Menit"
  type: 'reading' | 'chart-study' | 'quiz';
  summary: string;
  content: string[]; // Structured paragraphs
  keyTakeaways?: string[];
  chartData?: {
    title: string;
    description: string;
    timeframe: string;
    bias: 'Bullish' | 'Bearish' | 'Neutral';
  };
  quiz?: QuizQuestion[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  number: string; // e.g. "ACADEMY-01"
  title: string;
  subtitle: string;
  category: CourseCategory;
  level: CourseLevel;
  duration: string; // e.g. "3 Jam"
  totalLessons: number;
  featured?: boolean;
  instructor: {
    name: string;
    role: string;
    avatar?: string;
  };
  overview: string;
  objectives: string[];
  prerequisites: string[];
  modules: CourseModule[];
}

export interface UserCourseProgress {
  courseSlug: string;
  completedLessonIds: string[];
  quizScores: Record<string, number>; // quizId -> score
  lastAccessedLessonId?: string;
  enrolledAt: string;
  updatedAt: string;
}
