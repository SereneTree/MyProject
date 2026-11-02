import { ArrowLeftOutlined, ArrowRightOutlined, BookOutlined, CrownOutlined, DownloadOutlined, FileTextOutlined, FormOutlined, LockOutlined, ProfileOutlined, ReadOutlined, RocketOutlined, SoundOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Collapse, Divider, Empty, Form, Input, Layout, List, Menu, message, Radio, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Timeline, Typography } from 'antd';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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

// 大四课程暂不在前端展示（数据库数据保留，便于后续恢复）；
// 年级筛选中的「大四上 / 大四下」选项仍保留，只是点进去没有课程。
const HIDDEN_COURSE_GRADE_IDS = new Set(['senior_fall', 'senior_spring']);

// 课程置顶：数组顺序即展示顺序，仅在所属年级内部生效（不跨年级前插）
const PINNED_COURSE_IDS = ['data-structure'];

// 返回置顶序号，未置顶的统一排到最后
function pinnedCourseIndex(courseId: string) {
  const index = PINNED_COURSE_IDS.indexOf(courseId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

// 大一上 / 下学期的课程资源尚在整理，进入该范围的课程资源统一盖蒙层提示，不开放具体内容。
const COMING_SOON_COURSE_GRADE_IDS = new Set(['freshman_fall', 'freshman_spring']);
const COMING_SOON_TEXT = '资料整理筹备中，敬请期待哦～';

// 顶部导航为 sticky 固定高度 64px，滚动定位时预留间距避免内容被遮挡
const TOPBAR_OFFSET = 80;

// 顶栏「学习资源」入口默认锚定到大二上的数据结构课程
const DEFAULT_RESOURCE_PATH = '/?grade=sophomore_fall&course=data-structure#resources';

// 已处于资源页且 URL 未变化时，<Link> 不会触发路由变化，这里兜底把资源列滚回视口
function scrollToResourceColumnFallback() {
  if (window.location.hash !== '#resources') return;
  const el = document.querySelector('.cascade-column-main');
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - TOPBAR_OFFSET;
  window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
}

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

// 咨询意向表单按学年粒度选择（大一→大四、研一→研三），不区分上下学期
const consultGradeOptions = [
  { value: 'freshman', label: '大一' },
  { value: 'sophomore', label: '大二' },
  { value: 'junior', label: '大三' },
  { value: 'senior', label: '大四' },
  { value: 'master1', label: '研一' },
  { value: 'master2', label: '研二' },
  { value: 'master3', label: '研三' }
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

  // 所有路由跳转都从页面顶部开始展示（含从卡片点击进入的各专区二级页）；
  // 带 #resources 这类锚点的跳转交给学习资源页自身的锚点滚动逻辑，避免相互覆盖
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);
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
          { key: 'home', label: <Link to={DEFAULT_RESOURCE_PATH} onClick={scrollToResourceColumnFallback}>学习资源</Link> },
          { key: 'career-planning', label: <Link to="/career-planning" onClick={() => window.scrollTo({ top: 0 })}>生涯规划</Link> },
          { key: 'consultation', label: <Link to="/consultation">咨询服务</Link> }
        ]} />
        <HeaderBroadcast />
        <Space className="header-actions" size={10}>
          {/* 仅作状态展示，不再跳转会员页 */}
          <span className={`member-pill member-pill-${memberLevel}`}>
            <CrownOutlined />
            <span>{FREE_OPEN_MODE ? '全站资料免费开放' : memberNames[memberLevel]}</span>
          </span>
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
          <Route path="/career-planning/study-abroad-trends" element={<StudyAbroadTrendPage />} />
          <Route path="/career-planning/study-abroad-tests" element={<StudyAbroadTestPage />} />
          <Route path="/career-planning/study-abroad-updates" element={<StudyAbroadUpdatesPage />} />
          <Route path="/career-planning/tech-articles" element={<TechArticlesPage />} />
          <Route path="/career-planning/application-guide" element={<ApplicationGuidePage />} />
          <Route path="/career-planning/coaching" element={<CoachingPage />} />
          <Route path="/career-planning/followup/:storyId" element={<FollowupStoryPage />} />
          <Route path="/consultation" element={<ConsultationPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Content>
      {/* <Footer className="footer">MVP Demo · 内容用于学习参考和产品验证</Footer> */}
    </Layout>
  );
}

// 顶栏小播报站：数组顺序即滚动顺序，改文案只改这里
const HEADER_BROADCAST_ITEMS = [
  '保研专区将于11月中旬面向全体同学开放',
  '求职岗位实时更新中，有意向请直接咨询～',
  '学习资源区课件&大作业面向全体同学征集，课程资源加油包为你量身打造！'
];

