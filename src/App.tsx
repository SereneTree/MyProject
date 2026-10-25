import { BookOutlined, CrownOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, FormOutlined, LockOutlined, ProfileOutlined, ReadOutlined, RocketOutlined, TeamOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Collapse, Divider, Empty, Form, Input, Layout, List, Menu, message, Radio, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Timeline, Typography } from 'antd';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createOrder, fetchDocMarkdown, fetchMe, fetchNoteMarkdown, getAssignmentDetail, getAssignments, getAssignmentSolutions, getCourseNotes, getCourseResourceDetail, getCourseResources, getDocsByCourse, getHomeResources, getMajors, getMembershipPlans, getTestMaterials, getTestSolutions, getUserCourses, getXhsArticles, loginWithPhone, submitConsultationLead, updateMe } from './api';
import type { CourseNoteItem, DocItem, DocSection, TestMaterialItem } from './api';
import type { Assignment, AssignmentDetail, Course, CourseResourceCategory, CourseResourceDetail, CourseResourceGroup, CourseResourceItem, Grade, Major, MajorCourse, MemberLevel, MembershipPlan, MeUser, Profile, XhsArticle } from './types';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const memberNames: Record<MemberLevel, string> = {
  free: '免费体验版',
  study: '学业提升版',
  career: '职场进阶版'
};

const memberColors: Record<MemberLevel, string> = {
  free: 'default',
  study: 'blue',
  career: 'gold'
};

// 免费开放模式：所有学习资料无需登录注册即可免费查看（登录验证、会员等级、年级锁定全部放行）。
// 如需恢复会员付费模式，将其改回 false 即可，原登录/会员/年级权限逻辑均已保留。
const FREE_OPEN_MODE = true;

const gradeOptions = [
  { value: 'freshman_fall', label: '大一上' },
  { value: 'freshman_spring', label: '大一下' },
  { value: 'sophomore_fall', label: '大二上' },
  { value: 'sophomore_spring', label: '大二下' },
  { value: 'junior_fall', label: '大三上' },
  { value: 'junior_spring', label: '大三下' },
  { value: 'senior_fall', label: '大四上' },
  { value: 'senior_spring', label: '大四下' }
];

const difficultyMap = { easy: '入门', medium: '中等', hard: '挑战' };
const assignmentTypeMap = { coding: '编程类', theory: '理论类', project: '项目类' };

