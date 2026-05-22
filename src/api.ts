import type { Assignment, AssignmentDetail, Course, Grade, MemberLevel, MembershipPlan } from './types';

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

export function createOrder(level: MemberLevel) {
  return request<{ data: { id: string; level: MemberLevel; planName: string; amount: number; status: string } }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ level })
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