// 顶栏小播报站：文案首尾相接横向滚动，鼠标悬停暂停
function HeaderBroadcast() {
  return (
    <div className="header-broadcast" aria-label="站内播报">
      <span className="header-broadcast-tag">
        <SoundOutlined />
        播报
      </span>
      <div className="header-broadcast-viewport">
        {/* 同一份内容复制两遍，配合 translateX(-50%) 实现无缝衔接 */}
        <div className="header-broadcast-track">
          {[...HEADER_BROADCAST_ITEMS, ...HEADER_BROADCAST_ITEMS].map((text, index) => (
            <span
              className="header-broadcast-item"
              key={`${index}-${text}`}
              aria-hidden={index >= HEADER_BROADCAST_ITEMS.length}
            >{text}</span>
          ))}
        </div>
      </div>
    </div>
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
  const routerLocation = useLocation();
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

  // 右侧「课程资源」列的锚点：左侧课程列表较长，点击下方课程时需上滑把该列拉回视口
  const resourceColumnRef = useRef<HTMLDivElement | null>(null);

  function scrollToResourceColumn() {
    const el = resourceColumnRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - TOPBAR_OFFSET;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  // 从课程资源详情页返回、或从顶栏锚点进入时 URL 带 #resources，直接把课程资源列滚回视口。
  // 课程数据渲染后行高才稳定，故延后一帧再量位置，避免算到布局未完成时的偏移量。
  useEffect(() => {
    if (routerLocation.hash !== '#resources' || courses.length === 0) return;
    const timer = window.setTimeout(() => {
      const el = resourceColumnRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - TOPBAR_OFFSET;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [routerLocation.hash, courses.length]);

  useEffect(() => {
    getHomeResources().then((data) => {
      setGrades(data.grades);
      // 大四课程不在前端展示（数据仍在库中，去掉此处过滤即可恢复）
      setCourses(data.courses.filter((c) => !HIDDEN_COURSE_GRADE_IDS.has(c.gradeId)));
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
      // 3) 同一年级内，置顶课程排到首行（如大二上的数据结构）
      const pinA = pinnedCourseIndex(a.id);
      const pinB = pinnedCourseIndex(b.id);
      if (pinA !== pinB) return pinA - pinB;
      // 4) 其余情况保持后端返回顺序
      return 0;
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

  // 顶栏「学习资源」等入口会带查询参数重新导航，这里把参数同步回选择状态
  useEffect(() => {
    setSelectedGrade(searchParams.get('grade') || undefined);
    setSelectedCourse(searchParams.get('course') || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // 命中大一上/下学期（无论按年级筛选还是点开具体课程）时，课程资源区域整块用蒙层罩住
  const selectedCourseGradeId = selectedCourse
    ? scopedCourses.find((course) => course.id === selectedCourse)?.gradeId
    : undefined;
  const resourceComingSoon = COMING_SOON_COURSE_GRADE_IDS.has(
    (selectedCourse ? selectedCourseGradeId : selectedGrade) || ''
  );

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
                    onClick={() => {
                      setSelectedCourse(course.id);
                      scrollToResourceColumn();
                    }}
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
          <div className="cascade-column cascade-column-main" ref={resourceColumnRef}>
            <div className="cascade-title">
              <span>课程资源</span>
              {selectedCourse && (
                <Button size="small" onClick={() => setSelectedCourse(undefined)}>返回资源总览</Button>
              )}
            </div>

            <div className={resourceComingSoon ? 'resource-coming-soon-wrap' : undefined}>
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
              {/* 大一上/下学期：整块内容加蒙层，锁标志 + 筹备中提示，阻断点击 */}
              {resourceComingSoon && (
                <div className="resource-coming-soon">
                  <LockOutlined />
                  <span>{COMING_SOON_TEXT}</span>
                </div>
              )}
            </div>
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
                      {!isFree && <Tag color={levelColor}>{levelText}</Tag>}
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
      <Button
        type="primary"
        style={{ marginBottom: 16 }}
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/?course=${detail.courseId}#resources`)}
      >
        返回学习资源
      </Button>
      <Card className="detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <Space direction="vertical" size={8} style={{ flex: 1, minWidth: 0 }}>
            <Space wrap>
              <Tag color="geekblue">{detail.gradeName}</Tag>
              <Tag>{detail.courseName}</Tag>
              <Tag color="purple">{meta.label}</Tag>
              {/* 免费资源不显示等级标签，仅付费等级保留提示 */}
              {detail.requiredLevel !== 'free' && <Tag color={levelTagColor}>{levelText}</Tag>}
              {detail.locked && <Tag icon={<LockOutlined />} color="default">需升级</Tag>}
            </Space>
            <Title>{detail.title}</Title>
            {detail.summary && <Paragraph>{detail.summary}</Paragraph>}
          </Space>
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
        setMajorCourses(res.data.courses.filter((c) => !HIDDEN_COURSE_GRADE_IDS.has(c.gradeId)));
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

/* 大厂申请全流程二级页面：春/秋招 · 日常实习 · 个人评估 */
/* 春/秋招补充数据：秋招时间轴 / 定薪体系 / 大厂薪资 / 春秋对比 */
const autumnTimelineData = [
  { period: '5月 - 7月', stage: '提前批', actions: '免笔试或流程极快，不占用正式秋招名额（挂了不影响投正式批），主要抢夺人才。BAT 等大厂通常在 6 月底前开放。' },
  { period: '8月 - 9月', stage: '正式批', actions: '全面开放，HC 最多。8 月是网申和笔试的高峰，9 月是面试高峰。“金九银十”现在变成了“金八银九”。' },
  { period: '10月 - 11月', stage: 'Offer 发放与逼签', actions: '密集发 Offer，同时伴随“逼签”（给你 3-7 天时间考虑，接受Offer或者超时作废）。部分同学开始毁约释放 HC。' },
  { period: '12月 - 次年2月', stage: '秋招补录', actions: '竞争依然激烈，但岗位质量不如 8-9 月。' },
];

const offerLevelData = [
  { level: '🥬', meaning: '标准 Offer，满足基本要求', ratio: '60%-70%', diff: '基准线' },
  { level: 'SP (Special Offer)', meaning: '优秀候选人，面试评价高', ratio: '20%-30%', diff: '比🥬高 2k-5k/月，或签字费更高' },
  { level: 'SSP (Super SP)', meaning: '顶尖人才（名校/优质论文/竞赛获奖）', ratio: '5%以内', diff: '比 SP 更高，常有股票/期权，专属培养计划' },
];

const campusSalaryData = [
  { company: '字节跳动', base: '24k - 40k+', bonus: '3个月（即15薪）', total: '36W - 60W+', note: 'Base 极高，大小周取消后性价比提升；房补 1500/月。' },
  { company: '腾讯', base: '22k - 35k+', bonus: '因部门而异（通常3-5个月）', total: '35W - 60W+', note: '微信/IEG 核心部门总包极高；福利好（安居计划等）。' },
  { company: '阿里巴巴', base: '22k - 35k+', bonus: '通常3个月（16薪）', total: '35W - 55W+', note: 'P5 定级；近年总包略有缩水，但公积金比例高。' },
  { company: '美团', base: '22k - 32k+', bonus: '3.5个月', total: '33W - 50W+', note: '薪资结构稳定，到店/到家核心部门待遇好。' },
  { company: '拼多多', base: '30k - 45k+', bonus: '视绩效而定', total: '50W - 80W+', note: '绝对高薪天花板，但对应的是硬核加班（11-11-6）。' },
  { company: '快手', base: '24k - 35k+', bonus: '4个月（16薪）', total: '38W - 55W+', note: '房补 2000/月，免费三餐，整体性价比高。' },
  { company: '小红书', base: '25k - 38k+', bonus: '3-4个月', total: '38W - 60W+', note: '近年涨薪猛，抢人凶狠，对标字节/快手。' },
  { company: '华为', base: '20k - 35k+', bonus: '绩效导向（浮动极大）', total: '30W - 60W+', note: '13-15 级定级；底薪不算最高，但分红/年终奖上限极高。' },
];

function CampusRecruitTab() {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="校招时间线：秋招提前批 6-7月 → 秋招正式批 8-10月 → 春招 3-5月"
        description="提前批与正式批互不影响，秋招名额远多于春招，建议以秋招为主战场、春招作为补录与二次冲刺机会。"
      />
      <Card className="career-resource-card" title="五步走完整流程" style={{ marginBottom: 16 }}>
        <Timeline
          items={[
            { color: 'green', children: <><Text strong>① 网申投递</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>官网/校招公众号/内推码多渠道投递；提前批多免笔试直通面试，内推简历可被优先捞取。同一集团下多家子公司可分别投递，互不影响。</Paragraph></> },
            { color: 'green', children: <><Text strong>② 笔试测评</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>投递后 1-2 周内触发，一般为算法题 + 行测 + 性格测评；技术岗重点刷 LeetCode Hot 100 与历年真题（牛客网），性格测评如实作答、避免极端选项。</Paragraph></> },
            { color: 'blue', children: <><Text strong>③ 技术面（2-3 轮）</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>一、二面深挖项目与系统设计，考察基础知识与手撕算法，交叉面考察技术广度与潜力；每轮结束后主动复盘，补齐暴露的短板。</Paragraph></> },
            { color: 'blue', children: <><Text strong>④ HR 面</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>考察职业规划、稳定性与价值观匹配；提前准备好“为什么选择我们”与城市、岗位方向的取舍理由，薪资意向可表达开放态度。</Paragraph></> },
            { color: 'orange', children: <><Text strong>⑤ Offer 与签约</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>意向书 → 三方协议 → 入职；注意三方违约金条款与两家 Offer 的时间差博弈，校招 Offer 一般会明确薪资与入职部门。</Paragraph></> },
          ]}
        />
      </Card>
      <Card className="career-resource-card" title="📅 秋招完整时间轴（以次年 6 月毕业为例）" style={{ marginBottom: 16 }} size="small">
        <Paragraph type="secondary">大厂的校招早就不是“毕业那年才找工作”，而是<strong>提前一年甚至一年半</strong>开始。</Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="stage"
          dataSource={autumnTimelineData}
          columns={[
            { title: '时间段', dataIndex: 'period', width: 120 },
            { title: '阶段名称', dataIndex: 'stage', width: 180 },
            { title: '核心动作与特点', dataIndex: 'actions' },
          ]}
        />
      </Card>
      <Card className="career-resource-card" title="💰 薪资待遇信息（SP/SSP 体系）" style={{ marginBottom: 16 }} size="small">
        <Text strong>🏷️ 职级与定薪体系（🥬、SP、SSP）</Text>
        <Paragraph type="secondary" style={{ marginBottom: 8, marginTop: 4 }}>大厂根据面试表现将候选人分级，薪资差异巨大：</Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="level"
          dataSource={offerLevelData}
          columns={[
            { title: '评级', dataIndex: 'level', width: 160 },
            { title: '含义', dataIndex: 'meaning', width: 260 },
            { title: '占比', dataIndex: 'ratio', width: 100 },
            { title: '薪资差异', dataIndex: 'diff' },
          ]}
        />
        <Divider style={{ margin: '22px 0' }} />
        <Text strong>💼 头部大厂薪资参考范围（2024-2025 届行情）</Text>
        <Alert
          type="warning"
          showIcon
          style={{ margin: '8px 0' }}
          message="注：以下为技术岗（研发/算法）的大致月薪范围，非技术岗（产品/运营）通常为技术岗的 70%-85% 左右。具体随年份和公司业绩波动。"
        />
        <Table
          size="small"
          pagination={false}
          rowKey="company"
          scroll={{ x: 860 }}
          dataSource={campusSalaryData}
          columns={[
            { title: '公司', dataIndex: 'company', width: 100, fixed: 'left' },
            { title: '技术岗月薪范围 (RMB)', dataIndex: 'base', width: 150 },
            { title: '年终奖月数', dataIndex: 'bonus', width: 190 },
            { title: '年总包预估（🥬-SSP）', dataIndex: 'total', width: 180 },
            { title: '薪资结构与特色', dataIndex: 'note' },
          ]}
        />
        <Divider style={{ margin: '22px 0' }} />
        <Text strong>🎁 隐性收入与福利</Text>
        <div style={detailGroupStyle}>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>签字费：</Text>为了抢 SSP 或防止你被竞品挖走，一次性发放 3W - 10W 不等。</Paragraph>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>股票/期权：</Text>腾讯、字节对 SSP 可能会配股/期权，分 4 年归属，这是拉开总包差距的核心。</Paragraph>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>公积金：</Text>注意缴纳基数和比例。比如北京有些厂按全额工资 12% 交，有些按最低基数交，差距极大。</Paragraph>
          <Paragraph style={{ marginBottom: 0 }}><Text strong>搬家费/安家费：</Text>部分大厂提供 5000 - 15000 元的一次性异地入职补贴。</Paragraph>
        </div>
      </Card>
      <Card className="career-resource-card" title="⚠️ 核心注意事项与避坑指南" style={{ marginBottom: 16 }} size="small">
        <Collapse
          items={[
            { key: 'apply', label: <Text strong>1. 简历与投递策略</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>不要海投同一个公司的所有岗位：</Text>大厂的招聘管理系统会自动查重。如果你同时投了字节的产品和运营，大概率两个都会被锁死。精准投递。</Paragraph>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>内推 &gt; 官网直投：</Text>找学长学姐或在牛客网找内部员工内推。内推不仅能免去部分笔试，更重要的是能追踪进度，避免简历石沉大海。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>警惕“池子”：</Text>面试通过后不发 Offer，而是把你放进“人才池”排序。如果 HC 满了或者有更优的人，你会在池子里泡几个月后被捞起或挂掉。</Paragraph>
              </div>
            ) },
            { key: 'exam', label: <Text strong>2. 笔试与面试准备</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>手撕代码（技术岗）：</Text>LeetCode Medium 是底线。不仅要写出来，还要讲清楚时间/空间复杂度。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>业务 Sense（非技术岗）：</Text>产品经理面试必问“拆解一款 App”或“设计一个功能”。不要只谈体验，要谈商业模式、ROI、数据指标。</Paragraph>
              </div>
            ) },
            { key: 'sign', label: <Text strong>3. “逼签”与“毁约”博弈</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>逼签应对：</Text>当你拿到 A 厂 Offer（要求 3 天内签），但你还在等 B 厂时：</Paragraph>
                <Paragraph style={{ marginBottom: 2 }}>① 拖延战术：诚恳地向 HR 表示需要和家人商量，争取延期 1-2 周。</Paragraph>
                <Paragraph style={{ marginBottom: 2 }}>② 催熟战术：拿着 A 厂的 Offer 去联系 B 厂的 HR，说明情况，请求加速流程（B 厂如果想要你，通常会加速）。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>三方协议与违约金：</Text>签了三方协议后想毁约去更好的厂，通常需要交违约金（一般 5000 - 8000 元）。这笔钱该交就交，不要心疼，但要注意原学校发新三方的时间差，别导致两头空。</Paragraph>
              </div>
            ) },
            { key: 'dept', label: <Text strong>4. 部门选择大于公司选择</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>核心盈利部门 vs 边缘创新部门：</Text>同样是腾讯，微信/WXG 和某个不知名创新业务的体验天差地别。边缘部门随时可能被整个裁撤。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>如何调研：</Text>面试反问环节一定要问：“团队目前的 OKR 是什么？”、“这个岗位是新增还是替补？”。去脉脉搜该部门的口碑。</Paragraph>
              </div>
            ) },
            { key: 'edu', label: <Text strong>5. 学历与背景的残酷现实</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>简历筛选器：</Text>头部大厂的技术岗基本默认 985/211 或海外 QS 前 100 起步。如果是双非院校，必须有极其亮眼的经历（如 ACM 金牌、顶级开源项目核心贡献者、大厂长期实习经历）才能破局。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>实习经历权重：</Text>一段对口的大厂日常实习/暑期实习，抵得上你在学校的十个水项目。</Paragraph>
              </div>
            ) },
          ]}
        />
      </Card>
    </div>
  );
}

/* 日常实习补充数据：全年时间轴 / 大厂日薪基准 / 投递渠道 */
const internTimelineData = [
  { period: '2月 - 4月', heat: '🔥🔥🔥🔥', reason: '春季旺季。年后部分员工跳槽腾出 HC；暑期实习生还没入职，业务线缺人干杂活；很多同学找暑期实习前会先找个日常实习过渡。' },
  { period: '5月 - 6月', heat: '🔥🔥', reason: '相对平稳。此时暑期实习生即将入职，部分团队的日常实习 HC 会被压缩。' },
  { period: '7月 - 8月', heat: '🔥🔥🔥🔥🔥', reason: '暑期巅峰。大量在校生放假，全职可实习；同时很多暑期实习生在准备答辩/转正，团队需要额外人手分担压力。' },
  { period: '9月 - 10月', heat: '🔥🔥🔥', reason: '秋季小高峰。秋招开启，大三/研二学生面临抉择；部分拿到秋招 Offer 的同学开始找日常实习“试岗”。' },
  { period: '11月 - 12月', heat: '🔥🔥', reason: '临近年底，各厂锁 HC 冲财报，招聘放缓。但会有年前离职潮带来的捡漏机会。' },
  { period: '1月', heat: '🔥', reason: '寒假前夕，需求较少，多为急招替补。' },
];

const internSalaryData = [
  { company: '字节跳动', tech: '400 - 600+', prod: '300 - 400', func: '200 - 300', note: '业内顶薪之一。包三餐，下午茶，无房补但有免费健身房。' },
  { company: '腾讯', tech: '300 - 500', prod: '200 - 300', func: '150 - 250', note: '深圳总部有班车和食堂补贴。微信/QQ 等核心 BG 待遇可能略高。' },
  { company: '阿里巴巴', tech: '300 - 500', prod: '200 - 350', func: '150 - 250', note: '园区食堂好吃且便宜，部分部门有打车报销。' },
  { company: '美团', tech: '300 - 450', prod: '200 - 300', func: '150 - 200', note: '晚 7 点后包晚餐，加班文化较重，但给钱痛快。' },
  { company: '快手', tech: '350 - 500', prod: '250 - 350', func: '200 - 250', note: '薪资对标字节，房补较高（北京通常 1500-2000/月）。' },
  { company: '百度', tech: '300 - 400', prod: '200 - 300', func: '150 - 200', note: '食堂不错，整体性价比尚可。' },
  { company: '京东', tech: '250 - 400', prod: '150 - 250', func: '120 - 200', note: '亦庄总部有免费班车。' },
  { company: '小红书', tech: '300 - 500', prod: '250 - 400', func: '200 - 300', note: '近年待遇提升快，包三餐，氛围较年轻。' },
  { company: '拼多多', tech: '400 - 600+', prod: '300 - 400+', func: '250 - 300+', note: '绝对高薪，但对应的是极长的工作时间（11-11-6 常态）。' },
];

const internChannelData = [
  { channel: '内部员工内推', level: '⭐⭐⭐⭐⭐', tip: '成功率最高。通过学长学姐、脉脉、领英找到目标部门员工，直接递简历。' },
  { channel: '牛客网 / 实习僧', level: '⭐⭐⭐⭐⭐', tip: '最集中的日常实习发布地。牛客网的“讨论区”常有员工直招内推帖，回复极快。' },
  { channel: 'Boss直聘', level: '⭐⭐⭐⭐', tip: '可以直接和业务 Leader 或 HR 开聊。适合搜“日常实习”、“急招”关键词。' },
  { channel: '微信公众号/社群', level: '⭐⭐⭐⭐', tip: '关注“互联派”、“刺猬实习”、“校招日历”等，以及各大厂的官方招聘号（如“字节跳动招聘”）。' },
  { channel: '大厂官网', level: '⭐⭐⭐', tip: '流程最正规，但反馈最慢。日常实习在官网容易被淹没。' },
];

const emphasisTextStyle = { color: 'rgba(0, 0, 0, 0.65)' };

// 卡片内「小标题 + 细节说明」的细节段落统一左缩进，避免与标题齐平
const detailGroupStyle = { paddingLeft: 16, marginTop: 8 };

function DailyInternTab() {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="日常实习全年滚动招聘、随投随面，是低年级同学积累大厂经历的首选入口"
        description="与校招不同，日常实习不占用校招名额，面试难度略低、流程更快，表现优秀可在秋招中拿到转正/优先录取资格。"
      />
      <Card className="career-resource-card" title="五步走完整流程" style={{ marginBottom: 16 }}>
        <Timeline
          items={[
            { color: 'green', children: <><Text strong>① 目标定位</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>先定方向（技术/产品/运营）与城市，再评估可实习时长：<Text strong style={emphasisTextStyle}>建议 3 个月以上、每周 4-5 天 on-site</Text>，这是大部分 JD 的硬门槛。</Paragraph></> },
            { color: 'green', children: <><Text strong>② 简历打磨</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}><Text strong style={emphasisTextStyle}>一页纸原则，项目经历用“背景-动作-量化结果”描述</Text>，技术栈和背景与目标 JD 对齐；无大厂经历时突出课程项目、竞赛与开源贡献。</Paragraph></> },
            { color: 'blue', children: <><Text strong>③ 投递渠道</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>优先级：<Text style={{ color: '#b8860b', fontWeight: 600 }}><CrownOutlined style={{ marginRight: 4 }} />学长姐/导师内推</Text> → 官网/公众号 → BOSS直聘/实习僧；内推可直达招聘群，简历响应速度最快。</Paragraph></> },
            { color: 'blue', children: <><Text strong>④ 面试（2-3 轮）</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}><Text strong style={emphasisTextStyle}>通常 2-3 轮专业面 + 1 轮mentor/HR 面</Text>，一般一周内可走完；实习面试更看重基础扎实度、学习潜力与到岗时间。</Paragraph></> },
            { color: 'orange', children: <><Text strong>⑤ 入职与转正</Text><Paragraph type="secondary" style={{ marginBottom: 0 }}>入职后跟 mentor 定期对齐目标，争取独立负责模块；<Text strong style={emphasisTextStyle}>实习 2-3 个月后可主动沟通留用意向</Text>，秋招走转正绿色通道。</Paragraph></> },
          ]}
        />
      </Card>
      <Card className="career-resource-card" title="📅 全年时间轴与招聘热度" style={{ marginBottom: 16 }} size="small">
        <Paragraph type="secondary">日常实习没有统一的时间表，全年滚动招聘，但受业务周期和学校假期影响，有明显的淡旺季。</Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="period"
          dataSource={internTimelineData}
          columns={[
            { title: '时间段', dataIndex: 'period', width: 110 },
            { title: '招聘热度', dataIndex: 'heat', width: 130 },
            { title: '原因分析', dataIndex: 'reason' },
          ]}
        />
        <Divider style={{ margin: '22px 0' }} />
        <Text strong>⏳ 时长与到岗要求</Text>
        <div style={detailGroupStyle}>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>硬性规定：</Text>绝大多数大厂要求至少实习 3 个月，更青睐能实习 4-6 个月的候选人。</Paragraph>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>出勤天数：</Text>通常要求每周到岗 4-5 天（全勤优先）。如果只能一周去 2-3 天，简历通过率极低。</Paragraph>
          <Paragraph style={{ marginBottom: 0 }}><Text strong>到岗速度：</Text>日常实习通常是“急招”，面试官常问“最快什么时候能入职？”，能在面试通过后 1-2 周内到岗是巨大加分项。</Paragraph>
        </div>
      </Card>
      <Card className="career-resource-card" title="💰 薪资待遇速查（2023-2024 年市场行情）" style={{ marginBottom: 16 }} size="small">
        <Paragraph type="secondary">薪资结构：日薪 × 出勤天数 + 房补/餐补；不享受正式员工的年终奖、股票和完整福利。</Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="company"
          scroll={{ x: 760 }}
          dataSource={internSalaryData}
          columns={[
            { title: '公司', dataIndex: 'company', width: 90, fixed: 'left' },
            { title: '技术/算法类（RMB/天）', dataIndex: 'tech', width: 150 },
            { title: '产品/运营/设计类（RMB/天）', dataIndex: 'prod', width: 170 },
            { title: '职能类（HR/财务等）', dataIndex: 'func', width: 150 },
            { title: '备注说明', dataIndex: 'note' },
          ]}
        />
        <Divider style={{ margin: '22px 0' }} />
        <Text strong>🎁 隐性福利与补贴（重点关注）</Text>
        <div style={detailGroupStyle}>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>房补（异地实习的核心）：</Text>快手、小红书、B 站等通常有 1500-2000 元/月的房补；腾讯、阿里部分城市有合作公寓或租房补贴；注意字节和拼多多部分岗位反而没有直接房补，需提前问清 HR。</Paragraph>
          <Paragraph style={{ marginBottom: 2 }}><Text strong>餐饮：</Text>字节、快手、小红书等包三餐（相当于每天省下 80-100 元）；腾讯、阿里通常是发餐补到工卡里。</Paragraph>
          <Paragraph style={{ marginBottom: 0 }}><Text strong>交通：</Text>晚上加班到一定时间（如 21:30 或 22:00 后）打车全额报销。</Paragraph>
        </div>
        <Text strong style={{ display: 'inline-block', marginTop: 12 }}>🧮 算一笔账（以北京字节产品实习为例）</Text>
        <div style={detailGroupStyle}>
          <Paragraph style={{ marginBottom: 2 }}>日薪 300 元 × 22 天 = 6600 元；扣除五险一金/个税（实习劳务报酬税率较高，通常按 20% 预扣，次年汇算清缴退税）到手约 5500 元；加房补（如有）1500 元。</Paragraph>
          <Paragraph style={{ marginBottom: 0 }}><Text strong>实际月到手预期：6000 - 7500 元左右</Text>（足以覆盖一线城市基本生活成本）。</Paragraph>
        </div>
      </Card>
      <Card className="career-resource-card" title="🎯 投递渠道与信息差" style={{ marginBottom: 16 }} size="small">
        <Paragraph type="secondary">不要只盯着官网，日常实习讲究“快”和“精准”。</Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="channel"
          dataSource={internChannelData}
          columns={[
            { title: '渠道', dataIndex: 'channel', width: 150 },
            { title: '优先级', dataIndex: 'level', width: 130 },
            { title: '特点与操作建议', dataIndex: 'tip' },
          ]}
        />
      </Card>
      <Card className="career-resource-card" title="⚠️ 核心注意事项与避坑指南" size="small">
        <Collapse
          items={[
            { key: 'school', label: <Text strong>1. 学校与学业的平衡（红线问题）</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>导师/辅导员态度：</Text>研一/研二学生必须搞定导师。如果导师不放人，千万别强行旷课去实习，一旦被发现可能被开除或延毕。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>期末考试：</Text>入职前务必确认考试周时间，提前和 Leader 沟通请假。大厂对实习生请假通常比较宽容，但不能玩消失。</Paragraph>
              </div>
            ) },
            { key: 'chores', label: <Text strong>2. 警惕“打杂陷阱”</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>现象：</Text>进去后发现每天都在贴发票、拉数据跑 SQL、做毫无营养的竞品截图。</Paragraph>
                <Paragraph style={{ marginBottom: 4 }}><Text strong>应对：</Text>前两周熟悉业务打杂是正常的。但如果一个月后依然如此，你需要主动向上管理：</Paragraph>
                <Paragraph style={{ marginBottom: 2 }}>① 整理你打杂中发现的业务问题，写一份分析报告给 Leader。</Paragraph>
                <Paragraph style={{ marginBottom: 2 }}>② 主动请缨：“Leader，我最近把手头的数据梳理完了，看到咱们在做 X 项目，我能帮忙承担 Y 模块吗？”</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>③ 如果实在学不到东西，果断止损离职，不要为了一个大厂 Title 浪费半年青春。</Paragraph>
              </div>
            ) },
            { key: 'nda', label: <Text strong>3. 竞业协议与保密红线</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}><Text strong>绝对红线：</Text>严禁将公司的代码、内部文档、未上线的产品截图发到个人电脑、GitHub 或社交媒体上。哪怕是一张带有内部水印的飞书/钉钉截图，都可能导致你被开除甚至面临法律诉讼。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>竞业限制：</Text>极少数核心算法岗的日常实习生可能会被要求签竞业协议（离职后几个月不能去竞品），签之前一定要看清条款。一般产品/运营岗不涉及。</Paragraph>
              </div>
            ) },
            { key: 'tax', label: <Text strong>4. 税务问题（劳务报酬）</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}>实习生的工资在法律上属于<strong>“劳务报酬”</strong>，而非“工资薪金”。单次收入超过 800 元的部分，企业会按 20%~40% 的税率预扣预缴个人所得税。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}><Text strong>重点：不要慌！</Text>次年 3-6 月进行个人所得税综合所得汇算清缴时，因为你的年总收入通常达不到高税率标准，多扣的税会全额退还给你（在“个人所得税”App 上操作即可）。</Paragraph>
              </div>
            ) },
            { key: 'extra', label: <Text strong>5. 其他提醒</Text>, children: (
              <div>
                <Paragraph style={{ marginBottom: 2 }}>入职前确认薪资结构（日薪/月薪、餐补房补）与转正机制，口头承诺尽量落实到邮件或 Offer 文件。</Paragraph>
                <Paragraph style={{ marginBottom: 2 }}>警惕“付费内推”与包装简历的中介，正规内推均不收费。</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>远程实习需确认可否开具实习证明与背调背书，部分学校要求证明材料才能算实践学分。</Paragraph>
              </div>
            ) },
          ]}
        />
      </Card>
    </div>
  );
}

/* 六类岗位画像拆解数据（个人评估参照） */
interface JobProfile {
  icon: string;
  name: string;
  scope: string;
  knowledge: { label: string; text: string[] }[];
  personality: string[];
  interests: string[];
}

