export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseCategory = 
  | 'Trading Foundation'
  | 'Technical Analysis'
  | 'Market Structure'
  | 'Risk & Psychology'
  | 'Specialized Asset';

export type CoursePublicationStatus = 'draft' | 'published' | 'archived';

export type ContentBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'callout'
  | 'image';

export interface LessonContentBlock {
  id: string;
  type: ContentBlockType;
  text?: string;
  level?: 2 | 3;
  style?: 'bullet' | 'ordered';
  items?: string[];
  variant?: 'info' | 'warning' | 'tip';
  imageUrl?: string;
  imageAlt?: string;
  caption?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface PublicQuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface QuizSubmissionReview {
  questionId: string;
  question: string;
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation: string;
}

export type VisualDiagramType =
  | 'liquidity-orderbook'
  | 'candlestick-anatomy'
  | 'market-structure-bos-choch'
  | 'snr-zones-sbr-rbs'
  | 'confluence-workflow'
  | 'xauusd-macro-session'
  | 'position-sizing-rrr'
  | 'psychology-cycle'
  | 'journal-expectancy';

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  duration: string; // e.g. "10 Menit"
  type: 'reading' | 'chart-study' | 'quiz' | 'video' | 'diagram';
  summary: string;
  learningObjectives?: string[];
  content: string[]; // Deep conceptual explanation paragraphs
  contentBlocks?: LessonContentBlock[];
  applicationExample?: string;
  caseStudy?: string;
  practicalSteps?: string[];
  commonMistakes?: string[];
  keyTakeaways?: string[];
  references?: string[];
  visualDiagram?: VisualDiagramType;
  chartData?: {
    title: string;
    description: string;
    timeframe: string;
    bias: 'Bullish' | 'Bearish' | 'Neutral';
  };
  videoUrl?: string; // YouTube or direct MP4 URL
  videoDuration?: string;
  passingScore?: number;
  quiz?: QuizQuestion[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order?: number;
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
  status?: CoursePublicationStatus;
  order?: number;
  isStaticBaseline?: boolean;
  isOverridden?: boolean;
  thumbnailUrl?: string;
  coverUrl?: string;
  featured?: boolean;
  instructor: {
    name: string;
    role: string;
    avatar?: string;
  };
  overview: string;
  objectives: string[];
  competencies?: string[];
  prerequisites: string[];
  courseSummary?: string[];
  references?: string[];
  updatedAt?: string;
  updatedBy?: string;
  modules: CourseModule[];
}

export type AdminAuditAction =
  | 'COURSE_CREATE'
  | 'COURSE_UPDATE'
  | 'COURSE_STATUS_CHANGE'
  | 'COURSE_REORDER'
  | 'COURSE_RESET_BASELINE'
  | 'COURSE_DELETE'
  | 'MODULE_MUTATION'
  | 'LESSON_MUTATION'
  | 'QUIZ_MUTATION';

export interface AdminAuditLogEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  action: AdminAuditAction;
  target_course_id: string;
  target_course_slug: string;
  summary: string;
  created_at: string;
}

export interface UserCourseProgress {
  courseSlug: string;
  completedLessonIds: string[];
  quizScores: Record<string, number>; // quizId -> score
  lastAccessedLessonId?: string;
  enrolledAt: string;
  updatedAt: string;
}