function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function AppShell() {
  const location = useLocation();
  const [isLoggedInRaw, setIsLoggedIn] = useLocalState('isLoggedIn', false);
  const [memberLevelRaw, setMemberLevel] = useLocalState<MemberLevel>('memberLevel', 'free');
  // 免费开放模式下，登录状态与会员等级强制放行（全站视为已登录的职场进阶版用户）
  const isLoggedIn = FREE_OPEN_MODE ? true : isLoggedInRaw;
  const memberLevel: MemberLevel = FREE_OPEN_MODE ? 'career' : memberLevelRaw;
  const [memberExpiresAt, setMemberExpiresAt] = useLocalState<string | null>('memberExpiresAt', null);
  const [profile, setProfile] = useLocalState<Profile>('profile', {
    nickname: '未命名同学',
    phone: '',
    school: '',
    major: '',
    grade: undefined
  });

  // 将后端 MeUser 同步到本地三块 state（profile / memberLevel / memberExpiresAt）
  const syncFromMe = (me: MeUser) => {
    setProfile({
      id: me.id,
      nickname: me.nickname || `同学${me.phone.slice(-4)}`,
      phone: me.phone,
      school: me.school || '',
      major: me.majorName || me.major || '',
      majorId: me.majorId || undefined,
      grade: me.gradeId || undefined
    });
    setMemberLevel(me.memberLevel);
    setMemberExpiresAt(me.memberExpiresAt);
  };

  // 启动 / 刷新页面时，若本地记录着登录状态 + 手机号，就去后端拉一次真实用户信息
  useEffect(() => {
    if (!isLoggedIn || !profile.phone) return;
    fetchMe(profile.phone)
      .then((res) => syncFromMe(res.data))
      .catch((err) => {
        console.warn('同步用户信息失败', err);
        // 后端找不到该手机号，清除本地登录态
        if (err && err.message && err.message.includes('用户不存在')) {
          setIsLoggedIn(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout className="app-shell">
      <Header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-logo" src="/logo.png" alt="平台 Logo" />
          <span>计算机专业学习与发展规划平台</span>
        </Link>
        <Menu mode="horizontal" className="nav" selectedKeys={[getSelectedNavKey(location.pathname)]} items={[
          { key: 'home', label: <Link to="/">学习资源</Link> },
          { key: 'career-planning', label: <Link to="/career-planning">生涯规划</Link> },
          { key: 'consultation', label: <Link to="/consultation">咨询服务</Link> }
        ]} />
        <Space className="header-actions" size={10}>
          <Link to="/profile" className="profile-entry">
            <UserOutlined />
            <span>{isLoggedIn ? '个人中心' : '登录/注册'}</span>
          </Link>
          <Link to="/membership" className={`member-pill member-pill-${memberLevel}`}>
            <CrownOutlined />
            <span>{FREE_OPEN_MODE ? '全站资料免费开放' : memberNames[memberLevel]}</span>
          </Link>
        </Space>
      </Header>
      <Content className="content">
        <Routes>
          <Route path="/" element={<Home isLoggedIn={isLoggedIn} profile={profile} memberLevel={memberLevel} />} />
          <Route path="/assignments/:id" element={<AssignmentPage memberLevel={memberLevel} profile={profile} isLoggedIn={isLoggedIn} />} />
          <Route path="/resources/:id" element={<CourseResourceDetailPage memberLevel={memberLevel} profile={profile} isLoggedIn={isLoggedIn} />} />
          <Route path="/membership" element={<MembershipPage memberLevel={memberLevel} profile={profile} syncFromMe={syncFromMe} />} />
          <Route
            path="/profile"
            element={(
              <ProfilePage
                profile={profile}
                setProfile={setProfile}
                memberLevel={memberLevel}
                memberExpiresAt={memberExpiresAt}
                isLoggedIn={isLoggedIn}
                setIsLoggedIn={setIsLoggedIn}
                syncFromMe={syncFromMe}
              />
            )}
          />
          <Route path="/career-planning" element={<CareerPlanningPage />} />
          <Route path="/career-planning/tech-articles" element={<TechArticlesPage />} />
          <Route path="/consultation" element={<ConsultationPage profile={profile} />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Content>
      {/* <Footer className="footer">MVP Demo · 内容用于学习参考和产品验证</Footer> */}
    </Layout>
  );
}

function getSelectedNavKey(pathname: string) {
  if (pathname === '/' || pathname.startsWith('/assignments')) return 'home';
  if (pathname.startsWith('/career-planning')) return 'career-planning';
  if (pathname.startsWith('/consultation')) return 'consultation';
  if (pathname.startsWith('/about')) return 'about';
  return '';
}

function Home({ isLoggedIn, profile, memberLevel }: { isLoggedIn: boolean; profile: Profile; memberLevel: MemberLevel }) {
  // 学习资源页的“年级 + 课程”选择状态与 URL 查询参数同步，
  // 使用户从资源详情页点击浏览器 back 后仍能回到原选中的课程，也便于链接分享。
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGrade = searchParams.get('grade') || undefined;
  const initialCourse = searchParams.get('course') || undefined;
  const initialKeyword = searchParams.get('q') || '';

  const [grades, setGrades] = useState<Grade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string | undefined>(initialGrade);
  const [selectedCourse, setSelectedCourse] = useState<string | undefined>(initialCourse);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [loading, setLoading] = useState(false);
  // 当前用户的专业课程范围（仅登录且已绑定专业时生效）
  const [majorCourseIds, setMajorCourseIds] = useState<string[] | null>(null);
  const [majorName, setMajorName] = useState<string>('');
  // 当前用户被赋予的年级访问权限（null 代表不限制，如未登录或未设置）
  const [unlockedGradeIds, setUnlockedGradeIds] = useState<string[] | null>(null);

  useEffect(() => {
    getHomeResources().then((data) => {
      setGrades(data.grades);
      setCourses(data.courses);
      setAllAssignments(data.assignments);
      setAssignments(data.assignments);
    });
  }, []);

  // 登录后拉取当前用户的专业课程范围
  useEffect(() => {
    if (FREE_OPEN_MODE || !isLoggedIn || !profile.phone) {
      setMajorCourseIds(null);
      setMajorName('');
      setUnlockedGradeIds(null);
      return;
    }
    getUserCourses(profile.phone)
      .then((res) => {
        if (res.data.user.majorId) {
          // 已绑定专业：严格按专业过滤，哪怕该专业课程为空也保持过滤（避免退化为全展示）
          setMajorCourseIds(res.data.courses.map((c) => c.id));
          setMajorName(res.data.user.majorName || '');
        } else {
          // 未绑定专业的用户才退化到“不过滤”
          setMajorCourseIds(null);
          setMajorName('');
        }
        // 年级权限：后端返回不为空才启用锁定逻辑
        const unlocked = res.data.user.unlockedGradeIds;
        if (Array.isArray(unlocked) && unlocked.length > 0) {
          setUnlockedGradeIds(unlocked);
        } else {
          setUnlockedGradeIds(null);
        }
      })
      .catch(() => {
        setMajorCourseIds(null);
        setMajorName('');
        setUnlockedGradeIds(null);
      });
  }, [isLoggedIn, profile.phone]);

  useEffect(() => {
    setLoading(true);
    getAssignments({ gradeId: selectedGrade, courseId: selectedCourse, q: keyword })
      .then((res) => setAssignments(res.data))
      .finally(() => setLoading(false));
  }, [selectedGrade, selectedCourse, keyword]);

  // 按专业过滤课程与作业（未登录或未绑定专业时保持原逻辑，展示全部）
  const scopedCourses = useMemo(() => {
    if (!majorCourseIds) return courses;
    const idSet = new Set(majorCourseIds);
    return courses.filter((c) => idSet.has(c.id));
  }, [courses, majorCourseIds]);

  const scopedAssignments = useMemo(() => {
    if (!majorCourseIds) return assignments;
    const idSet = new Set(majorCourseIds);
    return assignments.filter((a) => idSet.has(a.courseId));
  }, [assignments, majorCourseIds]);

  const scopedAllAssignments = useMemo(() => {
    if (!majorCourseIds) return allAssignments;
    const idSet = new Set(majorCourseIds);
    return allAssignments.filter((a) => idSet.has(a.courseId));
  }, [allAssignments, majorCourseIds]);

  // 年级权限判断工具
  const unlockedSet = useMemo(
    () => (unlockedGradeIds ? new Set(unlockedGradeIds) : null),
    [unlockedGradeIds]
  );
  const isGradeLocked = (gradeId: string) => !!unlockedSet && !unlockedSet.has(gradeId);

  // 锁定策略：不过滤，仅记录哪些课程处于锁定状态。列表照常展示所有标题，进入详情时才拦截。
  const lockedCourseIdSet = useMemo(() => {
    if (!unlockedSet) return new Set<string>();
    return new Set(scopedCourses.filter((c) => !unlockedSet.has(c.gradeId)).map((c) => c.id));
  }, [scopedCourses, unlockedSet]);

  // 选中课程后拉取该课程下的 4 类资源
  const [courseResourceGroups, setCourseResourceGroups] = useState<CourseResourceGroup[] | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);

  useEffect(() => {
    if (!selectedCourse) {
      setCourseResourceGroups(null);
      return;
    }
    setResourceLoading(true);
    getCourseResources(selectedCourse, memberLevel)
      .then((res) => setCourseResourceGroups(res.data.groups))
      .catch(() => setCourseResourceGroups([]))
      .finally(() => setResourceLoading(false));
  }, [selectedCourse, memberLevel]);

  const visibleCourses = useMemo(() => {
    const result = selectedGrade ? scopedCourses.filter((course) => course.gradeId === selectedGrade) : scopedCourses;
    // 年级顺序映射：以 grades 数组顺序为准（大一上→大四下）
    const gradeOrder = new Map<string, number>();
    grades.forEach((g, i) => gradeOrder.set(g.id, i));
    return [...result].sort((a, b) => {
      // 1) 已解锁课程优先（locked=1 排后）
      const lockedA = lockedCourseIdSet.has(a.id) ? 1 : 0;
      const lockedB = lockedCourseIdSet.has(b.id) ? 1 : 0;
      if (lockedA !== lockedB) return lockedA - lockedB;
      // 2) 未选中具体年级时，按年级顺序升序；已选中年级则同一年级跳过此项
      if (!selectedGrade) {
        const orderA = gradeOrder.get(a.gradeId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = gradeOrder.get(b.gradeId) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
      }
      // 3) 同状态同年级下，按浏览量降序
      return b.viewCount - a.viewCount;
    });
  }, [scopedCourses, selectedGrade, grades, lockedCourseIdSet]);

  // 切换年级或课程数据变化时，自动选中课程列表的第一项；
  // 若当前选中课程仍在新列表中则保持不变，避免无谓重渲染。
  // 注意：初始加载未完成时（courses 为空）不调整，避免覆盖 URL 携带的 course 初值。
  useEffect(() => {
    if (courses.length === 0) return;
    if (visibleCourses.length === 0) {
      if (selectedCourse !== undefined) setSelectedCourse(undefined);
      return;
    }
    if (!selectedCourse || !visibleCourses.some((c) => c.id === selectedCourse)) {
      setSelectedCourse(visibleCourses[0].id);
    }
  }, [courses.length, visibleCourses, selectedCourse]);

  // 选择变化时同步到 URL 查询参数（replace 避免污染历史栈）
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedGrade) next.set('grade', selectedGrade);
    else next.delete('grade');
    if (selectedCourse) next.set('course', selectedCourse);
    else next.delete('course');
    if (keyword) next.set('q', keyword);
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // 仅依赖选择状态变化；不将 setSearchParams/searchParams 加入依赖避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrade, selectedCourse, keyword]);
  const selectedGradeName = selectedGrade ? grades.find((grade) => grade.id === selectedGrade)?.name || '年级' : '全部年级';
  const selectedCourseText = selectedCourse ? scopedCourses.find((course) => course.id === selectedCourse)?.name || '已选课程' : `${visibleCourses.length} 个课程`;

  return (
    <div>
      <section className="hero">
        <div>
          <Title level={1}>将每一门课程，<br /><span>变成绩点提升和未来职业竞争力</span></Title>
          <Paragraph>覆盖计算机专业核心课程，从参考解析、知识点提炼，到企业应用和 AI 实现，帮学生真正理解、掌握并迁移到未来发展。</Paragraph>
        </div>
        <Card className="hero-card">
          <Statistic title="已覆盖课程" value={scopedCourses.length} suffix="门" />
          <Statistic title="学习资源" value={scopedAllAssignments.length} suffix="项" />
        </Card>
      </section>

      {majorCourseIds && (
        <Alert
          style={{ marginBottom: 16 }}
          type="success"
          showIcon
          message={`已按你的专业《${majorName || '本专业'}》筛选，仅展示本专业课程与资源`}
          description="如需查看其他专业内容，请在《个人中心 - 个人资料》中修改专业，或退出登录后以游客身份浏览。"
        />
      )}

      {unlockedGradeIds && (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          icon={<LockOutlined />}
          message={`年级访问权限：已解锁 ${unlockedGradeIds.length} 个年级`}
          description="未解锁的年级下的课程与资源不会展示。如需解锁更多年级，请联系管理员或升级会员。"
        />
      )}

      <section className="resource-panel" id="resources">
        <div className="resource-panel-header">
          <Space className="resource-heading" align="baseline" size={14}>
            <Title level={2}>学习资源</Title>
            <Paragraph className="resource-subtitle" type="secondary">按年级和课程筛选，快速找到课程资源。</Paragraph>
          </Space>
        </div>
        <div className="resource-path">
          <span>当前选择</span>
          <strong>{selectedGradeName}</strong>
          <em>/</em>
          <strong>{selectedCourseText}</strong>
          <em>/</em>
          <strong>{scopedAssignments.length} 项课程资源</strong>
        </div>
        <div className="resource-cascade">
          <div className="cascade-column cascade-column-grade">
            <div className="cascade-title">
              <span>年级</span>
            </div>
            <Radio.Group
              value={selectedGrade ?? 'all'}
              onChange={(event) => {
                const v = event.target.value;
                setSelectedGrade(v === 'all' ? undefined : v);
                // 课程的自动选中交由上方 useEffect 统一处理
              }}
              className="grade-list"
            >
              <Radio.Button value="all">全部</Radio.Button>
              {grades.map((grade) => {
                const locked = isGradeLocked(grade.id);
                return (
                  <Radio.Button
                    key={grade.id}
                    value={grade.id}
                    className={locked ? 'grade-locked' : ''}
                    title={locked ? `《${grade.name}》未解锁：可查看列表，但不能进入详情` : undefined}
                  >
                    {grade.name}
                    {locked && <LockOutlined style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#bfbfbf' }} />}
                  </Radio.Button>
                );
              })}
            </Radio.Group>
          </div>
          <div className="cascade-column cascade-column-course">
            <div className="cascade-title">
              <span>课程</span>
              <Button className="clear-course-button" size="small" onClick={() => {
                setSelectedCourse(undefined);
                message.success('已展示全部课程');
              }}>查看全部</Button>
            </div>
            <List
              dataSource={visibleCourses}
              renderItem={(course) => {
                const locked = lockedCourseIdSet.has(course.id);
                return (
                  <List.Item
                    className={course.id === selectedCourse ? 'active-list-item' : ''}
                    onClick={() => setSelectedCourse(course.id)}
                    title={locked ? '该课程处于锁定年级：可查看课程名与资源标题，但不能进入详情' : undefined}
                  >
                    <Space>
                      {locked ? <LockOutlined style={{ color: '#bfbfbf' }} /> : <BookOutlined />}
                      <Text strong={course.id === selectedCourse} style={locked ? { color: '#8c8c8c' } : undefined}>
                        {course.name}
                      </Text>
                      {(() => {
                        // 按学期分色：年级顺序与 grades 一致，索引取色
                        const gradeColors = ['green', 'cyan', 'blue', 'geekblue', 'purple', 'magenta', 'orange', 'volcano'];
                        const idx = grades.findIndex((g) => g.id === course.gradeId);
                        const grade = idx >= 0 ? grades[idx] : null;
                        if (!grade) return null;
                        const color = idx >= 0 ? gradeColors[idx % gradeColors.length] : 'default';
                        return <Tag color={color}>{grade.name}</Tag>;
                      })()}
                    </Space>
                  </List.Item>
                );
              }}
            />
          </div>
          <div className="cascade-column cascade-column-main">
            <div className="cascade-title">
              <span>课程资源</span>
              {selectedCourse && (
                <Button size="small" onClick={() => setSelectedCourse(undefined)}>返回资源总览</Button>
              )}
            </div>

            {!selectedCourse ? (
              <>
                <Input.Search className="resource-search" placeholder="搜索课程资源/课程" allowClear onSearch={setKeyword} onChange={(e) => !e.target.value && setKeyword('')} />
                <Alert
                  style={{ marginBottom: 12 }}
                  type="info"
                  showIcon
                  message="请先在左侧选择一门课程，查看「课件讲义 / 大作业 / 历年考试 / 职场展望」四类资源"
                  description="未选课程时默认展示本专业/年级下的全部库存作业总览。"
                />
                <List
                  loading={loading}
                  dataSource={scopedAssignments}
                  pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
                  locale={{ emptyText: <Empty description="暂无匹配资源" /> }}
                  renderItem={(assignment) => (
                    <AssignmentCard
                      assignment={assignment}
                      isLoggedIn={isLoggedIn}
                      locked={lockedCourseIdSet.has(assignment.courseId)}
                    />
                  )}
                />
              </>
            ) : (
              <CourseResourceTabs
                courseId={selectedCourse}
                courseName={scopedCourses.find((c) => c.id === selectedCourse)?.name || ''}
                gradeName={(() => {
                  const c = scopedCourses.find((c) => c.id === selectedCourse);
                  return c ? grades.find((g) => g.id === c.gradeId)?.name || '' : '';
                })()}
                courseLocked={lockedCourseIdSet.has(selectedCourse)}
                groups={courseResourceGroups}
                loading={resourceLoading}
                memberLevel={memberLevel}
                isLoggedIn={isLoggedIn}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// 课程资源平铺列表（不使用 Tabs，用颜色标签区分 4 类）
// ==========================================
const categoryMeta: Record<CourseResourceCategory, { label: string; icon: ReactNode; tagColor: string; level: MemberLevel }> = {
  lecture:  { label: '课件讲义', icon: <ReadOutlined />,    tagColor: 'cyan',    level: 'free' },
  homework: { label: '大作业解析', icon: <FormOutlined />,    tagColor: 'orange',  level: 'study' },
  exam:     { label: '历年考试', icon: <FileTextOutlined />, tagColor: 'purple',  level: 'study' },
  career:   { label: '职场展望', icon: <RocketOutlined />,  tagColor: 'magenta', level: 'career' },
};

const memberRankMap: Record<MemberLevel, number> = { free: 0, study: 1, career: 2 };

function CourseResourceTabs({
  courseId,
  courseName,
  gradeName,
  courseLocked,
  groups,
  loading,
  memberLevel,
  isLoggedIn,
}: {
  courseId: string;
  courseName: string;
  gradeName: string;
  courseLocked: boolean;
  groups: CourseResourceGroup[] | null;
  loading: boolean;
  memberLevel: MemberLevel;
  isLoggedIn: boolean;
}) {
  const navigate = useNavigate();
  const orderedCats: CourseResourceCategory[] = ['lecture', 'homework', 'exam', 'career'];

  // 将 4 类资源拍平为单一列表，按「讲义→大作业→考试→职场」顺序
  const flatItems = useMemo(() => {
    const map = new Map<CourseResourceCategory, CourseResourceItem[]>();
    (groups || []).forEach((g) => map.set(g.category, g.items));
    const out: CourseResourceItem[] = [];
    orderedCats.forEach((c) => {
      const items = map.get(c) || [];
      out.push(...items);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const handleClickItem = (item: CourseResourceItem) => {
    const isFree = item.requiredLevel === 'free';
    if (courseLocked && !isFree) {
      message.warning('该课程所在年级未解锁，无法查看资源详情。');
      return;
    }
    if (!isLoggedIn) {
      message.info('请先登录后再查看资源详情');
      navigate('/profile');
      return;
    }
    if (item.locked) {
      const need = item.requiredLevel === 'study' ? '学业提升版' : '职场进阶版';
      message.warning(`该资源需「${need}」会员，升级后可查看完整内容。`);
      navigate(`/resources/${item.id}`);
      return;
    }
    navigate(`/resources/${item.id}`);
  };

  return (
    <div className="course-resource-flat">
      <div style={{ marginBottom: 12, color: '#8c8c8c', fontSize: 13 }}>
        当前课程：<Text strong>{courseName || courseId}</Text>
        {courseLocked && <Tag icon={<LockOutlined />} color="default" style={{ marginLeft: 8 }}>年级锁定</Tag>}
        <span style={{ marginLeft: 12 }}>共 {flatItems.length} 项资源</span>
      </div>
      <List
        loading={loading}
        dataSource={flatItems}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="暂无资源" /> }}
        renderItem={(item) => {
          const meta = categoryMeta[item.category];
          const isFree = item.requiredLevel === 'free';
          const isLocked = item.locked || (courseLocked && !isFree);
          const levelText = isFree ? '免费' : item.requiredLevel === 'study' ? '学业提升版' : '职场进阶版';
          const levelColor = isFree ? 'green' : item.requiredLevel === 'study' ? 'blue' : 'gold';
          return (
            <List.Item className={`assignment-list-item${isLocked ? ' assignment-list-item-locked' : ''}`}>
              <div
                className="assignment-item-main"
                style={isLocked ? { cursor: 'not-allowed', opacity: 0.78 } : { cursor: 'pointer' }}
                onClick={() => handleClickItem(item)}
              >
                <div className="assignment-item-left">
                  <div className="assignment-item-header">
                    <Space wrap size={[5, 4]}>
                      <Tag color="geekblue">{gradeName}</Tag>
                      <Tag>{courseName}</Tag>
                      <Tag color={meta.tagColor} icon={meta.icon}>{meta.label}</Tag>
                      <Tag color={levelColor}>{levelText}</Tag>
                      {item.locked && !courseLocked && <Tag icon={<LockOutlined />} color="default">需升级</Tag>}
                      {courseLocked && !isFree && <Tag icon={<LockOutlined />} color="default">年级锁定</Tag>}
                    </Space>
                  </div>
                  <Title level={4} className="assignment-item-title" style={isLocked ? { color: '#8c8c8c' } : undefined}>
                    {item.title}
                  </Title>
                  {item.summary && (
                    <Paragraph className="assignment-item-summary" ellipsis={{ rows: 2 }}>{item.summary}</Paragraph>
                  )}
                </div>
                <div className="assignment-item-right">
                  <Text type="secondary" className="assignment-view-count">
                    <EyeOutlined style={{ marginRight: 4 }} /> {item.viewCount}
                  </Text>
                </div>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
}

function AssignmentCard({ assignment, isLoggedIn, locked }: { assignment: Assignment; isLoggedIn: boolean; locked?: boolean }) {
  const navigate = useNavigate();

  return (
    <List.Item className={`assignment-list-item${locked ? ' assignment-list-item-locked' : ''}`}>
      <div
        className="assignment-item-main"
        style={locked ? { cursor: 'not-allowed', opacity: 0.7 } : undefined}
        onClick={() => {
          if (locked) {
            message.warning(`《${assignment.gradeName}》年级未解锁，无法查看详情。请联系管理员或升级会员解锁。`);
            return;
          }
          if (!isLoggedIn) {
            message.info('请先登录后再查看作业详情');
            navigate('/profile');
            return;
          }
          navigate(`/assignments/${assignment.id}`);
        }}
      >
        <div className="assignment-item-left">
          <div className="assignment-item-header">
            <Space wrap size={[5, 4]}>
              <Tag color="geekblue">{assignment.gradeName}</Tag>
              <Tag>{assignment.courseName}</Tag>
              <Tag color="purple">{assignmentTypeMap[assignment.assignmentType]}</Tag>
              <Tag color={assignment.difficulty === 'hard' ? 'red' : assignment.difficulty === 'medium' ? 'orange' : 'green'}>
                {difficultyMap[assignment.difficulty]}
              </Tag>
              {locked && <Tag icon={<LockOutlined />} color="default">年级锁定</Tag>}
            </Space>
          </div>
          <Title level={4} className="assignment-item-title">{assignment.title}</Title>
          <Paragraph className="assignment-item-summary" ellipsis={{ rows: 2 }}>{assignment.summary}</Paragraph>
        </div>
        <div className="assignment-item-right">
          <Text type="secondary" className="assignment-view-count">
            <EyeOutlined style={{ marginRight: 4 }} /> {assignment.viewCount}
          </Text>
        </div>
      </div>
    </List.Item>
  );
}

function AssignmentPage({ memberLevel, profile, isLoggedIn }: { memberLevel: MemberLevel; profile: Profile; isLoggedIn: boolean }) {
  const { id } = useParams();
  const [detail, setDetail] = useState<AssignmentDetail>();
  const [unlockedGradeIds, setUnlockedGradeIds] = useState<string[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) getAssignmentDetail(id, memberLevel).then(setDetail);
  }, [id, memberLevel]);

  // 拉取年级访问权限（仅登录后）
  useEffect(() => {
    if (FREE_OPEN_MODE || !isLoggedIn || !profile.phone) {
      setUnlockedGradeIds(null);
      return;
    }
    getUserCourses(profile.phone)
      .then((res) => {
        const list = res.data.user.unlockedGradeIds;
        setUnlockedGradeIds(Array.isArray(list) && list.length > 0 ? list : null);
      })
      .catch(() => setUnlockedGradeIds(null));
  }, [isLoggedIn, profile.phone]);

  // URL 直达兑底拦截：该作业所属年级未解锁则踢回首页
  useEffect(() => {
    if (!detail || !unlockedGradeIds) return;
    if (!unlockedGradeIds.includes(detail.gradeId)) {
      message.warning(`《${detail.gradeName}》年级未解锁，无法查看详情。`);
      navigate('/', { replace: true });
    }
  }, [detail, unlockedGradeIds, navigate]);

  if (!detail) return <Card loading />;

  const showMembershipGuide = memberLevel !== 'career';
  const contentColumnSize = showMembershipGuide ? 13 : 19;

  return (
    <div>
      <Card className="detail-header">
        <Space direction="vertical">
          <Space wrap>
            <Tag color="geekblue">{detail.gradeName}</Tag>
            <Tag>{detail.courseName}</Tag>
            <Tag color="purple">{assignmentTypeMap[detail.assignmentType]}</Tag>
            <Tag color={detail.difficulty === 'hard' ? 'red' : detail.difficulty === 'medium' ? 'orange' : 'green'}>
              {difficultyMap[detail.difficulty]}
            </Tag>
          </Space>
          <Title>{detail.title}</Title>
          <Paragraph>{detail.summary}</Paragraph>
          <div className="detail-value-strip">
            <Text>从解题思路到完整解析</Text>
            <Text>覆盖知识点、企业应用与 AI 实现</Text>
            <Text>适合作业复盘、考试准备和项目迁移</Text>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={5}>
          <Card title="内容目录" className="detail-toc sticky-card">
            <List
              dataSource={detail.modules}
              renderItem={(item, index) => (
                <List.Item>
                  <a href={`#${item.id}`}>
                    <Space className="detail-toc-link">
                      <Text type="secondary">{String(index + 1).padStart(2, '0')}</Text>
                      <Text>{item.title}</Text>
                      {item.locked && <LockOutlined className="detail-toc-lock" />}
                    </Space>
                  </a>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={contentColumnSize}>
          <Space direction="vertical" size={16} className="full-width">
            {detail.modules.map((item) => (
              <Card
                id={item.id}
                key={item.id}
                className="detail-module-card"
                title={<Space>{item.locked && <LockOutlined />} {item.title}</Space>}
                extra={<Tag color={item.locked ? 'orange' : 'green'}>{item.locked ? '升级解锁' : '已解锁'}</Tag>}
              >
                <Paragraph>{item.content}</Paragraph>
                {!item.locked && (
                  <div className="detail-module-note">
                    <Text strong className="detail-module-note-label">学习建议：</Text>
                    <Text type="secondary">先用自己的语言复述本节关键逻辑，再尝试把它迁移到课程项目、实验报告或 AI 辅助实现中。</Text>
                  </div>
                )}
                {item.locked && (
                  <Alert
                    type="info"
                    showIcon
                    message={`升级到${memberNames[item.requiredLevel]}解锁完整内容`}
                    description="当前仅展示模块预览。升级后可查看完整参考解析、企业应用或 AI 实现。"
                    action={<Button type="primary" onClick={() => navigate('/membership')}>立即升级</Button>}
                  />
                )}
              </Card>
            ))}
          </Space>
        </Col>
        {showMembershipGuide && (
          <Col xs={24} lg={6}>
            <Card title="会员解锁路径" className="sticky-card">
              <List
                dataSource={detail.plans}
                renderItem={(plan) => (
                  <List.Item>
                    <Space direction="vertical">
                      <Space>
                        <Badge color={plan.level === memberLevel ? '#2563eb' : '#d9d9d9'} />
                        <Text strong>{plan.name}</Text>
                        <Text type="secondary">{plan.price === 0 ? '免费' : `${plan.price}元/${plan.period}`}</Text>
                      </Space>
                      <Text type="secondary">{plan.tagline}</Text>
                    </Space>
                  </List.Item>
                )}
              />
              <Divider />
              <Button block type="primary" onClick={() => navigate('/membership')}>查看会员权益</Button>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}

// ==========================================
// 课件讲义 - 学习笔记目录组件（仅 lecture 类课件详情页使用）
// 服务端扫描 server/public/notes/<courseId>/L*.md 后返回列表，
// 前端采用懒加载：折叠面板展开时才拉取 markdown 源文件并渲染。
// ==========================================
function LectureNotesSection({ courseId }: { courseId: string }) {
  const [notes, setNotes] = useState<CourseNoteItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCourseNotes(courseId)
      .then((res) => {
        if (!cancelled) setNotes(res.data);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleExpand = async (filenames: string | string[]) => {
    const keys = Array.isArray(filenames) ? filenames : [filenames];
    for (const key of keys) {
      if (contents[key] || loadingKeys.has(key)) continue;
      const note = notes?.find((n) => n.filename === key);
      if (!note) continue;
      setLoadingKeys((prev) => new Set(prev).add(key));
      try {
        const md = await fetchNoteMarkdown(note.url);
        setContents((prev) => ({ ...prev, [key]: md }));
      } catch {
        setContents((prev) => ({ ...prev, [key]: '加载失败，请重试。' }));
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  if (loading) return <Spin />;
  if (!notes || notes.length === 0) {
    return <Empty description="暂未上传本课程的学习笔记" />;
  }

  return (
    <Collapse
      accordion
      onChange={handleExpand}
      items={notes.map((note) => ({
        key: note.filename,
        label: (
          <Space wrap>
            <Tag color="blue">{Number.isFinite(note.order) ? (['linear-programming', 'diff-equation', 'dsp-fundamentals', 'graph-theory', 'data-structure'].includes(courseId) ? `第${note.order}章` : `L${note.order}`) : '-'}</Tag>
            <Text strong>{note.title}</Text>
            {note.summary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {note.summary}
              </Text>
            )}
          </Space>
        ),
        extra: (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            href={note.url}
            download={note.filename}
            onClick={(e) => e.stopPropagation()}
          >
            下载
          </Button>
        ),
        children: loadingKeys.has(note.filename) ? (
          <Spin />
        ) : contents[note.filename] ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contents[note.filename]}</ReactMarkdown>
          </div>
        ) : (
          <Text type="secondary">点击展开加载内容...</Text>
        ),
      }))}
    />
  );
}

// ==========================================
// 课程资源详情页中用于嵌入展示 markdown 文档列表的子组件
// section: practical = 互联网大厂的实际应用 / interview = 相关岗位背景提升与面试准备
// 后端扫描 public/<section>/<courseId>/*.md 后以折叠面板呈现。
// ==========================================
function CourseDocsList({ section, courseId }: { section: DocSection; courseId: string }) {
  const [items, setItems] = useState<DocItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDocsByCourse(section, courseId)
      .then((res) => {
        if (!cancelled) setItems(res.data.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, courseId]);

  const handleExpand = async (filenames: string | string[]) => {
    const keys = Array.isArray(filenames) ? filenames : [filenames];
    for (const key of keys) {
      if (contents[key] || loadingKeys.has(key)) continue;
      const it = items?.find((n) => n.filename === key);
      if (!it) continue;
      setLoadingKeys((prev) => new Set(prev).add(key));
      try {
        const md = await fetchDocMarkdown(it.url);
        setContents((prev) => ({ ...prev, [key]: md }));
      } catch {
        setContents((prev) => ({ ...prev, [key]: '加载失败，请重试。' }));
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  const tagColor = section === 'practical' ? 'volcano' : 'geekblue';
  const emptyText = section === 'practical' ? '暂未上传本课程的大厂实践案例' : '暂未上传本课程的面试复习资料';

  if (loading) return <Spin />;
  if (!items || items.length === 0) return <Empty description={emptyText} />;

  return (
    <Collapse
      accordion
      onChange={handleExpand}
      items={items.map((it) => ({
        key: it.filename,
        label: (
          <Space wrap>
            {it.isReadme ? (
              <Tag color="green">总览</Tag>
            ) : Number.isFinite(it.order) ? (
              <Tag color={tagColor}>第 {it.order} 篇</Tag>
            ) : (
              <Tag>文档</Tag>
            )}
            <Text strong>{it.title}</Text>
            {it.summary && (
              <Text type="secondary" style={{ fontSize: 12 }}>{it.summary}</Text>
            )}
          </Space>
        ),
        extra: (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            href={it.url}
            download={it.filename}
            onClick={(e) => e.stopPropagation()}
          >下载</Button>
        ),
        children: loadingKeys.has(it.filename) ? (
          <Spin />
        ) : contents[it.filename] ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contents[it.filename]}</ReactMarkdown>
          </div>
        ) : (
          <Text type="secondary">点击展开加载内容...</Text>
        ),
      }))}
    />
  );
}

// 根据资源标题推断其是否为两个特殊职场展望资源，返回对应的 docs section。
function inferDocsSection(title: string): DocSection | null {
  if (/在互联网大厂的实际应用/.test(title)) return 'practical';
  if (/相关岗位背景提升与面试准备/.test(title)) return 'interview';
  return null;
}

// ==========================================
// 大作业题目解析展示组件
// ==========================================
function AssignmentSolutionsList({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<DocItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAssignmentSolutions(courseId)
      .then((res) => {
        if (!cancelled) setItems(res.data.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  const handleExpand = async (filenames: string | string[]) => {
    const keys = Array.isArray(filenames) ? filenames : [filenames];
    for (const key of keys) {
      if (contents[key] || loadingKeys.has(key)) continue;
      const it = items?.find((n) => n.filename === key);
      if (!it) continue;
      setLoadingKeys((prev) => new Set(prev).add(key));
      try {
        const md = await fetchDocMarkdown(it.url);
        setContents((prev) => ({ ...prev, [key]: md }));
      } catch {
        setContents((prev) => ({ ...prev, [key]: '加载失败，请重试。' }));
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  if (loading) return <Spin />;
  if (!items || items.length === 0) return <Empty description="暂无题目解析" />;

  return (
    <Collapse
      accordion
      onChange={handleExpand}
      items={items.map((it) => ({
        key: it.filename,
        label: (
          <Space wrap>
            {it.isReadme ? (
              <Tag color="green">总览</Tag>
            ) : Number.isFinite(it.order) ? (
              <Tag color="cyan">第 {it.order} 篇</Tag>
            ) : (
              <Tag>文档</Tag>
            )}
            <Text strong>{it.title}</Text>
            {it.summary && (
              <Text type="secondary" style={{ fontSize: 12 }}>{it.summary}</Text>
            )}
          </Space>
        ),
        extra: (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            href={it.url}
            download={it.filename}
            onClick={(e) => e.stopPropagation()}
          >下载</Button>
        ),
        children: loadingKeys.has(it.filename) ? (
          <Spin />
        ) : contents[it.filename] ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contents[it.filename]}</ReactMarkdown>
          </div>
        ) : (
          <Text type="secondary">点击展开加载内容...</Text>
        ),
      }))}
    />
  );
}

// ==========================================
// 考试真题集展示组件（表格 + 下载）
// ==========================================
function ExamPapersList({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<TestMaterialItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTestMaterials(courseId)
      .then((res) => { if (!cancelled) setItems(res.data.items); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  if (loading) return <Spin />;
  if (items.length === 0) return <Empty description="暂无历史试卷" />;

  const columns = [
    {
      title: '试卷名称',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string) => <Text strong>{text.replace(/\.pdf$/i, '')}</Text>,
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: TestMaterialItem) => (
        <Button type="primary" size="small" icon={<DownloadOutlined />} href={record.url} download={record.filename}>下载</Button>
      ),
    },
  ];

  return <Table dataSource={items} columns={columns} rowKey="filename" pagination={false} size="middle" />;
}

// ==========================================
// 考试题型分析与高频考点展示组件（solutions 渲染）
// ==========================================
function ExamSolutionsList({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<DocItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTestSolutions(courseId)
      .then((res) => { if (!cancelled) setItems(res.data.items); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  const handleExpand = async (filenames: string | string[]) => {
    const keys = Array.isArray(filenames) ? filenames : [filenames];
    for (const key of keys) {
      if (contents[key] || loadingKeys.has(key)) continue;
      const it = items?.find((n) => n.filename === key);
      if (!it) continue;
      setLoadingKeys((prev) => new Set(prev).add(key));
      try {
        const md = await fetchDocMarkdown(it.url);
        setContents((prev) => ({ ...prev, [key]: md }));
      } catch {
        setContents((prev) => ({ ...prev, [key]: '加载失败，请重试。' }));
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  if (loading) return <Spin />;
  if (!items || items.length === 0) return <Empty description="暂无考试解析" />;

  return (
    <Collapse
      accordion
      onChange={handleExpand}
      items={items.map((it) => ({
        key: it.filename,
        label: (
          <Space wrap>
            {it.isReadme ? (
              <Tag color="green">总览</Tag>
            ) : Number.isFinite(it.order) ? (
              <Tag color="orange">考点 {it.order}</Tag>
            ) : (
              <Tag>文档</Tag>
            )}
            <Text strong>{it.title}</Text>
            {it.summary && (
              <Text type="secondary" style={{ fontSize: 12 }}>{it.summary}</Text>
            )}
          </Space>
        ),
        children: loadingKeys.has(it.filename) ? (
          <Spin />
        ) : contents[it.filename] ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contents[it.filename]}</ReactMarkdown>
          </div>
        ) : (
          <Text type="secondary">点击展开加载内容...</Text>
        ),
      }))}
    />
  );
}

// ==========================================
// 课程资源详情页
// ==========================================
function CourseResourceDetailPage({ memberLevel, profile, isLoggedIn }: { memberLevel: MemberLevel; profile: Profile; isLoggedIn: boolean }) {
  const { id } = useParams();
  const [detail, setDetail] = useState<CourseResourceDetail>();
  const [unlockedGradeIds, setUnlockedGradeIds] = useState<string[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) getCourseResourceDetail(id, memberLevel).then(setDetail).catch(() => message.error('资源不存在或已下架'));
  }, [id, memberLevel]);

  useEffect(() => {
    if (FREE_OPEN_MODE || !isLoggedIn || !profile.phone) {
      setUnlockedGradeIds(null);
      return;
    }
    getUserCourses(profile.phone)
      .then((res) => {
        const list = res.data.user.unlockedGradeIds;
        setUnlockedGradeIds(Array.isArray(list) && list.length > 0 ? list : null);
      })
      .catch(() => setUnlockedGradeIds(null));
  }, [isLoggedIn, profile.phone]);

  // URL 直达兑底拦截：资源所属年级未解锁则踢回首页（免费资源除外）
  useEffect(() => {
    if (!detail || !unlockedGradeIds) return;
    if (!unlockedGradeIds.includes(detail.gradeId) && detail.requiredLevel !== 'free') {
      message.warning(`《${detail.gradeName}》年级未解锁，无法查看详情。`);
      navigate('/', { replace: true });
    }
  }, [detail, unlockedGradeIds, navigate]);

  if (!detail) return <Card loading />;

  const meta = categoryMeta[detail.category];
  const levelTagColor = detail.requiredLevel === 'free' ? 'green' : detail.requiredLevel === 'study' ? 'blue' : 'gold';
  const levelText = detail.requiredLevel === 'free' ? '免费' : detail.requiredLevel === 'study' ? '学业提升版' : '职场进阶版';
  // 两个特殊职场展望资源：检测后在详情页嵌入 markdown 文档列表
  const docsSection = detail.subType === 'career_extension' ? inferDocsSection(detail.title) : null;

  return (
    <div>
      <Card className="detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <Space direction="vertical" size={8} style={{ flex: 1, minWidth: 0 }}>
            <Space wrap>
              <Tag color="geekblue">{detail.gradeName}</Tag>
              <Tag>{detail.courseName}</Tag>
              <Tag color="purple">{meta.label}</Tag>
              <Tag color={levelTagColor}>{levelText}</Tag>
              {detail.locked && <Tag icon={<LockOutlined />} color="default">需升级</Tag>}
            </Space>
            <Title>{detail.title}</Title>
            {detail.summary && <Paragraph>{detail.summary}</Paragraph>}
            <Text type="secondary"><EyeOutlined /> {detail.viewCount} 次浏览</Text>
          </Space>
          {!detail.locked && detail.url && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                {detail.category === 'lecture' ? '课件下载' : '下载原始资源'}
              </Button>
            </div>
          )}
          {!detail.locked && detail.hasMaterial && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                href={`/api/resources/material/download/${detail.courseId}`}
                download
              >
                资料打包下载
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={detail.locked ? 16 : 24}>
          <Card className="detail-module-card" title={<Space>{meta.icon} 资源内容</Space>}>
            {detail.locked ? (
              <Alert
                type="warning"
                showIcon
                message={`升级到「${memberNames[detail.requiredLevel]}」解锁完整内容`}
                description={`当前会员等级为「${memberNames[memberLevel]}」，该资源需「${levelText}」及以上。升级后可查看完整讲义、大作业拆解、考试分析与职场拓展。`}
                action={<Button type="primary" onClick={() => navigate('/membership')}>立即升级</Button>}
              />
            ) : (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content || '该资源尚未上传内容。'}</ReactMarkdown>
              </div>
            )}
          </Card>
          {!detail.locked && detail.category === 'lecture' && (
            <Card
              className="detail-module-card"
              title={<Space><ReadOutlined /> 学习笔记目录</Space>}
              style={{ marginTop: 16 }}
            >
              <LectureNotesSection courseId={detail.courseId} />
            </Card>
          )}
          {!detail.locked && docsSection && (
            <Card
              className="detail-module-card"
              title={(
                <Space>
                  {docsSection === 'practical' ? <RocketOutlined /> : <ProfileOutlined />}
                  {docsSection === 'practical' ? '互联网大厂实际应用文档' : '面试复习资料目录'}
                </Space>
              )}
              style={{ marginTop: 16 }}
            >
              <CourseDocsList section={docsSection} courseId={detail.courseId} />
            </Card>
          )}
          {!detail.locked && detail.hasSolutions && (
            <Card
              className="detail-module-card"
              title={<Space><FormOutlined /> 题目解析与知识点讲解</Space>}
              style={{ marginTop: 16 }}
            >
              <AssignmentSolutionsList courseId={detail.courseId} />
            </Card>
          )}
          {!detail.locked && detail.hasTestMaterial && (
            <Card
              className="detail-module-card"
              title={<Space><FileTextOutlined /> 考试真题集</Space>}
              style={{ marginTop: 16 }}
            >
              <ExamPapersList courseId={detail.courseId} />
            </Card>
          )}
          {!detail.locked && detail.hasTestSolutions && (
            <Card
              className="detail-module-card"
              title={<Space><FormOutlined /> 考试题型分析与高频考点</Space>}
              style={{ marginTop: 16 }}
            >
              <ExamSolutionsList courseId={detail.courseId} />
            </Card>
          )}
        </Col>
        {detail.locked && (
          <Col xs={24} lg={8}>
            <Card title="会员解锁路径" className="sticky-card">
              <List
                dataSource={detail.plans}
                renderItem={(plan) => (
                  <List.Item>
                    <Space direction="vertical">
                      <Space>
                        <Badge color={plan.level === memberLevel ? '#2563eb' : '#d9d9d9'} />
                        <Text strong>{plan.name}</Text>
                        <Text type="secondary">{Number(plan.price) === 0 ? '免费' : `${plan.price}元/${plan.period}`}</Text>
                      </Space>
                      <Text type="secondary">{plan.tagline}</Text>
                    </Space>
                  </List.Item>
                )}
              />
              <Divider />
              <Button block type="primary" onClick={() => navigate('/membership')}>查看会员权益</Button>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}

function MembershipPage({ memberLevel, profile, syncFromMe }: { memberLevel: MemberLevel; profile: Profile; syncFromMe: (me: MeUser) => void }) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [buying, setBuying] = useState<MemberLevel>();
  const navigate = useNavigate();
  const planOrder: Record<MemberLevel, number> = {
    free: 0,
    study: 1,
    career: 2
  };

  useEffect(() => {
    getMembershipPlans().then((res) => {
      setPlans([...res.data].sort((a, b) => planOrder[a.level] - planOrder[b.level]));
    });
  }, []);

  async function buy(level: MemberLevel) {
    if (!profile.phone) {
      message.warning('请先登录后再购买会员');
      navigate('/profile');
      return;
    }
    setBuying(level);
    try {
      const res = await createOrder(level, profile.phone);
      syncFromMe(res.data.user);
      message.success(level === 'free' ? '已切换到免费体验版' : '模拟支付成功，会员已生效');
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    } finally {
      setBuying(undefined);
    }
  }

  // 免费开放模式下，会员体系暂停，展示开放说明
  if (FREE_OPEN_MODE) {
    return (
      <div>
        <Title>会员与权益</Title>
        <Alert
          type="success"
          showIcon
          message="全站资料免费开放"
          description="平台所有学习资料（课件讲义、大作业解析、历年考试、职场展望、课程笔记与面试资料）无需登录注册、无需购买会员，可直接免费查看"
        />
      </div>
    );
  }

  return (
    <div>
      <Title>会员与权益</Title>
      <Paragraph>按学期拆分，分别满足看懂方向、提升绩点、提升职业竞争力的不同需求。</Paragraph>
      <Row gutter={[16, 16]}>
        {plans.map((plan) => {
          const currentRank = planOrder[memberLevel] ?? 0;
          const planRank = planOrder[plan.level] ?? 0;
          const isCurrent = plan.level === memberLevel;
          // 当前版本以下的付费等级随高等级自动解锁（位于下方），按钮不可点
          const isUnlocked = !isCurrent && planRank < currentRank;
          // 高于当前等级的付费版本才需要“模拟购买”
          const isHigher = planRank > currentRank;
          let buttonText = '模拟购买';
          if (isCurrent) buttonText = '当前版本';
          else if (isUnlocked) buttonText = '已解锁';
          else if (plan.price === 0) buttonText = '切换体验';
          const buttonDisabled = isCurrent || isUnlocked;
          const cardClassName = isCurrent
            ? 'plan-card current-plan'
            : isUnlocked
              ? 'plan-card unlocked-plan'
              : 'plan-card';
          return (
            <Col xs={24} md={8} key={plan.level} className="plan-card-column">
              <Card className={cardClassName} title={<Space><CrownOutlined />{plan.name}</Space>}>
                <div className="plan-card-content">
                  <Title level={2}>{plan.price === 0 ? '免费' : `¥${plan.price}`}<Text className="price-period"> / {plan.period}</Text></Title>
                  <Paragraph className="plan-tagline">{plan.tagline}</Paragraph>
                  <List dataSource={plan.benefits} renderItem={(item) => <List.Item>✓ {item}</List.Item>} />
                  <div className="plan-card-action">
                    <Button
                      block
                      type="primary"
                      className="plan-action-button"
                      loading={buying === plan.level}
                      disabled={buttonDisabled}
                      onClick={() => { if (isHigher || (plan.price === 0 && !isUnlocked && !isCurrent)) buy(plan.level); }}
                    >
                      {buttonText}
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

function ProfileInfoGrid({
  items
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="profile-readonly-grid">
      <Row gutter={[24, 18]}>
        {items.map((item) => (
          <Col xs={24} md={12} key={item.label}>
            <div className="profile-readonly-item">
              <span className="profile-readonly-label">{item.label}</span>
              <strong className="profile-readonly-value">{item.value}</strong>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}

function ProfilePage({
  profile,
  setProfile,
  memberLevel,
  memberExpiresAt,
  isLoggedIn,
  setIsLoggedIn,
  syncFromMe
}: {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  memberLevel: MemberLevel;
  memberExpiresAt: string | null;
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
  syncFromMe: (me: MeUser) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState('profile');
  const [majors, setMajors] = useState<Major[]>([]);
  const [majorCourses, setMajorCourses] = useState<MajorCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  // 拉取专业列表（供表单下拉使用）
  useEffect(() => {
    getMajors().then((res) => setMajors(res.data)).catch(() => {});
  }, []);

  // 登录后，根据手机号拉取该用户专业下的课程
  useEffect(() => {
    if (FREE_OPEN_MODE || !isLoggedIn || !profile.phone) {
      setMajorCourses([]);
      return;
    }
    setCoursesLoading(true);
    getUserCourses(profile.phone)
      .then((res) => {
        setMajorCourses(res.data.courses);
      })
      .catch(() => setMajorCourses([]))
      .finally(() => setCoursesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, profile.phone]);

  async function login(values: { phone: string; code: string }) {
    setLoggingIn(true);
    try {
      const res = await loginWithPhone(values);
      syncFromMe(res.data);
      setIsLoggedIn(true);
      message.success(`登录成功，欢迎${res.data.nickname ? ` ${res.data.nickname}` : ''}`);
      navigate('/');
    } catch (err) {
      message.error((err as Error).message || '登录失败');
    } finally {
      setLoggingIn(false);
    }
  }

  async function save(values: { nickname?: string; school?: string; majorId?: string; grade?: string }) {
    if (!profile.phone) return;
    setSavingProfile(true);
    try {
      const res = await updateMe({
        phone: profile.phone,
        nickname: values.nickname,
        school: values.school,
        majorId: values.majorId,
        gradeId: values.grade
      });
      syncFromMe(res.data);
      setIsEditing(false);
      message.success('个人资料已保存');
    } catch (err) {
      message.error((err as Error).message || '保存失败');
    } finally {
      setSavingProfile(false);
    }
  }

  async function resetMembership() {
    if (!profile.phone) return;
    setResetting(true);
    try {
      const res = await createOrder('free', profile.phone);
      syncFromMe(res.data.user);
      message.success('已重置为免费体验版');
    } catch (err) {
      message.error((err as Error).message || '重置失败');
    } finally {
      setResetting(false);
    }
  }

  // 免费开放模式下，个人中心简化为开放说明页（登录/资料/会员代码保留，恢复模式后自动可用）
  if (FREE_OPEN_MODE) {
    return (
      <Row justify="center" className="login-page">
        <Col xs={24} md={20} lg={16}>
          <Card className="login-card">
            <Title level={3}>全站资料免费开放</Title>
            <Paragraph>平台所有学习资料无需登录注册即可免费查看。个性化资料与课程推荐等功能将在登录体系恢复后开放。</Paragraph>
            <Button type="primary" size="large" onClick={() => navigate('/')}>去查看学习资源</Button>
          </Card>
        </Col>
      </Row>
    );
  }

  if (!isLoggedIn) {
    return (
      <Row justify="center" className="login-page">
        <Col xs={24} md={20} lg={16}>
          <Card className="login-card" styles={{ body: { padding: 0 } }}>
            <Row>
              <Col xs={24} lg={11} className="login-intro">
                <Title level={2}>快人一步，搞定 CS 学业与前程</Title>
                <Paragraph>还在为绩点、保研和秋招发愁？加入我们，获取直通高分、保研名校、斩获大厂 offer 的实战解析，让每一次课程作业都成为简历上的加分项。</Paragraph>
                <div className="login-benefits">
                  {[
                    '📚 硬核学业资源库：覆盖 CS 核心课程，轻松搞定重难点',
                    '🛠️ 实战能力进阶：从基础理论，到企业级应用与 AI 前沿落地',
                    '🤝 专家定制路线：资深导师 1v1 指导，打破信息差，少走弯路'
                  ].map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </Col>
              <Col xs={24} lg={13} className="login-form-panel">
                <Title level={3}>登录 / 注册</Title>
                <Paragraph type="secondary">未注册手机号将自动创建账号，验证码演示环境可输入任意 6 位数字。</Paragraph>
                <Form layout="vertical" onFinish={login}>
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      { pattern: /^1\d{10}$/, message: '请输入 11 位手机号' }
                    ]}
                  >
                    <Input size="large" placeholder="请输入手机号" />
                  </Form.Item>
                  <Form.Item
                    name="code"
                    label="验证码"
                    rules={[
                      { required: true, message: '请输入验证码' },
                      { len: 6, message: '验证码为 6 位数字' }
                    ]}
                  >
                    <Input.Search
                      size="large"
                      placeholder="请输入 6 位验证码"
                      enterButton="获取验证码"
                      onSearch={() => message.success('验证码已发送（演示环境可输入任意 6 位数字）')}
                    />
                  </Form.Item>
                  <Button type="primary" size="large" block htmlType="submit" loading={loggingIn}>立即登录 / 注册</Button>
                </Form>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    );
  }

  const sectionTitleMap: Record<string, string> = {
    profile: '个人资料',
    courses: '我的课程',
    membership: '会员状态',
    security: '账号安全'
  };

  return (
    <Row gutter={[18, 18]} className="profile-center">
      <Col xs={24} lg={7}>
        <Card className="profile-sidebar">
          <Space direction="vertical" size={16} className="full-width">
            <div className="profile-user-card">
              <div>
                <Text strong>{profile.nickname}</Text>
                <Paragraph type="secondary">{formatGrade(profile.grade)} · {profile.major || '专业待完善'}</Paragraph>
              </div>
            </div>
            <Menu
              mode="inline"
              className="profile-nav-menu"
              selectedKeys={[activeProfileSection]}
              onClick={({ key }) => setActiveProfileSection(key)}
              items={[
                { key: 'profile', label: '个人资料' },
                { key: 'courses', label: '我的课程' },
                { key: 'membership', label: '会员状态' },
                { key: 'security', label: '账号安全' }
              ]}
              style={{ borderRight: 0, background: 'transparent' }}
            />
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={17}>
        <Card
          className="profile-content-card"
          title={sectionTitleMap[activeProfileSection]}
        >
          {activeProfileSection === 'profile' && (
            !isEditing ? (
              <Space direction="vertical" size={20} className="full-width">
                <ProfileInfoGrid
                  items={[
                    { label: '用户名', value: profile.nickname },
                    { label: '手机号', value: maskPhone(profile.phone) },
                    { label: '学校', value: profile.school || '待完善' },
                    { label: '专业', value: profile.major || '待完善' },
                    { label: '年级', value: formatGrade(profile.grade) }
                  ]}
                />
                <div className="profile-section-actions">
                  <Button type="primary" onClick={() => setIsEditing(true)}>编辑资料</Button>
                </div>
              </Space>
            ) : (
              <Space direction="vertical" size={20} className="full-width">
                <Alert className="profile-guide" type="info" showIcon message="完善资料后，首页会默认展示更适合你年级的学习资源。" />
                <Form
                  layout="vertical"
                  initialValues={{
                    nickname: profile.nickname,
                    phone: profile.phone,
                    school: profile.school,
                    majorId: profile.majorId,
                    grade: profile.grade
                  }}
                  onFinish={(values) => save(values as { nickname?: string; school?: string; majorId?: string; grade?: string })}
                >
                  <Row gutter={[24, 18]}>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="nickname" label="用户名"><Input size="large" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="phone" label="手机号"><Input size="large" disabled /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="school" label="学校"><Input size="large" placeholder="请输入学校" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="majorId" label="专业"><Select size="large" placeholder="请选择专业" allowClear options={majors.map((m) => ({ value: m.id, label: m.name }))} /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="grade" label="年级"><Select size="large" allowClear options={gradeOptions} /></Form.Item></Col>
                  </Row>
                  <div className="profile-section-actions">
                    <Button onClick={() => setIsEditing(false)}>取消编辑</Button>
                    <Button type="primary" htmlType="submit" loading={savingProfile}>保存资料</Button>
                  </div>
                </Form>
              </Space>
            )
          )}
          {activeProfileSection === 'courses' && (
            <Space direction="vertical" size={16} className="full-width">
              <Alert
                className="profile-guide"
                type="info"
                showIcon
                message={profile.major
                  ? `以下为《${profile.major}》专业推荐学习的课程，由后端专业-课程关联动态生成。`
                  : '请先在《个人资料》中选择专业，系统会为你推荐对应专业的课程。'}
              />
              {coursesLoading ? (
                <Paragraph type="secondary">加载中…</Paragraph>
              ) : majorCourses.length === 0 ? (
                <Empty description="暂无专业课程，请先完善专业信息或联系管理员配置" />
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={majorCourses}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Tag key="grade" color="blue">{item.gradeName}</Tag>,
                        item.isHot ? <Tag key="hot" color="volcano">热门</Tag> : null,
                        <Text key="views" type="secondary"><EyeOutlined /> {item.viewCount}</Text>
                      ].filter(Boolean) as ReactNode[]}
                    >
                      <List.Item.Meta
                        avatar={<BookOutlined style={{ fontSize: 20 }} />}
                        title={<Link to={`/?courseId=${item.id}`}>{item.name}</Link>}
                        description={`序号 ${item.sortOrder} · 课程 ID：${item.id}`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Space>
          )}
          {activeProfileSection === 'membership' && (
            <Space direction="vertical" size={16} className="full-width">
              <ProfileInfoGrid
                items={[
                  { label: '当前版本', value: <Tag color={memberColors[memberLevel]}>{memberNames[memberLevel]}</Tag> },
                  { label: '付费周期', value: memberLevel === 'free' ? '—' : '按学期' },
                  { label: '到期时间', value: memberExpiresAt ? new Date(memberExpiresAt).toLocaleDateString('zh-CN') : (memberLevel === 'free' ? '—' : '永久') },
                  { label: '状态', value: memberLevel === 'free' ? '未开通付费会员' : (memberExpiresAt && new Date(memberExpiresAt) < new Date() ? '已过期' : '生效中') }
                ]}
              />
              <div className="profile-section-actions">
                <Link to="/membership"><Button type="primary">升级会员</Button></Link>
                <Button onClick={resetMembership} loading={resetting}>重置为免费体验</Button>
              </div>
            </Space>
          )}
          {activeProfileSection === 'security' && (
            <Space direction="vertical" size={16} className="full-width">
              <ProfileInfoGrid
                items={[
                  { label: '绑定手机号', value: maskPhone(profile.phone) },
                  { label: '登录方式', value: '手机号验证码' },
                  { label: '账号状态', value: '正常' }
                ]}
              />
              <div className="profile-section-actions">
                <Button danger onClick={() => { setIsLoggedIn(false); message.success('已退出登录'); }}>退出登录</Button>
              </div>
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  );
}

function matchUserName(phone: string) {
  const knownUsers: Record<string, string> = {
    '13800138000': '小张同学',
    '18600000000': '小李同学',
    '13900139000': '小王同学'
  };
  return knownUsers[phone] || `同学${phone.slice(-4)}`;
}

function maskPhone(phone?: string) {
  if (!phone) return '待登录';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function formatGrade(grade?: string) {
  if (!grade) return '待完善';
  return gradeOptions.find((item) => item.value === grade)?.label || '待完善';
}

/* ======================== 生涯规划页面 ======================== */
type JobPosting = {
  company: string;
  role: string;
  location: string;
  mode: string;
  tags: string[];
  description?: string[];
  requirements?: string[];
  benefits?: string[];
  graduationPeriod?: string;
  batch?: string;
  interviewMode?: string;
  writtenTestTrack?: string;
};

function JobPostingCard({ job }: { job: JobPosting }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(job.description?.length || job.requirements?.length || job.benefits?.length);
  return (
    <Card className="career-resource-card" hoverable>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="career-resource-header">
            <Text className="career-resource-title" strong>{job.role}</Text>
            <Tag color="green">招人中</Tag>
          </div>
          <Paragraph type="secondary" className="career-resource-desc">
            {job.company} · {job.location} · {job.mode}
          </Paragraph>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {job.tags.map((t) => <Tag key={t} color="blue">{t}</Tag>)}
          </div>
        </div>
        {hasDetail && (
          <Button type="link" style={{ flexShrink: 0 }} onClick={() => setExpanded(!expanded)}>
            {expanded ? '收起' : '展开'}
          </Button>
        )}
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 12, paddingTop: 12 }}>
          {(job.graduationPeriod || job.batch || job.interviewMode || job.writtenTestTrack) && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>基础信息：</Text>
              <div style={{ marginTop: 4, color: 'rgba(0, 0, 0, 0.65)', lineHeight: 1.8 }}>
                {job.graduationPeriod && <div>毕业起止时间：{job.graduationPeriod}</div>}
                {job.batch && <div>招聘批次：{job.batch}</div>}
                {job.interviewMode && <div>面试地点：{job.interviewMode}</div>}
                {job.writtenTestTrack && <div>笔试方向：{job.writtenTestTrack}</div>}
              </div>
            </div>
          )}
          {job.description && job.description.length > 0 && (
            <>
              <Text strong>职位描述：</Text>
              <ol style={{ margin: '8px 0', paddingLeft: 20, color: 'rgba(0, 0, 0, 0.65)' }}>
                {job.description.map((d, i) => <li key={i} style={{ marginBottom: 4 }}>{d}</li>)}
              </ol>
            </>
          )}
          {job.requirements && job.requirements.length > 0 && (
            <>
              <Text strong>职位要求：</Text>
              <ol style={{ margin: '8px 0', paddingLeft: 20, color: 'rgba(0, 0, 0, 0.65)' }}>
                {job.requirements.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
              </ol>
            </>
          )}
          {job.benefits && job.benefits.length > 0 && (
            <>
              <Text strong>你将获得：</Text>
              <ol style={{ margin: '8px 0 0', paddingLeft: 20, color: 'rgba(0, 0, 0, 0.65)' }}>
                {job.benefits.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}
              </ol>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function TechArticlesPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<XhsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getXhsArticles()
      .then((res) => setArticles(res.data || []))
      .catch(() => message.error('获取文章列表失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="career-planning-page">
      <Button style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning')}>← 返回生涯规划</Button>
      <div className="career-hero">
        <div className="career-hero-badge">📕 小红书 · 技术干货</div>
        <Title level={2}>技术干货<span className="career-hero-highlight">抢先读</span></Title>
        <Paragraph>小红书过往发表文章合集，涵盖求职、保研、留学与前沿技术干货，持续更新中</Paragraph>
      </div>
      <Card className="career-resource-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <img
            src="/xhs-card.jpg"
            alt="小红书账号：大厂 AI 直通车"
            style={{ width: 220, borderRadius: 12, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <Title level={4} style={{ marginTop: 0 }}>大厂 AI 直通车</Title>
            <Paragraph type="secondary">北邮毕业生，大厂工程师，每天分享一个 Agent 领域的小知识点～</Paragraph>
            <Text type="secondary">扫描左侧二维码，在小红书找到我（小红书号：5512167689）</Text>
          </div>
        </div>
      </Card>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {articles.map((a) => (
            <Col xs={24} sm={12} lg={8} key={a.title}>
              <Card
                className="career-resource-card"
                hoverable
                onClick={a.url ? () => window.open(a.url, '_blank', 'noopener,noreferrer') : undefined}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{a.cover || '📄'}</div>
                <Text className="career-resource-title" strong>{a.title}</Text>
                <Paragraph type="secondary" className="career-resource-desc">{a.summary}</Paragraph>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{a.date}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>❤️ {a.likes} · ⭐ {a.collects}</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        {!loading && articles.length === 0 && <Empty description="暂无文章，期待第一篇笔记发布" />}
      </Spin>
    </div>
  );
}

function CareerPlanningPage() {
  const navigate = useNavigate();
  const [jobsBoardOpen, setJobsBoardOpen] = useState(false);
  const [activeJobCategory, setActiveJobCategory] = useState('技术类');

  const postgraduateData = [
    { title: '保研时间线全攻略', desc: '从大一到大三的完整保研规划路径，包括成绩、科研、竞赛准备节点', tag: '规划', color: 'blue' },
    { title: '保研材料清单与写作指导', desc: '个人陈述、推荐信、简历等核心材料的模板与撰写技巧', tag: '材料', color: 'green' },
    { title: '夏令营/预推免申请策略', desc: '如何选择目标院校、提高入营率、面试表现加分项', tag: '申请', color: 'purple' },
    { title: '计算机方向保研面试高频问题', desc: '数据结构、操作系统、项目经验等面试常见问题梳理', tag: '面试', color: 'orange' },
    { title: '保研信息差速递（持续更新）', desc: '各校夏令营开放时间、往年数据、最新政策变动汇总', tag: '动态', color: 'red' },
  ];

  const studyAbroadData = [
    { title: '留学选校定位方法论', desc: '根据GPA、科研、实习等背景，科学定位冲刺/主申/保底院校', tag: '定位', color: 'blue' },
    { title: 'CS方向留学申请时间线', desc: '从标化考试到文书提交的完整时间规划（美/英/港/新）', tag: '规划', color: 'green' },
    { title: '文书写作与CV打造', desc: 'SOP/PS撰写逻辑框架、CV排版技巧、推荐人选择策略', tag: '文书', color: 'purple' },
    { title: 'GRE/TOEFL/IELTS备考指南', desc: '高效备考方法、资料推荐和分数目标设定', tag: '标化', color: 'orange' },
    { title: '最新留学申请动态', desc: '各校Deadline更新、录取数据分析、政策变化解读', tag: '动态', color: 'red' },
  ];

  const internshipData = [
    { title: '大厂实习申请全流程', desc: '从简历投递到Offer接收的完整链路，含时间节点与注意事项', tag: '流程', color: 'blue' },
    { title: '技术面试准备路线图', desc: '算法/系统设计/项目深挖的分阶段准备策略', tag: '面试', color: 'green' },
    { title: '简历与项目包装指南', desc: '如何用STAR法则描述项目经历，突出技术亮点', tag: '简历', color: 'purple' },
    { title: '互联网行业岗位解读', desc: '后端/前端/算法/数据/测试等岗位要求、发展路径分析', tag: '岗位', color: 'orange' },
    { title: '实习岗位集结号', desc: '各大厂春招/秋招/日常实习时间线与内推渠道汇总，点击查看在招岗位', tag: '动态', color: 'red' },
    { title: '技术干货抢先读', desc: '精选大厂技术文章与面试干货，抢先掌握前沿技术动态与实战经验', tag: '干货', color: 'cyan' },
  ];

  const studentCases = [
    { name: '张同学', school: '某211计算机', achievement: '成功保研至清华大学计算机系', period: '2023届', story: '大二开始规划，GPA排名前5%，两段科研经历+一篇论文，夏令营拿到清华、北大、浙大offer。', avatar: '🎓' },
    { name: '李同学', school: '某双非软件工程', achievement: '拿到CMU MSCS全奖录取', period: '2023届', story: '从双非起步，通过科研实习+高质量推荐信+精准选校策略，逆袭拿到CMU全奖。', avatar: '🌏' },
    { name: '王同学', school: '某985信息学院', achievement: '秋招拿到字节跳动SP Offer', period: '2024届', story: '大三两段大厂实习，系统化刷题+项目沉淀，最终斩获字节、腾讯、阿里多个SP。', avatar: '💼' },
    { name: '赵同学', school: '某211数学系', achievement: '跨考上岸浙大计算机', period: '2024届', story: '数学系转码，408零基础用8个月系统备考，初试400+，复试机试满分。', avatar: '📚' },
    { name: '陈同学', school: '某普通一本CS', achievement: '香港科技大学MSc录取', period: '2024届', story: '普通一本背景，通过高GPA+实习经历+精心打磨的文书，成功申请港科大。', avatar: '🏆' },
  ];

  const jobCategoryData = [
    { name: '技术类', icon: '💻' },
    { name: '设计类', icon: '🎨' },
    { name: '产品类', icon: '🧭' },
    { name: '数据类', icon: '📊' },
    { name: '运营类', icon: '📣' },
    { name: '销售类', icon: '🤝' },
  ];

  const jobPostingsData: Record<string, JobPosting[]> = {
    '技术类': [
      {
        company: '剪映CapCut',
        role: 'AI应用全栈开发工程师（即梦）',
        location: '北京/广州/深圳/杭州',
        mode: '全职招聘',
        tags: ['全栈开发', 'LLM应用', 'IDE插件'],
        description: [
          '参与建设剪映AI编程&研效提升，深入理解各类研发场景，完成不同业务场景AI编程能力的落地',
          '负责跟进和探索AI领域最新的技术和趋势，结合研发效能场景，提供技术解决方案',
          '负责相关技术的基础设施搭建，提高工程效率和工程质量',
        ],
        requirements: [
          '本科及以上学历，3年以上全栈开发工作经验，对计算机基础系统架构有清晰理解，计算、存储、网络等基础功底扎实',
          '熟悉Go/Kotlin/Java/Swift/Objective-C/TypeScript/JavaScript中至少一门语言',
          '熟悉一门前后端开发框架或Android/iOS客户端开发经验',
          '熟悉VSCode或JetBrains插件体系，有IDE插件开发经验优先',
          '了解LLM应用架构，掌握LLM相关技术栈优先，如Langchain、Vector DBs等',
          '具备较强的责任感、团队合作精神、逻辑思维能力和表达能力，能独立分析问题，善于研究业务、分析产品',
        ],
      },
      {
        company: '剪映CapCut',
        role: '高级前端开发工程师（增长方向）',
        location: '北京/深圳（优先）/上海',
        mode: '社会招聘',
        tags: ['前端', 'React/Vue', 'AI Agent', '用户增长'],
        description: [
          '支撑剪映、CapCut、即梦、醒图、小云雀等数亿级视频/图片创作产品的增长渠道搭建，覆盖内容营销、导流联动、促活与激励等核心方向',
          '深入研究Web前端技术，负责B端&C端业务架构设计、框架与技术规划、性能优化等关键工作',
          '负责平台化方案的设计与建设，面向多业务场景，支持用户增长、留存，以及研发效率的提升等工作',
          '跟进行业新技术并应用于业务实践，解决产品开发过程中的工程质量与体验问题',
          '负责AI Agent在增长场景中落地，制定Agent产品交互开发，前后端交互方案、通信协议，以及Agent编排等工作',
          '负责极具挑战的大型活动，并建设C端数十亿流量场景的高稳定性、高性能与高可用能力',
        ],
        requirements: [
          '本科及以上学历，计算机基础扎实，熟练掌握Javascript/CSS等前端必备技术栈',
          '掌握当前流行的前端框架，如React/Vue，并熟悉其衍生生态（如状态管理方案、SSR方案等）',
          '熟悉至少一种构建工具，具备前端工程化思维',
          '了解跨端技术栈，熟悉一门服务端、客户端语言加分',
          '具备良好的系统模块设计能力，具有架构意识，并能在日常研发中灵活使用',
          '掌握数据结构、算法、设计模式与网络通信等相关计算机基础知识',
          '对技术保持好奇心，具备良好的沟通能力与团队合作精神；关注前端前沿技术发展，能够将新知识传递给团队并转化到项目中',
        ],
        benefits: [
          '前沿AI Agent技术实践机会：鼓励前端探索AI Agent的产品设计与开发，有机会参与AI Agent项目，与顶尖技术团队合作，提升AI领域的技术水平与实战经验',
          '深入研究行业前沿技术：纵向与横向覆盖架构设计、SDK建设、深度性能优化与平台化建设等环节',
          '良好的工作环境和团队氛围：加入一个充满活力、创新精神和团队合作精神的优秀团队，在积极健康的工作氛围中实现个人与团队的共同进步',
          '广阔的职业发展空间：随着剪映系业务的快速发展和AI技术的不断深化应用，接触风口业务的成长和先进的开发模式',
          '丰富的学习资源和培训机会：提供丰富的内部培训与技术分享活动，为提升全栈技能提供空间与资源',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI Agent基础设施研发工程师（AI研发方向）',
        location: '杭州/北京/上海/深圳/广州',
        mode: '27届秋招 · 应届生',
        tags: ['AI Agent', '大模型', '云原生', 'LLMOps'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【AI研发】阿里巴巴集团27届秋招',
        description: [
          '负责构建支撑AI Agent全生命周期的核心基础设施，涵盖设计构建、训练优化、安全部署、高并发调度及服务化交付等，为Agent的规模化落地提供稳定、高效、安全的底层能力',
          'Agent基础设施：设计高并发、可扩展的Agent框架，覆盖沙箱执行、容器编排、任务调度及状态管理，支持训练优化与安全部署',
          '安全与稳定性：构建沙箱隔离与委托身份认证，确保API安全调用，并实现检查点恢复机制保障长任务可靠性',
          '平台服务能力：开发LLM上下文预计算、知识检索等优化能力，封装SDK/API（如向量检索、观测体系）提升推理效率',
          'AI能力产品化：模块化输出开发套件（如CLI/SKLLS），降低Agent构建与调优门槛，支持算法迭代优化',
          '技术前瞻与落地：跟踪Agent生态技术进展，推动新技术规模化应用，持续优化架构性能与易用性',
          '目标：通过高效、安全、先进的基础设施，实现AI Agent从开发到生产的全流程支持，加速规模化落地',
        ],
        requirements: [
          '基础条件：计算机、软件工程、人工智能等相关专业优先',
          '基础条件：有顶会论文/高影响项目/开源贡献者加分',
          '专业能力-技术基础：扎实的计算机基础（OS/网络/数据库），精通至少一门编程语言（Go/Python/Java/C++/Rust/TypeScript），熟悉后端技术栈（微服务/消息队列/缓存）及云原生（K8s/Serverless）或安全隔离技术（Docker/gVisor）',
          '专业能力-AI Agent专精领域：深入理解大模型原理，熟悉至少一种Agent框架（LangGraph/ADK/LangChain/AutoGen/MetaGPT等）或核心组件（RAG/工具调用/SKILLS），具备Agent全生命周期管理（训练/评测/部署）经验，有强化学习或规划算法背景优先',
          '专业能力-Agent Ops运维实践：掌握LLMOps（模型版本/监控/部署）及AgentOps（编排/自愈/状态管理），熟悉可观测性系统（链路追踪/日志分析）',
          '专业能力-工程与交付能力：擅长AI Coding快速原型开发，熟悉测试与变更管理（CI/静态分析），有高并发优化或多租户隔离经验',
          '能力特质：对AI原生应用有热情，能复现前沿技术；追求简洁可扩展的架构，沟通协作能力强',
          '加分项：有Agent优化实战经验、参与Agent平台开发、熟悉上下文工程或多Agent协同系统',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI应用研发工程师（AI研发方向）',
        location: '杭州/深圳/北京/上海/广州',
        mode: '27届秋招 · 应届生',
        tags: ['AI应用', 'Agent', 'RAG', 'AI Coding'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【AI研发】阿里巴巴集团27届秋招',
        description: [
          '聚焦核心业务场景，利用Agent等前沿技术推动AI落地。参与从需求洞察到系统构建的全流程，通过研发智能应用与工具，提升业务效率与效果，实现技术驱动业务增长的完整闭环，推动智能规模化演进',
          '需求理解与归因：深入业务场景，利用数据挖掘与特征分析完成现象归因；精准识别高价值问题，将模糊的业务痛点转化为明确的AI解决目标',
          '架构设计：面向具体业务需求，设计AI原生系统架构；参与Agent系统核心模块的规划，包括记忆管理、推理策略与工具编排，兼顾架构的灵活性、可扩展性与工程可落地性',
          '知识与环境构建：搭建AI与现有业务系统的交互环境，涵盖API接入、RAG知识库构建、记忆方案设计；持续优化召回质量与上下文注入策略，为模型提供准确、及时的执行环境与知识支撑',
          '核心能力实现：负责Agent关键模块的工程落地，实现意图识别、任务拆解与反思纠错闭环；封装标准化SDK/API服务，构建Agent观测体系，实现全链路追踪与多维归因分析',
          '系统迭代与演进：建立自动化评测与回测机制，通过调优与Case分析不断收敛效果与性能提升的最优路径；沉淀方法论与可复用组件，推动AI能力从单点验证走向规模化落地',
          '性能优化：优化高并发场景下的系统性能，通过异步处理与降级策略保障稳定性，通过低侵入性观测手段保障系统的长期稳定运行',
        ],
        requirements: [
          '基础条件：计算机、软件工程、人工智能等相关专业优先',
          '专业能力-AI编程工具：Cursor、Claude Code等AI编程工具重度或顶级玩家，具备极强的Prompt编写与调优能力，有过完整的项目级开发经验，理解如何让AI写出生产级代码',
          '专业能力-大模型理解与掌握：理解主流LLM的能力与局限，能够清晰拆解任务并通过LLM或确定性逻辑兜底实现；熟悉主流大模型应用范式（Context Engineering、Prompt Engineering、Agent、工具/函数调用等）及主流Agent框架（如LangChain等），具备大模型幻觉、Prompt注入等风险的工程化应对思路',
          '专业能力-代码与工程能力：具备扎实的计算机基础知识，深入理解数据结构、算法、网络和操作系统等相关知识，能至少在一种主流编程语言（如Java/Python/JS等）上有深度的实践经验，掌握常见工程实践并具备优秀的Coding能力，能够根据场景灵活选型并快速上手',
          '能力特质-学习能力：具备快速啃透前沿论文（Paper）的能力，并能将理论知识转化为工程代码',
          '能力特质-开放性与动手能力：拒绝纸上谈兵，有自己独立完成的小项目（开源项目或个人Demo），展现极客精神',
          '能力特质-好奇心与想象力：面对未知事物有独特的想法，具备敏锐的问题定义能力和坚韧的解决问题能力',
          '能力特质-审美追求：技术亦有审美，鼓励提出打动人心、简洁优雅的好想法',
          '能力特质-高能动性：具备强烈的自驱力，能够主动探索边界，而不是等待被分配任务',
          '加分项：有AI应用或Agent实际落地经验（如RAG系统、多智能体编排、结合MCP/Skill等的Agent项目），有可展示的项目/实习成果者优先',
          '加分项：开源贡献或技术影响力，在Github上有高质量AI项目、技术博客或社区影响力',
          '加分项：对AI Infra有基本理解，了解vLLM、Ollama等推理框架原理，理解延迟优化、KV cache优化、流式输出等工程全局视角',
          '加分项：在CV或NLP方向有扎实的理论基础，有实际业务场景模型训练（SFT、RL）等经验的优先',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI数据研发工程师（数据研发方向）',
        location: '杭州/北京',
        mode: '27届秋招 · 应届生',
        tags: ['大数据', '数据合成', '评测体系', '大模型'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【数据研发】阿里巴巴集团27届秋招',
        description: [
          '以数据驱动、评测驱动的方式，构建数据高效迭代闭环，建立从数据寻源、标注、处理、合成到评测的全链路数据体系，持续建设高质量数据集和评测集，不断推动基础模型能力提升，推动AI模型和应用发展',
          '全模态数据处理：参与研发万亿级数据规模的全模态数据处理引擎；设计高性能、可复用的数据处理算子，构建覆盖全生命周期的自动化数据生产pipeline；解决海量数据在清洗、脱敏及增强过程中的计算瓶颈，利用智能筛选与精准对齐算法交付高质量训练集；持续优化全链路交付效能，确保数据质量与处理规模世界领先',
          '大模型数据理解与资产体系建设：设计支撑AGI演进的多模态语义标签标准与特征映射体系，构建先进的质量度量模型与内容理解框架，实现对海量3D、视频、音频等复杂数据的自动化精炼；结合业务垂直场景与最前沿算法，驱动EB级全模态数据的深度解析与价值发现，将海量数据转化为高稀缺性和行业竞争壁垒的AI数据资产',
          '领域全链路数据策略建设：设计面向大模型细分领域性能优化的全链路数据体系，涵盖评测体系设计、数据加工与数据合成链路、数据标注策略设计；实践评测驱动（EDD）的大模型迭代方法，确保千问、万相等基础模型能力持续处于世界领先水平',
        ],
        requirements: [
          '基础条件：计算机、软件工程、数学、统计、人工智能、大数据、机器人等相关专业硕士/博士优先（非此类专业，有相关经验亦可）',
          '基础条件：有顶会论文/高影响项目/开源贡献者加分',
          '专业能力-大数据处理技术：深入理解大规模分布式数据处理系统原理，熟悉Spark/Flink/Ray等开源技术栈；深入理解流批处理原理（计算模型、调度和资源管理、容错与一致性等）；可独立完成面向全模态数据（结构化/文本/图像/音频/视频）的批流一体数据处理开发与优化',
          '专业能力-大模型技术的理解与掌握：深入理解大模型核心原理，包括Transformer架构、上下文学习（ICL）、指令微调（Instruction Tuning）、检索增强生成（RAG）及推理机制（如思维链CoT）等关键技术；熟悉大模型在预训练、监督微调（SFT）和强化学习对齐（RLHF/RLAIF）等阶段的数据需求与优化逻辑；能够基于领域场景设计高质量数据处理与合成算法',
          '专业能力-AI编程意识与工程思维：能持续快速学习AI研发新范式，熟练运用主流AI工具，独立完成从需求分析、架构设计到高质量代码实现的系统级开发任务，并确保代码的可维护性、可扩展性与工程规范性',
          '专业能力-跨学科跨领域理解：通过评测及数据驱动的方式提升模型效果，结合对大模型及垂直领域的深度融合理解，设计面向领域的高质量评测集和数据集，针对基础模型短板设计相应的模型训练策略，不断突破基础模型能力上限',
          '专业能力-工程与系统素养：能至少在一种主流编程语言（如Java/Python/C++等）上有深度的实践经验，掌握常见工程实践并具备优秀的Coding能力，能够根据场景灵活选型并快速上手',
          '能力特质：对AI有热情、对前沿技术与产品好奇；能快速学习掌握新知识与技术；能良好沟通交流拓宽视野；有责任感，确保工作完整闭环、高质量交付，为团队与合作方提供可信赖的支撑',
        ],
      },
      {
        company: '阿里妈妈',
        role: 'AI广告系统研发工程师（训推Infra方向）',
        location: '北京',
        mode: '27届秋招 · 应届生',
        tags: ['C/C++', 'CUDA', 'AI Infra', '广告系统'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【工程】阿里巴巴集团27届秋招',
        description: [
          '在AI与广告技术融合的最前沿，打造世界领先的AI广告系统，用技术驱动千亿级商业决策',
          'AI训推Infra优化：从稀疏传统广告模型到稠密计算大模型，从端到端训练到大模型微调，持续优化改造工业级模型训练框架；针对GPU/PPU/AMD等异构计算资源，优化构建万卡推理引擎，支持广告全链路大模型提效',
          '云原生架构赋能：践行DevOps、ServiceMesh、Serverless-GaaS、落地AI运维与科学实验；运用容器化、微服务构建弹性高可用的广告平台，管控海量广告引擎在离线资源和模型训推资源',
          '用AI重塑研发：基于LLM和Agent构建高质量知识库，高效管理数据、代码、系统、文档知识；从需求理解、方案设计、代码编写、测试验证到生产发布、日常答疑、问题诊断，端到端实现AI研发赋能',
          '极致性能建模：运用现代C++、CUDA等异构硬件编程技术，构建毫秒级响应的分布式计算引擎；探索GPU/PPU异构硬件在广告引擎各场景的优化落地，帮助业务提升RT/建模Scaling up空间',
          '业务赋能前沿：参与广告产品Agent重塑、AI Targeting等重大升级，帮助AIGA/AIGB/AIGC/LUM/MUSE等算法落地，助力AI提升广告效果，从容应对海量流量峰值',
        ],
        requirements: [
          '本科及以上学历，计算机、软件工程、人工智能等计算机相关专业',
          '热爱编程，熟练掌握C/C++、Python等编程语言，具备扎实的编程功底；掌握常用数据结构与算法，熟悉网络编程、多线程编程',
          '熟悉CUDA编程，了解Tensorflow、PyTorch等机器学习平台，熟悉XLA/TensorRT/TVM等机器学习编译器',
          '了解DNN/LLM模型原理、工程架构，熟悉CPU/GPU/XPU硬件原理，能够参与定制化的模型算子改造、训推优化',
          '学习能力强，不畏挑战，喜欢钻研，善于独立思考并反思总结，有良好的沟通表达能力',
          '加分项：有大型项目开发经验或ACM/ICPC等算法竞赛经验',
          '加分项：有AI Agent开发或AI应用落地，有异构计算优化经验者',
          '加分项：权威竞赛获奖者或顶级会议论文发表者',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI引擎研发工程师（算力优化方向）',
        location: '北京',
        mode: '27届秋招 · 应届生',
        tags: ['C/C++', 'CUDA', 'Agent', '云原生'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【工程】阿里巴巴集团27届秋招',
        description: [
          '聚焦核心业务场景，借助现代C/C++、AI Agent等前沿技术推动AI提效落地；参与从需求洞察到系统构建的全流程，通过建设和应用智能研发工具、持续推进极致的算力/架构优化，助力业务效率与效果提升',
          '深度参与业务提效：参与核心商业化产品的Agent重塑，见证传统系统到Agent系统的完整重生，通过持续的算力和架构优化助力AI提效全面落地',
          '持续推进极致的性能优化：运用现代C/C++、CUDA等异构硬件编程技术，构建高并发、低延迟、高可用的AI引擎框架和内核；探索GPU/PPU异构硬件在业务系统的落地，帮助业务提升RT/建模Scaling up空间',
          '全面重塑AI研发全过程：基于LLM和Agent构建高质量知识库，优化建设最先进的AI Coding系统，从需求理解到代码编写到生产发布到日常运维，端到端实现AI赋能',
          '通过数据驱动业务提效：借助湖仓、AIData、超参寻优、OLAP等技术，洞察业务提效机会与系统算力洼地，直接赋能大盘效果提升和系统算力优化',
          '深度参与云原生架构赋能：践行DevOps、ServiceMesh、Serverless、落地AI运维与科学实验，运用容器化、微服务构建弹性高可用的广告平台，管控海量CPU/GPU资源',
        ],
        requirements: [
          '基础条件：计算机、软件工程、人工智能等相关专业优先',
          '专业能力-扎实的计算机基础：深入理解数据结构、算法、网络和操作系统等相关知识，对大规模分布式系统有深刻理解',
          '专业能力-硬核的编程能力：熟练掌握C/C++、Python等编程语言，掌握常见工程实践并具备优秀的Coding能力，能根据场景灵活选型并快速上手，在AI Coding上有深度的实践经验',
          '专业能力-熟悉异构硬件编程：熟悉CUDA编程，了解Tensorflow、PyTorch等机器学习平台，熟悉XLA/TensorRT/TVM等机器学习编译器',
          '专业能力-理解分布式和云原生：具备构建复杂工程系统的潜力，熟悉现代云原生基础设施（如Kubernetes）',
          '专业能力-熟悉Agent架构：对Context Engineering、Prompt Engineering、AI-Memory、主流Agent框架（LangChain等）有一定理解，能够独立开发并优化Agent系统',
          '能力特质：好奇心重，对未知事物保持渴望；学习力强，能将理论知识转化为工程代码；动手力强，拒绝纸上谈兵，有项目有实践，展现极客精神；思考力强，具备敏锐的问题定义、识别和拆解能力；积极主动，具备强烈的自驱力',
          '加分项：有Agent开发或AI应用落地经验（如RAG系统、多智能体编排、结合MCP/Skill等的Agent项目），有可展示的项目/实习成果者优先',
          '加分项：对AI Infra有基本理解，了解vLLM、Ollama等推理框架原理，理解延迟优化、KV cache优化、流式输出等工程全局视角',
          '加分项：有大型项目开发经验或ACM/ICPC等权威竞赛获奖者，或顶级会议论文发表，在开源社区有高质量项目、技术博客或社区影响力',
        ],
      },
      {
        company: '阿里巴巴',
        role: '算法工程师（搜推广大模型方向）',
        location: '杭州/北京',
        mode: '27届秋招 · 应届生',
        tags: ['算法', 'LLM', '搜推广', 'RLHF'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【算法】阿里巴巴集团27届秋招',
        description: [
          '前沿技术落地：负责Agentic Search/Reasoning、Deep Research及多模态大模型在电商场景的应用；探索RLHF/RLAIF对齐技术，推动搜推广架构向生成式预估/召回演进，验证Scaling Law潜力',
          '体验重构优化：深耕Query意图理解、语义检索及UGC内容生成；利用LLM CoT增强用户行为建模与偏好推理，提升搜推广相关性、丰富度及匹配精准度',
          'AIGC商业提效：构建生成式内容生态（自动标题/卖点、文生图/视频、自动化投放），通过提升内容质量与生产效率，驱动用户体验与商业转化双增长',
          '智能体体系构建：研发AI Agent、Agentic RL及多智能体协同技术，应用于智能导购、交互式搜推广及复杂供需匹配，打造具备自主推理、动态规划及自进化能力的智能系统',
        ],
        requirements: [
          '基础扎实：计算机/AI相关专业硕士及以上，机器学习/深度学习理论基础深厚',
          '技术栈：精通Python/C++及PyTorch/TF，深入理解Transformer，有LLM预训练/SFT/RLHF/RAG实战经验者优先',
          '业务经验：熟悉搜/推/广经典算法（召回/排序/相关性等），有大模型改造传统链路经验者极佳',
          '前沿视野：对AI Agent、Multi-modal LLM、Generative Retrieval有深入研究，具备极强的工程落地能力与创新意识',
        ],
      },
    ],
    '设计类': [
      { company: '网易', role: 'UI/UX 设计实习生', location: '杭州', mode: '日常实习', tags: ['Figma', '视觉设计'] },
      { company: '小红书', role: '视觉设计实习生', location: '上海', mode: '暑期实习', tags: ['品牌视觉', '海报设计'] },
      { company: '百度', role: '交互设计实习生', location: '北京', mode: '日常实习', tags: ['交互原型', '用户研究'] },
    ],
    '产品类': [
      {
        company: '阿里巴巴',
        role: 'AI产品经理（Agent协作产品方向）',
        location: '杭州',
        mode: '27届秋招 · 应届生',
        tags: ['AI产品', 'Agent', '数据分析', 'Prompt工程'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        writtenTestTrack: '【工程】阿里巴巴集团27届秋招',
        description: [
          '本岗位需要完成工程笔试',
          '主导Agent与人协作产品的设计与迭代',
          '深入研究用户场景与痛点，建立用户反馈闭环，持续驱动产品体验优化',
          '与工程、设计、运营等同事和Agent紧密协作，推动产品从0到1及规模化增长',
          '定义并跟踪核心产品指标（DAU、留存、活跃度、NPS等），用数据驱动决策',
          '关注行业动态与竞品分析，保持产品的竞争力与创新性',
        ],
        requirements: [
          '本科及以上学历，计算机、人工智能、心理学、工业设计等相关专业优先',
          '熟悉AI基础技术框架，能与技术团队高效沟通技术应用',
          '擅长从员工视角拆解复杂任务，设计轻量化、低学习成本的AI解决方案',
          '熟悉企业服务（如OA、HR SaaS）或AI行业应用，熟悉RPA、低代码等效率工具生态，有Prompt工程优化或AIGC应用实践经验',
          '熟练使用SQL/Python分析用户行为数据，或具备基础技术开发能力',
          '逻辑清晰，能快速将抽象需求转化为可执行方案；自驱力强，对AI技术落地怀有热情，适应高速迭代的工作节奏',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI产品经理（企业效率方向）',
        location: '上海',
        mode: '27届秋招 · 应届生',
        tags: ['AI产品', '企业服务', '效率工具', '数据分析'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        description: [
          '用户需求洞察：设计科学的需求洞察路径，深度调研企业员工日常工作场景，挖掘效率瓶颈与体验优化点，转化为可落地的AI产品功能',
          '产品设计与规划：负责企业级AI效率产品的全生命周期管理，围绕员工生产力提升及工作体验优化，设计AI产品核心能力（如智能助手、自动化流程、知识管理、数据分析等）',
          '产品实施落地：联动技术、算法、设计团队，推动AI产品功能落地，确保最终实施与产品目标对齐',
          '数据驱动优化：建立产品效果评估体系，持续优化AI产品能力；关注AI伦理与数据安全，设计合规机制保障企业信息隐私',
          '行业前瞻性调研：跟踪AI领域技术突破，探索其在企业效率场景的创新应用',
        ],
        requirements: [
          '本科及以上学历，计算机、人工智能、心理学、工业设计等相关专业优先',
          '熟悉AI基础技术框架，能与技术团队高效沟通技术应用',
          '擅长从员工视角拆解复杂任务，设计轻量化、低学习成本的AI解决方案',
          '熟悉企业服务（如OA、HR SaaS）或AI行业应用，熟悉RPA、低代码等效率工具生态，有Prompt工程优化或AIGC应用实践经验',
          '熟练使用SQL/Python分析用户行为数据，或具备基础技术开发能力',
          '逻辑清晰，能快速将抽象需求转化为可执行方案；自驱力强，对AI技术落地怀有热情，适应高速迭代的工作节奏',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI产品经理（搜索推荐方向）',
        location: '北京',
        mode: '27届秋招 · 应届生',
        tags: ['AI产品', '搜索推荐', '大模型', '数据分析'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        description: [
          '负责搜索推荐日常数据分析及用户需求洞察，并转化为产品方案持续提升搜索推荐能力',
          '推动大模型、多模态技术在搜索推荐等核心场景的落地，打造AI驱动的下一代搜索推荐体验',
          '协同运营、算法、工程团队高效推动项目高质量落地，对项目目标负责',
        ],
        requirements: [
          '本科以上学历，有C端产品实习经验',
          '具备足够的大盘视野，能看到全局增长空间，捕捉业务增长点',
          '具备较强的数据分析能力，善于运用数据驱动产品优化',
          '责任心强，具有坚持不懈的精神，性格积极乐观，学习能力强、抗压能力强',
        ],
      },
      {
        company: '大麦国际',
        role: 'AI产品经理（文娱方向）',
        location: '北京',
        mode: '27届秋招 · 应届生',
        tags: ['AI产品', '大模型', 'AIGC', '文娱'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        interviewMode: '远程',
        description: [
          '大麦国际致力于连接全球优质现场娱乐内容与用户，探索人工智能如何重塑内容生产、购票体验与全球化运营',
          '参与AI产品从用户需求洞察、方案设计到上线迭代的全流程，探索大模型、智能体、AIGC等技术在文化娱乐产品中的应用',
          '围绕文娱活动、用户购票、内容消费、客服、营销、商家与内部运营等场景，设计智能化产品能力',
          '与算法、研发、设计、运营及业务团队协作，推动AI产品创新与高质量落地',
          '跟踪AI技术发展与产品趋势，完成竞品分析、场景验证、效果评估与持续优化',
          '基于数据和用户反馈，持续提升产品体验、业务效率与产品价值',
        ],
        requirements: [
          '本科及以上学历，具备国际化视野与至少一门熟练外语的优先',
          '对AI、大语言模型、智能体、RAG、AIGC等有深入理解，并有应用实践或创业经历者优先',
          '对音乐、演出、体育、潮流文化或娱乐内容有浓厚的兴趣',
          '自驱力强、乐于协作，愿意在快速变化的业务与技术环境中持续学习',
          '投递要求：请附上个人简历，并建议补充能够体现产品思考的项目案例，AI相关作品、产品原型、Demo链接或技术实践均可附上',
        ],
      },
      { company: '腾讯', role: '产品经理实习生（微信方向）', location: '广州', mode: '日常实习', tags: ['需求分析', '竞品调研'] },
      { company: '字节跳动', role: '产品实习生（抖音生活服务）', location: '北京', mode: '日常实习', tags: ['PRD撰写', '用户访谈'] },
      { company: '美团', role: '到店产品实习生', location: '北京', mode: '暑期实习', tags: ['商业分析', '产品设计'] },
    ],
    '数据类': [
      { company: '字节跳动', role: '数据分析实习生', location: '北京', mode: '日常实习', tags: ['SQL', 'Python'] },
      { company: '拼多多', role: '商业分析实习生', location: '上海', mode: '日常实习', tags: ['Excel', '行业研究'] },
      { company: '快手', role: '数据科学实习生', location: '北京', mode: '暑期实习', tags: ['统计建模', 'A/B实验'] },
    ],
    '运营类': [
      { company: '小红书', role: '内容运营实习生', location: '上海', mode: '日常实习', tags: ['文案策划', '社区运营'] },
      { company: 'B站', role: '活动运营实习生', location: '上海', mode: '日常实习', tags: ['活动策划', '跨部门协作'] },
      { company: '京东', role: '用户运营实习生', location: '北京', mode: '暑期实习', tags: ['用户增长', '数据复盘'] },
    ],
    '销售类': [
      { company: '阿里云', role: '云销售实习生', location: '杭州', mode: '日常实习', tags: ['ToB销售', '客户沟通'] },
      { company: '华为', role: '客户经理实习生', location: '深圳', mode: '暑期实习', tags: ['商务谈判', '解决方案'] },
      { company: '字节跳动', role: '商业化销售实习生', location: '北京', mode: '日常实习', tags: ['广告销售', '客户拓展'] },
    ],
  };

  const renderResourceList = (
    data: { title: string; desc: string; tag: string; color: string }[],
    onItemClick?: (item: { title: string; desc: string; tag: string; color: string }) => void,
  ) => (
    <List
      dataSource={data}
      renderItem={(item) => (
        <List.Item>
          <Card
            className="career-resource-card"
            hoverable
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          >
            <div className="career-resource-header">
              <Tag color={item.color}>{item.tag}</Tag>
              <Text className="career-resource-title" strong>{item.title}</Text>
            </div>
            <Paragraph type="secondary" className="career-resource-desc">{item.desc}</Paragraph>
          </Card>
        </List.Item>
      )}
    />
  );

  const tabItems = [
    {
      key: 'internship',
      label: <span><ProfileOutlined /> 求职专区</span>,
      children: jobsBoardOpen ? (
        <div className="career-tab-content">
          <Button style={{ marginBottom: 16 }} onClick={() => setJobsBoardOpen(false)}>← 返回求职专区</Button>
          <div className="career-section-header">
            <Title level={4}>实习岗位集结号</Title>
            <Paragraph type="secondary">按职位类型浏览在招实习岗位，信息持续更新</Paragraph>
          </div>
          <Tabs
            activeKey={activeJobCategory}
            onChange={setActiveJobCategory}
            className="career-tabs"
            items={jobCategoryData.map((cat) => ({
              key: cat.name,
              label: <span>{cat.icon} {cat.name}</span>,
              children: (
                <Row gutter={[16, 16]}>
                  {(jobPostingsData[cat.name] || []).map((job) => (
                    <Col xs={24} md={12} key={`${job.company}-${job.role}`}>
                      <JobPostingCard job={job} />
                    </Col>
                  ))}
                </Row>
              ),
            }))}
          />
        </div>
      ) : (
        <div className="career-tab-content">
          <div className="career-section-header">
            <Title level={4}>求职专区</Title>
            <Paragraph type="secondary">助你拿到心仪的大厂实习Offer，积累核心竞争力</Paragraph>
          </div>
          {renderResourceList(internshipData, (item) => {
            if (item.title === '实习岗位集结号') setJobsBoardOpen(true);
            if (item.title === '技术干货抢先读') navigate('/career-planning/tech-articles');
          })}
        </div>
      ),
    },
    {
      key: 'abroad',
      label: <span><RocketOutlined /> 留学专区</span>,
      children: (
        <div className="career-tab-content">
          <div className="career-section-header">
            <Title level={4}>留学专区</Title>
            <Paragraph type="secondary">涵盖选校定位、标化备考、文书打造到申请提交的全流程指导</Paragraph>
          </div>
          {renderResourceList(studyAbroadData)}
        </div>
      ),
    },
    {
      key: 'postgraduate',
      label: <span><TrophyOutlined /> 保研专区</span>,
      children: (
        <div className="career-tab-content">
          <div className="career-section-header">
            <Title level={4}>保研专区</Title>
            <Paragraph type="secondary">为目标保研的同学提供从规划到录取的全链路资料与信息</Paragraph>
          </div>
          {renderResourceList(postgraduateData)}
        </div>
      ),
    },
    {
      key: 'followup',
      label: <span><TeamOutlined /> 长期随访</span>,
      children: (
        <div className="career-tab-content">
          <div className="career-section-header">
            <Title level={4}>长期随访 · 学员成长故事</Title>
            <Paragraph type="secondary">记录每一位同学的规划与成长历程，见证努力到收获的完整链路</Paragraph>
          </div>
          <Row gutter={[16, 16]}>
            {studentCases.map((c) => (
              <Col xs={24} md={12} key={c.name}>
                <Card className="career-case-card" hoverable>
                  <div className="career-case-header">
                    <span className="career-case-avatar">{c.avatar}</span>
                    <div>
                      <Text strong>{c.name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{c.school} · {c.period}</Text>
                    </div>
                  </div>
                  <div className="career-case-achievement">
                    <Tag color="blue">{c.achievement}</Tag>
                  </div>
                  <Paragraph type="secondary" className="career-case-story">{c.story}</Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
          <Card className="career-followup-cta" style={{ marginTop: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <Title level={5}>想了解更多学员案例或获取专属规划？</Title>
              <Button type="primary" size="large" onClick={() => navigate('/consultation')}>立即预约 1v1 咨询</Button>
            </div>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="career-planning-page">
      <div className="career-hero">
        <div className="career-hero-badge">🎯 生涯规划中心</div>
        <Title level={2}>为你的未来，<span className="career-hero-highlight">量身定制路径</span></Title>
        <Paragraph>无论你选择保研、留学、考研还是就业，这里都有为你量身整理的路径资料与真实案例</Paragraph>
        <div className="career-hero-stats">
          <div className="career-hero-stat"><span className="career-hero-stat-num">5</span><span className="career-hero-stat-label">规划方向</span></div>
          <div className="career-hero-stat-divider" />
          <div className="career-hero-stat"><span className="career-hero-stat-num">200+</span><span className="career-hero-stat-label">精选资料</span></div>
          <div className="career-hero-stat-divider" />
          <div className="career-hero-stat"><span className="career-hero-stat-num">50+</span><span className="career-hero-stat-label">成功案例</span></div>
        </div>
      </div>
      <Tabs defaultActiveKey="internship" items={tabItems} className="career-tabs" size="large" />
    </div>
  );
}

function ConsultationPage({ profile }: { profile: Profile }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: Record<string, string>) {
    setSubmitting(true);
    try {
      await submitConsultationLead(values);
      form.resetFields();
      message.success('提交成功！我们已收到你的咨询意向，将尽快与你联系，请保持手机畅通。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Row gutter={[18, 18]} align="stretch" className="consult-page">
      <Col xs={24} lg={10} className="consult-col">
        <Card className="consult-card">
          <Tag className="consult-badge">1 对 1 成长规划</Tag>
          <Title level={2}>把课程表现、项目经历和未来选择连成一条清晰路径</Title>
          <Paragraph>二十年生涯规划经验，结合你的课程基础、绩点目标、项目经历和家庭背景，拆出可执行的升学、留学、实习与职业发展方案。</Paragraph>
          <div className="consult-feature-list">
            {['定位适合你的升学/留学/就业路径', '梳理课程成绩、项目和简历竞争力', '拆解短期学习计划与长期申请节奏', '给出下一步可执行的行动清单'].map((item) => (
              <div className="consult-feature" key={item}>✓ {item}</div>
            ))}
          </div>
          <div className="consult-process-title">只需三步，即可获得一对一成长规划咨询</div>
          <div className="consult-process">
            {['提交意向', '专业诊断', '规划建议'].map((item, index) => (
              <Fragment key={item}>
                <div className="consult-process-step" key={item}>
                  <span className="consult-process-index">{index + 1}</span>
                  <Text>{item}</Text>
                </div>
                {index < 2 && <span className="consult-process-arrow" aria-hidden="true">→</span>}
              </Fragment>
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={14} className="consult-col">
        <Card
          className="consult-form-card"
          title="提交咨询意向"
          extra={<Text type="secondary" className="consult-form-extra">约 1 分钟完成</Text>}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              name: profile.nickname && profile.nickname !== '未命名同学' ? profile.nickname : undefined,
              contact: profile.phone || undefined,
              school: profile.school || undefined,
              major: profile.major || undefined,
              grade: profile.grade || undefined,
            }}
            onFinish={submit}
          >
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input placeholder="例如：陈小博" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="contact" label="联系方式" rules={[{ required: true }]}><Input placeholder="例如：手机号 / 微信" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="school" label="学校"><Input placeholder="例如：北京邮电大学" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="major" label="专业"><Input placeholder="例如：计算机科学与技术" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="grade" label="年级"><Select placeholder="请选择你所在年级" options={gradeOptions} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="goal" label="咨询方向" rules={[{ required: true, message: '请选择咨询方向' }]}><Select placeholder="请选择所咨询方向" options={['实习与就业', '考研与保研', '留学', '其他'].map((item) => ({ value: item, label: item }))} /></Form.Item></Col>
            </Row>
            <Form.Item name="description" label="当前困惑" rules={[{ required: true, message: '请描述你当前的困惑' }]}><Input.TextArea rows={5} placeholder="描述你目前的学习/升学/就业困惑" /></Form.Item>
            <div className="consult-submit-row">
              <Button type="primary" htmlType="submit" loading={submitting}>提交意向</Button>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}

function AboutPage() {
  return (
    <div className="about-page">
      <Card className="about-hero">
        <Title level={2}>关于我们</Title>
        <Paragraph type="secondary">当前页面内容已清空，等待重新编辑。</Paragraph>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