const jobProfileData: JobProfile[] = [
  {
    icon: '💻',
    name: '技术岗',
    scope: '研发/算法/测试/运维',
    knowledge: [
      { label: '硬基础', text: ['数据结构与算法（LeetCode Medium/Hard 级别是敲门砖）、计算机网络、操作系统、数据库原理。'] },
      { label: '语言与框架', text: ['字节：极度偏爱 Go、C++、Python，强调高并发、微服务架构。', '腾讯：C++（游戏/底层）、Java（后台）、前端生态，注重系统稳定性和海量用户处理。', '阿里：Java 绝对主导（Spring Cloud/Dubbo 生态），熟悉分布式中间件（RocketMQ、Redis 等）。'] },
      { label: '业务理解', text: ['不仅会写代码，还要懂业务逻辑。大厂现在不招纯“代码机器”，要求具备系统设计和架构思维。'] },
    ],
    personality: ['务实、抗压、极客精神、拥抱变化。', '字节喜欢“自驱力强、不设边界”的人（经常需要跨栈解决问题）。', '阿里喜欢“皮实、乐观、聪明”的人（能扛住高压和频繁的组织调整）。', '腾讯相对温和，偏好“专注、沉稳、追求极致”的技术匠人。'],
    interests: ['热衷于逛 GitHub、Stack Overflow；关注新技术（如大模型、云原生）并有实际动手经验；喜欢用技术手段解决生活或工作中的效率问题。'],
  },
  {
    icon: '📋',
    name: '产品岗',
    scope: '产品经理 PM',
    knowledge: [
      { label: '通用技能', text: ['需求分析、竞品分析、原型设计（Axure/Figma）、PRD 撰写、项目管理。'] },
      { label: '差异化侧重', text: ['腾讯（产品为王）：极度看重同理心和用户体验。要求懂心理学、交互设计，能洞察人性（如张小龙式的产品哲学）。', '字节（数据驱动）：看重 ROI 意识和增长黑客能力。要求精通 A/B Test，懂数据分析，以指标（留存、DAU、转化率）为导向。', '阿里（商业闭环）：看重商业嗅觉和复杂系统抽象能力。B 端产品多，要求懂行业 Know-how（电商、供应链、SaaS），能把复杂的业务流转化为产品逻辑。'] },
    ],
    personality: ['强沟通、高逆商、逻辑严密、强势但不固执。', '产品经理是无授权领导，必须靠逻辑和影响力推动研发和设计。', '字节/阿里需要极强的执行力和结果导向；腾讯更看重对产品品味的坚持。'],
    interests: ['重度互联网用户，手机里装满各种 App 并喜欢拆解其逻辑；关注商业模式、社会趋势、心理学；喜欢玩剧本杀、策略类游戏（锻炼逻辑和全局观）。'],
  },
  {
    icon: '📊',
    name: '数据岗',
    scope: '数据分析/数据科学/数据工程',
    knowledge: [
      { label: '硬技能', text: ['SQL（必须精通到性能优化级别）、Python/R、统计学基础、机器学习算法（数科岗）。'] },
      { label: '工具栈', text: ['Hadoop/Spark 生态、Tableau/PowerBI、Hive 等。'] },
      { label: '业务 Sense（最核心）', text: ['大厂不缺会跑 SQL 的“取数机”，缺的是能通过数据发现业务问题并提出策略的人。', '需要懂指标体系搭建（OSM 模型、AARRR 模型），懂归因分析。', '字节的数据岗权力极大，直接决定产品走向；阿里的数据岗偏重商业化和供应链效率优化。'] },
    ],
    personality: ['严谨、客观、好奇心强、敢于质疑。', '面对业务方的不合理需求，能用数据说“不”。', '具备批判性思维，不盲信表面数据（懂辛普森悖论等统计陷阱）。'],
    interests: ['对数字敏感，喜欢看财报、行业研报；热衷于 Kaggle 等数据竞赛；喜欢玩数独、逻辑推理游戏；对“为什么”有强烈的探究欲。'],
  },
  {
    icon: '🎨',
    name: '设计岗',
    scope: 'UI/UX/交互/视觉/用研',
    knowledge: [
      { label: '专业基础', text: ['排版、色彩理论、动效设计、3D 建模、Figma/Sketch/PS/AE 精通。'] },
      { label: '进阶能力（大厂分水岭）', text: ['懂业务：设计不是纯艺术表达，而是解决商业问题。要知道你的设计如何提升点击率/转化率。', '懂规范：能参与构建和维护 Design System（设计系统），保证大型团队协同的一致性。'] },
      { label: '差异化侧重', text: ['腾讯的设计中心（ISUX/CDC）在业界顶尖，极度看重审美和细节；字节看重“快”和“数据验证设计”；阿里看重“营销感”和“B 端复杂界面的秩序感”。'] },
    ],
    personality: ['敏锐、包容、有主见但不自我、善于共情。', '能承受产品和开发的反复修改（心态好）。', '能用理性的语言向非设计人员解释“为什么这么设计”（讲故事的能力）。'],
    interests: ['热爱生活和美学，看展、摄影、建筑、时尚；关注 Behance/Dribbble/Pinterest；喜欢研究各种 App 的交互动画；对新鲜事物（如 AI 生成艺术 Midjourney）保持高度敏感。'],
  },
  {
    icon: '📣',
    name: '运营岗',
    scope: '用户/内容/活动/商家/类目运营',
    knowledge: [
      { label: '通用技能', text: ['文案策划、活动 SOP 制定、社群管理、资源统筹。'] },
      { label: '差异化侧重', text: ['阿里（运营是灵魂）：阿里的运营体系最庞大、最精细。要求懂商家生态、懂供应链、懂大促节奏（双11）。强调“拿结果”的能力和极强的资源整合能力。', '字节（内容与增长）：偏向内容生态运营和增长运营。要求懂推荐算法逻辑，知道如何通过标签、流量池机制把内容分发出去。', '腾讯（生态与用户）：偏向社区氛围维护、IP 联动、私域流量运营。要求懂用户心理，擅长做长线的情感连接。'] },
    ],
    personality: ['外向、接地气、执行力爆表、八面玲珑、厚脸皮。', '运营是打杂+统筹的结合体，需要极强的多线程工作能力和抗挫折能力。', '阿里特别看重“又猛又持久”的韧性。'],
    interests: ['重度网民，混迹各大论坛/贴吧/小红书/豆瓣，懂网络梗；喜欢组织线下聚会或线上活动；对热点事件极其敏感，能迅速借势营销。'],
  },
  {
    icon: '🤝',
    name: '销售岗',
    scope: 'ToB 大客户/商业化广告/BD',
    knowledge: [
      { label: '专业知识', text: ['顾问式销售方法论（SPIN、挑战者销售）、招投标流程、合同法务基础。'] },
      { label: '行业 Know-how', text: ['卖云服务要懂 IT 架构，卖广告要懂营销漏斗，卖 SaaS 要懂企业管理。'] },
      { label: '差异化侧重', text: ['阿里（中供铁军基因）：中国 ToB 销售的黄埔军校。要求极强的陌拜能力、抗压能力、客户分层管理能力。不仅要卖东西，还要“赋能”客户。', '腾讯（生态型销售）：更多是卖解决方案和生态合作。要求具备较高的商务谈判素养，善于利用腾讯的微信/QQ 生态作为筹码。', '字节（巨量引擎商业化）：广告销售为主。要求极度懂流量变现逻辑、ROI 计算，能用数据说服广告主持续投流。'] },
    ],
    personality: ['极度渴望成功（狼性）、高情商、抗挫折能力极强、利他思维。', '不能只是“能说会道”，大厂销售更看重“结构化思考”和“建立信任”的能力。', '阿里的销售面试常通过压力测试考察候选人的“心力”。'],
    interests: ['喜欢与人打交道，享受搞定困难客户的成就感；关注宏观经济、各行业商业模式；喜欢竞技类运动（胜负欲强）。'],
  },
];

function JobProfileSection() {
  return (
    <Card
      className="career-resource-card"
      title="🧭 六类岗位画像拆解（对照自评，找到最适合你的方向）"
      style={{ marginBottom: 16 }}
    >
      <Collapse
        items={jobProfileData.map((job) => ({
          key: job.name,
          label: (
            <span>
              {job.icon} <Text strong>{job.name}</Text>
              <Text type="secondary">（{job.scope}）</Text>
            </span>
          ),
          children: (
            <div>
              <Text strong>📚 知识储备要求</Text>
              <div style={{ marginTop: 8 }}>
                {job.knowledge.map((k) => (
                  <div key={k.label} style={{ marginBottom: 10 }}>
                    <Tag color="blue" style={{ marginBottom: 4 }}>{k.label}</Tag>
                    {k.text.map((line) => (
                      <Paragraph key={line} type="secondary" style={{ marginBottom: 2 }}>{line}</Paragraph>
                    ))}
                  </div>
                ))}
              </div>
              <Divider style={{ margin: '22px 0' }} />
              <Text strong>💼 性格画像</Text>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                {job.personality.map((p) => (
                  <li key={p}><Paragraph type="secondary" style={{ marginBottom: 2 }}>{p}</Paragraph></li>
                ))}
              </ul>
              <Text strong>❤️ 兴趣信号</Text>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                {job.interests.map((i) => (
                  <li key={i}><Paragraph type="secondary" style={{ marginBottom: 2 }}>{i}</Paragraph></li>
                ))}
              </ul>
            </div>
          ),
        }))}
      />
    </Card>
  );
}

function SelfAssessmentTab() {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="投递前先完成个人评估：对照六类岗位画像，找到最适合自己的方向"
        description="评估的目的是把有限精力投入到性价比最高的方向上，避免海投带来的时间与信心损耗。"
      />
      <JobProfileSection />
      <Card className="career-resource-card" title="行动建议" size="small">
        <Paragraph style={{ marginBottom: 4 }}>1. 每两周做一次模拟面（同学互面或 AI 面试工具），用录音复盘表达与知识盲区。</Paragraph>
        <Paragraph style={{ marginBottom: 4 }}>2. 按“冲刺:匹配:保底 ≈ 2:5:3”的比例分配投递精力，冲刺层靠内推提高简历通过率。</Paragraph>
        <Paragraph style={{ marginBottom: 0 }}>3. 每轮面试后 24h 内复盘，把新暴露的题目录入个人题库并在一周内补齐。</Paragraph>
      </Card>
    </div>
  );
}

function ApplicationGuidePage() {
  const navigate = useNavigate();
  return (
    <div className="career-planning-page">
      <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning')}>← 返回求职专区</Button>
      <div className="career-hero">
        <div className="career-hero-badge">🚀 求职专区 · 申请全流程</div>
        <Title level={2}>大厂申请<span className="career-hero-highlight">全流程</span></Title>
        <Paragraph>从面试准备、简历投递到 Offer 接收的完整链路，含个人评估、时间节点与注意事项</Paragraph>
      </div>
      <Tabs
        defaultActiveKey="campus"
        size="large"
        items={[
          { key: 'campus', label: '校招', children: <CampusRecruitTab /> },
          { key: 'internship', label: '日常实习', children: <DailyInternTab /> },
          { key: 'assessment', label: '个人评估', children: <SelfAssessmentTab /> },
        ]}
      />
    </div>
  );
}

type CoachingStep = { title: string; detail: string; color: string; bullets?: string[] };

// 师资力量：一位导师 = 头部（姓名/角色/学历）+ 一句背景 + 经历与 Offer 分组
// 经历与 Offer 统一用 label/value 二元组，方便后续追加导师
type CoachingMentorRow = { label: string; value: string };
type CoachingMentor = {
  name: string;
  role: string;
  education: string;
  summary: string;
  expertise?: string[];
  experiences: CoachingMentorRow[];
  offers: CoachingMentorRow[];
};

// 能力地图：无配图方向（商科）用它替代研发方向的 AI 知识体系卡
type CoachingSkill = { title: string; desc: string };

type CoachingTrack = {
  key: string;
  label: string;
  steps: CoachingStep[];
  stepsTitle?: string;
  origin?: string;
  pains?: string[];
  reliefText?: string;
  mentors?: CoachingMentor[];
  skillsTitle?: string;
  skillsIntro?: string;
  skills?: CoachingSkill[];
  gains?: string[];
  gainsNote?: string;
};

// 1V1 全流程辅导：研发 / 商科两个方向的陪跑环节拆解
const coachingTracks: CoachingTrack[] = [
  {
    key: 'rd',
    label: '💻 研发',
    stepsTitle: '三阶段陪跑流程',
    origin: '做陪跑的初衷很简单：我大学那几年，最盼的就是身边有个学长带。那些绕过的弯、错过的机会，学弟学妹们不必再经历一遍——这条路上的经验，我直接给你。',
    pains: [
      '⏳ 学期与假期拥有大段可支配时间，却缺少清晰的能力积累路径',
      '🧩 校内课程与企业岗位要求的知识结构之间，找不到明确的结合点',
      '📅 对校招应当准备什么、关键时间节点如何安排，缺乏系统认知',
      '📉 面试被追问项目细节时难以展开，缺少可深入阐述的技术叙事',
      '🤖 大模型与 Agent 已成为行业共识，自身却缺少可展示的项目积累',
    ],
    steps: [
      {
        title: '① 一阶段 · 精准诊断',
        color: 'green',
        detail: '',
        bullets: [
          '深度面试：60分钟线上 1v1，覆盖简历、项目与基础，摸底当前水平',
          '能力雷达图：算法、工程、项目深度、领域知识、表达五项打分，明确差距与补齐周期',
          '目标锁定：结合 AI 行业趋势、个人性格兴趣与院校背景，确定高匹配度企业与岗位清单',
        ],
      },
      {
        title: '② 二阶段 · 系统赋能 + 实战演练',
        color: 'blue',
        detail: '',
        bullets: [
          '硬核技术重构：从 0 到 1 独立设计与实现一个具备完整业务闭环的 AI Agent 应用——需求分析与场景定义（智能客服 / 代码审查 / 数据分析 Agent 等）、架构设计（任务规划、工具调用、记忆机制、多轮推理），最终沉淀为带完整技术文档的业界实战项目',
          '项目价值升华：深挖每个技术决策背后的取舍，拒绝平淡功能描述，体现架构能力与业务洞察',
          '高频考点狙击：构建系统化的计算机知识图谱，对大模型原理、Agent 框架、主流 AI 工具、AI Coding 应试技巧详细解析',
          '高压模拟面试：1:1 还原大厂 AI 岗面试场景（在线编程、系统设计、项目深挖），每次模拟后详细复盘、针对性改进，直至形成肌肉记忆',
        ],
      },
      {
        title: '③ 三阶段 · 成果收获',
        color: 'orange',
        detail: '',
        bullets: [
          '系统化的 AI 技术认知体系',
          '有细节、有亮点、有价值的 AI Agent 实战项目',
          '从容应对高压深挖，显著提升大厂 AI Offer 获取率',
        ],
      },
    ],
  },
  {
    key: 'biz',
    label: '📈 商科',
    origin: '做商科陪跑的初衷很实在：我自己就是从语言类专业 0 基础跨界商科，选赛道、改简历、练 Case、跑面试，每一步都踩过坑。这些经验不必再让你自己摸索一遍——方向怎么选、材料怎么写、面试怎么答，我直接带你走一遍。',
    reliefText: '这些不是能力问题，是信息差——早有人替你踩过，就不必自己再撞一遍。简历有人改、Case 有人陪练、面试有人逐句复盘，行业与岗位的选择也提前帮你想清楚。等秋招真正开始，你会发现自己已经准备好了。三个月走完，目标只有一个：拿到一份你自己满意的工作。',
    pains: [
      '🧭 想进咨询 / 快消 / 互联网，却分不清赛道差异，不知道该重点投哪一类',
      '📄 简历写满社团与学生工作，讲不出可量化的商业成果',
      '🗣️ 行为面 STAR 讲不完整，案例面（Case）缺少结构化框架',
      '📊 商业 sense 与行业认知偏薄，群面里抢不到发言位置',
      '⏰ 暑期实习与秋招节奏没踩准，等到毕业才发现窗口已经关上',
    ],
    mentors: [
      {
        name: 'Y老师',
        role: '商科方向主导师',
        education: '北外、HEC Paris 战略管理研究生（欧洲第一商学院）',
        summary: '从 0 到 1 跨界商科，成为咨询、互联网战略与快消行业的全能型选手。',
        expertise: ['面试辅导', 'Mock Case', '快消 / 互联网 / 咨询行业岗位介绍与选择'],
        experiences: [
          { label: '咨询', value: '贝恩、罗兰贝格' },
          { label: '互联网战略', value: '字节跳动、百度' },
          { label: '快消', value: '联合利华、玛氏' },
        ],
        offers: [
          { label: '暑期实习', value: '宝洁 BRM、腾讯微信产品经理、某战略咨询' },
          { label: '秋招', value: '某 Tier 2 战略咨询' },
        ],
      },
    ],
    skillsTitle: '商科能力地图',
    skillsIntro: '商科求职考的从来不是背了多少模型，而是能不能在有限信息里把事情想清楚、说明白。下面四块能力按“先定方向、再磨材料、最后练表达”的顺序叠加，每一块都有可交付的产出。',
    skills: [
      { title: '行业与岗位认知', desc: '咨询（战略 / 管理 / 风险）、快消（BRM / 供应链 / 市场）、互联网（产品 / 运营 / 战略）三大赛道的岗位差异、晋升路径与选人偏好，先把方向定对再谈技巧。' },
      { title: '简历与作品集', desc: '把社团、实习、竞赛翻译成可量化的商业成果（GMV、留存、转化率、复购），再补一份行业研究报告作为作品集，应对“你有什么作品”这类追问。' },
      { title: 'Case 与商业分析', desc: '市场规模估算、利润拆解、进入策略等高频题型的框架，配合 mock case 逐轮打磨假设、结构与结论，形成自己可复用的拆题习惯。' },
      { title: '面试表达与群面', desc: '行为面 STAR 逐句打磨、业务面深挖准备、群面角色定位与时间管理，每轮录音逐句反馈结论先行、逻辑分层与数据引用。' },
    ],
    gains: [
      '一份把经历翻译成商业价值的简历',
      '一套可复用的 Case 拆解与表达框架',
      '一份能直接放进作品集的行业研究报告',
      '一份逐场沉淀的真实面试复盘结论库',
    ],
    gainsNote: '商科求职拼的从来不是“知道多少”，而是“能不能讲清楚”。每一轮 mock、每一场面试都会沉淀成你的题库与话术库，到真正上场时，你已经是练过很多次的那个版本。加油，我们终点见。',
    steps: [
      { title: '① 职业性格评测', color: 'green', detail: '霍兰德 + 大五人格测评，区分产品、运营、咨询、管培四类岗位的胜任特征，避免只看岗位热度而忽视性格与工作节奏的匹配度。' },
      { title: '② 个人能力摸底', color: 'green', detail: '商业 sense、数据分析、结构化表达、案例拆解四项打分，明确与目标岗位胜任模型的差距，并给出 4-8 周的针对性提升任务。' },
      { title: '③ 背景&简历提升', color: 'blue', detail: '把社团、实习、竞赛翻译成可量化的商业成果（GMV、留存、转化率、复购），并补一份行业研究报告作为作品集，应对“你有什么作品”这类追问。' },
      { title: '④ 模拟面试', color: 'blue', detail: '行为面 STAR 逐句打磨 + 案例分析（Case）框架演练 + 群面角色定位与时间管理，每轮录音逐句反馈结论先行、逻辑分层与数据引用。' },
      { title: '⑤ 真实面试复盘', color: 'orange', detail: '记录每家公司的考察侧重点与话术得失，区分“知识缺口”与“表达问题”，下一场面试前针对性补刀，不在同一个坑跌两次。' },
      { title: '⑥ 流程跟进', color: 'red', detail: '秋招宣讲会与网申节奏并行，内推与官方渠道双线推进，Offer 决策矩阵（业务前景 / 成长性 / 薪资 / 城市）辅助做出不后悔的选择。' },
    ],
  },
];

// 研发方向配图：招募海报、三阶段总览、学习地图、项目库、成果收获（图片放在 public/coaching）
const coachingMedia: Record<string, { hero?: string; stages?: string; map?: string; projects?: string; results?: string }> = {
  rd: {
    hero: '/coaching/hero-offer.jpg',
    stages: '/coaching/three-stages.jpg',
    map: '/coaching/learning-map.jpg',
    projects: '/coaching/project-library.png',
    results: '/coaching/results.jpg',
  },
};

