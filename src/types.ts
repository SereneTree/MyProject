export type MemberLevel = 'free' | 'study' | 'career';

export interface Grade {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Course {
  id: string;
  gradeId: string;
  name: string;
  isHot: boolean;
  viewCount: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  difficulty: 'easy' | 'medium' | 'hard';
  assignmentType: 'coding' | 'theory' | 'project';
  viewCount: number;
  favoriteCount: number;
  courseName: string;
  gradeId: string;
  gradeName: string;
}

export interface AssignmentModule {
  id: string;
  moduleType: string;
  title: string;
  requiredLevel: MemberLevel;
  locked: boolean;
  content: string;
  previewContent: string;
}

export interface AssignmentDetail extends Assignment {
  modules: AssignmentModule[];
  plans: MembershipPlan[];
}

export interface MembershipPlan {
  level: MemberLevel;
  name: string;
  tagline: string;
  price: number;
  period: string;
  benefits: string[];
}

export interface Profile {
  nickname: string;
  phone?: string;
  school?: string;
  major?: string;
  majorId?: string;
  grade?: string;
}

export interface Major {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MajorCourse {
  id: string;
  name: string;
  gradeId: string;
  gradeName: string;
  isHot: boolean;
  viewCount: number;
  sortOrder: number;
}

export interface UserCoursesResponse {
  user: {
    id: string;
    phone: string;
    nickname: string | null;
    school: string | null;
    major: string | null;
    majorId: string | null;
    majorName: string | null;
    gradeId: string | null;
    gradeName: string | null;
    /** 当前用户被赋予的年级访问权限（控制锁定/解锁 UI） */
    unlockedGradeIds: string[];
  };
  courses: MajorCourse[];
}
