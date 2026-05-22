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
  grade?: string;
}