function CoachingTrackPanel({ track, onConsult }: { track: CoachingTrack; onConsult: () => void }) {
  const media = coachingMedia[track.key] || {};
  const hasHero = Boolean(media.hero || track.origin || track.pains);
  // 经历与 Offer 共用同一份行渲染，避免两处重复维护
  const renderMentorRows = (rows: CoachingMentorRow[]) => (
    <ul className="coaching-mentor-rows">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="coaching-mentor-label">{row.label}</span>
          <span className="coaching-mentor-value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      {hasHero && (
        <section className={`coaching-hero${media.hero ? '' : ' coaching-hero--no-media'}`}>
          <div className="coaching-hero-body">
            {track.origin && <p className="coaching-hero-origin">{track.origin}</p>}
            {track.pains && (
              <div className="coaching-hero-group">
                <div className="coaching-hero-group-title">你是不是也有这种焦虑</div>
                <ul className="coaching-hero-pains">
                  {track.pains.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}
            <div className="coaching-hero-relief">
              <p className="coaching-hero-relief-title">不用怕，这条路上有人带着走</p>
              <p className="coaching-hero-relief-text">
                {track.reliefText || '这些不是能力问题，是信息差——早有人替你踩过，就不必自己再撞一遍。简历有人改、项目有人带、面试有人陪练，每一步都踩在关键节点上。等秋招真正开始，你会发现自己已经准备好了。三个月走完，目标只有一个：拿到一份你自己满意的工作。'}
              </p>
            </div>
          </div>
          {media.hero && (
            <figure className="coaching-hero-media">
              <img src={media.hero} alt="AI 应用开发 Offer 陪跑 1V1：3 个月 3 个阶段" loading="lazy" />
            </figure>
          )}
        </section>
      )}
      {track.mentors && track.mentors.length > 0 && (
        <Card className="career-resource-card" title="师资力量" style={{ marginBottom: 16 }}>
          {track.mentors.map((mentor) => (
            <article className="coaching-mentor" key={mentor.name}>
              <header className="coaching-mentor-head">
                <div className="coaching-mentor-avatar" aria-hidden="true">{mentor.name.slice(0, 1)}</div>
                <div className="coaching-mentor-meta">
                  <div className="coaching-mentor-name">
                    {mentor.name}
                    <span className="coaching-mentor-role">{mentor.role}</span>
                  </div>
                  <div className="coaching-mentor-edu">{mentor.education}</div>
                </div>
                {mentor.expertise && mentor.expertise.length > 0 && (
                  <div className="coaching-mentor-expertise">
                    <span className="coaching-mentor-expertise-label">擅长</span>
                    <div className="coaching-mentor-expertise-tags">
                      {mentor.expertise.map((item) => (
                        <span className="coaching-mentor-expertise-tag" key={item}>{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </header>
              <p className="coaching-mentor-summary">{mentor.summary}</p>
              <div className="coaching-mentor-grid">
                <section className="coaching-mentor-col">
                  <div className="coaching-mentor-col-title">实习与任职经历</div>
                  {renderMentorRows(mentor.experiences)}
                </section>
                <section className="coaching-mentor-col coaching-mentor-col--offers">
                  <div className="coaching-mentor-col-title">Offer 战绩</div>
                  {renderMentorRows(mentor.offers)}
                </section>
              </div>
            </article>
          ))}
        </Card>
      )}
      <Card className="career-resource-card" title={track.stepsTitle || '六步陪跑流程'} style={{ marginBottom: 16 }}>
        <div className={`coaching-stages${media.stages ? '' : ' coaching-stages--no-media'}`}>
          <Timeline
            items={track.steps.map((s) => ({
              color: s.color,
              children: (
                <>
                  <Text strong>{s.title}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>{s.detail}</Paragraph>
                  {s.bullets && (
                    <ul className="coaching-step-bullets">
                      {s.bullets.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  )}
                </>
              ),
            }))}
          />
          {media.stages && (
            <figure className="coaching-stages-media">
              <img src={media.stages} alt="三阶段陪跑：从写简历到拿大厂 AI Offer" loading="lazy" />
            </figure>
          )}
        </div>
      </Card>
      {track.skills && track.skills.length > 0 && (
        <Card className="career-resource-card" title={track.skillsTitle || '能力地图'} style={{ marginBottom: 16 }}>
          {track.skillsIntro && <Paragraph className="coaching-map-intro">{track.skillsIntro}</Paragraph>}
          <div className="coaching-skills">
            {track.skills.map((skill) => (
              <section className="coaching-skill" key={skill.title}>
                <div className="coaching-skill-title">{skill.title}</div>
                <p className="coaching-skill-desc">{skill.desc}</p>
              </section>
            ))}
          </div>
        </Card>
      )}
      {track.gains && track.gains.length > 0 && (
        <Card className="career-resource-card" title="成果收获" style={{ marginBottom: 16 }}>
          <div className="coaching-gains">
            {track.gains.map((gain, index) => (
              <div className="coaching-gain" key={gain}>
                <span className="coaching-gain-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="coaching-gain-text">{gain}</span>
              </div>
            ))}
          </div>
          {track.gainsNote && (
            <div className="coaching-results-note">
              <p className="coaching-results-note-title">这条路，我陪你走完</p>
              <p className="coaching-results-note-text">{track.gainsNote}</p>
            </div>
          )}
        </Card>
      )}
      {media.projects && (
        <Card className="career-resource-card" title="AI 知识体系" style={{ marginBottom: 16 }}>
          <Paragraph className="coaching-map-intro">
            这是一条螺旋向上的路：先打牢编程底子，再了解模型原理，Agent框架、工程理念逐层叠加，最后一站直接落在行业项目与面试上。
          </Paragraph>
          {media.map && (
            <figure className="coaching-map">
              <img
                src={media.map}
                alt="从零基础到大厂 Agent 工程师的学习地图：1 编程与工程基础、2 大模型基础原理、3 RAG 与知识检索、4 Agent 基础能力、5 上下文与记忆工程、6 Agent 工程化 Harness、7 工具生态与 AI Coding、8 行业项目与面试准备"
                loading="lazy"
              />
            </figure>
          )}
          <Divider style={{ margin: '20px 0 16px' }} />
          <Text strong className="coaching-map-heading">📁 地图之外：持续更新的 27 个实战项目文件夹</Text>
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            地图上每一站都不是空谈，项目库已沉淀 27 个主题文件夹，覆盖行业 AI Coding（电商 / 金融 / 内容消费）、Agent 架构、MCP / RAG / Context Engineering、Harness 工程化、主流 AI 编程工具与框架实践等行业热门领域，并持续更新补充。选题和找资料这两件最耗时间的事，不必再自己扛！
          </Paragraph>
          <img className="coaching-wide-img coaching-img-medium" src={media.projects} alt="实战项目库：27 个主题文件夹，覆盖行业 AI Coding、Agent、MCP、RAG、Context Engineering 等主题" loading="lazy" />
        </Card>
      )}
      {media.results && (
        <Card className="career-resource-card" title="成果收获" style={{ marginBottom: 16 }}>
          <img className="coaching-wide-img coaching-img-narrow" src={media.results} alt="成果收获：4 项核心资产" loading="lazy" />
          <div className="coaching-results-note">
            <p className="coaching-results-note-title">这条路，我陪你走完</p>
            <p className="coaching-results-note-text">
              你只管往前——把时间投进项目，把问题抛给我，把面试当练手。路上难免卡壳和焦虑，但努力终将会有回报。加油兄弟姐妹们，我们终点见。
            </p>
          </div>
        </Card>
      )}
      <Card className="career-resource-card career-followup-cta">
        <div style={{ textAlign: 'center' }}>
          <Title level={5}>想先看看自己现在处在哪一档？</Title>
          <Paragraph type="secondary">先做一次免费初步评估，再决定是否需要全程陪跑</Paragraph>
          <Button type="primary" size="large" onClick={onConsult}>立即预约 1v1 咨询</Button>
        </div>
      </Card>
    </div>
  );
}

function CoachingPage() {
  const navigate = useNavigate();
  return (
    <div className="career-planning-page">
      <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning')}>← 返回求职专区</Button>
      <div className="career-hero">
        <div className="career-hero-badge">🎯 求职专区 · 全流程陪跑</div>
        <Title level={2}>1V1<span className="career-hero-highlight">全流程辅导</span></Title>
        <Paragraph>职业性格评测、个人能力摸底、背景&简历提升、模拟面试、真实面试复盘、流程跟进等全流程陪跑</Paragraph>
      </div>
      <Tabs
        defaultActiveKey="rd"
        size="large"
        className="career-tabs"
        items={coachingTracks.map((track) => ({
          key: track.key,
          label: track.label,
          children: <CoachingTrackPanel track={track} onConsult={() => navigate('/consultation')} />,
        }))}
      />
    </div>
  );
}

// 小红书封面：真实数据是图片 URL，早期手填数据用的是 emoji 占位
const XHS_COVER_IMAGE = /^https?:\/\//;

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

  // 只保留点赞+收藏热度最高的前 12 条，其余不在页面展示
  const topArticles = useMemo(() => {
    const heat = (a: XhsArticle) => (a.likes || 0) + (a.collects || 0);
    const byDate = (a: XhsArticle, b: XhsArticle) => String(b.date || '').localeCompare(String(a.date || ''));
    return [...articles].sort((a, b) => heat(b) - heat(a) || byDate(a, b)).slice(0, 12);
  }, [articles]);

  const renderArticleCard = (a: XhsArticle, locked = false) => (
    <Col xs={24} sm={12} lg={8} key={a.url || a.title}>
      <Card
        className="career-resource-card"
        hoverable
        style={{ height: '100%' }}
        onClick={a.url && !locked ? () => window.open(a.url, '_blank', 'noopener,noreferrer') : undefined}
      >
        {a.cover && XHS_COVER_IMAGE.test(a.cover) ? (
          <div className="xhs-cover">
            <img src={a.cover} alt={a.title} loading="lazy" referrerPolicy="no-referrer" />
          </div>
        ) : (
          <div style={{ fontSize: 32, marginBottom: 8 }}>{a.cover || '📄'}</div>
        )}
        <Text className="career-resource-title" strong style={{ display: 'block', lineHeight: 1.5 }}>{a.title}</Text>
        {a.summary ? <Paragraph type="secondary" className="career-resource-desc">{a.summary}</Paragraph> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{a.date}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ❤️ {a.likes}{a.collects > 0 ? ` · ⭐ ${a.collects}` : ''}
          </Text>
        </div>
      </Card>
    </Col>
  );

  // 扫码浮层：宽度较大，用 fixed 跟随按钮定位，上方放不下时自动贴底，避免被视口裁掉
  const [scanPop, setScanPop] = useState<{ top: number; left: number } | null>(null);
  const scanHintRef = useRef<HTMLSpanElement | null>(null);

  const showScanPop = () => {
    const el = scanHintRef.current;
    if (!el) return;
    const SCAN_POP_W = 320;
    const SCAN_POP_H = 436;
    const gap = 12;
    const rect = el.getBoundingClientRect();
    const above = rect.top - gap - SCAN_POP_H;
    setScanPop({
      top: above >= gap ? above : Math.max(gap, window.innerHeight - SCAN_POP_H - gap),
      left: Math.min(
        Math.max(gap, rect.left + rect.width / 2 - SCAN_POP_W / 2),
        window.innerWidth - SCAN_POP_W - gap,
      ),
    });
  };

  return (
    <div className="career-planning-page">
      <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning')}>← 返回求职专区</Button>
      <div className="career-hero">
        <div className="career-hero-badge">📕 小红书 · 技术干货</div>
        <Title level={2}>技术干货<span className="career-hero-highlight">抢先读</span></Title>
        <Paragraph>大厂 AI Agent 开发与面试干货合集，涵盖 RAG、MCP、Function Call、多 Agent 架构与框架源码解析，持续更新中</Paragraph>
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
          {topArticles.slice(0, 9).map((a) => renderArticleCard(a))}
        </Row>
        {topArticles.length > 9 && (
          <div className="xhs-locked-row">
            <Row gutter={[16, 16]}>
              {topArticles.slice(9).map((a) => renderArticleCard(a, true))}
            </Row>
            {/* 横跨整行底部的虚化带，只放一个引导按钮 */}
            <div className="xhs-bottom-fade">
              <span
                className="xhs-scan-hint"
                ref={scanHintRef}
                onMouseEnter={showScanPop}
                onMouseLeave={() => setScanPop(null)}
                onWheel={() => setScanPop(null)}
              >
                更多内容关注请扫码关注哦～
              </span>
            </div>
          </div>
        )}
        {!loading && articles.length === 0 && <Empty description="暂无文章，期待第一篇笔记发布" />}
      </Spin>
      {scanPop && (
        <div className="xhs-scan-pop" style={{ top: scanPop.top, left: scanPop.left }}>
          <img src="/xhs-card.jpg" alt="小红书扫码关注：大厂 AI 直通车" />
        </div>
      )}
    </div>
  );
}

// 尚未开发完成的板块：整块灰色蒙层 + 锁提示，拦截所有点击
function ComingSoonMask({ section }: { section: string }) {
  return (
    <div className="career-coming-soon-mask">
      <div className="career-coming-soon-panel">
        <LockOutlined className="career-coming-soon-icon" />
        <Title level={5} className="career-coming-soon-title">功能暂未开放</Title>
        <Paragraph type="secondary" className="career-coming-soon-desc">
          {section}正在整理完善中，暂不支持查看，敬请期待
        </Paragraph>
      </div>
    </div>
  );
}

type StudyAbroadStage = { color: string; period: string; detail?: string; bullets?: string[]; highlight?: boolean };

// 北邮（含海南学院）留学申请的三个演变阶段，2020 级至今最有参考价值
const studyAbroadStages: StudyAbroadStage[] = [
  {
    color: 'blue',
    period: '2012 级 - 2016 级 · 赴美为主',
    detail: '大部分同学去美国，少部分去英联邦；“弃保”（放弃保研去留学）比例较高，整体氛围是全力竞争欧美名校。',
  },
  {
    color: 'green',
    period: '2016 级 - 2019 级 · 转向英港新',
    detail: '受政策影响赴美签证受限，主阵地转向英国、香港、新加坡。此时“弃保”人数开始减少，英联邦顶级院校的申请竞争反而变小。',
  },
  {
    color: 'orange',
    period: '2020 级 - 至今 · 当前态势',
    highlight: true,
    bullets: [
      '优先保研：绝大多数学生优先卷保研，“弃保”留学成为个案。',
      '地区偏好：选择优先级为 港 > 新 > 英。',
      '竞争红利：“弃保”人数大幅减少，英联邦头部院校的申请竞争变小，利好有留学意向同学。',
      '心态转变：留学生更倾向于谋求毕业后稳定的工作，偏好生活节奏较慢、压力较小的城市。',
    ],
  },
];

const studyAbroadPrinciples = [
  { title: '三维兼顾原则', detail: '院校和专业的选择必须同时兼顾三个维度：个人特质及兴趣、申请难度可行性、未来职业发展。' },
  { title: '一人一策定制化', detail: '每个申请者和家庭的诉求不同，切忌盲目跟风，必须根据自身情况量身定制方案。' },
  { title: '参考近期同类案例', detail: '北邮国院和海南学院的背景有其特殊性，应重点参考近三年国院及近两年海南学院（22 级第一届招生）的真实申请案例锚定自身位置。' },
];

const studyAbroadStrategies = [
  { title: '认清局势', detail: '利用当前“弃保少”的现状，大胆冲击英联邦头部名校，享受竞争变小的红利。' },
  { title: '明确方向', detail: '按照“港 > 新 > 英”的大趋势进行梯度选校，结合自身 GPA、语言、科研、实习等硬件条件在专业库中匹配。' },
  { title: '拒绝盲从', detail: '摆弃信息焦虑，结合“个人兴趣 + 申请可行性 + 职业规划”制定一人一策，把留学当作自我提升的跳板而非逃避内卷的退路。' },
];

type StudyAbroadSchool = { school: string; note: string; programs: string[] };
type StudyAbroadRegion = { key: string; label: string; color: string; summary: string; schools: StudyAbroadSchool[] };

// 常申请的「英、港、新」头部院校与对口专业（选校简易自测清单）
const studyAbroadRegions: StudyAbroadRegion[] = [
  {
    key: 'hk',
    label: '🇭🇰 中国香港',
    color: 'blue',
    summary: '当前首选地区：项目选择最丰富，与通信、计算机、电子背景的对口度最高，也是近几届申请最集中的方向。',
    schools: [
      {
        school: '香港大学（HKU）',
        note: '近 16 个与通信 / 计算机 / 电子 / 数据背景匹配的专业',
        programs: ['数据科学', '统计学', '金融科技', '人工智能', '计算机科学（网络安全方向）', '计算机科学（AI 方向）', '智能网络与信息工程', '机器人与智能系统', '电子商务', '生物医学创新'],
      },
      {
        school: '香港科技大学（HKUST）',
        note: '共 12 个方向，电信学对通信背景友好',
        programs: ['人工智能', '金融科技', '金融数学（量化）', '商业分析', '大数据科技', '信息技术', '电信学（含通信机器学习）', '电子工程'],
      },
      {
        school: '香港中文大学（CUHK）',
        note: '共 12 个专业，信息工程与金融科技方向近年申请最多',
        programs: ['计算机科学', '人工智能', '金融科技', '数据科学与商业统计', '信息工程', '机器人学', '数字经济与人工智能'],
      },
    ],
  },
  {
    key: 'sg',
    label: '🇸🇬 新加坡',
    color: 'green',
    summary: '次优选地区：项目更偏应用与就业导向，计算机硕士设有通用方向，对转专业相对友好。',
    schools: [
      {
        school: '新加坡国立大学（NUS）',
        note: '分 MSc 与 Master of Computing / Technology 两大类，共 12 个项目',
        programs: ['数据科学与机器学习', '计算机硕士（AI 方向）', '计算机硕士（CS 方向）', '计算机硕士（信息系统方向）', '计算机硕士（信息安全方向）', '计算机硕士（通用转专业方向）', '技术硕士（AI 系统）', '技术硕士（企业商业分析）', '技术硕士（软件工程）', '精准健康与医学 × AI'],
      },
      {
        school: '南洋理工大学（NTU）',
        note: '共 10 个方向，EEE 下属项目对电子 / 通信背景友好',
        programs: ['人工智能', '数据科学', '网络安全', '金融科技', '应用 AI 计算', '区块链', '生物医学数据科学', 'EEE 下属全部项目', '企业人工智能'],
      },
    ],
  },
  {
    key: 'uk',
    label: '🇬🇧 英国',
    color: 'purple',
    summary: '竞争相对较小：头部院校项目细分最全，非 CS 背景的转专业通道清晰，可用来补足梯度选校的冲刺与保底。',
    schools: [
      {
        school: '帝国理工学院（IC）',
        note: '共 15 个顶尖项目，Computing 与高级计算按背景分流',
        programs: ['MSc Computing（面向非 CS 背景）', '高级计算（面向 CS 背景）', '人工智能', '软件工程', '安全可靠性', '视觉计算与机器人', '统计学', '金融科技'],
      },
      {
        school: '伦敦大学学院（UCL）',
        note: '专业多达 30 余个，交叉学科选择最丰富',
        programs: ['计算机科学 MSc（转专业友好）', '机器学习', '人机交互', '计算金融', '医疗 AI', '物联网系统工程', '时空分析与大数据挖掘', '地理空间科学'],
      },
    ],
  },
];

// 留学专区二级页：从趋势出发的选校定位方法论
function StudyAbroadTrendPage() {
  const navigate = useNavigate();
  return (
    <div className="career-planning-page">
      <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning?tab=abroad')}>← 返回留学专区</Button>
      <div className="career-hero">
        <div className="career-hero-badge">🌏 留学专区 · 趋势分析定选校</div>
        <Title level={2}>趋势分析<span className="career-hero-highlight">定选校</span></Title>
        <Paragraph>从十余年申请趋势看清竞争格局，结合港、新、英头部院校专业库，把选校定位做成一套可复用的方法论</Paragraph>
      </div>

      <Card className="career-resource-card" title="一、留学大背景与趋势分析 · 经验篇" style={{ marginBottom: 16 }}>
        <Timeline
          items={studyAbroadStages.map((stage) => ({
            color: stage.color,
            children: (
              <>
                {stage.highlight ? (
                  <Text strong className="abroad-stage-highlight">
                    <CrownOutlined className="abroad-stage-crown" />
                    {stage.period}
                  </Text>
                ) : (
                  <Text strong>{stage.period}</Text>
                )}
                {stage.detail && (
                  <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{stage.detail}</Paragraph>
                )}
                {stage.bullets && (
                  <ul className="abroad-stage-bullets">
                    {stage.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </>
            ),
          }))}
        />
      </Card>

      <Card className="career-resource-card" title="二、选校定位的核心诀窍 · 方法论篇" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          在 AI 时代，申请者并不缺信息，缺的是甄别信息的能力和形成个人方法论的能力。以下几条是判断与取舍的底层依据。
        </Paragraph>
        {studyAbroadPrinciples.map((p, index) => (
          <div className="abroad-item" key={p.title}>
            <span className="abroad-item-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="abroad-item-body">
              <Text strong>{p.title}</Text>
              <Paragraph type="secondary" style={{ margin: '2px 0 0' }}>{p.detail}</Paragraph>
            </div>
          </div>
        ))}
        <div className="abroad-quote">
          <p className="abroad-quote-text">“留学不是保研的退路，更不是逃避考研上岸风险的避风港。留学是一场个人蜕变的开始。”</p>
          <p className="abroad-quote-source">端正留学心态，带着正确的认知去规划，才能做好选校。</p>
        </div>
      </Card>

      <Card className="career-resource-card" title="三、热门选校及专业信息库 · 干货篇" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          基于北邮学生的专业背景（通信、计算机、电子、数据等），以下为当前常申请的「英、港、新」三大地区头部院校及对口专业，可作为选校的「简易自测」清单。
        </Paragraph>
        <Tabs
          defaultActiveKey="hk"
          size="large"
          className="abroad-region-tabs"
          items={studyAbroadRegions.map((region) => ({
            key: region.key,
            label: region.label,
            children: (
              <>
                <Paragraph type="secondary" className="abroad-region-summary">{region.summary}</Paragraph>
                {region.schools.map((school) => (
                  <div className="abroad-school" key={school.school}>
                    <Text strong className="abroad-school-name">{school.school}</Text>
                    <Paragraph type="secondary" className="abroad-school-note">{school.note}</Paragraph>
                    <div className="abroad-program-tags">
                      {school.programs.map((program) => (
                        <Tag key={program} color={region.color}>{program}</Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ),
          }))}
        />
      </Card>

      <Card className="career-resource-card" title="四、总结建议" style={{ marginBottom: 16 }}>
        {studyAbroadStrategies.map((s, index) => (
          <div className="abroad-item" key={s.title}>
            <span className="abroad-item-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="abroad-item-body">
              <Text strong>{s.title}</Text>
              <Paragraph type="secondary" style={{ margin: '2px 0 0' }}>{s.detail}</Paragraph>
            </div>
          </div>
        ))}
      </Card>

      <Card className="career-resource-card career-followup-cta">
        <div style={{ textAlign: 'center' }}>
          <Title level={5}>想结合自己的 GPA、语言与项目背景做一次选校定位？</Title>
          <Paragraph type="secondary">对照趋势与院校专业库，先把「冲刺 / 主申 / 保底」的梯度排出来</Paragraph>
          <Button type="primary" size="large" onClick={() => navigate('/consultation')}>立即预约 1v1 咨询</Button>
        </div>
      </Card>
    </div>
  );
}

type AbroadTestPoint = { title: string; detail: string };
type AbroadTestGuide = { key: string; label: string; color: string; trends: AbroadTestPoint[]; keyPoints: AbroadTestPoint[] };

// 三科标化：改革后的考情变化与分科备考要点
const abroadTestGuides: AbroadTestGuide[] = [
  {
    key: 'toefl',
    label: 'TOEFL 托福',
    color: 'blue',
    trends: [
      { title: '全面缩短', detail: '自 2023 年 7 月起，考试时间从 3 小时大幅缩减至 2 小时以内，取消加试，阅读和听力篇章减少，对考生的体力消耗降低，但容错率也随之下降。' },
      { title: '拼分政策（MyBest Scores）', detail: '越来越多院校接受两年内各单项最高分的拼凑成绩，但部分顶尖名校（如 IC、NUS 的部分项目）仍要求单次考试成绩。' },
      { title: '家庭版常态化', detail: 'TOEFL Home Edition 被广泛接受，但部分高校对其认可度存在波动，建议优先选择线下考点。' },
    ],
    keyPoints: [
      { title: '得听力者得天下', detail: '改革后听力依然是核心（听力、口语、写作均涉及听音）。需坚持精听 TPO，训练边听边记笔记的能力。' },
      { title: '学术词汇量', detail: '托福侧重北美大学课堂真实语境，需熟练掌握约 8000-10000 学术词汇。' },
      { title: '写作适应新题型', detail: '新增“学术讨论写作（Academic Discussion）”，要求在 10 分钟内阅读材料并发表观点，考验快速构思和精准表达。' },
    ],
  },
  {
    key: 'ielts',
    label: 'IELTS 雅思',
    color: 'green',
    trends: [
      { title: '机考全面普及', detail: '机考场次远超纸笔考，出分极快（通常 3-5 天），且支持单科重考（One Skill Retake, OSR）政策正在全球逐步落地，考生可在 60 天内仅重考未达标单科。' },
      { title: 'UKVI 与普通 A 类的区分', detail: '赴英申请若需配语言班，必须考取用于英国签证及移民的雅思（UKVI）；直录则普通 A 类即可，港新地区通常两者皆认。' },
      { title: '评分尺度微调', detail: '口语和写作的压分现象在部分地区依然存在，考生需更加注重逻辑框架而非单纯堆砌词汇。' },
    ],
    keyPoints: [
      { title: '同义替换是灵魂', detail: '无论是阅读还是听力，雅思的核心考点在于题干与原文的同义替换（Paraphrasing）。' },
      { title: '口语素材去模板化', detail: '考官对背诵痕迹极度敏感。需结合自身真实经历（如北邮的科研项目、实习故事）构建语料库，追求流利度与自然交流感。' },
      { title: '写作逻辑重于词藻', detail: '大作文（Task 2）重点考察 TR（任务回应）和 CC（连贯与衔接），切忌堆砌生僻词而忽视段落间的逻辑推演。' },
    ],
  },
  {
    key: 'gre',
    label: 'GRE',
    color: 'purple',
    trends: [
      { title: '重大改革（变短）', detail: '2023 年 9 月起，GRE 总时长从近 4 小时缩减至 1 小时 58 分钟。取消了 Argument 写作，阅读和填空题目数量减少，无中场休息。' },
      { title: 'Optional 趋势延续', detail: '后疫情时代，大量美国及部分英港新项目仍将 GRE 设为 Optional（可选），但对于北邮学生常申的 CS、AI、DS、EE 等量化强相关专业，一个高分 GRE（尤其是 Quant 满分或接近满分）仍是核心加分项。' },
      { title: '容错率极低', detail: '由于题量大幅减少，每道题的分值权重上升，粗心导致的失误代价极大。' },
    ],
    keyPoints: [
      { title: 'Verbal（语文）靠硬核积累', detail: '填空题高度依赖 GRE 专属词汇（如“要你命 3000”等），需多轮滚动记忆；阅读理解需掌握长难句拆解技巧，适应高强度的逻辑推理。' },
      { title: 'Quant（数学）求稳不求快', detail: '对北邮理工科学生而言知识点不难，但陷阱多（如数据充分性判断）。改革后题量少，必须保证 168-170 的绝对高分。' },
      { title: '自适应机制（Section-level Adaptive）', detail: '第一个 Section 的表现决定第二个 Section 的难度。务必在第一个 Section 稳扎稳打，进入 Hard 模式才能冲击高分上限。' },
    ],
  },
];

// 标化备考时间轴（以北邮学生为例）
const abroadTestTimeline: StudyAbroadStage[] = [
  { color: 'blue', period: '大一 / 大二', detail: '主攻 GPA，同步积累英语基础（四六级高分通过，开始接触托福 / 雅思词汇）。' },
  { color: 'blue', period: '大二下 / 大三上', detail: '集中攻克 TOEFL / IELTS，争取首考达标（托福 100+ / 雅思 7.0+）。' },
  { color: 'green', period: '大三下', detail: '若目标为顶尖量化项目，启动 GRE 备考，利用理工科数学优势速战速决。' },
  { color: 'orange', period: '大三暑假前', detail: '所有标化成绩应全部出分，大四开学全力投入文书和网申。' },
];

const abroadTestChoices: AbroadTestPoint[] = [
  { title: 'TOEFL vs IELTS', detail: '主攻美国必选 TOEFL；主攻英联邦（英港新）首选 IELTS，但目前港新英均双认。结合个人习惯：擅长学术长难句和机考打字选托福，擅长生活化场景和面对面口语选雅思。' },
  { title: '是否需要 GRE', detail: '查阅目标项目官网。若申请 NUS / NTU 的计算机硕士、帝国理工 / UCL 的量化或 AI 方向，强烈建议提交 GRE 以证明数理能力。' },
];

type AbroadScoreRow = { region: string; school: string; programs: string; toefl: string; ielts: string; gre: string; note: string };

// 趋势页所列港/新/英七所院校的院校级语言门槛（具体项目以官网最新要求为准）
const abroadScoreRows: AbroadScoreRow[] = [
  {
    region: '中国香港',
    school: '香港大学（HKU）',
    programs: '数据科学、统计学、金融科技、计算机科学、人工智能等 9 个方向',
    toefl: '80（部分项目 93）',
    ielts: '6.0（各项 ≥5.5）',
    gre: '不强制；金融科技、统计类建议提交',
    note: '计算机与数据类实际录取多集中 TOEFL 90+ / IELTS 6.5+',
  },
  {
    region: '中国香港',
    school: '香港科技大学（HKUST）',
    programs: '人工智能、金融科技、大数据科技、电信学、电子工程等 8 个方向',
    toefl: '80',
    ielts: '6.5（各项 ≥5.5）',
    gre: '不强制；量化方向建议提交',
    note: '电信学、电子工程对通信背景友好，语言门槛相对宽松',
  },
  {
    region: '中国香港',
    school: '香港中文大学（CUHK）',
    programs: '计算机科学、人工智能、金融科技、信息工程等 7 个方向',
    toefl: '79',
    ielts: '6.5',
    gre: '不强制',
    note: '信息工程、金融科技对单项有要求，热门项目实际看 IELTS 6.5+',
  },
  {
    region: '新加坡',
    school: '新加坡国立大学（NUS）',
    programs: '数据科学与机器学习、计算机硕士（AI / CS / 通用方向）、技术硕士等 10 个方向',
    toefl: '85（计算机类常见 90+）',
    ielts: '6.0（部分项目 6.5）',
    gre: '计算机硕士建议提交（Quant 高分）',
    note: '通用方向对转专业友好，语言要求需按具体项目确认',
  },
  {
    region: '新加坡',
    school: '南洋理工大学（NTU）',
    programs: '人工智能、数据科学、网络安全、金融科技、EEE 下属项目等 9 个方向',
    toefl: '90',
    ielts: '6.5',
    gre: '建议提交（部分项目强制）',
    note: 'EEE 下属项目对电子 / 通信背景友好',
  },
  {
    region: '英国',
    school: '帝国理工学院（IC）',
    programs: '高级计算、人工智能、软件工程、视觉计算与机器人、金融科技等 8 个项目',
    toefl: '92（各项 ≥20）',
    ielts: '6.5（各项 ≥6.0）',
    gre: '不强制；量化 / AI 方向建议提交',
    note: '上述为 Standard 档，部分项目按 Higher 档（IELTS 7.0 / TOEFL 100）',
  },
  {
    region: '英国',
    school: '伦敦大学学院（UCL）',
    programs: '计算机科学、机器学习、人机交互、计算金融、医疗 AI 等 8 个项目',
    toefl: '92（读写 ≥24，听说 ≥20）',
    ielts: '6.5（各项 ≥6.0）',
    gre: '不强制',
    note: '上述为 Level 2，机器学习、计算金融等部分专业按 Level 3（IELTS 7.0）',
  },
];

// 标化备考二级页：新形势 + 时间轴/选择策略 + 分科要点 + 总结箴言
function StudyAbroadTestPage() {
  const navigate = useNavigate();

  const renderPoints = (points: AbroadTestPoint[]) => (
    <div>
      {points.map((p, index) => (
        <div className="abroad-item" key={p.title}>
          <span className="abroad-item-index">{String(index + 1).padStart(2, '0')}</span>
          <div className="abroad-item-body">
            <Text strong>{p.title}</Text>
            <Paragraph type="secondary" style={{ margin: '2px 0 0' }}>{p.detail}</Paragraph>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="career-planning-page">
      <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning?tab=abroad')}>← 返回留学专区</Button>
      <div className="career-hero">
        <div className="career-hero-badge">🌏 留学专区 · 标化备考</div>
        <Title level={2}>GRE/TOEFL/IELTS<span className="career-hero-highlight">备考指南</span></Title>
        <Paragraph>改革后的托福、雅思、GRE 考情变化，配合时间轴安排与分科备考要点，一页看清标化精力该怎么分配</Paragraph>
      </div>

      <Card className="career-resource-card" title="一、当下新形势" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          三科考试近两年都经历了结构性调整：长度变短、评分与送分规则在变，备考策略也必须跟着变。
        </Paragraph>
        <Tabs
          defaultActiveKey="toefl"
          size="large"
          className="abroad-tabs"
          items={abroadTestGuides.map((guide) => ({
            key: guide.key,
            label: guide.label,
            children: renderPoints(guide.trends),
          }))}
        />
      </Card>

      <Card className="career-resource-card" title="二、备考指南" style={{ marginBottom: 16 }}>
        <Text strong className="abroad-subtitle">整体时间轴规划（以北邮学生为例）</Text>
        <Timeline
          style={{ marginTop: 12 }}
          items={abroadTestTimeline.map((stage) => ({
            color: stage.color,
            children: (
              <>
                <Text strong>{stage.period}</Text>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{stage.detail}</Paragraph>
              </>
            ),
          }))}
        />
        <Divider style={{ margin: '8px 0 18px' }} />
        <Text strong className="abroad-subtitle">考试选择策略</Text>
        <div style={{ marginTop: 12 }}>{renderPoints(abroadTestChoices)}</div>
      </Card>

      <Card className="career-resource-card" title="三、目标院校语言分数线速查" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          message="下表是院校级最低门槛，不是录取安全线"
          description="各校不同项目可能有更高的总分或单项要求，实际录取分数普遍高于最低线；请以目标项目官网最新要求为准。"
        />
        <Table
          style={{ marginTop: 16 }}
          size="small"
          pagination={false}
          rowKey="school"
          scroll={{ x: 980 }}
          dataSource={abroadScoreRows}
          columns={[
            { title: '地区', dataIndex: 'region', width: 90 },
            { title: '院校', dataIndex: 'school', width: 180 },
            { title: '对应专业方向', dataIndex: 'programs', width: 240 },
            { title: 'TOEFL iBT', dataIndex: 'toefl', width: 130 },
            { title: 'IELTS', dataIndex: 'ielts', width: 140 },
            { title: 'GRE', dataIndex: 'gre', width: 200 },
          ]}
        />
        <Paragraph type="secondary" style={{ margin: '12px 0 0', fontSize: 12 }}>
          注：分数线为总分门槛，括号内为单项要求；GRE 一列仅代表是否需要提交，Quant 分数对 CS / AI / DS / EE 方向仍是核心加分项。
        </Paragraph>
      </Card>
      
      <Card className="career-resource-card" title="四、准备要点" style={{ marginBottom: 16 }}>
        {abroadTestGuides.map((guide) => (
          <div className="abroad-test-block" key={guide.key}>
            <div className="abroad-test-block-head">
              <Tag color={guide.color}>{guide.label}</Tag>
              <Text strong>备考要点</Text>
            </div>
            {renderPoints(guide.keyPoints)}
          </div>
        ))}
      </Card>

      <Card className="career-resource-card" title="五、总结箴言" style={{ marginBottom: 16 }}>
        <Paragraph>
          结合前文“一人一策定选校”的方法论，标化考试的准备同样适用：不要陷入“唯分数论”的信息冗余中。对于北邮学子而言，GPA 和专业背景（科研 / 竞赛）是基本盘，语言成绩是“敲门砖”（过线即可，边际效益递减），GRE 是“加速器”。合理分配精力，尽早出分，将更多时间留给软背景的打造，才是 AI 时代最高效的备考之道。
        </Paragraph>
        <div className="abroad-quote">
          <p className="abroad-quote-text">基本盘在 GPA 与专业背景，敲门砖是语言成绩，加速器是 GRE。</p>
          <p className="abroad-quote-source">尽早出分，把省下来的时间投给科研、竞赛与项目。</p>
        </div>
      </Card>

      <Card className="career-resource-card career-followup-cta">
        <div style={{ textAlign: 'center' }}>
          <Title level={5}>想结合目标院校定一条标化出分时间线？</Title>
          <Paragraph type="secondary">先看自己的 GPA 与目标项目，再决定托雅怎么选、GRE 要不要考</Paragraph>
          <Button type="primary" size="large" onClick={() => navigate('/consultation')}>立即预约 1v1 咨询</Button>
        </div>
      </Card>
    </div>
  );
}

type AbroadUpdateDeadline = { label?: string; value?: string; text?: string };
type AbroadUpdateLink = { label: string; href: string };
type AbroadUpdateRow = {
  key: string;
  region: string;
  regionColor: string;
  school: string;
  programs: string;
  deadlines: AbroadUpdateDeadline[];
  note?: string;
  links: AbroadUpdateLink[];
};
type AbroadUpdatePoint = { title: string; detail: string };

// 港 / 新 / 英头部院校 2027 入学（2027/28 学年）的申请窗口，均为项目级时间
const abroadUpdateRows: AbroadUpdateRow[] = [
  {
    key: 'hku-ai',
    region: '中国香港',
    regionColor: 'blue',
    school: '香港大学 HKU',
    programs: 'MSc Artificial Intelligence',
    deadlines: [
      { label: '主轮', value: '2026-11-16 中午' },
      { label: '清算轮', value: '2027-02-01 中午' },
    ],
    links: [{ label: '官网', href: 'https://www.scifac.hku.hk/prospective/tpg/ArtificialIntelligence' }],
  },
  {
    key: 'hku-mds',
    region: '中国香港',
    regionColor: 'blue',
    school: '香港大学 HKU',
    programs: 'Master of Data Science',
    deadlines: [
      { label: '主轮', value: '2026-12-01 中午' },
      { label: '清算轮', value: '2027-04-30 中午' },
    ],
    links: [{ label: '官网', href: 'https://mdasc.cds.hku.hk/admissions-2027-28/' }],
  },
  {
    key: 'hkust-ai-bdt',
    region: '中国香港',
    regionColor: 'blue',
    school: '香港科技大学 HKUST',
    programs: 'MSc Artificial Intelligence、MSc Big Data Technology',
    deadlines: [
      { label: '第一轮', value: '2026-12-01' },
      { label: '第二轮', value: '2027-03-01' },
    ],
    links: [
      { label: 'AI 项目', href: 'https://seng.hkust.edu.hk/academics/taught-postgraduate/msc-ai' },
      { label: 'BDT 项目', href: 'https://seng.hkust.edu.hk/academics/taught-postgraduate/msc-bdt' },
    ],
  },
  {
    key: 'cuhk-cs',
    region: '中国香港',
    regionColor: 'blue',
    school: '香港中文大学 CUHK',
    programs: 'MSc Computer Science',
    deadlines: [{ label: '截止', value: '2027-01-31' }],
    links: [{ label: '官网', href: 'https://msc.cse.cuhk.edu.hk/?lang=en&page_id=90' }],
  },
  {
    key: 'cuhk-ai-fintech',
    region: '中国香港',
    regionColor: 'blue',
    school: '香港中文大学 CUHK',
    programs: 'MSc Artificial Intelligence、MSc Financial Technology',
    deadlines: [{ label: '四轮', value: '2026-10-02 · 2026-11-06 · 2026-12-31 · 2027-02-28' }],
    links: [{ label: '官网', href: 'https://www.gs.cuhk.edu.hk/admissions/application-deadline' }],
  },
  {
    key: 'nus-mcomp',
    region: '新加坡',
    regionColor: 'green',
    school: '新加坡国立大学 NUS',
    programs: 'MComp（含 General Track；）',
    deadlines: [{ label: '2027 年 8 月入学', value: '2026-10-01 至 2027-01-31' }],
    links: [{ label: '官网', href: 'https://www.comp.nus.edu.sg/programmes/pg/mcomp-gen/application/' }],
  },
  {
    key: 'ntu',
    region: '新加坡',
    regionColor: 'green',
    school: '南洋理工大学 NTU',
    programs: 'AI、数据科学、计算机及相关授课型项目',
    deadlines: [
      { text: '不同学院和项目的截止日不同：学校总招生指南列出了 2027/28 各项目的申请窗口，不能用一个日期代表所有 NTU 项目。' },
    ],
    links: [{ label: '招生指南', href: 'https://www.ntu.edu.sg/admissions/graduate/cwadmissionguide' }],
  },
  {
    key: 'imperial',
    region: '英国',
    regionColor: 'purple',
    school: '帝国理工 Imperial',
    programs: 'AI、Computing、Advanced Computing 等',
    deadlines: [{ label: '后续轮次', value: '2027-01-06 · 03-10 · 04-28' }],
    links: [{ label: 'AI 项目', href: 'https://www.imperial.ac.uk/study/courses/postgraduate-taught/artificial-intelligence/' }],
  },
  {
    key: 'ucl',
    region: '英国',
    regionColor: 'purple',
    school: '伦敦大学学院 UCL',
    programs: 'Computer Science、Machine Learning、Computational Statistics and Machine Learning 等',
    deadlines: [
      { label: '需签证', value: '2027-03-22' },
      { label: '不需签证', value: '2027-08-27' },
    ],
    links: [{ label: '官网', href: 'https://www.ucl.ac.uk/study/prospective-students/graduate/courses/computer-science-msc' }],
  },
];

// 2027 入学季值得关注的审理规则与政策变化
const abroadUpdatePolicies: AbroadUpdatePoint[] = [
  {
    title: '港校普遍是分轮 + 滚动审理',
    detail: 'HKU 明确主轮优先；HKUST 和 CUHK 也提示竞争性或滚动审理。实际策略是尽量赶早轮，不能只看最终截止日。',
  },
  {
    title: 'NUS MComp 的入学节奏已收敛到每年 8 月一轮',
    detail: '项目页面注明自 AY2025 起仅有 August intake；不要套用旧年份的多轮次，也不要把其他项目的日期套用过来。',
  },
  {
    title: 'Imperial 使用固定申请轮次',
    detail: '2027 入学项目页面已显示轮次截止和预计决定日期，晚轮仍存在名额不确定性。',
  },
  {
    title: 'UCL 要区分是否需要签证的截止时间',
    detail: '同一课程可能有不同截止日，而且官方说明项目可能在公告截止前因名额满而关闭；部分项目还限制一个申请周期最多申请两个研究生课程。',
  },
  {
    title: '项目名称相近不代表背景要求相同',
    detail: '例如「AI」项目有的欢迎跨专业、有的要求计算机工程背景；申请前要检查该专业的先修课、工作经验、英语要求和推荐材料，不能只凭方向标签判断适配度。',
  },
];

// ---------- 项目级录取难度地图 ----------
type AbroadDifficultyLevel = 'reach' | 'high' | 'mid' | 'easy';
type AbroadSchoolDifficultyGroup = {
  school: string;
  schoolShort: string;
  programs: [string, string, AbroadDifficultyLevel][];
};

// 四档难度：标色用于图例、难度条与项目卡片左边条，文案用于标签
const abroadDifficultyLevels: { key: AbroadDifficultyLevel; label: string; color: string; desc: string }[] = [
  {
    key: 'reach',
    label: '极高',
    color: '#e11d48',
    desc: '往年以 985/211、高 GPA 加硬核实习或科研为主，名额最紧，建议作为冲刺位',
  },
  {
    key: 'high',
    label: '高',
    color: '#f97316',
    desc: '热门王牌项目，对标化、专业匹配度要求高，需要提前 8～10 个月准备',
  },
  {
    key: 'mid',
    label: '中',
    color: '#2563eb',
    desc: '主流可选档：背景达标且方向匹配即有较大机会，适合作为主申',
  },
  {
    key: 'easy',
    label: '相对友好',
    color: '#059669',
    desc: '新设或交叉学科项目，对跨专业、双非背景更友好，可作保底或转方向跳板',
  },
];

// 港 / 新 / 英七所院校的项目级难度（经验评估，同校内不同项目差异远大于学校之间差异）
// 每项依次为：项目中文名（含缩写）、英文全称、难度档
const abroadDifficultyGroups: AbroadSchoolDifficultyGroup[] = [
  {
    school: '香港大学 HKU',
    schoolShort: '港大',
    programs: [
      ['数据科学 MDASC', 'Master of Data Science', 'high'],
      ['统计学 MStat（含 Data Analytics 方向）', 'Master of Statistics', 'mid'],
      ['金融科技方向金融硕士 MFFinTech', 'Master of Finance in Financial Technology', 'reach'],
      ['人工智能 MSc(AI)', 'MSc Artificial Intelligence', 'reach'],
      ['金融科技与数据分析 MSc(FTDA)', 'MSc Financial Technology and Data Analytics', 'reach'],
      ['计算机科学 MSc（网络安全 / 金融计算 / 多媒体计算 / AI）', 'MSc Computer Science', 'high'],
      ['智能网络与信息工程 MSc(Eng)', 'MSc(Eng) Intelligent Networks and Information Engineering', 'mid'],
      ['机器人与智能系统 MSc(Eng)', 'MSc(Eng) Robotics and Intelligent Systems', 'mid'],
      ['电子商务与互联网计算', 'MSc Electronic Commerce & Internet Computing', 'mid'],
      ['工业工程与物流管理 IELM', 'MSc Industrial Engineering and Logistics Management', 'mid'],
      ['创新与科技 MSc(I&T)', 'MSc Innovation and Technology', 'mid'],
      ['生物医学创新 MBioInno（含数字健康与 AI）', 'Master of Biomedical Innovation', 'mid'],
      ['社会数据分析 MSocSc', 'MSocSc in Social Data Analytics', 'mid'],
      ['城市分析', 'MSc Urban Analytics', 'mid'],
      ['建筑人工智能 MSc(BAI)', 'MSc Building Artificial Intelligence', 'easy'],
      ['图书馆与信息管理（数据科学 pathway）', 'MSc Library and Information Management', 'easy'],
    ],
  },
  {
    school: '香港科技大学 HKUST',
    schoolShort: '港科大',
    programs: [
      ['人工智能', 'MSc Artificial Intelligence', 'reach'],
      ['金融科技', 'MSc Financial Technology', 'reach'],
      ['金融数学（量化方向）', 'MSc Financial Mathematics', 'high'],
      ['商业分析', 'MSc Business Analytics', 'high'],
      ['大数据科技', 'MSc Big Data Technology', 'reach'],
      ['信息技术', 'MSc Information Technology', 'high'],
      ['电信学（含通信机器学习方向）', 'MSc Telecommunications', 'mid'],
      ['信息系统管理', 'MSc Information Systems Management', 'mid'],
      ['数据驱动建模', 'MSc Data-Driven Modeling', 'high'],
      ['电子工程（含 AI / 机器人方向）', 'MSc Electronic Engineering', 'mid'],
      ['人工智能与创业', 'MSc AI and Entrepreneurship', 'easy'],
      ['生物分子工程与健康信息学', 'MSc Biomolecular Engineering and Health Informatics', 'easy'],
    ],
  },
  {
    school: '香港中文大学 CUHK',
    schoolShort: '港中大',
    programs: [
      ['计算机科学', 'MSc Computer Science', 'high'],
      ['人工智能', 'MSc Artificial Intelligence', 'reach'],
      ['金融科技', 'MSc Financial Technology', 'reach'],
      ['数据科学与商业统计 DSBS', 'MSc Data Science and Business Statistics', 'high'],
      ['信息工程', 'MSc Information Engineering', 'high'],
      ['信息科学与技术管理 ISTM', 'MSc Information Science and Technology Management', 'mid'],
      ['电子商务与物流技术 ECLT', 'MSc E-Commerce and Logistics Technologies', 'mid'],
      ['生物医学工程（医学影像 / 健康数据）', 'MSc Biomedical Engineering', 'mid'],
      ['机器人学', 'MSc Robotics', 'high'],
      ['科学人工智能', 'MSc Artificial Intelligence for Science', 'easy'],
      ['数字经济与人工智能 DEAI', 'MSc Digital Economy and Artificial Intelligence', 'easy'],
      ['地理信息科学与智慧城市', 'MSc GeoInformation Science and Smart Cities', 'easy'],
    ],
  },
  {
    school: '新加坡国立大学 NUS',
    schoolShort: '新国立',
    programs: [
      ['数据科学与机器学习 DSML', 'MSc Data Science and Machine Learning', 'reach'],
      ['计算机硕士·人工智能方向', 'Master of Computing in Artificial Intelligence', 'reach'],
      ['计算机硕士·计算机科学方向', 'Master of Computing - Computer Science Specialisation', 'high'],
      ['计算机硕士·信息系统方向', 'Master of Computing - Information Systems Specialisation', 'mid'],
      ['计算机硕士·信息安全方向', 'Master of Computing - Infocomm Security Specialisation', 'mid'],
      ['计算机硕士·通用方向（转专业友好）', 'Master of Computing - General Track', 'high'],
      ['技术硕士·人工智能系统', 'Master of Technology in Artificial Intelligence Systems', 'mid'],
      ['技术硕士·企业商业分析', 'Master of Technology in Enterprise Business Analytics', 'mid'],
      ['技术硕士·软件工程', 'Master of Technology in Software Engineering', 'mid'],
      ['技术硕士·数字领导力', 'Master of Technology in Digital Leadership', 'easy'],
      ['生物医学信息学', 'MSc Biomedical Informatics', 'mid'],
      ['精准健康与医学 × AI', 'MSc Precision Health & Medicine x AI', 'easy'],
    ],
  },
  {
    school: '南洋理工大学 NTU',
    schoolShort: '南洋理工',
    programs: [
      ['人工智能 MSAI', 'MSc Artificial Intelligence', 'reach'],
      ['数据科学 MSDS', 'MSc Data Science', 'high'],
      ['网络安全 MSCS', 'MSc Cyber Security', 'high'],
      ['金融科技', 'MSc Financial Technology', 'high'],
      ['应用人工智能计算硕士 MCAAI', 'Master of Computing in Applied AI', 'mid'],
      ['网络安全·应用方向', 'MSc Cybersecurity (Applied Cybersecurity)', 'mid'],
      ['区块链', 'MSc Blockchain', 'mid'],
      ['生物医学数据科学', 'MSc Biomedical Data Science', 'mid'],
      ['电子电气工程（EEE 下全部 programme）', 'MSc programmes under EEE', 'mid'],
      ['企业人工智能', 'MSc Enterprise Artificial Intelligence', 'easy'],
    ],
  },
  {
    school: '帝国理工学院 Imperial',
    schoolShort: '帝国理工',
    programs: [
      ['计算机科学（面向非 CS 背景）', 'MSc Computing', 'high'],
      ['高级计算机科学（面向 CS 背景）', 'MSc Advanced Computing', 'reach'],
      ['人工智能', 'MSc Artificial Intelligence', 'reach'],
      ['计算机·AI 与机器学习方向', 'MSc Computing (AI and Machine Learning)', 'reach'],
      ['计算机·软件工程方向', 'MSc Computing (Software Engineering)', 'high'],
      ['计算机·安全与可靠性方向', 'MSc Computing (Security and Reliability)', 'high'],
      ['计算机·视觉计算与机器人方向', 'MSc Computing (Visual Computing and Robotics)', 'high'],
      ['AI 应用与创新', 'MSc Artificial Intelligence Applications and Innovation', 'mid'],
      ['应用机器学习', 'MSc Applied Machine Learning', 'high'],
      ['统计学', 'MSc Statistics', 'high'],
      ['统计学·数据科学与机器学习方向', 'MSc Statistics (Data Science and Machine Learning)', 'high'],
      ['应用计算科学与工程', 'MSc Applied Computational Science and Engineering', 'mid'],
      ['AI、经济与政策', 'MSc AI, Economics and Policy', 'easy'],
      ['商业分析与 AI', 'MSc Business Analytics & AI', 'high'],
      ['通信与信号处理', 'MSc Communications and Signal Processing', 'mid'],
      ['金融科技', 'MSc Financial Technology', 'high'],
    ],
  },
  {
    school: '伦敦大学学院 UCL',
    schoolShort: 'UCL',
    programs: [
      ['计算机科学（转专业项目）', 'Computer Science MSc', 'high'],
      ['机器学习', 'Machine Learning MSc', 'reach'],
      ['数据科学与机器学习', 'Data Science and Machine Learning MSc', 'reach'],
      ['人机交互', 'Human-Computer Interaction MSc', 'high'],
      ['计算统计与机器学习', 'Computational Statistics and Machine Learning MSc', 'high'],
      ['人工智能与数据工程', 'Artificial Intelligence and Data Engineering MSc', 'mid'],
      ['金融科技', 'Financial Technology MSc', 'high'],
      ['计算金融', 'Computational Finance MSc', 'high'],
      ['金融风险管理（CS 系开设）', 'Financial Risk Management MSc', 'mid'],
      ['金融与数据科学', 'Finance with Data Science MSc', 'high'],
      ['数据科学', 'Data Science MSc', 'reach'],
      ['统计学', 'Statistics MSc', 'high'],
      ['生物医学与医疗 AI', 'Artificial Intelligence for Biomedicine and Healthcare MSc', 'mid'],
      ['机器人与人工智能', 'Robotics and Artificial Intelligence MSc', 'high'],
      ['软件系统工程', 'Software Systems Engineering MSc', 'mid'],
      ['信息安全', 'Information Security MSc', 'mid'],
      ['新兴数字技术（AI / 区块链 / 云）', 'Emerging Digital Technologies MSc', 'mid'],
      ['计算机图形、视觉与成像', 'Computer Graphics, Vision and Imaging MSc', 'mid'],
      ['物联网系统工程', 'Systems Engineering for the Internet of Things MSc', 'easy'],
      ['集成机器学习系统', 'Integrated Machine Learning Systems MSc', 'mid'],
      ['可持续发展 AI', 'Artificial Intelligence for Sustainable Development MSc', 'easy'],
      ['医学统计与数据科学', 'Medical Statistics and Data Science MSc', 'mid'],
      ['健康数据科学', 'Health Data Science MSc', 'mid'],
      ['科学与数据密集型计算', 'Scientific and Data Intensive Computing MSc', 'mid'],
      ['知识、信息与数据科学', 'Knowledge, Information and Data Science MSc', 'easy'],
      ['AI 与医学影像', 'Artificial Intelligence and Medical Imaging MSc', 'mid'],
      ['医疗机器人与 AI', 'Medical Robotics and Artificial Intelligence MSc', 'mid'],
      ['时空分析与大数据挖掘', 'Spatio-temporal Analytics and Big Data Mining MSc', 'mid'],
      ['地理空间科学·GIS 与计算', 'Geospatial Sciences (GIS and Computing) MSc', 'easy'],
      ['城市空间科学', 'Urban Spatial Science MSc', 'easy'],
    ],
  },
];

// 留学专区二级页：2027 入学申请时间表 + 审理规则变化
function StudyAbroadUpdatesPage() {
  const navigate = useNavigate();

  // 难度地图筛选：'全部' 表示不筛选
  const [difficultySchool, setDifficultySchool] = useState('全部');
  const [difficultyLevel, setDifficultyLevel] = useState<'全部' | AbroadDifficultyLevel>('全部');

  // 每所学校的难度分布 + 全平台各档计数，供难度条与图例使用
  const difficultyOverview = useMemo(() => {
    const total: Record<AbroadDifficultyLevel, number> = { reach: 0, high: 0, mid: 0, easy: 0 };
    const schools = abroadDifficultyGroups.map((group) => {
      const counts: Record<AbroadDifficultyLevel, number> = { reach: 0, high: 0, mid: 0, easy: 0 };
      group.programs.forEach(([, , level]) => {
        counts[level] += 1;
      });
      abroadDifficultyLevels.forEach((item) => {
        total[item.key] += counts[item.key];
      });
      return { ...group, counts, programTotal: group.programs.length };
    });
    return {
      schools,
      total,
      programTotal: schools.reduce((sum, school) => sum + school.programTotal, 0),
    };
  }, []);

  // 按院校 / 难度过滤后仍保留院校分组，空分组不渲染
  const difficultyGroups = useMemo(
    () =>
      difficultyOverview.schools
        .filter((group) => difficultySchool === '全部' || group.schoolShort === difficultySchool)
        .map((group) => ({
          ...group,
          programs: group.programs
            .map(([program, programEn, level], index) => ({
              key: `${group.schoolShort}-${index}`,
              program,
              programEn,
              level,
            }))
            .filter((item) => difficultyLevel === '全部' || item.level === difficultyLevel),
        }))
        .filter((group) => group.programs.length > 0),
    [difficultyOverview, difficultySchool, difficultyLevel]
  );

  // 同一所学校的多行合并「地区 / 学校」单元格，只保留在每组首行
  const schoolRowSpans = useMemo(() => {
    const spans: Record<string, number> = {};
    let currentGroup = '';
    let groupStartKey = '';
    let groupCount = 0;

    abroadUpdateRows.forEach((row) => {
      const group = `${row.region}|${row.school}`;
      if (group !== currentGroup) {
        if (groupStartKey) spans[groupStartKey] = groupCount;
        currentGroup = group;
        groupStartKey = row.key;
        groupCount = 1;
        return;
      }
      groupCount += 1;
      spans[row.key] = 0;
    });
    if (groupStartKey) spans[groupStartKey] = groupCount;

    return spans;
  }, []);

  const renderPoints = (points: AbroadUpdatePoint[]) => (
    <div>
      {points.map((p, index) => (
        <div className="abroad-item" key={p.title}>
          <span className="abroad-item-index">{String(index + 1).padStart(2, '0')}</span>
          <div className="abroad-item-body">
            <Text strong>{p.title}</Text>
            <Paragraph type="secondary" style={{ margin: '2px 0 0' }}>{p.detail}</Paragraph>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="career-planning-page">
      <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning?tab=abroad')}>← 返回留学专区</Button>
      <div className="career-hero">
        <div className="career-hero-badge">🌏 留学专区 · 申请新动态</div>
        <Title level={2}>留学申请<span className="career-hero-highlight">新动态</span></Title>
        <Paragraph>港、新、英头部院校 2027 入学的申请窗口与截止日期，叠加 108 个项目级录取难度画像与最新审理规则变化，把网申节奏排到日历上</Paragraph>
      </div>

      <Card
        className="career-resource-card"
        title="一、2027 入学申请时间与截止日期"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>更新于 2026 年 10 月</Text>}
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          message="表格是「项目级」时间窗口，不是录取难度参考"
          description="港校多为分轮 + 滚动审理，项目可能在公告截止前满额关闭；请以目标项目官网最新页面为准。项目难度的相对档位见下方「二、项目录取难度地图」。"
        />
        <Text type="secondary" className="abroad-table-tip">内容较多，可左右滑动表格查看完整信息</Text>
        <Table
          className="abroad-update-table"
          style={{ marginTop: 8 }}
          size="middle"
          pagination={false}
          rowKey="key"
          scroll={{ x: 1120 }}
          dataSource={abroadUpdateRows}
          columns={[
            {
              title: '学校',
              dataIndex: 'school',
              width: 210,
              fixed: 'left',
              onCell: (row) => ({ rowSpan: schoolRowSpans[row.key] }),
              render: (_: string, row: AbroadUpdateRow) => (
                <Text strong className="abroad-update-school-name">{row.school}</Text>
              ),
            },
            {
              title: '项目示例',
              dataIndex: 'programs',
              width: 320,
              render: (value: string) => <p className="abroad-update-programs">{value}</p>,
            },
            {
              title: '2027 入学申请时间或截止日期',
              dataIndex: 'deadlines',
              width: 450,
              render: (_: AbroadUpdateDeadline[], row: AbroadUpdateRow) => (
                <div className="abroad-deadline-list">
                  {row.deadlines.map((deadline, index) => (
                    <div className="abroad-deadline-line" key={`${row.key}-${index}`}>
                      {deadline.label && <Tag color="orange">{deadline.label}</Tag>}
                      {deadline.value
                        ? <Text strong>{deadline.value}</Text>
                        : <Text type="secondary">{deadline.text}</Text>}
                    </div>
                  ))}
                  {row.note && <div className="abroad-deadline-note">{row.note}</div>}
                </div>
              ),
            },
            {
              title: '官网',
              dataIndex: 'links',
              width: 140,
              align: 'center',
              render: (_: AbroadUpdateLink[], row: AbroadUpdateRow) => (
                <div className="abroad-update-links">
                  {row.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label} ↗
                    </a>
                  ))}
                </div>
              ),
            },
          ]}
        />
        <Paragraph type="secondary" style={{ margin: '12px 0 0', fontSize: 12 }}>
          注：截止时间标注「中午」的以官网公布的当地时间为准；轮次日期可能因项目调整变化，提交前请再核对一次项目页面。
        </Paragraph>
      </Card>

      <Card
        className="career-resource-card"
        title="二、项目录取难度地图"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>{difficultyOverview.programTotal} 个项目 · {difficultyOverview.schools.length} 所院校</Text>}
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="warning"
          showIcon
          message="难度是同校内的相对档位，不是录取概率"
          description="同一所学校里不同项目的差距，往往大于不同学校之间的差距：计算机与金融科技类扎堆最严重，「交叉 + 新设」项目通常更宽松。请以自己的 GPA、先修课与实习科研匹配度为准。"
        />

        <div className="abroad-diff-legend">
          {abroadDifficultyLevels.map((level) => (
            <div className="abroad-diff-legend-item" key={level.key}>
              <span className="abroad-diff-legend-head">
                <i className="abroad-diff-dot" style={{ background: level.color }} />
                <Text strong>{level.label}</Text>
                <span className="abroad-diff-legend-count">{difficultyOverview.total[level.key]} 个</span>
              </span>
              <span className="abroad-diff-legend-desc">{level.desc}</span>
            </div>
          ))}
        </div>

        <div className="abroad-diff-overview">
          {difficultyOverview.schools.map((row) => (
            <button
              type="button"
              key={row.schoolShort}
              className={`abroad-diff-overview-row${difficultySchool === row.schoolShort ? ' is-active' : ''}`}
              onClick={() => setDifficultySchool(difficultySchool === row.schoolShort ? '全部' : row.schoolShort)}
            >
              <span className="abroad-diff-overview-school">{row.schoolShort}</span>
              <span className="abroad-diff-bar">
                {abroadDifficultyLevels.map((level) =>
                  row.counts[level.key] > 0 ? (
                    <span
                      key={level.key}
                      className="abroad-diff-bar-seg"
                      style={{ width: `${(row.counts[level.key] / row.programTotal) * 100}%`, background: level.color }}
                      title={`${level.label} ${row.counts[level.key]} 个`}
                    />
                  ) : null
                )}
              </span>
              <span className="abroad-diff-overview-count">{row.programTotal}</span>
            </button>
          ))}
        </div>
        <Text type="secondary" className="abroad-diff-hint">
          点选学校行或下方标签可按院校 / 难度筛选项目，再次点击已选学校即取消筛选
        </Text>

        <div className="abroad-diff-filters">
          <div className="abroad-diff-filter-row">
            <span className="abroad-diff-filter-label">院校</span>
            <Tag.CheckableTag checked={difficultySchool === '全部'} onChange={() => setDifficultySchool('全部')}>
              全部
            </Tag.CheckableTag>
            {difficultyOverview.schools.map((school) => (
              <Tag.CheckableTag
                key={school.schoolShort}
                checked={difficultySchool === school.schoolShort}
                onChange={() => setDifficultySchool(school.schoolShort)}
              >
                {school.schoolShort}
              </Tag.CheckableTag>
            ))}
          </div>
          <div className="abroad-diff-filter-row">
            <span className="abroad-diff-filter-label">难度</span>
            <Tag.CheckableTag checked={difficultyLevel === '全部'} onChange={() => setDifficultyLevel('全部')}>
              全部
            </Tag.CheckableTag>
            {abroadDifficultyLevels.map((level) => (
              <Tag.CheckableTag
                key={level.key}
                checked={difficultyLevel === level.key}
                onChange={() => setDifficultyLevel(level.key)}
              >
                {level.label}
              </Tag.CheckableTag>
            ))}
          </div>
        </div>

        {difficultyGroups.length === 0 && <Empty description="当前筛选下暂无项目" />}

        {difficultyGroups.map((group) => (
          <div className="abroad-diff-group" key={group.schoolShort}>
            <div className="abroad-diff-group-head">
              <Text strong>{group.school}</Text>
              <span className="abroad-diff-group-count">{group.programs.length} 个项目</span>
            </div>
            <div className="abroad-diff-programs">
              {group.programs.map((item) => (
                <div className={`abroad-diff-program abroad-diff-program-${item.level}`} key={item.key}>
                  <span className="abroad-diff-program-zh">{item.program}</span>
                  <span className="abroad-diff-program-en">{item.programEn}</span>
                  <span className={`abroad-diff-badge abroad-diff-badge-${item.level}`}>
                    {abroadDifficultyLevels.find((level) => level.key === item.level)?.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card className="career-resource-card" title="三、值得关注的政策与申请规则" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          2027 入学季的核心变化不在「截止日提前」，而在审理方式：分轮、滚动、名额先到先得，直接决定了提交顺序比截止日更重要。
        </Paragraph>
        {renderPoints(abroadUpdatePolicies)}
      </Card>

      <Card className="career-resource-card career-followup-cta">
        <div style={{ textAlign: 'center' }}>
          <Title level={5}>想按自己的背景把这几张时间表排成一条申请日历？</Title>
          <Paragraph type="secondary">结合 GPA、语言出分计划与目标项目，倒推每一轮的提交节点</Paragraph>
          <Button type="primary" size="large" onClick={() => navigate('/consultation')}>立即预约 1v1 咨询</Button>
        </div>
      </Card>
    </div>
  );
}

// 长期随访：一级页双列卡片流与二级页 /career-planning/followup/:storyId 共用同一份数据
type FollowupSection = { label: string; text: string; wide?: boolean };

// 随访文章的分类：左上角三角角标按类别配色，方便快速区分
// 注：赵同学是跨考上岸，归到「考研」；如需并回三类，把类别改成「保研」即可
type FollowupCategory = '求职' | '留学' | '保研' | '考研';

const followupCategoryClass: Record<FollowupCategory, string> = {
  求职: 'job',
  留学: 'abroad',
  保研: 'postgrad',
  考研: 'exam',
};

type FollowupStory = {
  id: string;
  category: FollowupCategory;
  name: string;
  school: string;
  period: string;
  avatar: string;
  cover: string;
  title: string;
  summary: string;
  achievement: string;
  sections: FollowupSection[];
};

const followupStories: FollowupStory[] = [
  {
    id: 'zhou-baidu',
    category: '求职',
    name: '周同学',
    school: '某高校计算机',
    period: '2027届',
    avatar: '🚀',
    cover: '/followup/story-baidu-campus.jpg',
    title: '两段大厂实习，第二段进百度做 Agent 研发',
    summary: '大二暑假就开始投实习，在岗时拿下百度 Agent 研发岗；每场面试录音复盘，离职前把实习证明和推荐信一次收齐。',
    achievement: '百度 · Agent 研发实习',
    sections: [
      {
        label: '实习时机',
        text: '大二暑假我就开始投了，别等大三下。手上有一段在跑的时候，反而更好投下一段——我 8 月底一边实习一边面百度，9 月中出 offer，9 月 21 日就入职了，两段连起来，节奏一点没浪费。',
      },
      {
        label: '实习准备',
        text: '投之前先把目标公司和产品线摸清楚。我面 Agent 岗被问到 dumate，还以为是内部代号，结果是人家自家的产品——这种尴尬说到底就是准备没做够。简历上少写“参与”，把一件具体的事讲清楚：做了什么、效果多少。',
      },
      {
        label: '面试应考',
        text: '每场面试我都录音，回来逐句复盘：哪里答得虚、哪个问题卡住，当天就补。面试官说“不用自我介绍”也别掉以轻心，一样要能三句话说清自己做什么。答不上来就直说不知道，回去把它变成知道——面试官更在意你怎么面对不会。',
      },
      {
        label: '实际工作',
        text: '进百度之后一直在 agent 开发这条线上，一个多月学到的东西比在学校半年还密。也提醒一句：离职别拍拍屁股就走，实习证明先开好，再请 leader 用公司邮箱写一封推荐信，下一段实习和之后申请都用得上。',
      },
      {
        label: '对辅导老师的评价',
        text: '老师没替我面试，他是那个逼我把每场面试变成经验的人：催录音、催复盘，有匹配的岗位先想到我（货拉拉 HR、字节的岗位都是他直接推的）。我赶项目的时候他不扰我，我要找第二段了他又第一时间接上，这种分寸感挺难得。',
        wide: true,
      },
    ],
  },
  {
    id: 'sui-hku',
    category: '留学',
    name: '隋同学',
    school: '北邮海南学院 计算机',
    period: '2026届',
    avatar: '✨',
    cover: '/followup/story-hku-campus.jpg',
    title: '均分 84、0 实习，正式批首录港大 CS',
    summary: '大三结束均分 84、雅思 6.5、实习空白，先把软背景用科研补起来；港大提前批因排名被挡，稳住心态转正式批，2026 年 2 月收到港大 CS 录取。',
    achievement: '香港大学 · CS 硕士录取',
    sections: [
      {
        label: '起点与定位',
        text: '我是北邮海南学院第一届学生，没有往届经验可参照。大三结束均分 84、雅思 6.5——不算差，但在计算机方向的申请里真算不上突出。最要命的是实习：准确说到大三结束还是 0 段。越查案例越焦虑，港新方向是知道的，但具体怎么走、短板怎么补，完全没头绪。',
      },
      {
        label: '把短板补上',
        text: '博哥没有先画大饼，而是把我能补的部分拆出来：绩点已过门槛不必死磕，最紧迫的是用科研填掉实习的空白。我按他的建议去申请了本校实验室，这段科研后来几乎撑起了我整个软背景，文书也终于有东西可写。科研老师的反馈是“很按时去实验室，很上心”。',
      },
      {
        label: '语言与节奏',
        text: '语言上他给我下了“死命令”：十一假期前后必须出分，并给了对应的备考策略。选校、申请节点也一并排清楚——第一次知道该往哪走之后，焦虑就换成了执行：雅思按节奏推进，科研持续推进，不再纠结“我行不行”。',
      },
      {
        label: '提前批被拒',
        text: '港大 CS 提前批的反馈很直接：排名在 40% 以后，无法参加提前批考试。那一刻我以为港大跟我无缘了。博哥只回了一句“没事，提前批不行咱们就正常申”。听起来简单，但对刚被拒的人来说是真定心丸——提前批不是唯一的路，正式批一样有机会。',
      },
      {
        label: '正式批录取',
        text: '正式申之前，博哥把我零散的科研经历和课业成绩重新梳理了一遍，像上阵前把武器弹药擦干净。2026 年 2 月的一个晚上，我像往常一样打开邮箱，港大 CS 的录取就躺在那里——正式批首录，之前的焦虑和怀疑一下就都放下了。',
      },
      {
        label: '对辅导老师的评价',
        text: '务实分析不画饼，是我信任他的根源：不说“你肯定行”，也不制造焦虑说“你这背景悬”，而是把问题翻译成行动方案，再排优先级——什么该重点补、什么可以放一放。遇事沉着经验足，是他服务里最值钱的部分：提前批被拒时他没有过度安慰，也没有一点慌张，那种镇定本身就在告诉我“还有路”。',
        wide: true,
      },
      {
        label: '致学弟学妹',
        text: '这段经历教会我最重要的一件事：面对不确定性，与其问“我行不行”，不如想“下一步该做什么”。提前批被拒就是最好的例子——以前的我可能就此放弃港大，走完这一遭才知道，一次挫折不等于终局，持续的规划和努力才靠得住。',
        wide: true,
      },
    ],
  },
  {
    id: 'zhang-tsinghua',
    category: '保研',
    name: '张同学',
    school: '某211计算机',
    period: '2023届',
    avatar: '🎓',
    cover: '/followup/story-tsinghua.jpg',
    title: 'GPA 前 5%，夏令营同时拿下清华、北大、浙大',
    summary: '大二上就把保研当主线，绩点、科研、竞赛按学期排进日程；夏令营阶段只做一件事：把材料讲清楚。',
    achievement: '保研至清华大学计算机系',
    sections: [
      {
        label: '前期规划',
        text: '大二上就把保研当主线：先把绩点稳住（最终排名前 5%），再把每学期的科研、竞赛排进日程。很多人到大三下才开始准备，其实名额在那之前就已经定了大半。',
      },
      {
        label: '科研与材料',
        text: '两段科研经历加一篇论文，不是为了堆数量，而是能在面试时讲清楚：问题是什么、我做了什么、结果怎么验证。夏令营材料也按这个逻辑写，不写“我热爱科研”。',
      },
      {
        label: '夏令营节奏',
        text: '清华、北大、浙大的夏令营时间高度重叠，提前排好时间与准备顺序，每场结束当天复盘，把被追问的点补进下一场。',
      },
      {
        label: '给师弟师妹的一句话',
        text: '保研是四年的事，不是大三下三个月的冲刺。绩点是门票，科研和表达决定你能走多远。',
        wide: true,
      },
    ],
  },
  {
    id: 'li-cmu',
    category: '留学',
    name: '李同学',
    school: '某双非软件工程',
    period: '2023届',
    avatar: '🌏',
    cover: '/followup/story-cmu.jpg',
    title: '双非起步，拿到 CMU MSCS 全奖',
    summary: '从双非本科出发，用科研实习、海外推荐信和精准选校，把“不可能”拆成一年内可执行的清单。',
    achievement: 'CMU MSCS 全奖录取',
    sections: [
      {
        label: '选校定位',
        text: '先认清自己的位置：双非背景冲顶尖项目，必须用科研和推荐信补位。选校按冲刺 / 主申 / 保底拉开梯度，把钱和精力押在最匹配的项目上。',
      },
      {
        label: '科研与推荐信',
        text: '主动进实验室，从跑实验、写报告做起，做出能写进文书的成果；推荐信找真正了解你的老师写，能说出具体细节的推荐信才有分量。',
      },
      {
        label: '文书',
        text: '文书不写“我热爱计算机”，写具体做过什么、遇到什么、怎么解决，以及为什么非这个项目不可。',
      },
      {
        label: '给师弟师妹的一句话',
        text: '出身决定起跑线，不决定终点。把能控的部分做到极致，剩下的交给时间。',
        wide: true,
      },
    ],
  },
  {
    id: 'wang-bytedance',
    category: '求职',
    name: '王同学',
    school: '某985信息学院',
    period: '2024届',
    avatar: '💼',
    cover: '/followup/story-bytedance.jpg',
    title: '两段大厂实习，秋招拿到字节跳动 SP',
    summary: '大三一年跑完两段实习，刷题与项目同步推进，秋招时手里握着字节、腾讯、阿里多个 SP。',
    achievement: '字节跳动 SP Offer',
    sections: [
      {
        label: '实习节奏',
        text: '大三上开始投第一段实习，寒假前落地；第二段按目标岗位挑，尽量让两段在同一条技术线上，简历才有主线。',
      },
      {
        label: '刷题与项目',
        text: '刷题只解决入场券，项目决定能谈多少。把实习里的真实模块沉淀成可讲的技术故事，面试时按“背景 - 方案 - 权衡 - 结果”讲。',
      },
      {
        label: '秋招策略',
        text: '提前批先投最想去的几家练手，正式批再冲；每场面试当天复盘，把被问倒的点补进题库。',
      },
      {
        label: '给师弟师妹的一句话',
        text: '实习不是简历上的装饰，是你把学校知识换成工程能力的地方。',
        wide: true,
      },
    ],
  },
  {
    id: 'zhao-zju',
    category: '考研',
    name: '赵同学',
    school: '某211数学系',
    period: '2024届',
    avatar: '📚',
    cover: '/followup/story-zju.jpg',
    title: '数学系转码，8 个月从零上岸浙大',
    summary: '408 零基础起步，把四门专业课、数学和英语排成可执行的时间表，初试 400+、复试机试满分。',
    achievement: '跨考上岸浙江大学计算机',
    sections: [
      {
        label: '为什么转',
        text: '数学底子是我的优势，缺的是工程基础。想清楚这一点后，复习重心直接压到 408 和机试，而不是从头补专业课。',
      },
      {
        label: '八个月怎么过',
        text: '把 8 个月切成四段：三门公共课打地基 → 408 第一轮 → 真题与机试 → 冲刺。每周固定一天做复盘，只调计划不硬扛。',
      },
      {
        label: '复试',
        text: '机试满分靠的是考前两个月每天固定题量；面试把跨专业的经历讲成优势，而不是道歉。',
      },
      {
        label: '给师弟师妹的一句话',
        text: '跨考最难的不是知识，是节奏和心态。按周推进，别按情绪推进。',
        wide: true,
      },
    ],
  },
  {
    id: 'chen-hkust',
    category: '留学',
    name: '陈同学',
    school: '某普通一本CS',
    period: '2024届',
    avatar: '🏆',
    cover: '/followup/story-hkust.jpg',
    title: '普通一本背景，拿到港科大 MSc 录取',
    summary: 'GPA、一段对口的实习和一份反复打磨的文书，把普通一本的背景讲成了港科大能读懂的故事。',
    achievement: '香港科技大学 MSc 录取',
    sections: [
      {
        label: '硬指标先过关',
        text: '港校看重 GPA 与语言成绩，这两项没到位，文书再好也难进审理；先把分数拉到项目的中位数以上。',
      },
      {
        label: '实习与项目',
        text: '一段与申请方向一致的实习，比三段无关经历更有用。项目要能说清你负责哪一块、产出了什么。',
      },
      {
        label: '文书打磨',
        text: '文书至少改五稿：第一稿写事实，第二稿删形容词，后面几稿对照项目要求逐条印证。',
      },
      {
        label: '给师弟师妹的一句话',
        text: '申请不是运气，是把每一项材料都做到“刚好够好”的累积。',
        wide: true,
      },
    ],
  },
];

// 每个专区内容末尾统一的咨询跳转模块：文案按专区区分，样式统一用工 .career-followup-cta
function ConsultCta({ title, onConsult }: { title: string; onConsult: () => void }) {
  return (
    <Card className="career-followup-cta" style={{ marginTop: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <Title level={5}>{title}</Title>
        <Button type="primary" size="large" onClick={onConsult}>立即预约 1v1 咨询</Button>
      </div>
    </Card>
  );
}

function CareerPlanningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobsBoardOpen, setJobsBoardOpen] = useState(false);
  const [activeJobCategory, setActiveJobCategory] = useState('技术类');
  // 二级页面返回时可通过 ?tab=abroad 直接锚定对应专区，默认仍为求职专区
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'internship');

  // 岗位集结号是页内二级视图（不换路由），上层的路由回顶 effect 不会触发：
  // 进入与返回都手动回顶，否则会沿用上一个视图的滚动位置，一进来就停在页面中间
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [jobsBoardOpen]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate(key === 'internship' ? '/career-planning' : `/career-planning?tab=${key}`, { replace: true });
  };

  const postgraduateData = [
    { title: '保研时间线全攻略', desc: '从大一到大三的完整保研规划路径，包括成绩、科研、竞赛准备节点', tag: '规划', color: 'blue' },
    { title: '保研材料清单与写作指导', desc: '个人陈述、推荐信、简历等核心材料的模板与撰写技巧', tag: '材料', color: 'green' },
    { title: '计算机方向保研面试高频问题', desc: '数据结构、操作系统、项目经验等面试常见问题梳理', tag: '面试', color: 'orange' },
    { title: '保研信息差速递（持续更新）', desc: '各校夏令营开放时间、往年数据、最新政策变动汇总', tag: '动态', color: 'red' },
  ];

  const studyAbroadData = [
    { title: '趋势分析定选校', desc: '从十余年申请趋势看清当下竞争格局，按「港 > 新 > 英」梯度完成冲刺/主申/保底定位', tag: '定位', color: 'blue' },
    { title: '留学申请新动态', desc: '108 个项目的录取难度画像、各校 Deadline 更新与政策变化解读', tag: '动态', color: 'red' },
    { title: 'GRE/TOEFL/IELTS备考指南', desc: '高效备考方法、资料推荐和分数目标设定', tag: '标化', color: 'orange' },
    // 「文书写作与CV打造」暂不展示，恢复时取消整行注释即可
    // { title: '文书写作与CV打造', desc: 'SOP/PS撰写逻辑框架、CV排版技巧、推荐人选择策略', tag: '文书', color: 'purple' },
  ];

  const internshipData = [
    { title: '大厂申请全流程', desc: '从面试准备、简历投递到Offer接收的完整链路，含个人评估、时间节点与注意事项', tag: '流程', color: 'blue' },
    { title: '实习岗位集结号', desc: '各大厂春招/秋招/日常实习时间线与内推渠道汇总，点击查看在招岗位', tag: '动态', color: 'red' },
    { title: '技术干货抢先读', desc: '精选大厂技术文章与面试干货，抢先掌握前沿技术动态与实战经验', tag: '干货', color: 'cyan' },
    { title: '1V1全流程辅导', desc: '职业性格评测、个人能力摸底、背景&简历提升、模拟面试、真实面试复盘、流程跟进等全流程陪跑', tag: '辅导', color: 'purple', highlight: true },
  ];

  // 大厂实习的三重回报：经济 / 就业 / 深造，求职专区列表下方归纳展示
  const internshipValueData = [
    {
      tag: '独立',
      color: 'green',
      title: '经济独立，讲话硬气',
      summary: '头部大厂实习日薪 200-800 元，叠加房补与餐补，单月综合收入可达 8k-20k，在校期间就能实现财务独立。',
    },
    {
      tag: '就业',
      color: 'blue',
      title: '打破信息差，锁定优质 Offer',
      summary: '暑期实习是最稳的转正通道，一段头部大厂背书能让后续简历通过率显著跃升。',
    },
    {
      tag: '深造',
      color: 'purple',
      title: '留学与科研的加速器',
      summary: '真实的算法落地或 Agent 项目经历，是港新英 CS / AI / DS 申请里最硬的文书素材与推荐信来源。',
    },
  ];

  // 留学的三重回报：就业 / 深造 / 成长，与求职专区同款三栏呈现
  const studyAbroadValueData = [
    {
      tag: '就业',
      color: 'blue',
      title: '打破内卷，构建差异化壁垒',
      summary: 'QS 前 50/100 可享落户、补贴与购车免税，1-1.5 年学制叠加海外背景，让你比同龄人早一步入场。',
    },
    {
      tag: '深造',
      color: 'purple',
      title: '接轨国际学术标准',
      summary: '头部实验室常与 DeepMind、MSRA 深度合作，名校教授推荐信在申请全奖 PhD 时含金量更高。',
    },
    {
      tag: '成长',
      color: 'green',
      title: '完成真正的个人蜕变',
      summary: '全英文高压环境与多元文化协作，练出独立判断、全球化视野与抗压能力。',
    },
  ];

  // 各专区在 hero 内展示的三重回报（仅求职、留学两个专区有内容）
  const heroValueData: Record<string, typeof internshipValueData> = {
    internship: internshipValueData,
    abroad: studyAbroadValueData,
  };

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
    data: { title: string; desc: string; tag: string; color: string; highlight?: boolean }[],
    onItemClick?: (item: { title: string; desc: string; tag: string; color: string; highlight?: boolean }) => void,
  ) => (
    <List
      dataSource={data}
      renderItem={(item) => (
        <List.Item className={onItemClick ? 'career-list-item--clickable' : 'career-list-item--static'}>
          <Card
            className={`career-resource-card${onItemClick ? ' career-resource-card--clickable' : ''}`}
            hoverable={Boolean(onItemClick)}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          >
            <div className="career-resource-main">
              <div className="career-resource-body">
                <div className="career-resource-header">
                  {/* highlight 卡片：皇冠包在与其它卡片同款的金色小标签里 */}
                  {item.highlight ? (
                    <Tag
                      color="gold"
                      style={{
                        // 不覆盖 marginInlineEnd，保留 antd 默认 8px，与文字标签的 标签→标题间距一致
                        paddingInline: 7,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        // 与其他文字标签（宽 40 / 高 22）保持同尺寸
                        minWidth: 40,
                        height: 22,
                      }}
                    >
                      <CrownOutlined style={{ fontSize: 16 }} />
                    </Tag>
                  ) : (
                    <Tag color={item.color}>{item.tag}</Tag>
                  )}
                  <Text className="career-resource-title" strong style={item.highlight ? { color: '#b8860b' } : undefined}>
                    {item.title}
                  </Text>
                </div>
                <Paragraph type="secondary" className="career-resource-desc">{item.desc}</Paragraph>
              </div>
              {/* 右侧固定一个「查看详情」入径：卡片整体可点，这里只做可点击的视觉提示 */}
              {onItemClick && (
                <span className="career-resource-action" aria-hidden="true">
                  查看详情
                  <ArrowRightOutlined />
                </span>
              )}
            </div>
          </Card>
        </List.Item>
      )}
    />
  );

  // 四个专区的 hero 主标题各写一句，后半句（渐变字）承载各自的核心目标
  const heroTitleData: Record<string, { lead: string; highlight: string }> = {
    internship: { lead: '实习先人一步，', highlight: '未来职场不焦虑！' },
    abroad: { lead: '找准自身定位，', highlight: '名校录取不是梦～' },
    postgraduate: { lead: '选课、竞赛、论文，', highlight: '是你保研上岸的最大助力' },
    followup: { lead: '沿着学长的真实轨迹，', highlight: '找到属于你自己的最优解！' },
  };
  const heroTitle = heroTitleData[activeTab] || { lead: '为你的未来，', highlight: '量身定制路径' };

  // 蓝色 hero 作为每个专区内容区的顶部横幅，使 Tabs 导航条位于页面最上方
  const heroSection = (
    <div className="career-hero">
      <div className="career-hero-badge">🎯 生涯规划中心</div>
      <Title level={2}>{heroTitle.lead}<span className="career-hero-highlight">{heroTitle.highlight}</span></Title>
      {/* 求职 / 留学专区在 hero 内展示各自的三重回报 */}
      {heroValueData[activeTab] && (
        <Row gutter={[16, 16]} className="career-value-strip">
          {heroValueData[activeTab].map((block) => (
            <Col xs={24} md={12} lg={8} key={block.tag}>
              <div className="career-value-block">
                <div className="career-value-head">
                  <Tag color={block.color}>{block.tag}</Tag>
                  <Text strong>{block.title}</Text>
                </div>
                <p className="career-value-summary">{block.summary}</p>
              </div>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'internship',
      label: <span><ProfileOutlined /> 求职专区</span>,
      children: (
        <div className="career-tab-content">
          {heroSection}
          <div className="career-section-header">
            <Title level={4}>求职专区</Title>
            <Paragraph type="secondary">助你拿到心仪的大厂实习Offer，积累核心竞争力</Paragraph>
          </div>
          {renderResourceList(internshipData, (item) => {
            if (item.title === '实习岗位集结号') setJobsBoardOpen(true);
            if (item.title === '大厂申请全流程') navigate('/career-planning/application-guide');
            if (item.title === '技术干货抢先读') navigate('/career-planning/tech-articles');
            if (item.title === '1V1全流程辅导') navigate('/career-planning/coaching');
          })}
          <ConsultCta title="想拿到心仪的实习 Offer？先聊一次，把投递节奏排清楚" onConsult={() => navigate('/consultation')} />
        </div>
      ),
    },
    {
      key: 'abroad',
      label: <span><RocketOutlined /> 留学专区</span>,
      children: (
        <div className="career-tab-content">
          {heroSection}
          <div className="career-section-header">
            <Title level={4}>留学专区</Title>
            <Paragraph type="secondary">涵盖选校定位、标化备考、文书打造到申请提交的全流程指导</Paragraph>
          </div>
          {renderResourceList(studyAbroadData, (item) => {
            if (item.title === '趋势分析定选校') navigate('/career-planning/study-abroad-trends');
            if (item.title === 'GRE/TOEFL/IELTS备考指南') navigate('/career-planning/study-abroad-tests');
            if (item.title === '留学申请新动态') navigate('/career-planning/study-abroad-updates');
          })}
          <ConsultCta title="想确认自己能冲哪几所？先做一次选校定位与背景评估" onConsult={() => navigate('/consultation')} />
        </div>
      ),
    },
    {
      key: 'postgraduate',
      label: <span><TrophyOutlined /> 保研专区</span>,
      children: (
        <div className="career-tab-content">
          {heroSection}
          <div className="career-section-header">
            <Title level={4}>保研专区</Title>
            <Paragraph type="secondary">为目标保研的同学提供从规划到录取的全链路资料与信息</Paragraph>
          </div>
          <div className="career-coming-soon-body">
            {renderResourceList(postgraduateData)}
            <ComingSoonMask section="保研专区" />
          </div>
          <ConsultCta title="想知道自己离保研还差哪几步？先做一次背景评估" onConsult={() => navigate('/consultation')} />
        </div>
      ),
    },
    {
      key: 'followup',
      label: <span><TeamOutlined /> 长期随访</span>,
      children: (
        <div className="career-tab-content">
          {heroSection}
          <div className="career-section-header">
            <Title level={4}>长期随访 · 学长现身说法</Title>
            <Paragraph type="secondary">记录每一位同学的规划与成长历程，见证努力到收获的完整链路</Paragraph>
          </div>
          {/* 一级页只做双列流：封面图 + 标题 + 一句话简介，详情统一进二级页 */}
          <div className="followup-grid">
            {followupStories.map((story) => (
              <article
                className="followup-card"
                key={story.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/career-planning/followup/${story.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/career-planning/followup/${story.id}`);
                  }
                }}
              >
                <div className="followup-cover">
                  {/* 左上角三角角标：按分类配色（求职 / 留学 / 保研 / 考研） */}
                  <span className={`followup-cover-category followup-cover-category--${followupCategoryClass[story.category]}`}>
                    {story.category}
                  </span>
                  <img src={story.cover} alt={`${story.name}·${story.achievement}`} loading="lazy" />
                  <span className="followup-cover-badge">{story.avatar} {story.period}</span>
                </div>
                <div className="followup-card-body">
                  <div className="followup-card-name">
                    {story.name}
                    <span className="followup-card-meta">{story.school}</span>
                  </div>
                  <h3 className="followup-card-title">{story.title}</h3>
                  <p className="followup-card-summary">{story.summary}</p>
                  <span className="followup-card-action">阅读全文<ArrowRightOutlined /></span>
                </div>
              </article>
            ))}
          </div>
          <ConsultCta title="想了解更多真实案例或获取专属规划？" onConsult={() => navigate('/consultation')} />
        </div>
      ),
    },
  ];

  // 岗位集结号以二级页面形态呈现：隐藏生涯规划顶层的专区 Tabs，与其它专区二级页面结构一致
  if (jobsBoardOpen) {
    return (
      <div className="career-planning-page">
        <Button type="primary" style={{ marginBottom: 16 }} onClick={() => setJobsBoardOpen(false)}>← 返回求职专区</Button>
        <div className="career-hero">
          <div className="career-hero-badge">💼 求职专区 · 岗位集结号</div>
          <Title level={2}>实习岗位<span className="career-hero-highlight">集结号</span></Title>
          <Paragraph>按职位类型浏览在招实习岗位，信息持续更新</Paragraph>
        </div>
        <Tabs
          activeKey={activeJobCategory}
          onChange={setActiveJobCategory}
          className="career-tabs"
          size="large"
          items={jobCategoryData.map((cat) => ({
            key: cat.name,
            label: <span>{cat.icon} {cat.name}</span>,
            children: (
              <Row gutter={[16, 16]}>
                {(jobPostingsData[cat.name] || []).map((job) => (
                  <Col xs={24} key={`${job.company}-${job.role}`}>
                    <JobPostingCard job={job} />
                  </Col>
                ))}
              </Row>
            ),
          }))}
        />
      </div>
    );
  }

  return (
    <div className="career-planning-page career-planning-home">
      <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} className="career-tabs" size="large" />
    </div>
  );
}

function FollowupStoryPage() {
  const navigate = useNavigate();
  const { storyId } = useParams();
  const story = followupStories.find((item) => item.id === storyId);

  const backButton = (
    <Button type="primary" style={{ marginBottom: 16 }} onClick={() => navigate('/career-planning?tab=followup')}>← 返回长期随访</Button>
  );

  if (!story) {
    return (
      <div className="career-planning-page">
        {backButton}
        <Card className="career-resource-card">
          <Empty description="没找到这条随访记录，可能链接已经更新" />
        </Card>
      </div>
    );
  }

  return (
    <div className="career-planning-page">
      {backButton}
      <Card className="followup-detail-hero">
        <div className="followup-detail-intro">
          <div className="career-hero-badge">🎓 {story.category} · 学长现身说法</div>
          <Title level={2}>{story.title}</Title>
          <div className="followup-detail-meta">
            <span className="followup-detail-avatar" aria-hidden="true">{story.avatar}</span>
            <Text strong>{story.name}</Text>
            <Text type="secondary">{story.school} · {story.period}</Text>
          </div>
          <Tag color="blue" className="followup-detail-tag">{story.achievement}</Tag>
          <Paragraph type="secondary" className="followup-detail-summary">{story.summary}</Paragraph>
        </div>
        <img className="followup-detail-cover" src={story.cover} alt={`${story.name}·${story.achievement}`} />
      </Card>

      <Card className="career-resource-card followup-detail-sections" title="经验分享">
        <div className="career-case-sections">
          {story.sections.map((section, index) => (
            <section
              className={`career-case-section${section.wide ? ' career-case-section--wide' : ''}`}
              key={section.label}
            >
              <div className="career-case-section-label">
                <span className="career-case-section-index">{String(index + 1).padStart(2, '0')}</span>
                {section.label}
              </div>
              <p className="career-case-section-text">{section.text}</p>
            </section>
          ))}
        </div>
      </Card>

      <ConsultCta title="想走同一条路？先聊一次，把节奏排清楚" onConsult={() => navigate('/consultation')} />
    </div>
  );
}

function ConsultationPage() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: Record<string, string>) {
    setSubmitting(true);
    try {
      await submitConsultationLead(values);
      form.resetFields();
      message.success('提交成功！我们已收到你的咨询意向，将尽快与你联系，请保持手机畅通。');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交失败，请稍后重试');
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
            onFinish={submit}
          >
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input placeholder="例如：陈小博" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="contact" label="联系方式（手机/微信）" rules={[{ required: true }]}><Input placeholder="例如：138xxxxxxxx / 微信号" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="school" label="学校"><Input placeholder="例如：北京邮电大学" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="major" label="专业"><Input placeholder="例如：计算机科学与技术" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="grade" label="年级"><Select placeholder="请选择你所在年级" options={consultGradeOptions} /></Form.Item></Col>
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
