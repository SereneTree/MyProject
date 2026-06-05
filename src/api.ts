import type { Assignment, AssignmentDetail, Course, CourseResourceDetail, CourseResourceListResponse, Grade, Major, MemberLevel, MembershipPlan, MeUser, UserCoursesResponse } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '请求失败');
  }

  return response.json() as Promise<T>;
}

export function getHomeResources() {
  return request<{ grades: Grade[]; courses: Course[]; assignments: Assignment[] }>('/api/resources/home');
}

export interface CourseNoteItem {
  filename: string;
  title: string;
  summary: string;
  order: number;
  url: string;
  size: number;
}

export function getCourseNotes(courseId: string) {
  return request<{ data: CourseNoteItem[] }>(`/api/courses/${encodeURIComponent(courseId)}/notes`);
}

export async function fetchNoteMarkdown(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('笔记加载失败');
  return res.text();
}

// 互联网大厂实际应用 / 岗位背景提升与面试准备 两个二级页面公用接口
export type DocSection = 'practical' | 'interview';

export interface DocCourseSummary {
  courseId: string;
  name: string;
  count: number;
}

export interface DocItem {
  filename: string;
  title: string;
  summary: string;
  order: number;
  isReadme: boolean;
  url: string;
  size: number;
}

export function getDocsCourses(section: DocSection) {
  return request<{ data: DocCourseSummary[] }>(`/api/docs/${section}/courses`);
}

export function getDocsByCourse(section: DocSection, courseId: string) {
  return request<{ data: { section: DocSection; courseId: string; courseName: string; items: DocItem[] } }>(
    `/api/docs/${section}/courses/${encodeURIComponent(courseId)}`,
  );
}

export async function fetchDocMarkdown(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('文档加载失败');
  return res.text();
}

export function getAssignmentSolutions(courseId: string) {
  return request<{ data: { courseId: string; items: DocItem[] } }>(
    `/api/assignment/${encodeURIComponent(courseId)}/solutions`,
  );
}

export function getAssignments(params: { gradeId?: string; courseId?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params.gradeId) search.set('gradeId', params.gradeId);
  if (params.courseId) search.set('courseId', params.courseId);
  if (params.q) search.set('q', params.q);
  return request<{ data: Assignment[] }>(`/api/assignments?${search.toString()}`);
}

export function getAssignmentDetail(id: string, level: MemberLevel) {
  return request<AssignmentDetail>(`/api/assignments/${id}?level=${level}`);
}

export function getMembershipPlans() {
  return request<{ data: MembershipPlan[] }>('/api/membership/plans');
}

export function createOrder(level: MemberLevel, phone: string) {
  return request<{ data: { order: { id: string; planLevel: MemberLevel; planName: string; amount: string; status: string } | null; user: MeUser } }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ level, phone })
  });
}

/** 手机号+验证码登录（演示环境：任意 6 位数字均可通过） */
export function loginWithPhone(payload: { phone: string; code: string }) {
  return request<{ data: MeUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/** 拉取当前登录用户完整信息（含会员状态、个人资料） */
export function fetchMe(phone: string) {
  return request<{ data: MeUser }>(`/api/auth/me?phone=${encodeURIComponent(phone)}`);
}

/** 更新当前用户资料 */
export function updateMe(payload: { phone: string; nickname?: string; school?: string; majorId?: string; gradeId?: string }) {
  return request<{ data: MeUser }>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function submitConsultationLead(payload: Record<string, string>) {
  return request<{ data: { id: string } }>('/api/consultation/leads', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminSummary() {
  return request<{ data: { users: number; assignments: number; orders: number; consultationLeads: number; conversionRate: string } }>('/api/admin/summary');
}

export function getMajors() {
  return request<{ data: Major[] }>('/api/majors');
}

export function getUserCourses(phone: string) {
  const search = new URLSearchParams({ phone });
  return request<{ data: UserCoursesResponse }>(`/api/users/courses?${search.toString()}`);
}

/** 获取某门课程下的 4 类资源列表，带会员等级锁定状态 */
export function getCourseResources(courseId: string, level: MemberLevel) {
  return request<CourseResourceListResponse>(`/api/courses/${courseId}/resources?level=${level}`);
}

/** 获取资源详情，带会员等级过滤 */
export function getCourseResourceDetail(id: string, level: MemberLevel) {
  return request<CourseResourceDetail>(`/api/resources/${id}?level=${level}`);
}
