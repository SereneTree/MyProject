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
  id?: string;
  nickname: string;
  phone?: string;
  school?: string;
  major?: string;
  majorId?: string;
  grade?: string;
}

/** 后端 /api/auth/login | /api/auth/me | PATCH /api/users/me 统一返回的用户信息 */
export interface MeUser {
  id: string;
  phone: string;
  nickname: string | null;
  school: string | null;
  major: string | null;
  majorId: string | null;
  majorName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  memberLevel: MemberLevel;
  memberExpiresAt: string | null;
  unlockedGradeIds: string[];
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

/** 课程资源主分类 */
export type CourseResourceCategory = 'lecture' | 'homework' | 'exam' | 'career';

/** 课程资源表中所有可能的子类型 */
export type CourseResourceSubType =
  | 'handout'
  | 'notes'
  | 'project'
  | 'practice_summary'
  | 'paper'
  | 'paper_analysis'
  | 'career_extension';

/** 列表项：课程资源 */
export interface CourseResourceItem {
  id: string;
  courseId: string;
  category: CourseResourceCategory;
  subType: CourseResourceSubType;
  title: string;
  summary: string | null;
  requiredLevel: MemberLevel;
  locked: boolean;
  viewCount: number;
  sortOrder: number;
}

export interface CourseResourceGroup {
  category: CourseResourceCategory;
  items: CourseResourceItem[];
}

export interface CourseResourceListResponse {
  data: {
    course: { id: string; name: string; gradeId: string; gradeName: string };
    groups: CourseResourceGroup[];
  };
}

export interface CourseResourceDetail {
  id: string;
  courseId: string;
  courseName: string;
  gradeId: string;
  gradeName: string;
  category: CourseResourceCategory;
  subType: CourseResourceSubType;
  title: string;
  summary: string | null;
  requiredLevel: MemberLevel;
  locked: boolean;
  content: string | null;
  url: string | null;
  viewCount: number;
  hasMaterial: boolean;
  plans: MembershipPlan[];
}
