import { ArrowLeftOutlined, ArrowRightOutlined, BookOutlined, CrownOutlined, DownloadOutlined, FileTextOutlined, FormOutlined, LockOutlined, MenuOutlined, ProfileOutlined, ReadOutlined, RocketOutlined, SoundOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Collapse, Divider, Dropdown, Empty, Form, Image, Input, Layout, List, Menu, message, Radio, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Timeline, Typography } from 'antd';
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
        <HeaderNavigation />
        <HeaderBroadcast />
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

function HeaderNavigation() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
      setIsMobile(media.matches);
      setOpen(false);
    };
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => setOpen(false), [location]);

  const items = [
    { key: 'home', label: <Link to={DEFAULT_RESOURCE_PATH} onClick={scrollToResourceColumnFallback}>学习资源</Link> },
    { key: 'career-planning', label: <Link to="/career-planning" onClick={() => window.scrollTo({ top: 0 })}>生涯规划</Link> },
    { key: 'consultation', label: <Link to="/consultation">咨询服务</Link> }
  ];
  const selectedKeys = [getSelectedNavKey(location.pathname)];

  if (!isMobile) return <Menu mode="horizontal" className="nav" selectedKeys={selectedKeys} items={items} />;

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      menu={{ items, selectedKeys, selectable: true, onClick: () => setOpen(false), className: 'mobile-nav-menu' }}
    >
      <Button
        className={`mobile-nav-trigger${open ? ' is-open' : ''}`}
        icon={<MenuOutlined />}
        aria-label={open ? '关闭导航菜单' : '打开导航菜单'}
        aria-haspopup="menu"
        aria-expanded={open}
      />
    </Dropdown>
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
  urgent?: boolean;
  jobId?: string;
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
            {job.urgent && <Tag color="red">急招</Tag>}
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
          {(job.graduationPeriod || job.batch || job.interviewMode || job.writtenTestTrack || job.jobId) && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>基础信息：</Text>
              <div style={{ marginTop: 4, color: 'rgba(0, 0, 0, 0.65)', lineHeight: 1.8 }}>
                {job.jobId && <div>职位 ID：{job.jobId}</div>}
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
          scroll={{ x: 760 }}
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
          scroll={{ x: 900 }}
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
          scroll={{ x: 680 }}
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
          scroll={{ x: 720 }}
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
        className="career-tabs career-section-tabs career-guide-tabs"
        items={[
          { key: 'campus', label: <span><ReadOutlined />校招</span>, children: <CampusRecruitTab /> },
          { key: 'internship', label: <span><RocketOutlined />日常实习</span>, children: <DailyInternTab /> },
          { key: 'assessment', label: <span><FormOutlined />个人评估</span>, children: <SelfAssessmentTab /> },
        ]}
      />
    </div>
  );
}

type CoachingStep = { title: string; detail: string; color: string; bullets?: string[] };

// 师资力量：一位导师 = 头部（姓名/角色/学历）+ 一句背景 + 经历与 Offer 分组
// 经历与 Offer 统一用 label/value 二元组，方便后续追加导师
type CoachingMentorRow = { label: string; value: string };
// 数字战绩：大号数值 + 小字说明，用作师资卡片的第一视觉焦点
type CoachingMentorHighlight = { value: string; label: string };
type CoachingMentor = {
  name: string;
  role: string;
  education: string;
  summary: string;
  // 右侧虚拟人物头像；未配置时退化为无图单栏布局
  avatar?: string;
  highlights?: CoachingMentorHighlight[];
  expertise?: string[];
  // 经历 / Offer 任一侧为空时整列不渲染，两列都空则整个分组不渲染
  experiences: CoachingMentorRow[];
  offersTitle?: string;
  offers?: CoachingMentorRow[];
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
    origin: '做陪跑的初衷很简单：我大学那几年，最盼的就是身边有个学长带。那些绕过的弯、错过的机会，学弟学妹们不必再经历一遍——这条路上的经验，我们直接交到你手上！',
    pains: [
      '⏳ 学期与假期拥有大段可支配时间，却缺少清晰的能力积累路径',
      '🧩 校内课程与企业岗位要求的知识结构之间，找不到明确的结合点',
      '📅 对校招应当准备什么、关键时间节点如何安排，缺乏系统认知',
      '📉 面试被追问项目细节时难以展开，缺少可深入阐述的技术叙事',
      '🤖 大模型与 Agent 已成为行业共识，自身却缺少可展示的项目积累',
    ],
    mentors: [
      {
        name: 'W 学长',
        role: '金融科技 & Agent应用专家',
        education: '北邮毕业生',
        avatar: '/coaching/mentor-w-flat.jpg',
        summary: '金融Agent一线实战＋校招 / 社招面试官视角，帮你把项目讲成面试官真正想听的样子。',
        highlights: [
          { value: '6 年+', label: '头部金融平台经验' },
          { value: '百万级', label: '日活 Agent 产品' },
          { value: '2 年', label: '团队管理经验' },
          { value: '100+', label: '过往考察面试候选人' },
        ],
        expertise: ['金融 Agent 开发求职', '项目经历重构', '全真模拟面试', 'Offer 选择规划'],
        experiences: [
          // { label: '背景', value: '6 年+ 头部金融平台技术经验，2 年+ 团队管理经历' },
          // { label: '项目', value: '主导研发百万级日活金融 Agent 产品，拥有 3 年 Agent 应用落地实战经验' },
          // { label: '行业', value: '深耕银行、证券等金融机构，精通金融科技业务环境与技术架构' },
          // { label: '面试', value: '常年担任校招 / 社招面试官，累计面试 60 余人，精准把控大厂招聘标准与考察重点' },
        ],
      },
      {
        name: 'L 学长',
        role: '一线大厂 & AI前沿技术专家',
        education: '北邮毕业生',
        avatar: '/coaching/mentor-l-flat.jpg',
        summary: '从亿级流量业务线到大厂面试席，帮你在项目里挖出真正能加分的技术亮点。',
        highlights: [
          { value: '5 年+', label: 'BAT 等一线大厂' },
          { value: '亿级', label: '流量业务线主导' },
          { value: '4 年+', label: '搜推 / 电商经验' },
          { value: '3 年+', label: 'Agent工程化落地经验' },
        ],
        expertise: ['互联网大厂求职冲刺', '项目亮点提炼', 'AI 前沿技术实战', '差异化备考策略'],
        experiences: [
          // { label: '背景', value: '5 年+ BAT 及一线大厂核心研发经验' },
          // { label: '项目', value: '主导内容消费、电商交易、本地生活等亿级流量业务线开发，Agent 工程化落地经验丰富' },
          // { label: '面试', value: '大厂校招面试官，善于深挖项目技术难点与简历亮点' },
          // { label: '资源', value: '持续追踪 AI 前沿动向，掌握一手技术实践资料' },
        ],
      },
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
    label: '📈 商科&产品',
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
        education: 'HEC Paris 战略管理研究生（欧洲第一商学院）',
        avatar: '/coaching/mentor-y-flat.jpg',
        summary: '从 0 到 1 跨界商科，成为咨询、互联网战略与快消行业的全能型选手。',
        highlights: [
          { value: '4 个', label: '名企 Offer 斩获' },
          { value: '3 大', label: '赛道全覆盖' },
          { value: '6 家', label: '头部公司实战' },
          { value: '0 → 1', label: '跨界商科路径' },
        ],
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

function CoachingPreviewImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <figure className={`coaching-preview-media ${className}`}>
      <Image
        src={src}
        alt={alt}
        loading="lazy"
        width="100%"
        preview={{ visible: open, onVisibleChange: setOpen, mask: '点击查看大图' }}
      />
      <button
        className="coaching-stages-preview-hint"
        type="button"
        aria-label={`放大查看：${alt}`}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 13V5a2 2 0 0 1 4 0v7" />
          <path d="M13 10a2 2 0 0 1 4 0v2" />
          <path d="M17 11a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6h-2c-2 0-3-.6-4-2l-5-6a2 2 0 0 1 3-3l2 2" />
        </svg>
      </button>
    </figure>
  );
}

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
  // 经历 / Offer 为空时整列跳过，避免渲染空标题与空列表造成空白
  const hasRows = (rows?: CoachingMentorRow[]) => Boolean(rows && rows.length > 0);
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
        <Card className="career-resource-card coaching-team-card" title="学长团队" style={{ marginBottom: 16 }}>
          {track.mentors.map((mentor) => (
            <article className={`coaching-mentor${mentor.avatar ? ' coaching-mentor--with-portrait' : ''}`} key={mentor.name}>
              <div className="coaching-mentor-main">
                <header className="coaching-mentor-head">
                  {mentor.avatar ? (
                    <img className="coaching-mentor-head-portrait" src={mentor.avatar} alt={`${mentor.name} 虚拟形象`} loading="lazy" />
                  ) : (
                    <div className="coaching-mentor-avatar" aria-hidden="true">{mentor.name.slice(0, 1)}</div>
                  )}
                  <div className="coaching-mentor-meta">
                    <div className="coaching-mentor-name">
                      {mentor.name}
                      <span className="coaching-mentor-role">{mentor.role}</span>
                      {mentor.education && (
                        <span className="coaching-mentor-edu-tag">
                          <ReadOutlined />
                          {mentor.education}
                        </span>
                      )}
                    </div>
                  </div>
                </header>
                {mentor.highlights && mentor.highlights.length > 0 && (
                  <ul className="coaching-mentor-highlights">
                    {mentor.highlights.map((item) => (
                      <li className="coaching-mentor-highlight" key={item.label}>
                        <span className="coaching-mentor-highlight-value">{item.value}</span>
                        <span className="coaching-mentor-highlight-label">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
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
                {/* 一句话定位下移：作为经历列表的引导句，取代原来的栏目小标题 */}
                <p className="coaching-mentor-summary">{mentor.summary}</p>
                {hasRows(mentor.experiences) || hasRows(mentor.offers) ? (
                  <div className={`coaching-mentor-grid${hasRows(mentor.experiences) && hasRows(mentor.offers) ? '' : ' coaching-mentor-grid--single'}`}>
                    {hasRows(mentor.experiences) && (
                      <section className="coaching-mentor-col">
                        {renderMentorRows(mentor.experiences)}
                      </section>
                    )}
                    {hasRows(mentor.offers) && (
                      <section className="coaching-mentor-col coaching-mentor-col--offers">
                        <div className="coaching-mentor-col-title">{mentor.offersTitle || 'Offer 战绩'}</div>
                        {renderMentorRows(mentor.offers || [])}
                      </section>
                    )}
                  </div>
                ) : null}
              </div>
              {mentor.avatar && (
                <figure className="coaching-mentor-portrait">
                  <img src={mentor.avatar} alt={`${mentor.name} 虚拟形象`} loading="lazy" />
                </figure>
              )}
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
            <CoachingPreviewImage className="coaching-stages-media" src={media.stages} alt="三阶段陪跑：从写简历到拿大厂 AI Offer" />
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
            <CoachingPreviewImage
              className="coaching-map"
              src={media.map}
              alt="从零基础到大厂 Agent 工程师的学习地图：1 编程与工程基础、2 大模型基础原理、3 RAG 与知识检索、4 Agent 基础能力、5 上下文与记忆工程、6 Agent 工程化 Harness、7 工具生态与 AI Coding、8 行业项目与面试准备"
            />
          )}
          <Divider style={{ margin: '20px 0 16px' }} />
          <Text strong className="coaching-map-heading">📁 地图之外：持续更新的 27 个实战项目文件夹</Text>
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            地图上每一站都不是空谈，项目库已沉淀 27 个主题文件夹，覆盖行业 AI Coding（电商 / 金融 / 内容消费）、Agent 架构、MCP / RAG / Context Engineering、Harness 工程化、主流 AI 编程工具与框架实践等行业热门领域，并持续更新补充。选题和找资料这两件最耗时间的事，不必再自己扛！
          </Paragraph>
          <CoachingPreviewImage className="coaching-img-medium" src={media.projects} alt="实战项目库：27 个主题文件夹，覆盖行业 AI Coding、Agent、MCP、RAG、Context Engineering 等主题" />
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
// 封面既可能是历史外链，也可能是本地化后的 /xhs-covers/ 路径
const XHS_COVER_IMAGE = /^(https?:\/\/|\/xhs-covers\/)/;

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
    name: 'C 同学',
    school: '北邮海南学院',
    period: '2022届',
    avatar: '🚀',
    cover: '/followup/story-baidu-campus.jpg',
    title: '两段大厂实习，第二段成功入职百度 Agent 研发',
    summary: '大二暑假就开始投实习，在岗时拿下百度 Agent 研发岗；每场面试录音复盘，离职前把实习证明和推荐信一次收齐。',
    achievement: '百度 · Agent 研发实习',
    sections: [
      {
        label: '实习时机',
        text: '大二暑假我就开始投了，别等大三下。手上有一段在跑的时候，反而更好投下一段——我 8 月底一边实习一边面百度，9 月中出 offer，9 月 21 日就入职了，两段连起来，节奏一点没浪费。',
      },
      {
        label: '实习准备',
        text: '投之前先把目标公司和产品线摸清楚。简历上少写“参与”，把一件具体的事讲清楚：做了什么、效果是啥、数据怎么样。',
      },
      {
        label: '面试应考',
        text: '每场面试我都录音，回来逐句复盘：哪里答得虚、哪个问题卡住，当天就补。面试官说“不用自我介绍”也别掉以轻心，一样要能三句话说清自己做什么。答不上来就直说不知道，回去把它变成知道——面试官更在意你怎么对于问题的解决能力。',
      },
      {
        label: '实际工作',
        text: '进百度之后一直在 agent 开发这条线上，一个多月学到的东西比在学校半年还密。也提醒一句：离职别拍拍屁股就走，实习证明先开好，再请 leader 用公司邮箱写一封推荐信，下一段实习和之后申请都用得上。',
      },
      {
        label: '对辅导老师的评价',
        text: '老师没替我面试，他是那个逼我把每场面试变成经验的人：给资料、催录音、催复盘、抓住难点反复练习，有匹配的岗位先想到我（腾讯、字节的岗位都是他直接推的，并且一直帮我关注进度）。我赶项目的时候他不扰我，我要找第二段了他又第一时间接上，这种节奏感拿捏得真的刚刚好。',
        wide: true,
      },
    ],
  },
  {
    id: 'sui-hku',
    category: '留学',
    name: 'S 同学',
    school: '北邮海南学院',
    period: '2022届',
    avatar: '✨',
    cover: '/followup/story-hku-wall.jpg',
    title: '均分 83+，正式批首录港大 CS',
    summary: '大三结束均分 83+、雅思 6.5、实习空白，先把软背景用科研补起来；稳住心态转正式批，2026年初如愿收到港大 CS 录取。',
    achievement: '香港大学 · CS 硕士录取',
    sections: [
      {
        label: '起点与定位',
        text: '大三结束均分 83+、雅思 6.5——不算差，但在计算机方向的申请里真算不上突出。越查案例越焦虑，港新方向是知道的，但具体怎么补短板，完全没头绪。',
      },
      {
        label: '把短板补上',
        text: '老师没有先画大饼，而是把我能补的部分拆出来：绩点已过门槛不必死磕，最紧迫的是用科研填掉实习的空白。这段科研后来几乎撑起了我整个软背景，文书瞬间提分一大截。',
      },
      {
        label: '语言与节奏',
        text: '语言上他给我下了十一假期前后必须出分的“死命令”，并给了对应的备考策略。选校、申请节点也一并排清楚——第一次知道该往哪走之后，焦虑就换成了执行。',
      },
      {
        label: '正式批录取',
        text: '正式申之前，老师把我零散的科研经历和课业成绩重新梳理了一遍，终于2026 年 2 月的一个晚上，我像往常一样打开邮箱，港大 CS 的录取就躺在那里——正式批首录，之前的辛苦一下子都值得了。',
      },
      {
        label: '对辅导老师的评价',
        text: '务实分析不画饼，把问题翻译成带有清晰优先级的行动方案，什么急需重点补、什么可以放一放，面对不确定性，与其问“我行不行”，不如想“下一步该做什么”。遇事沉着经验足，是他服务里最值钱的部分。',
        wide: true,
      }
    ],
  },
  {
    id: 'lin-bytedance',
    category: '求职',
    name: 'L 同学',
    school: '北邮国际学院',
    period: '2023届',
    avatar: '🎬',
    cover: '/followup/story-bytedance-campus.jpg',
    title: '从 AI 小白和学长并肩作战，大三拿下剪映 AI 实习',
    summary: '大二一整年把学校课程与业界技术栈的差距一点点补平：从只会用 Codex 写脚本，到能指挥多个 Agent 协作迭代，最后选择去做 AI 基建；三轮面试走完，一切都是水到渠成。',
    achievement: '字节跳动 · 剪映 AI 开发实习',
    sections: [
      {
        label: '起点与茫然',
        text: 'AI的浪潮下我们每个人都是受益者，但是我清楚，我所谓的“会用 AI”就是让 Codex 帮我写写作业，查查资料。可大厂 AI 岗位的 JD，Agent、工具调用、评测、沙箱……全是我没碰过的东西。学校课业和业界技术栈几乎对不上，那段时间最真实的感觉是：不知道该从哪下手。',
      },
      {
        label: '第一个动作',
        text: 'L 学长没让我先去刷一堆课，而是从基础构建AI RoadMap。我从最小的东西做起——结构严谨的Prompt，完备清晰的Context，能调工具的 MCP，会自我检查的流程，再往后是让几个 Agent 分工、互相 review，把一件任务迭代到自己满意为止。',
      },
      {
        label: '最沮丧的中段',
        text: '真正的坎在中间。知识越学越多，反而越学越慌：每个方向都有一堆没懂的名词，做完的东西自己都看不上。学长说这是必经的“知识扩张期”，破法很简单——别焦虑，去深挖去实践，把焦虑换成 commit，知识的网络就在不经意间悄然织就。',
      },
      {
        label: '选择基建',
        text: '定方向时我选了不那么显眼的一条路。AI 的黄金年代，所有人都在挖矿，我想去做给挖矿大军修路搭桥的那个人：工具接入、运行环境、失败重试、效果评测——让 Agent 稳定跑起来的那层基建。写起来枯燥，但它决定了一个 AI 产品能不能真的上线。',
      },
      {
        label: '对辅导老师的评价',
        text: 'L 学长带人的方式很特别：他不直接给答案，他更强调下一个动作。我卡住时他把问题拆到能动手的粒度，我飘的时候他让我先把东西做小；每周我都要讲清楚“这周让 Agent 多做了什么、凭什么说它更稳了、数据效果怎么样”。一年下来，我习惯了回答问题用数据做基础，框架思维，言之有物。',
        wide: true,
      },
    ],
  },
  {
    id: 'z-antgroup',
    category: '求职',
    name: 'Z 同学',
    school: '北邮人工智能学院',
    period: '2023届',
    avatar: '💹',
    cover: '/followup/story-ant-campus.jpg',
    title: '保研在手，顺利斩获蚂蚁金服校招 AI 开发',
    summary: '大三下成绩够保研，半年苦战恶补，在 W 学长的帮助下把 Agent 能力和金融知识融会贯通，蚂蚁金服校招 offer稳稳收入囊中；350 的实习日薪，是优秀团队的认可，更是独立的底气。',
    achievement: '蚂蚁集团 · 校招 AI 开发 offer',
    sections: [
      {
        label: '起点与选择',
        text: '大三下学期，我的成绩单基本可以稳稳保研。可我总觉得自己对金融的兴趣没被认真对待过——比起把接下来几年写进一份已经确定的日程，我更想知道，把技术用在钱和资产流转的地方，会是什么样子。',
      },
      {
        label: '把兴趣变成方向',
        text: 'W 学长没有让我二选一，而是抛了一个更具体的问法：你手上已经有的 Agent 能力，能不能解决金融场景里一个真实的问题。于是方向从“我想做金融”变成了“我要让一个 Agent 在金融业务里跑得可靠”。',
      },
      {
        label: '恶补与落地',
        text: '接下来是密集地补课：工具调用怎么设计、上下文怎么给足、结果怎么评估、出错怎么兜底。学一块就落一块，把财报解析、研报问答、指标核验这些场景做成能演示的 demo。第一次看到自己的 Agent 在真实数据上把一份研报讲清楚，那种兴奋比绩点好看多了。',
      },
      {
        label: '面试与结果',
        text: '简历按“问题—方案—效果”重写，面试按“为什么这样设计、怎么证明它可靠”反复磨。聊到金融场景的风控与合规时，面试官明显来了兴趣——因为我不是在背概念，而是真的踩过那些坑。最后，蚂蚁金服的校招 offer 到手。',
      },
      {
        label: '入职之后',
        text: '真正进去之后才发现，职场和学校完全是两套节奏：需求是真金白银的，评审会上每个人都在问“上线之后怎么衡量”。新奇也有趣，每天都能看到自己写的东西被真实用户用上。一天 350 的实习工资不算多，但它让我第一次有了独立的底气！',
      },
      {
        label: '对辅导老师的评价',
        text: 'W 学长最厉害的地方，是把“兴趣”转化成“能力”，一次次帮我把模糊的想法转化成可以亲手探索的方向，用真实职场协作的方式将这些想法落地，然后耐心帮我把每一个细节理清。感谢学长这半年以来的悉心托举。',
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
      title: '经济独立不求人',
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
      title: '留学科研两手抓',
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
      {
        company: '美团',
        role: 'AI 全栈工程师',
        location: '北京/上海/成都/深圳',
        mode: '应届 · 校园招聘',
        tags: ['AI 全栈', 'LLM 应用', 'RAG', 'Agent 编排'],
        description: [
          '参与 AI 应用的全栈开发：负责 AI 产品功能的前端界面（Web/小程序）与后端服务的设计与实现，保障高可用与用户体验',
          '大模型能力工程化：参与 LLM 应用架构设计与开发，包括 Prompt 模板工程、RAG 检索管线搭建、Agent 工作流编排等',
          '模型效果调优与评估：参与模型输出的质量评估，分析 Bad Case，优化提示词策略与检索链路，提升 AI 回答的准确率与可用性',
          'AI 工程基础设施建设：参与模型服务化部署、推理性能优化、流式响应设计，构建高效稳定的 AI 应用底座',
          '技术探索与落地：跟踪前沿 AI 技术动态，参与从 0 到 1 的 AI 功能创新验证',
        ],
        requirements: [
          '本科及以上学历，计算机科学、软件工程或相关专业',
          '扎实的编程基础：熟练掌握至少一门编程语言（Python / Java / TypeScript / Go 等），具备良好的代码习惯',
          '基本功扎实：了解前端框架（React / Vue 等）或后端框架（Spring / Django / Express 等）之一，具备完整 Web 项目开发经验',
          'AI 素养与好奇心：熟悉大模型基本原理与应用范式，有 ChatGPT / Claude 等工具的深度使用经验，理解 Prompt Engineering 基本技巧',
          '学习与解决问题能力：对新技术保持敏感，能快速学习并应用 AI 领域新知识，具备良好的逻辑思维与沟通协作能力',
          '有独立完成 AI 应用（Bot / Agent / 自动化工作流）从 0 到 1 上线的经历者优先',
        ],
      },
      {
        company: '快手',
        role: 'AI 全栈开发工程师',
        location: '北京/杭州',
        mode: '全职招聘',
        tags: ['AI 编程', '全栈', '跨端'],
        urgent: true,
        description: [
          '借助 AI 编程工具，打破前端、后端、客户端的传统分工边界，端到端参与产品功能的开发与迭代——覆盖数据层、服务端到 Web 与移动端各层，在真实项目中全面打磨技术栈',
          '深度使用 AI 编程工具，大幅提升开发效率，把精力从重复编码转向架构设计与业务价值实现，快速验证想法、推动功能高效迭代与落地',
          '面向真实业务场景解决问题：提升核心业务指标、改进系统性能、保障线上稳定性，产出直接运行于生产环境、服务真实用户',
          '在编码、重构、Bug 排查等高频环节中持续把 AI 工具用作常规起点，拥有「先复核、再采用」的习惯',
        ],
        requirements: [
          '计算机科学、软件工程、人工智能等相关专业优先',
          '熟悉至少一门编程语言（如 Java/Go/Python/Kotlin/Swift/TypeScript 等），具备扎实编程基础，了解常见数据结构与算法，能独立完成代码编写与调试',
          '习惯将 AI 编程工具作为日常编码的默认起点，用于代码生成、重构、Bug 排查等高频场景；能对 AI 产出做基础复核（能跑通、能发现明显错误），并愿意持续提升对代码质量与工作流的判断力',
          '在后端、Web 前端、安卓客户端、iOS 客户端任一「端」具备基础、有相关开发实践，并愿意借助 AI 工具拓展到其他端',
          '加分项：有 AI 相关项目、开源贡献或互联网公司实习经历',
          '加分项：具备跨学科思维，能将 AI/工程能力与其他领域知识结合，产出创新应用',
          '备注：该岗位【北京】简历稀缺，投递北京不排队',
        ],
      },
      {
        company: '快手',
        role: '策略开发工程师（生态治理方向）',
        location: '杭州/北京',
        mode: '全职招聘',
        tags: ['风控治理', '策略体系', 'SQL', 'AI Agent'],
        urgent: true,
        description: [
          '深入理解业务本质，沉淀标准化的风险发现与解决机制，能够基于业务日志、行为数据等进行分析与抽象，通过根因洞察、案例复盘、风险溯源，定位漏洞与长短期做工空间，完善高热治理策略体系的同时发挥横向职能，推动垂直业务策略迭代，提升治理及时性与有效性',
          '参与 AI 辅助的策略生产与运营链路建设，用模型和自动化手段提升策略挖掘、样本标注、效果归因的效率；对模式识别、策略体系、大模型和 AI Agent 进行融合应用，能够快速发现及定位疑似风险的内容和行为',
          '与业务团队紧密配合，结合业务策略，平衡业务发展与风险防控，制定合适的风险策略，为业务健康发展提供风控保障',
        ],
        requirements: [
          '本科及以上学历，计算机/统计/数据/商业分析/经济学等专业优先',
          '熟练使用 EXCEL/HIVE/SQL 等工具，能独立完成 SQL 取数，对数据敏感，掌握基本的数据分析方法',
          '能独立完成简单分析报告的撰写，文字功底、逻辑和分析能力优秀',
          '有责任心，同理心，好奇心强，善于思考和沟通',
        ],
      },
      {
        company: '快手',
        role: '推荐模型算法工程师',
        location: '北京',
        mode: '全职招聘',
        tags: ['推荐系统', '排序模型', '深度学习', 'Python'],
        urgent: true,
        description: [
          '参与业内最前沿的排序模型的迭代工作，通过优化模型精度提升用户体验',
          '分析、理解用户数据和业务场景，设计适合业务发展的推荐算法和机器学习模型',
          '迭代业内最前沿的推荐算法，并落地到快手最大的消费场景中',
        ],
        requirements: [
          '硕士及以上学历，人工智能、计算机、数学等相关专业',
          '具备扎实的编码功底，能够熟练使用 Python、Java、C++ 中的一种，有较强的工程实现能力',
          '扎实的分析能力，能熟练使用 SQL、Jupyter、Spark 进行数据分析',
          '熟悉机器学习模型，有大规模实时模型开发、迭代经验，如 Wide and Deep、DCN、deepFM、Transformer、SIM 等模型技术',
          '热爱技术，勇于实践新技术与新想法；用于探索技术领域，并持续迭代拿到线上效果',
          '加分项：有推荐系统召回、排序，在线广告，搜索引擎，自然语言，计算机视觉等相关领域经验者优先',
          '加分项：在 SIGKDD、ICML、NIPS、WSDM、WWW、ACL、RECSYS 等相关国际顶级会议上有文献发表',
          '加分项：有 ACM/Topcoder Algorithm 或类似算法竞赛经历者优先',
        ],
      },
      {
        company: '快手',
        role: '广告算法工程师',
        location: '北京',
        mode: '全职招聘',
        tags: ['广告算法', 'CTR/CVR', '深度学习', '用户画像'],
        urgent: true,
        description: [
          '广告算法策略包含深度学习、强化学习、大数据、数据挖掘、并行优化、策略机制等多个方向',
          '负责机器学习的算法和模型开发，包括：DNN、超参数优化、学习和优化方法等',
          '负责海量数据的分析和挖掘工作，构建用户画像模型，提升 CTR、CVR',
          '对机器学习尤其是深度学习前沿问题进行探索与研究',
          '对推荐系统、自然语言处理、图像处理等领域提供模型支持',
        ],
        requirements: [
          '硕士及以上学历，博士优先，计算机、模式识别、人工智能、自动化、软件工程、电子工程、信息安全等专业',
          '熟悉常用机器学习算法，对模式识别、概率统计、最优化等算法原理及应用，有扎实的基础',
          '熟悉 C/C++、Java、Python 等至少一门编程语言，有较强动手能力，了解目前常见的机器学习或者深度学习框架',
          '在 ICML、KDD、AAAI、IJCAI、ICLR、SIGIR 等机器学习领域会议或期刊以第一作者发表过文章，或者有相关的开源项目贡献经验优先',
          '参加国内外机器学习比赛，TOP 10 成绩者优先',
        ],
      },
      {
        company: '快手',
        role: '多模态 Data Infra 开发工程师',
        location: '北京',
        mode: '全职招聘',
        tags: ['多模态', '数据管线', '分布式计算', '可灵'],
        urgent: true,
        description: [
          '对接视频/图片/音频等各类多模态模型的数据生产需求，打造业界领先的多模态数据生产引擎，持续提升训练数据的规模、质量和迭代效率，支撑可灵全系多模态生成模型训练',
          '搭建 Data Centric 的多模态数据处理 pipeline，包括数据处理算子开发、跨模态检索引擎开发、多模态数据的内容理解、质量筛选、组织与合成等关键环节',
          '构建高可用、高吞吐的数据算法服务框架，支持多模态模型服务的快速部署，持续优化多模态数据的存储以及检索效率',
        ],
        requirements: [
          '本科及以上学历，计算机、软件工程、人工智能等相关专业优先',
          '计算机基础扎实，熟练掌握 Java/C++/Python 语言中的一种，有服务端系统的开发经验',
          '聪明好学，有较强的自驱力和学习力，良好的沟通协作能力',
          '熟悉分布式计算或大数据处理框架（如 Ray、Flink、ES 等），或者大模型推理训练框架（如 vLLM、SGLang、PyTorch）者优先',
        ],
      },
      {
        company: '京东',
        role: '后端开发工程师',
        location: '北京/上海/成都/深圳/天津/苏州/西安/三亚',
        mode: '校招 · 应届',
        tags: ['后端', 'Java/Go', '分布式系统', 'AI 编程助手'],
        graduationPeriod: '2026-10-01 - 2027-09-30',
        batch: '京东集团校招（科技/零售/物流等）',
        description: [
          '负责相关系统/模块的业务需求分析，参与核心系统设计、开发、维护工作',
          '参与核心系统的灵活性、稳定性建设，保障线上系统的高可用',
          '探索学习后端开发最新技术，保持技术前瞻性，持续推动系统架构的合理性，扩展技术深度与宽度，提升研发效率',
          '通过与前端、产品、算法、测试紧密协作，为产品业务迭代提供支持',
          'AI 应用探索：主动关注 AI 在后端开发领域的创新应用，积极运用 AI 编程助手等工具提升代码质量、开发效率与问题排查能力',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '熟练掌握 C/C++/Java/Go 等其中一种或多种开发语言',
          '有扎实的专业基础知识，熟悉常用的数据结构和算法，对计算机系统结构、网络、操作系统等专业知识有深刻认知',
          '了解 TCP/IP、UDP、FTP、HTTP、HTTPS 的基本原理及应用场景',
          '有分布式系统开发、大数据处理开发经验者优先',
          '有互联网企业实习经验优先',
          '具备优秀的逻辑思维能力，有良好的团队合作精神，较强的沟通能力和学习能力',
          '熟练使用 AI 编程助手（如 GitHub Copilot、Cursor 等）辅助代码编写、调试与重构，有利用 AI 工具提升开发效率的实践经历',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '京东',
        role: '测试开发工程师',
        location: '北京/上海/成都/深圳/三亚',
        mode: '校招 · 应届',
        tags: ['测试开发', '自动化测试', '质量保障', 'AI 测试工具'],
        graduationPeriod: '2026-10-01 - 2027-09-30',
        batch: '京东集团校招（科技/零售/物流等）',
        description: [
          '参与项目测试全流程，根据产品需求和研发设计进行需求分析和风险评估，制定测试计划，设计并执行测试用例，进行缺陷定位和跟踪修复，保障项目质量',
          '掌握和开发维护部署工具，独立部署测试环境，包括数据库和服务器配置',
          '自动化测试工具的开发和维护，提升测试效率',
          '掌握和开发维护公司各类监控工具，掌握系统架构、组件和工作原理，能根据监控数据快速定位和诊断系统问题',
          '优化测试流程，并能站在用户角度提出系统优化建议、完善用户体验',
          'AI 应用探索：主动关注 AI 在测试领域的应用，运用 AI 工具辅助测试用例生成、自动化脚本编写及缺陷智能分析，提升测试效率与覆盖率',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '熟练掌握 C++/Java/Python/Shell 等一种以上编程语言',
          '熟悉软件的开发测试流程，掌握软件测试理论和方法，具备设计和开发测试工具和自动化测试框架能力',
          '掌握行业主流监控工具，能通过监控指标及时发现问题并协同定位',
          '对技术富有热情，自驱力和自我学习能力强，喜欢挑战',
          '良好的沟通能力和逻辑思维能力',
          '做事耐心认真，有较强的责任感和团队协作能力',
          '熟练使用 AI 编程助手（如 GitHub Copilot、Cursor 等）辅助测试脚本开发；了解 AI 测试工具（如智能缺陷分析平台）并有使用兴趣',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '京东',
        role: '前端开发工程师',
        location: '上海/北京/成都/深圳/三亚',
        mode: '校招 · 应届',
        tags: ['前端', 'React/Vue', 'TypeScript', 'AI 编程助手'],
        graduationPeriod: '2026-10-01 - 2027-09-30',
        batch: '京东集团校招（科技/零售/物流等）',
        description: [
          '结合业务打造满足用户需要、符合用户习惯的高性能产品，支持 Web 端（浏览器、小程序运行时、App client 等）产品的研发工作',
          '探索学习 Web 前端开发最新技术，保持技术前瞻性，持续推动系统架构的合理性，扩展技术深度与宽度，提升研发效率',
          '结合数据指标驱动和分析，持续进行功能的改进及性能优化',
          'AI 应用探索：主动关注 AI 在前端开发领域的创新应用，积极运用 AI 编程助手及前端智能化工具提升页面开发效率与交互体验',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          'HTML、CSS、JavaScript 基础扎实，熟悉 ES6、TypeScript、Node.js 和面向对象编程',
          '熟悉前端工程化和模块化开发，掌握并能熟练应用至少一种前端开发框架进行页面以及组件开发，包括且不限于 React、Vue、AngularJS',
          '对前端开发有持续热情，良好的团队协作能力，能独立完成开发工作，做事认真负责，追求高质量的代码交付',
          '具有良好的沟通协作能力，优秀的分析问题和解决问题能力',
          '熟练使用 AI 编程助手（如 GitHub Copilot、Cursor 等）及前端 AI 工具辅助页面开发与调试，有利用 AI 工具提升前端开发效率的实践经历',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '京东',
        role: '算法工程师（搜索/推荐/广告）',
        location: '北京',
        mode: '校招 · 应届',
        tags: ['搜广推', 'CTR/CVR', '大模型', '强化学习'],
        graduationPeriod: '2026-10-01 - 2027-09-30',
        batch: '京东集团校招（科技/零售/物流等）',
        description: [
          '负责搜索、广告、推广系统全链路算法优化，涵盖召回、粗排、精排、混排、机制策略等核心环节，提升流量匹配效率与商业变现能力',
          '优化 CTR、CVR、DeepCVR、LTV 等核心业务指标预估模型，结合业务场景迭代模型结构，提升广告精准度、用户转化效率与投放 ROI',
          '探索大模型、多模态技术在搜广推场景的落地应用，包括生成式召回、创意生成、用户意图理解、端到端广告生成等方向',
          '运用强化学习、运筹优化、因果推断、长序列建模、图神经网络等技术，优化智能出价、自动化投放、流量分配、竞价机制与归因策略',
          'AI 应用探索：持续跟踪搜广推领域 AI 前沿，熟练运用 AI 实验管理平台与工具链加速模型迭代，推动智能化投放策略落地',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '计算机科学、人工智能、自动化、电子工程、机器人学等相关专业优先',
          '编程能力：扎实掌握 Python/C++/Java 中至少一门编程语言，熟悉 Linux 操作系统，具备扎实的数据结构与算法功底',
          '算法基础：精通机器学习、深度学习核心原理，熟悉 LR、GBDT、DNN、Transformer、DeepFM 等常用模型，了解 TensorFlow、PyTorch 等深度学习框架',
          '业务认知：了解搜索、广告、推荐领域核心逻辑与基本流程，具备一定的业务敏感度',
          '熟练使用 AI 开发工具与实验跟踪平台，有利用 AI 编程助手（如 GitHub Copilot）辅助算法开发的经历；有相关 AI 竞赛或业务成果者优先',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '字节跳动',
        role: '推荐算法实习生（TikTok 算法）',
        location: '北京',
        mode: 'ByteIntern 实习',
        tags: ['推荐算法', '机器学习', 'Python/C++', 'ByteIntern'],
        jobId: 'A68933',
        graduationPeriod: '2026-09-01 - 2027-08-31',
        batch: 'ByteIntern（2027 届）',
        description: [
          'ByteIntern：面向 2027 届毕业生（2026 年 9 月 - 2027 年 8 月期间毕业），为符合岗位要求的同学提供转正机会',
          '团队介绍：短视频平台算法团队，负责国际化短视频产品的基础推荐算法，加入我们，你能接触到包括用户增长、社交、直播、电商 C 端、内容创造、内容消费等核心业务场景，直接为核心用户体验负责，支持产品在全球赛道上高速发展。我们的工作内容包括大规模推荐算法的优化、复杂约束的优化问题的解决、多模态大模型的落地探索，推荐大模型的应用研究等多个学术领域的算法改进以及对多种场景的推荐架构的设计和对产品数据的复杂深入的分析。在这里，你可以深入钻研机器学习算法的改进和优化，探索前沿的技术；可以跟来自全球不同国家的团队合作，感受不同文化的碰撞，激发认知；可以通过对产品和内容生态的深度分析，影响产品未来的发展方向',
          '利用机器学习技术，改进短视频的推荐系统，优化数亿用户的使用体验',
          '分析基础数据，挖掘用户兴趣、内容价值，增强推荐系统的预测能力',
        ],
        requirements: [
          '2027 届硕士及以上学位在读，计算机、软件工程、数学、物理学等相关专业优先',
          '代码基础扎实，有扎实的数据结构和算法功底，熟悉 Linux 开发环境，日常工作语言 Python 和 C++',
          '熟悉机器学习相关算法，基础扎实',
          '优秀的分析问题和解决问题的能力，对解决具有挑战性问题充满激情',
          '实习时间 6 个月及以上，每周至少 4 天',
        ],
      },
      {
        company: '字节跳动',
        role: 'AI 后端（风控合规方向）实习生（国际支付）',
        location: '杭州',
        mode: '日常实习',
        tags: ['风控合规', '特征工程', '数据链路', 'LLM 应用'],
        jobId: 'A52869A',
        batch: '日常实习（3 个月及以上）',
        description: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
          '团队介绍：国际支付，立足于为字节跳动国际化业务提供专业的支付和金融服务，专注于全球支付产品线的质量和效率，确保为国际产品提供高度可靠和稳定的服务，建立国际支付产品和能力，同时在高效助力业务快速拓展的同时，打造行业领先的支付和金融产品能力。团队当前所提供的产品和服务，遍布全球多个国家和地区，团队拥有丰富的国际化产品研发经验；同时这里有全球超大规模的支付网络；覆盖多业务场景的海外钱包及金融产品解决方案；围绕分布式一致性、高并发、高可用、资金安全在内的核心技术能力攻坚；LLM 等前沿 AI 技术在支付&金融服务中的探索、研发和应用。另外，我们在全球设立团队，团队同学背景多元，不同的思维方式，打造了一个多元、碰撞、融合、包容的工作环境',
          '负责国际支付风控的特征与数据体系建设：参与风控特征的设计、开发与维护，覆盖用户、设备、商户、交易等多维度特征，支撑风控模型的训练与实时决策，保障特征对业务的完整覆盖与可解释性',
          '负责风控数据链路的搭建与优化：建设实时/离线特征计算与存储体系（特征平台、特征仓库、样本库），保障特征数据的时效性、准确性与一致性，提升特征上线与模型迭代的效率',
          '结合 LLM 等前沿 AI 技术探索风控场景落地：参与智能特征挖掘、异常模式识别、风控策略生成等方向的研发，助力 AI 技术与风控业务深度融合',
          '参与风控数据质量保障与治理：建设特征监控、质量校验、样本回流与标注机制，沉淀数据规范与治理流程，支撑风控模型持续迭代与策略调优',
          '参与各专项技术调研与前瞻项目，重点关注 LLM、智能风控、智能合规在支付&金融服务领域的应用探索与落地实践',
        ],
        requirements: [
          '本科及以上学历在读，计算机、数学、统计等相关专业优先',
          '热爱计算机科学和互联网技术，精通至少一门编程语言，包括但不仅限于：Java、C、C++、PHP、Python、Go；熟悉 SQL，掌握扎实的数据结构与算法、操作系统等计算机基础知识',
          '熟悉大数据处理组件（如 Spark、Flink、Hive）或具备特征工程、数据挖掘项目经验者优先',
          '有优秀的逻辑分析能力，能够对业务逻辑进行合理的抽象和拆分，对数据敏感，能发现并定位数据问题',
          '有强烈的求知欲，优秀的学习和沟通能力；有 LLM 应用、Vibe coding、Agent 开发经验或风控相关项目经验者加分',
        ],
      },
      {
        company: '字节跳动',
        role: 'AI 应用开发工程师（TikTok Shop）',
        location: '杭州',
        mode: '2027 届校园招聘',
        tags: ['AIGC', 'AI 导购', 'AI Infra', '大模型'],
        jobId: 'A137399',
        batch: 'TikTok Shop 2027 届校招',
        description: [
          '团队介绍：TikTok Shop 是以 TikTok 为载体的内容电商业务，致力于成为用户发现并获取优价好物的首选平台，在直播电商、视频内容电商等多场景下，希望能为用户提供更个性化、更主动、更高效的消费体验，为商家提供稳定可靠的平台服务，在更多的地区实现没有难卖的优价好物。目前团队拥有丰富的国际产品研发经验，包容多元的文化，且在全球设立研发团队',
          '负责国际电商 AI 研发相关工作，聚焦跨境电商全场景 AI 落地，下设 AIGC、AI 导购、AI Infra 三大方向；依托亿级国际用户与海量多模态电商数据，落地大模型、多模态生成、智能 Agent、模型训练推理工程化能力，实现内容提效、购物体验升级与业务增长，技术落地性强、业务场景真实',
          '如果加入 AIGC 业务研发，你将负责电商内容工业化智能闭环建设，覆盖商家内容创作、自动化生产、素材剧本策略、内容质量质检、数据分发运营全链路，通过算法与策略优化实现内容降本、提质、提效',
          '如果加入 AI 导购业务研发，你将面向国际用户打造沉浸式智能购物体验，基于大模型与多模态技术，建设电商导购智能体系，提升用户互动与转化效果',
          '如果加入 AI Infra 研发，你将负责全业务 AI 技术底座建设，支撑国际电商业务的训练、推理、服务部署与成本治理，打造高可用、低成本的生产级 AI 平台',
        ],
        requirements: [
          '2027 届获得本科及以上学历，计算机、人工智能、CV、NLP、软件工程、分布式系统、应用数学等相关专业优先',
          '掌握数据结构、算法、深度学习/大模型基础，熟练掌握一门编程语言（Go/C++/Java/Python 等）',
          '有模型训推、Agent 架构、Agent 应用等 AI 相关的应用开发经验优先',
          '积极乐观，责任心强，工作认真细致，具有良好的团队沟通与协作能力',
          '热爱编程，有较强的学习能力，有强烈的求知欲、好奇心和进取心，能及时关注和学习业界最新技术',
        ],
      },
      {
        company: '字节跳动',
        role: '后端开发实习生（Flow）',
        location: '杭州',
        mode: '日常实习',
        tags: ['Golang', '后端', '平台研发', '豆包'],
        jobId: 'A174825',
        batch: '日常实习（3 个月及以上）',
        description: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
          '团队介绍：字节跳动 Flow 产品研发团队，专注研究 AI 智能化相关业务落地，目前落地豆包、Cici 等 APP，以及对应的 Bot 开发平台等 AI 智能化创新产品，业务和团队均处于快速发展期，成长空间大',
          '参与和指导公司平台级技术组件和平台（AGW/Janus/ByteSync/BAM）的研发工作',
          '分析和深入发掘现有系统的不足，定位系统瓶颈，提高系统性能和稳定性',
          '主要实现语言为 Golang/Python',
        ],
        requirements: [
          '本科及以上学历在读，计算机、通信等相关专业优先',
          '深刻理解计算机原理，有良好的数据结构和算法基础',
          '熟悉 MySQL、Redis、消息队列等常用 WEB 组件，并有能力进行定制化改进',
          '有较好的产品意识优先',
          '积极乐观，责任心强，工作认真细致，具有良好的团队沟通与协作能力',
          '热爱编程，至少掌握一门编程语言，有较强的学习能力，有强烈的求知欲、好奇心和进取心，能及时关注和学习业界最新技术',
        ],
      },
      {
        company: '字节跳动',
        role: 'AI 研发实习生（模型数据工程）',
        location: '深圳',
        mode: '日常实习',
        tags: ['数据工程', 'LLM', 'Agent', '标注平台'],
        jobId: 'A74996',
        batch: '日常实习（3 个月及以上）',
        description: [
          '团队介绍：数据工程与平台团队旨在实现人类知识与经验向模型能力的加速迁移。我们从真实场景出发，通过模型短板识别、高质量数据定义、规模化数据生产，提升模型能力。与此同时，团队还致力于依托训练反馈，反哺数据设计，推动系统迭代，构建业内一流的数据工程能力与平台',
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
          '参与大模型数据生产体系构建，从大规模的数据合成到 HITL 的世界知识精华注入，研究大模型工作原理，助力大模型效果迭代',
          '推动数据平台的智能化演进，搭建 AI 辅助的智能标注、质量校验与数据迭代闭环系统，实现任务的自动分配、错误智能修正、数据价值自动评估，降低人力成本并提升数据生产的标准化与规模化',
          '参与大模型数据构建的全流程，从模型效果分析到数据策略迭代，确保数据的高效性与准确性，持续调优模型性能',
          '通过数据分析与算法改进，优化大模型数据供应链，提升模型效果和用户体验，并与跨部门团队协作推动项目落地',
          '关注行业前沿技术，引入创新技术，为数据生产系统的技术发展提供前瞻性建议，特别是在 Coding、多模态等领域的应用突破',
        ],
        requirements: [
          '本科及以上学历在读，计算机、软件工程等相关专业优先',
          '良好的思维能力和计算机基础知识，有一定的架构设计能力或者经验',
          '富有好奇心，有强大的自我驱动力',
          '熟悉一种或多种语言：Python、Go、Java/Kotlin、Swift/OC、TypeScript、C++ 等',
          '有 AI 应用相关开发经验：了解 LLM 架构，熟悉 PE 工程、AI Agent、LangChain、RAG、Memory、Text2SQL 等优先',
        ],
      },
    ],
    '设计类': [
      {
        company: '美团',
        role: '产品设计实习生（无人机）',
        location: '北京',
        mode: '日常实习',
        tags: ['UI设计', '产品经理', 'AI设计工具', '低空经济'],
        batch: '无人机业务部 · 日常实习',
        interviewMode: '北京',
        description: [
          '团队背景：美团 2017 年启动无人机配送探索，已完成飞行器、自动化机场及智能调度系统研发；截至 2024 年 12 月已在深圳、北京、上海、广州、南京、迪拜等城市开通 53 条航线，累计完成订单超 40 万单',
          '负责美团无人机软件相关的产品设计工作，出任 UI 设计或产品经理的角色，在指导下支持无人机商业拓展的产品迭代',
          '参与创新功能——情绪价值相关模块的设计及交付，在官方品牌形象的框架内探索新增长点、新玩法，提升美团无人机在用户心中的正向心智',
          '支持其它内部项目的协同工作',
        ],
        requirements: [
          '具备良好的逻辑思维能力、审美、细节意识与沟通协作能力，熟悉美团及即时零售的视觉风格',
          '熟练掌握 UI 设计的基础软件及 AI 设计工具，具备手搓原图、制作动效的能力',
          '或：有出色的产品思维、了解用户场景，对主流 C 端产品、增长工具有一定理解',
          '2028 届及以后毕业，本科及以上学历在读',
          'base 北京，每周可实习 4 天以上，可实习 3 个月以上',
          '优先：有互联网公司的设计实习经验',
          '优先：有 C 端产品经理的实习经验',
        ],
        benefits: [
          '团队隶属于美团无人机的产品团队，有机会亲手参与低空经济的建设过程',
          '深入了解无人机配送与商业价值的有机结合，打造前所未有的用户体验',
        ],
      },
      {
        company: '美团',
        role: 'UX设计实习生（大众点评）',
        location: '上海',
        mode: '日常实习',
        tags: ['交互设计', '视觉设计', 'Figma/MasterGo', '用户调研'],
        batch: '核心本地商业-点评事业部 · 日常实习',
        interviewMode: '上海',
        description: [
          '团队背景：大众点评是国内重要的本地生活消费决策参考平台，以“星级”和“评价”产品为数亿用户提供消费决策依据，并以信息流产品形式帮助用户发现更多好去处',
          '负责大众点评 App 用户端的交互和视觉设计工作',
          '能够统筹运用用研、交互和视觉多个专业的知识技能，完成交互和视觉设计方案',
          '全面跟进产研流程，与产品、研发、QA 团队紧密协作，跟进设计方案落地，确保方案高度还原',
          '沉淀并分享知识，推动设计能力提升',
        ],
        requirements: [
          '大学本科及以上学历，设计相关专业优先',
          '熟练使用设计工具，如 MasterGo、Figma 等',
          '对用户调研、产品分析、专家走查等专业方法有基本了解',
          '具备良好的沟通能力和团队协作意识',
          '每周工作至少 4 天，实习时间 3 个月以上',
          '优先：有互联网大厂工作实习经历',
          '优先：有用户研究经验',
        ],
        benefits: [
          '丰富的知识方法沉淀，成熟的培养体系',
          '有机会参与影响重点产品的设计过程，见证设计带给用户和商业的价值',
        ],
      },
      {
        company: '美团',
        role: '体验设计实习生（大众点评）',
        location: '上海',
        mode: '日常实习',
        tags: ['体验设计', '设计规范', 'AI-Agent', '体验走查'],
        batch: '核心本地商业-点评事业部 · 日常实习',
        interviewMode: '上海',
        description: [
          '团队背景：大众点评深耕本地生活消费领域，覆盖吃喝玩乐游购娱等生活场景，为更好满足用户探索城市的需求，以信息流产品形式助力用户发现更多好去处',
          '参与制定并优化体验设计标准与规范，推动团队体验标准与规范有效落地',
          '协助组织并推进团队体验走查，识别共性问题并提出优化方案',
          '参与大众点评 App 的体验设计工作，负责产品界面的设计和优化',
          '协助参与 AI-Agent 能力建设，推动 Agent 融入设计工作流',
        ],
        requirements: [
          '大学本科及以上学历，设计相关专业优先',
          '对大众点评 App 基础产品的用户体验设计有浓厚兴趣，具备一定的设计基础和创新能力',
          '熟练使用各类设计软件',
          '良好的沟通能力和团队合作精神，能够承受一定的工作压力',
          '优先：有大型互联网公司实习经历',
        ],
        benefits: [
          '可以在大众点评 App 优秀的设计团队中学习和成长，获得实战经验',
          '可以参与大众点评 App 的设计工作，拓展视野和提升设计能力',
          '提供有竞争力的实习薪资和晋升机会',
        ],
      },
      {
        company: '美团',
        role: 'AI 产品设计师（实习）',
        location: '北京',
        mode: '日常实习',
        tags: ['AI产品设计', 'Prompt工程', 'Agent工作流', 'RAG'],
        batch: '核心本地商业-美团平台 · 日常实习',
        interviewMode: '北京',
        description: [
          '负责 AI 产品的需求分析与方案设计，独立完成从用户调研到产品定义的全流程',
          '输出高质量的设计方案：交互原型、视觉设计稿',
          '设计 AI 产品的核心交互——包括 Prompt 工程、Agent 工作流编排、RAG 知识库接入等 AI 能力方案',
          '沉淀 AI 产品设计的方法论，参与团队 AI 工具链的建设',
        ],
        requirements: [
          '具备设计 + 技术复合能力：能独立完成“设计 → 原型 → 开发 → 上线”完整闭环，不依赖他人配合即可交付可用产品',
          '熟练使用 Figma 等设计工具，具备良好的交互与视觉设计功底',
          '熟悉主流大模型能力（GPT / Claude / 豆包 / 通义等），有 Prompt 设计、Agent 搭建、RAG 应用的实际经验',
          '至少掌握一种落地方式：前端 / 全栈开发能力，或熟练使用 Agent 工具进行产品搭建',
          '对 AI 产品有强烈热情，关注行业动态，有自驱力和快速学习能力',
        ],
        benefits: [
          '参与前沿 AI 产品的创新设计，推动技术与体验的融合',
          '与行业优秀团队共同成长，获得丰富的项目经验',
          '开放包容的工作环境，鼓励创意与跨领域协作',
        ],
      },
      {
        company: '美团',
        role: '体验设计师',
        location: '北京/上海/深圳',
        mode: '校园招聘 · 应届',
        tags: ['交互设计', '视觉设计', '用户研究', 'AI原型'],
        batch: '美团应届校园招聘',
        interviewMode: '北京、上海、深圳',
        description: [
          '负责相应业务产品的交互和视觉设计工作',
          '能够统筹运用用研、交互和视觉多个专业的知识技能，完成交互和视觉设计方案',
          '准确地理解业务需求，参与体验研究项目的各个流程，包括研究设计、数据分析、结果输出、推动落地等，挖掘体验问题根因',
          '全面跟进产研流程，与产品、研发、QA 团队紧密协作，跟进设计方案落地，确保方案高度还原',
          '参与设计规范及组件库的制定，沉淀并分享知识，推动设计能力提升',
          '借助 AI 原型生成工具快速产出交互方案初稿，通过人机协作迭代提升设计探索效率',
        ],
        requirements: [
          '本科及以上学历，设计、交互、人机工程等相关专业优先，有互联网产品实习经历或完整设计项目作品集者优先',
          '具备用户研究意识，能够通过市场分析、竞品研究、用户反馈等方式发掘设计洞察和机会点',
          '有独立思考、分析、解决问题的能力，勇于创造和创新；自驱性强，有突出的钻研能力和问题洞察力',
          '具备良好的沟通表达能力与团队协作意识，能够积极与产品、开发等角色配合推动设计方案落地',
          '对 AI 技术及其在设计领域的应用有持续关注和探索热情，有相关实践或实验经验者优先',
          '加分：有线框图和 UI 原型及 UX 设计能力，对色彩、图形、字体、动效等设计原则有基本理解和实践经验',
          '加分：对电商业务有一定认知和兴趣，能够将业务目标和用户价值转化为合理的设计方案',
        ],
        benefits: [
          '最多可投递 3 个职位，但同一时间仅有 1 个职位流程处于进行中，第一志愿将被优先考虑',
        ],
      },
      {
        company: '快手',
        role: '设计工程师-AI设计方向',
        location: '北京',
        mode: '全职',
        tags: ['设计系统', 'React/Vue', 'AI coding', '开源社区'],
        batch: '快手 · 设计类',
        interviewMode: '北京',
        description: [
          '参与企业级设计系统的建设与维护，在导师指导下完成组件开发、Token 体系迭代、文档编写等日常工作',
          '探索 AI 在设计工作流中的应用，尝试用 AI coding 工具构建小工具、agents 或 skills，为团队效率找新的杠杆点',
          '关注海外设计社区动态，收集前沿实践与开源项目信息，将外部视野带回团队',
          '与工程师协作，将设计规范落地为高质量的组件实现，持续学习，快速成长',
        ],
        requirements: [
          '理解设计系统基本原理，有设计系统相关课程项目、实习经历或个人实践，对 Token、组件抽象、主题机制有基础认知和动手经验',
          '掌握前端开发基础，熟悉 Vue 或 React 技术体系，能独立完成中等复杂度的组件开发，有个人项目或实习中的工程实践',
          '关注海外设计社区，活跃于 GitHub、Dribbble、Figma Community 等平台，有开源贡献、个人作品或独立项目者优先',
          '有极客精神，喜欢用代码解决问题，遇到新工具新技术会主动折腾而不是等别人教',
          '对 AI 在设计领域的应用有好奇心，用过 AI coding 工具，有自己的思考和判断',
          '较好的设计品味与审美标准，能在 AI 生成结果中做基本的质量判断',
          '沟通清晰，学习能力强，能在快速变化的环境中保持节奏',
          '优先：独立产品或开源项目有真实用户',
          '优先：有 Figma 插件、浏览器扩展等小工具开发经验',
          '优先：在设计社区有内容输出（博客、教程、分享等）',
        ],
      },
      {
        company: '快手',
        role: '交互设计师',
        location: '北京',
        mode: '全职',
        tags: ['交互设计', '用户研究', 'Figma', '竞品分析'],
        batch: '快手 · 设计类',
        interviewMode: '北京',
        description: [
          '参与产品开发设计的各个阶段，协助撰写交互设计流程',
          '深入了解产品测试和体验，研究用户使用行为和场景，快速优化设计方案',
          '关注分析行业以及竞品动态，了解流行交互方式与发展趋势',
        ],
        requirements: [
          '本科及以上学历，具备用户体验设计相关学科背景，如工业设计、信息设计、交互设计、计算机、人机交互等专业',
          '优秀的逻辑思维能力和沟通能力，积极主动融入团队业务',
          '熟悉交互设计的基础流程和方法，乐于体验不同产品，能熟练使用 Figma 等设计软件',
          '对 AI 业务有强烈兴趣，对 AI 的最新技术和应用有了解和关注，有强烈的用户体验意识，对产品体验有敏锐的洞察',
          '投递简历时，请附带个人作品集或个人作品链接地址',
        ],
      },
      {
        company: '京东',
        role: '创意设计师',
        location: '北京/上海/深圳',
        mode: '校园招聘 · 应届',
        tags: ['创意设计', 'VI/IP', 'AI创意工具', '品牌营销'],
        batch: '京东集团校招 · 设计方向设计类（京东健康/京东集团/京东零售/国际事业群）',
        interviewMode: '北京、上海、深圳',
        description: [
          '深入理解品牌理念和业务需求，结合市场趋势进行创意发散，完成品牌推广、市场营销等项目的创意设计',
          '负责线上线下各类物料设计制作、VI 及 IP 开发、素材库开发等设计项目，确保作品符合质量标准，推动营销活动开展，提升品牌市场影响力',
          '关注品牌/创意/广告/艺术/设计等行业发展趋势，对流行因素有敏锐的洞察力',
          'AI 应用探索：主动运用 AI 创意工具（如 Midjourney、Stable Diffusion、AI 生成视频等）辅助创意概念探索、视觉素材生成，拓展创意边界',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历，美术设计相关专业优先',
          '美术功底好、审美佳，拥有综合视觉表现能力者优先',
          '对前沿的设计理念与技术有所理解，热爱设计与互联网行业',
          '关注品牌、创意、广告、设计等行业发展趋势，对流行因素有敏锐的洞察力，愿意深耕创意设计领域',
          '保持好奇、持续学习，拥有一直向上、永不止步的专业敬畏之心',
          '熟练使用 AI 创意设计工具（如 Midjourney、Stable Diffusion 等）进行创意发散与视觉输出；有将 AI 创意成果应用于实际项目的作品或案例',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
          '投递前请务必上传 PDF 作品集',
        ],
      },
      {
        company: '京东',
        role: '视觉设计师',
        location: '北京/上海',
        mode: '校园招聘 · 应届',
        tags: ['视觉设计', 'AI/C4D/Sketch', '用户体验', '数据驱动'],
        batch: '京东集团校招 · 设计方向设计类（京东健康/京东科技/京东零售）',
        interviewMode: '北京、上海',
        description: [
          '进行客户体验及用户界面的设计及管理',
          '提升各类客户体验品质，提高客户满意度',
          '了解行业流行因素，结合业务特点、客户需求做出热点创意设计',
          'AI 应用探索：主动关注并运用 AI 设计工具（如 Midjourney、Stable Diffusion、AI 版式生成等）提升创意效率与视觉表现力，探索 AI 辅助设计的新可能',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '美术、设计相关专业，能够熟练使用 AI、C4D、Sketch 等相关设计软件',
          '有一定数据分析能力，擅长推动设计优化，并通过数据进行验证',
          '关注品牌、创意、广告、设计等行业发展趋势，对流行因素有敏锐的洞察力，愿意深耕创意设计领域',
          '学习能力强，有好奇心，敢于创想与落地，对前沿的设计理念与技术有所理解',
          '熟练使用 AI 设计工具（如 Midjourney、Stable Diffusion 等）辅助创意探索与素材生成；有将 AI 融入设计工作流的实践经验或作品展示',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
          '投递前请务必上传 PDF 作品集',
        ],
      },
      {
        company: '字节跳动',
        role: '国际化短视频产品设计实习生（TikTok 设计）',
        location: '北京',
        mode: '日常实习',
        tags: ['UX设计', 'Figma', 'Vibe coding', '国际化'],
        batch: 'TikTok 设计 · 职位 ID A221881',
        interviewMode: '北京',
        description: [
          '团队背景：TikTok 覆盖 150 个国家和地区，TikTok 设计团队遍布中国、美国、新加坡等地，由产品设计师、创意设计师、效果设计师、内容文案专家与本地化经理协同合作',
          '负责公司最大国际化短视频产品的用户体验（UX）设计工作',
          '从初步产品构想出发，深入挖掘并细化设计概念，探索满足用户需求的解决方案，并跟踪设计落地效果',
          '以用户体验为中心，主动提出设计与产品优化方案，持续提升产品整体体验',
        ],
        requirements: [
          '本科及以上学历在读，设计相关专业优先',
          '可连续实习，长期实习优先，具备良好的沟通与协作能力，积极主动',
          '工作认真负责，注重设计细节，耐心细致，有好奇心、喜欢探索，有尝试过 AI Vibe coding',
          '熟练掌握 Figma 等设计工具，具备交互与 UI 设计基础，设计习惯良好，审美水平较高',
          '英语通过 CET-4（能以英语作为工作语言者优先），有互联网产品设计经验及作品案例者、社交平台活跃用户优先',
        ],
        benefits: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
          '有机会理解世界不同地域的文化差异，分析并解决复杂的体验问题，进行前沿的设计探索',
        ],
      },
      {
        company: '字节跳动',
        role: '创意视觉设计师（飞书设计）',
        location: '北京/上海',
        mode: '校园招聘 · 2027届',
        tags: ['视觉传达', 'Figma/AE/C4D', '品牌传播', 'AIGC'],
        batch: '飞书设计 · 职位 ID A61653',
        interviewMode: '北京、上海',
        description: [
          '团队背景：飞书设计负责飞书核心产品体验与品牌设计，覆盖产品体验、设计系统与品牌表达等方向，并持续探索“人机协作”的新范式',
          '负责集团旗下 Lark 业务线的产品内容与传播设计工作，涵盖但不仅限于产品获客材料制作、传播物料、品牌礼品等设计工作',
          '能够精准把握产品核心价值，通过设计手段实现内容信息的高效可视化呈现',
          '对设计工作保持热情，主动学习并掌握新知识与设计工具',
        ],
        requirements: [
          '2027 届获得本科及以上学历，视觉传达设计或相关专业优先',
          '具备优秀的审美素养，扎实的视觉设计基础功底',
          '能独立完成设计执行与验收，有成熟案例，熟练掌握 Figma、AE、C4D 等设计工具，同时熟悉 PPT 及 Keynote 制作流程',
          '具备主动思考能力，能够独立承担并完成设计任务，能够从内容与传播效果的角度提供创意设计方案',
          '注重细节处理，具有开阔的行业视野及快速学习能力，具备优秀的团队协作精神',
          '具备 AI 相关能力，有系统性的 AIGC 作品，具有实习经历者优先考虑',
        ],
      },
      {
        company: '字节跳动',
        role: 'AI产品设计师（剪映CapCut）',
        location: '北京/深圳/上海',
        mode: '校园招聘 · 2027届',
        tags: ['AI产品设计', '体验设计', '工具类产品', '复杂交互'],
        batch: '剪映CapCut · 职位 ID A167573A',
        interviewMode: '北京、深圳、上海',
        description: [
          '团队背景：剪映CapCut 团队成立七年，先后孵化剪映、CapCut、醒图、Hypic、即梦、Dreamina、Pippit 等产品，打造与 AI 结合的全球化产品矩阵',
          '负责 AI 工具类产品的体验设计与持续迭代',
          '面向多状态、多结果、不确定反馈的 AI 产品场景，聚焦复杂交互与关键路径设计',
          '在既有产品框架下不断打磨细节体验，推动体验与视觉质量的持续提升',
          '在明确业务目标与技术边界的前提下，与产品、算法、工程紧密协作完成落地',
        ],
        requirements: [
          '2027 届获得本科及以上学历',
          '具备 UX / 交互 / 产品设计经验，了解工具类/内容创作类/平台型产品的设计模式',
          '对 AI 产品形态具备基础理解与实践经验，了解大模型相关能力与限制',
          '推进设计落地，平衡效率与质量',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI体验设计师',
        location: '北京/广州/杭州/上海',
        mode: '校园招聘 · 2027届',
        tags: ['AI体验设计', '用户调研', 'Agent产品', '生成式AI'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生 · 设计类（淘宝闪购/阿里云/千问/虎鲸文娱/盒马）',
        interviewMode: '北京、广州、杭州、上海',
        description: [
          '有机会加入阿里云、淘宝闪购、飞猪、阿里国际、钉钉、千问 C 端、虎鲸文娱等业务，参与结合 AI 的体验设计创新工作',
          '在业务场景中完成用户痛点及需求梳理、设计策略、设计方案、结果验证、优化迭代的全流程体验设计',
          '参与 AI 与业务结合的产品体验创新，探索高质量的 AI 体验范式及设计表达',
          '参与设计 AI 能力和资产建设，设计方法与流程迭代，提升设计质量与效率',
        ],
        requirements: [
          '本科及以上学历，有良好专业教育背景（设计类、计算机、人工智能、心理学等专业，有多元专业视角加分）',
          '具备优秀的用户视角、抽象思维和问题拆解能力，通过用户调研、行业分析及研究，持续挖掘事物本质和落地的创新机会',
          '乐于拥抱 AI、敢于动手验证想法，熟练掌握主流 AI 设计工具、生成式 AI 技术原理，有 AI Agent 产品设计经验者加分',
          '具备良好的沟通与跨团队协作能力，推动创意从“想法”走向“现实”',
          '有全球多元文化下的学习、生活和工作经验者优先',
        ],
        benefits: [
          '可投递多个业务集团/公司，不同业务集团的应聘流程可并行；每个业务集团只有 1 次投递机会，且最多可选择 2 个意向投递',
        ],
      },
      {
        company: '阿里巴巴',
        role: '产品体验设计师',
        location: '杭州',
        mode: '校园招聘 · 2027届',
        tags: ['产品体验设计', 'AI设计能力', '视觉风格定义', '商业逻辑'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生 · 设计类（淘天集团）',
        interviewMode: '杭州',
        description: [
          '洞察用户行为和反馈，分析同类产品尤其是 AI 产品的设计形态和发展范式',
          '承接各业务形态的产品体验设计',
          '交付针对需求的策略和设计方案',
          '构建 AI 设计的产品能力',
          '撰写各类设计知识文档，包括但不限于符合 AI 认知的规范，模型可识别的内容知识',
        ],
        requirements: [
          '本科及以上学历；设计学科，同时跨学科交叉背景优先，如人机交互（HCI）、体验设计、视觉设计、计算机科学等',
          '因自身兴趣长期专研和磨砺设计产出，尤其是界面视觉风格定义，无学科背景要求',
          '出众、独特的审美能力，具备构建精致有序、易于理解的设计界面能力，图形认知判断准确',
          '理解商业运行逻辑和用户使用产品的常识，理解商业、用户、成本的关系，遵循产品统一体验',
          '具备主动沟通协作的意识和勇气，判断统一体验条件下的协同必要性',
          '有务实本真的求变意识，同一设计能持续创新；追踪 AI 前沿演进趋势，探索 AI 产品设计新范式',
          '具备基于任务目标构想一切画面内容和关系的能力，并能用语言精确表达',
          'AI 设计工具的应用：在工作和设计产出中使用 AI 工具，具备高品质可落地的生成结果；对 AI 底层模型能力有认知',
        ],
        benefits: [
          '可投递多个业务集团/公司，不同业务集团的应聘流程可并行；每个业务集团只有 1 次投递机会，且最多可选择 2 个意向投递',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI视觉设计师',
        location: '杭州',
        mode: '校园招聘 · 2027届',
        tags: ['AI视觉', 'AIGC工作流', '视觉传达', 'Agent视觉'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生 · 设计类（淘宝闪购）',
        interviewMode: '杭州',
        description: [
          '有机会加入淘宝闪购，参与 AI 时代的视觉内容生产与品牌表达创新工作',
          '参与导购信息表达与决策引导、复杂业务逻辑的视觉化、营销 IP 心智设计等项目；负责产品的 AI 视觉内容创作，包含海报、视频、商品图等从创意到落地的全流程',
          '参与 Agent 场景下的视觉与品牌表达设计，探索 AI 产品中一致、可延展的视觉语言与表达范式',
          '沉淀可复用的 AI 视觉生产工作流，对 AI 生成内容进行判断、筛选与精修，持续提升团队产出的质量与效率',
        ],
        requirements: [
          '本科及以上学历，设计相关专业（视觉传达、数字媒体、产品设计等），具备较好的审美判断力与视觉定义能力',
          '熟悉主流 AI 图像 / 视频生成工具（ChatGPT、可灵、即梦、Sora 等），有节点式工作流搭建、角色/场景一致性控制、多模型混合调用经验者加分',
          '具备 Photoshop / Illustrator / AE 等传统设计软件的精修与排版能力',
          '有团队协作意识，能够承受一定的工作压力，具有良好的沟通能力和解决问题的能力，具备较强的学习能力和创新精神',
        ],
        benefits: [
          '可投递多个业务集团/公司，不同业务集团的应聘流程可并行；每个业务集团只有 1 次投递机会，且最多可选择 2 个意向投递',
        ],
      },
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
      {
        company: '腾讯',
        role: 'AI产品经理（企业微信·智能助理 Agent）',
        location: '广州',
        mode: '社会招聘 · 1 年以上',
        tags: ['企业微信', 'AI助理', 'Agent', 'IM体验'],
        batch: 'WXG 微信事业群 · 企业微信',
        interviewMode: '广州',
        description: [
          '负责企业微信内的基础模块和 AI 功能的相关产品策划工作，具体包括但不限于基础功能的策略制定、功能设计及推动上线',
          '主要负责的功能模块是企业微信 AI 相关功能、主框架、基础 IM 体验、基础管理体验等',
          '持续了解企业通讯工具、协同工具、企业微信与 AI 结合的需求和体验提升',
        ],
        requirements: [
          '对产品设计有饱满热情，在功能策划上有一定经验和能力',
          '对 AI 有一定经验或者知识积累，且有结合用户视角理解的能力',
          '善于观察和分析，善于发现关键问题，分清主次矛盾，具备很好的逻辑抽象能力和框架系统思考的能力',
          '有洞察机会的能力，面对产品增长的瓶颈，有意愿突破难解的问题，寻找可能的出口尝试',
        ],
      },
      {
        company: '腾讯',
        role: 'AI产品经理',
        location: '深圳',
        mode: '校园招聘 · 应届',
        tags: ['AI产品定义', 'LLM/Agent/RAG', 'AI交互体验', 'A/B实验'],
        batch: '腾讯校园招聘 · 产品',
        interviewMode: '深圳 / 远程面试',
        description: [
          '定义 AI 产品方向：洞察用户场景中 AI 能创造增量价值的关键节点，完成 AI 产品的需求定义、方案设计和效果验证，推动从概念到上线的完整闭环',
          '驾驭 AI 技术边界：深入理解大模型（LLM/MLLM）、Agent 架构、RAG、多模态等核心 AI 技术的能力与局限，能准确判断什么该用 AI 做、什么不该用，与技术团队高效对话',
          '设计 AI 交互体验：探索 AI 驱动的新型交互范式——对话式界面、生成式 UI、主动式智能推荐、Agent 多步推理等，建立独特的 AI 产品体验指标（如准确率、幻觉率、用户信任度等）',
          '驱动 AI 产品增长：通过数据实验（A/B 测试、用户行为分析、AI 使用漏斗等）持续优化产品策略，追踪 AI 产品的留存、付费转化和用户满意度',
          '追踪 AI 前沿：保持对 AI 行业动态的敏锐关注，及时将前沿进展转化为产品机会',
        ],
        requirements: [
          'AI 应用技能：善于借助 AI 工具拆解复杂问题、探索解决方案，并能对 AI 的输出进行高质量判断，具备人机协同的工作意识和习惯',
          '具备敏捷的洞察和思维能力，并且能把思考变为现实以不断满足用户和客户需求',
          '拥有优秀的逻辑思维与系统分析能力、技术敏感度及商业敏感度',
          '具备优秀的产品 Sense 和用户同理心，能独立完成从用户洞察到产品方案的全流程思考',
          '怀揣着做出优秀互联网产品的梦想，拥有对 AI 行业和产品的极大热情',
          '加分：计算机或算法类专业背景、了解大模型技术',
          '加分：有产品实习经历或独立完成的产品项目（有 AI 产品经验尤佳）',
          '加分：用 AI 工具搭建过 AI 应用原型的实际经验',
        ],
        benefits: [
          '参加面试的城市：深圳，支持远程面试',
        ],
      },
      {
        company: '腾讯',
        role: '游戏发行/运营培训生',
        location: '待定',
        mode: '校园招聘 · 应届',
        tags: ['游戏运营', '商业化策划', '玩家洞察', '内容运营'],
        batch: '腾讯校园招聘 · 产品',
        interviewMode: '远程面试',
        description: [
          '深入挖掘游戏运营数据与玩家反馈，洞察玩家的偏好，发现问题与增长机会，为游戏的长线运营和迭代方向提供有理有据的决策支持',
          '参与游戏内活动、商业化内容与版本节点等设计与策划，通过合理的商业模式和策略，为玩家提供独特的价值和体验，同时为游戏创造可持续的收入和增长',
          '倾听玩家声音，在游戏社区中与玩家互动交流，洞察与理解玩家、关心玩家',
          '负责游戏在各类平台和渠道的内容运营与推广合作，策划有创意、有传播力的内容，把游戏的魅力精准传递给目标玩家',
        ],
        requirements: [
          '专业不限，学科成绩优秀，综合素质扎实；热爱游戏，对游戏设计、玩家心理或流行内容有自己的独到判断，并持续关注行业动态',
          '具备一定的产品思维，对数据敏感，能从数据和反馈中找到洞察，并转化为行动',
          '具有优秀的学习能力、创造力、沟通能力、逻辑思维、系统分析与文字组织能力',
          '乐于接受新鲜事物，对流行文化、创新科技、电子竞技等有较高关注度；热爱生活、关注人性，对玩家的心态和行为有天然的敏感与理解',
          '加分：乐于探索 AI 使用，有尝试用 AI 工具辅助进行数据分析、内容生产的相关经验',
          '加分：具有广泛网络游戏经验或电子竞技参与经验',
          '加分：具备英、日、韩任意一种语言无碍使用能力',
        ],
        benefits: [
          '参加面试的城市：远程面试',
        ],
      },
      {
        company: '腾讯',
        role: '技术产品经理',
        location: '待定',
        mode: '校园招聘 · 应届',
        tags: ['ToB/ToG', '云计算', 'AI数据分析', '商业化'],
        batch: '腾讯校园招聘 · 产品',
        interviewMode: '远程面试',
        description: [
          '负责 ToB（或 ToG）平台产品的产品策划和运营工作，提供具有竞争力的产品方案，实现产品增长、商业化目标',
          '关注行业生态、同类产品动向，结合产品优势制定行业合作和市场运营方案，提升行业影响力',
          '持续关注云计算和 AI/大模型发展趋势，理解 AI 在 B 端产品中的应用逻辑（智能客服、AI 数据分析、RAG 知识管理等），基于业界标杆和技术原理的分析，落地技术产品',
          '构建业务数据监控体系、IT 支持及客服体系、渠道和营销体系，持续改善系统架构、运营效率和成本，提升销售转化效率',
          '进行业务调研和客户反馈收集，提炼通用需求并判断优先级，推进销售或客户的痛点问题持续解决',
        ],
        requirements: [
          'AI 应用技能：善于借助 AI 工具拆解复杂问题、探索解决方案，并能对 AI 的输出进行高质量判断，具备人机协同的工作意识和习惯',
          '计算机、软件、人工智能、大数据相关专业',
          '热爱互联网、热爱技术；对产品策划有激情，热爱思考，具有优秀的逻辑思维和创新能力',
          '有亲和力，擅于沟通，并有优秀的执行力来保障需求的落地',
          '有服务意识，用心满足客户诉求，愿意深入了解客户的应用场景',
          '善于面对挑战和质疑',
          '加分：有一定的编程能力',
        ],
        benefits: [
          '参加面试的城市：远程面试',
        ],
      },
      {
        company: '小红书',
        role: '全球增长业务管培生（产品）',
        location: '北京/上海',
        mode: '校园招聘 · 2027届',
        tags: ['Creator Growth', '社区增长', 'AI-Native', '全球化'],
        batch: '2027 校园招聘 · 非技术 / 产品',
        interviewMode: '北京、上海',
        description: [
          '岗位定位：参与全球市场的 creator 和 community growth，从找到第一批核心用户和创作者，到设计 creator 成长机制、组织社区活动，再到探索能规模化复制的增长模式',
          '不是传统的社区运营，也不是机械地联系达人和维护群聊——希望你既懂人，也懂工具，用 AI、自动化和轻量技术手段把高度依赖人工的增长做得更快、更聪明、更可规模化',
          '参与重点市场的 creator 和 community 冷启动及增长，挖掘、招募和运营有潜力的创作者、社区核心用户和合作伙伴',
          '设计 creator onboarding、成长路径、激励机制和长期运营体系，策划线上线下社区活动，提升参与度与社区连接',
          '分析 creator、内容和社区数据，持续优化招募、成长和留存策略；与产品、市场、品牌团队合作，把社区洞察转化为产品和增长方案',
          '使用 AI 工具完成 creator sourcing、用户研究、内容分析、信息整理和项目推进，探索自动化 creator database、运营 workflow、内容监测等方式',
          '独立负责部分市场或项目，从 0 到 1 建立可持续的 growth playbook',
        ],
        requirements: [
          '本科及以上学历，不限专业',
          '对 creator economy、社交媒体、社区文化和互联网内容高度敏感',
          '喜欢和人打交道，同时具备很强的组织、沟通和推动能力',
          '对不同国家、语言和文化有强烈好奇心，愿意深入理解本地用户',
          '有 ownership，面对不确定的问题能够自己找到切入点并开始行动',
          '对技术和数据不排斥，愿意用新的方式解决传统运营问题',
          '英文可以作为工作语言',
          '具备 AI-native 的工作习惯，能够主动思考哪些事情不应该继续靠人工完成',
          '加分：熟练使用 Codex、Cowork、ChatGPT 等 AI 工具做用户研究、内容分析、creator sourcing 和项目管理',
          '加分：能利用 AI 快速处理大量内容、creator 和用户信号，从中发现增长机会',
          '加分：会自己搭简单的自动化 workflow、数据抓取、creator database 或内部运营工具',
          '加分：有 vibe coding、no-code、light coding 或 agent workflow 相关经验',
          '加分：做过自己的内容账号、社区、工具、side project 或其他从 0 到 1 的项目',
          '加分：有校园社群、creator、community、活动或国际化项目经历',
          '加分：掌握第二外语，例如马来语、印尼语、泰语等',
        ],
        benefits: [
          '每人最多可投递 1 个职位方向中的 2 个子方向，最多 5 个职位；投递后职位方向不可更换，志愿将按顺序依次流转',
        ],
      },
      {
        company: '小红书',
        role: '产品经理（AI Coding·AI 应用）',
        location: '北京/上海',
        mode: '校园招聘 · 2027届',
        tags: ['AI Coding', '研发Agent', 'LLM', 'IDE插件/CLI'],
        batch: '2027 校园招聘 · 非技术 / 产品 · 质效研发部',
        interviewMode: '北京、上海',
        description: [
          '团队背景：质效研发部以 AI 重构公司级下一代质量与研发效能体系，基于 LLM 辅助与 LLM 原生能力串联从需求理解到发布部署的全流程，让每位研发人都有机会成为“超级个体”',
          '负责质效领域大模型产品某条功能线的全生命周期：研发 Agent、AI Coding（IDE 插件 / CLI）、AI Testing 等方向的产品设计，完成从原型验证到规模化推广的完整交付',
          '深入研发一线场景，识别 AI 能真正提效的切入点：通过用户行为分析与一线访谈，定位大模型应用的关键价值点与能力边界，把研发痛点转化为可落地的 Agent 方案',
          '搭建产品数据监测与评测体系，追踪核心指标口径，通过深度分析用户使用数据与反馈，形成数据驱动的产品决策闭环',
          '追踪 AI Coding 与 Agent 领域一手动态，形成自己的方向判断并推动落地；与业务团队协同，快速构建专属 AI 能力',
        ],
        requirements: [
          '本科及以上学历，计算机科学、软件工程、数据科学、人工智能等相关专业优先',
          '具备扎实的产品设计基础：能独立完成需求拆解、用户场景分析、方案设计与 PRD 撰写，产出结构清晰、逻辑严谨、可直接进入评审的文档',
          '具备项目推进能力：能拆解里程碑、跟进进度、识别风险，推动跨职能协作按期交付',
          '深度使用过至少一款 AI Coding 工具（Cursor / Claude Code / Copilot / CodeWiz / Windsurf 等）：不是“试过”，而是真的用它完成过完整项目或持续交付过代码，面试会现场追问工作流细节',
          '学习能力和自驱力突出，能在不确定性中主动探索方向',
          '加分：有可展示的独立产出（产品分析文章、独立产品 / 工具 / 开源项目、竞赛成果），投递时附上链接或文档；给开源项目提交过被合并的 PR',
          '加分：有 AI 产品、开发者工具、DevTools 相关实习经历',
        ],
        benefits: [
          '直接影响数千名小红书研发工程师日常工作方式的机会，你做的每一个决策都在重塑公司的研发范式',
          '直面 LLM 在实际工程场景落地的关键难题：可靠性、可控性、规模化，以及“能力边界与产品价值匹配”问题',
          '完善的 Mentor 带教与成长机制，与一群对技术和产品充满热情的伙伴共同探索人机协作的研发新范式',
          '每人最多可投递 1 个职位方向中的 2 个子方向，最多 5 个职位',
        ],
      },
      {
        company: '小红书',
        role: '产品经理（Trust&Safety·rednote 国际化）',
        location: '新加坡',
        mode: '校园招聘 · 2027届',
        tags: ['Trust&Safety', 'AI治理', '国际化', '风控合规'],
        batch: '2027 校园招聘 · 非技术 / 产品 · rednote 国际化',
        interviewMode: '新加坡',
        description: [
          'AI-native 治理平台共建：参与下一代 AI Native 安全治理平台的产品设计，打通风险感知、识别、审核、处置、评估的治理全链路；探索 LLM 与 Agent 能力在审核、调查、辅助决策中的落地边界',
          '用户信任与透明度产品：设计面向用户的治理沟通体验——审核结果如何解释、处罚原因如何透传、申诉与举报链路如何更公平高效，直接影响平台的用户信任度指标',
          '全球化实战场：面向海外及非中文市场，理解不同地区的监管环境、文化语境与用户预期差异，与工程、算法、Policy、运营、数据团队协作完成从需求到上线的闭环',
          '前沿风险探索：深入诈骗、垃圾账号、未成年人保护、内容分级等前沿风险议题，参与识别新型风险模式并推动产品化解法',
        ],
        requirements: [
          '对平台治理、内容生态、社会议题有真实的好奇心，愿意面对“没有标准答案”的复杂问题，并从中找出可执行的解法',
          '对 AI 等前沿技术有浓厚兴趣，理解 LLM / Agent 的能力与边界，渴望把技术变成真正跑起来的产品能力',
          '兼具细腻的用户同理心与系统化思维——既能站在被处罚用户的视角思考体验，也能设计出支撑亿级规模的机制与流程',
          '具备结构化表达与跨团队推动能力，能把复杂规则讲清楚，也能推动工程、算法、政策、运营达成一致',
          '具备数据驱动思维，习惯用数据和实验验证判断，而非依赖直觉',
          '拥有深度思考和持续进化的成长型思维，在面对挑战与模糊地带时展现出勇气与韧性',
          '加分：计算机、人工智能、数据科学、人机交互、法学、社会学、传播学等相关背景',
          '加分：有内容平台、社区产品、风控、合规相关的实习或项目经历',
          '加分：具备良好的英文读写与沟通能力，能阅读海外监管文件与平台政策原文',
          '加分：有跨文化生活 / 学习经历，或对海外市场用户行为有真实观察',
        ],
        benefits: [
          '岗位面向全球市场业务，有机会在真实的跨时区、跨职能环境中完成从需求到上线的完整闭环',
          '每人最多可投递 1 个职位方向中的 2 个子方向，最多 5 个职位',
        ],
      },
      {
        company: '快手',
        role: '平台产品经理-电商产品',
        location: '杭州',
        mode: '全职',
        tags: ['电商产品', '交易链路', '内容导购', '流量效率'],
        batch: '快手 · 产品类-平台产品B端',
        interviewMode: '杭州',
        description: [
          '负责快手电商核心产品体验与迭代，提升流量效率与核心交易效率，包括但不局限于首页、售前、售后等模块',
          '结合快手产品用户特征与内容导购业务模式，探索创新方案',
          '撰写产品需求、功能定义、用户界面、交互设计等详细文档，高效项目推动，高质量交付',
          '持续关注产品效果数据，优秀的业务 sense，并从数据中探寻产品的优化方向',
        ],
        requirements: [
          '本科及以上学历，理工科专业优先',
          '熟悉电商交易链路 / 商家治理 / 运营平台 / 内容生态 / 直播互动等关键产品领域，可迅速独立支持项目者优先',
          '优秀的逻辑性和结构性思维，优秀的用户洞察、商业感觉与行业格局，对内容导购类产品有深入理解或者实习经历最佳',
          '热爱移动产品，有强烈的开放创新意识，能举一反三，具有优秀的沟通和跨部门协作能力',
          '熟悉 Axure、PS、Visio 等产品经理常用工具，具备基础的数据分析与框架能力',
          '抗压能力强，对工作有责任心，具备良好的服务精神和团队合作能力',
        ],
      },
      {
        company: '快手',
        role: '平台产品经理-支付产品',
        location: '杭州',
        mode: '全职',
        tags: ['支付产品', 'B端', '商业化', '需求规划'],
        batch: '快手 · 产品类-平台产品B端',
        interviewMode: '杭州',
        description: [
          '负责快手支付产品方向相关工作，BP 对接业务部门，及时收集业务部门的支付需求和反馈，出具对应需求的产品规划与方案设计',
          '能够结合市场竞争态势和发展情况设定目标，并拆解为可执行的产品路径，抽象和输出支付解决方案',
          '通过商业判断、数据分析、需求挖掘，构建并完善运营效率等关键指标，持续助力业务增长',
          '负责跨部门协调和沟通，推动方案落地和管理进展，把控项目质量',
        ],
        requirements: [
          '本科及以上学历，有支付产品相关实习经验者优先',
          '用户体验产品感觉好，具有同理心，了解用户诉求，并通过产品优化不断提升用户满意',
          '熟悉了解电商、直播、广告、内容等相关行业玩法',
          '具备较强的逻辑分析能力、语言表达能力和写作能力，有较强的责任心和执行力，具备优秀的规划和独立推进项目进度的能力',
        ],
      },
      {
        company: '快手',
        role: '策略产品经理',
        location: '北京',
        mode: '全职',
        tags: ['策略产品', '推荐', '增长裂变', '数据分析'],
        batch: '快手 · 产品类-策略产品',
        interviewMode: '北京',
        description: [
          '根据不同应用场景（推荐、增长裂变、热点功能等）提出产品策略方案，推动具体策略的迭代升级及产品化功能落地，提升用户使用体验',
          '深入了解业务场景，通过用户调研、数据分析挖掘用户需求，基于用户反馈和数据分析进行效果评估并提出产品改进点',
          '收集内外部需求，跟踪行业竞品动态，挖掘新的策略优化点并提出切实可行的产品方案',
          '通过用户调研、竞品分析、数据分析，学习和了解业界最新动态，发现产品机会点',
        ],
        requirements: [
          '本科及以上学历，计算机、数学等相关专业优先',
          '良好的逻辑思维能力，有一定的业务敏感性与数据敏感性，对短视频有强烈热情和深入理解',
          '良好的需求管理能力、项目推进能力和团队协作能力，能够独立完成需求调研、数据分析等工作',
          '数据敏感型，擅长使用各种工具进行数据分析，并对所产出数据保持严谨态度',
          '互联网产品重度使用者，了解产品设计和用户体验原理，具备一定的产品思维和创新意识',
          '优先：对增长玩法、热点产品、裂变机制、推荐系统有了解',
        ],
      },
      {
        company: '快手',
        role: '平台产品经理-商业产品',
        location: '北京',
        mode: '全职',
        tags: ['商业化', '流量策略', '投放优化', 'AB实验'],
        batch: '快手 · 产品类-平台产品B端',
        interviewMode: '北京',
        description: [
          '负责商业化变现业务的场景拓展及策略优化落地',
          '针对不同类型 App 的商业化流量进行梳理和规划，推动相关策略落地及效率提升',
          '深入挖掘投放全链路中的潜在机会点，优化投放效率',
          '通过竞品调研、客户调研及数据分析深入了解需求并设计产品方案，通过 AB 实验确保迭代方案的有效性',
        ],
        requirements: [
          '本科及以上学历，专业不限',
          '互联网产品重度使用者，有商业化产品实习背景优先，媒体样式、流量策略或投放策略等方向皆可',
          '严密的逻辑思维和扎实的数据分析能力，能够敏锐地从数据中发现和总结问题，并对所产出数据保持严谨态度',
          '学习能力强，积极主动、思维活跃，具有良好的沟通表达能力，吃苦耐劳',
        ],
      },
      {
        company: '京东',
        role: '技术产品经理',
        location: '北京/成都/深圳/上海',
        mode: '校园招聘 · 应届',
        tags: ['B端/C端', 'AI产品评测', 'MVP验证', 'A/B测试'],
        batch: '京东集团校招 · 产品方向产品类（京东健康/京东科技/京东集团/京东工业/京东物流/京东零售/探索研究院）',
        interviewMode: '北京、成都、深圳、上海',
        description: [
          '常规方向：负责 B 端、C 端产品策划工作，基于内部或外部客户业务需要，设计技术产品架构，明确产品功能需求',
          '常规方向：跟进研发开发、测试，完成产品上线和功能迭代；关注行业动态，定期产出有价值情报信息并提炼为可能的解决方案',
          'AI 方向：参与 AI 产品的全流程设计，包括用户需求调研、场景挖掘、原型设计及 MVP 验证',
          'AI 方向：构建 AI 产品效果评估体系，包括评估指标、测评数据集设计、效果归因及优化策略制定',
          'AI 方向：基于 A/B 测试、用户行为和反馈数据，推动产品持续优化迭代；关注 AI 行业动态与竞品动向，输出差异化分析与产品洞察报告',
          'AI 应用探索：主动运用 AI 工具（智能原型工具、数据分析平台、用户反馈分析工具等）提升产品调研、设计与决策效率',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '计算机、人工智能、自动化、统计学、心理学、交互设计等相关背景优先',
          '对产品开发、设计、测试、运营等有一定了解；AI 方向需对 AI 技术有基础认知，对 AI 产品、生成式技术应用充满热情',
          '具备大局观，逻辑思维能力强，主动性高，有高效的执行力，具备优秀的理解、沟通与协调能力，有一定的文字表达能力',
          '熟练使用通用 AI 工具（如对话式 AI）辅助需求分析、竞品调研与文档撰写；有使用 AI 原型设计工具的经历者优先',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '京东',
        role: '产研项目管理',
        location: '北京',
        mode: '校园招聘 · 应届',
        tags: ['项目管理', '风险管控', 'ROI论证', 'AI提效'],
        batch: '京东集团校招 · 产品方向项目类（京东健康/京东零售/京东工业/京东科技/京东集团）',
        interviewMode: '北京',
        description: [
          '按照公司项目管理流程对项目进行全生命周期管理，包括业务条线上的项目集管理：项目立项、排期、进度跟踪、质量管控、风险预警评估、结项等项目过程管理',
          '为公司项目落地提供有力支持，保证决策在各部门、团队快速传递并有效执行；深入理解业务，识别组织效率 / 项目交付过程 / 研发管理等领域的问题，提供分析建议以支持决策',
          '参与项目需求优先级分析、ROI 指标的论证及项目立项评审，制定合理的整体项目计划、控制项目总体成本，项目结项后效果跟踪与评估',
          'AI 应用探索：主动运用 AI 工具辅助项目进度跟踪、风险识别与数据分析，提升项目管理透明度与协同效率',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '对互联网极度热爱，具备敏捷的洞察和思维能力，有把思考变为现实以满足项目需求的勇气和能力',
          '优秀的创造力、想象力、逻辑思维与系统分析能力，突出的文字组织能力和沟通能力',
          '极强的跨部门沟通能力、组织协调和问题解决的能力，突出的抗压能力，学习适应能力',
          '熟练使用 AI 工具（如通用对话式 AI）辅助项目文档整理、会议纪要与风险分析；有利用 AI 工具优化项目管理流程的经历者优先',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '字节跳动',
        role: 'AI产品经理（广告策略方向·抖音生活服务）',
        location: '上海/北京',
        mode: '校园招聘 · 2027届',
        tags: ['广告策略', 'Agent评测', 'SFT/CoT', '生活服务'],
        batch: '抖音生活服务 · 职位 ID A95159A',
        interviewMode: '上海、北京',
        description: [
          '团队背景：抖音生活服务依托抖音 POI、短视频、直播、搜索等，截至 2025 年底业务覆盖 400+ 城市、超过 1500 万家动销门店',
          '围绕生活服务商家和平台营收目标，开展广告 AI 能力的客户需求分析、业务目标拆解、产品定义，完善 Agent 能力评测到营收结果增益的逻辑链，持续度量收益并判断 Agent 迭代导向与优先级',
          '通过对广告产品原理、生活服务交易供需的业务理解，和产品运营团队持续迭代评测标准和评测集，和算法团队通过样本建设到 Post-train 深度参与调优过程，提升 Agent 能力指标',
          '通过对商家服务策略、销售技巧的提取，优化 Agent 的 Context（Memory）、Skill，提供端到端个性化的服务方案，最终达成过程指标和营收结果增益',
        ],
        requirements: [
          '2027 届获得本科及以上学历，理工科优先',
          '优先广告策略应用 AI、AI 商家服务、AI 搜索、AI 导购等产品经验；具备优秀的策略设计、数据分析、洞察能力和逻辑思维',
          '对当前的 Agent 技术，尤其是 SFT、CoT、Post-train 有深入理解，有 AI 规模化实践或拿到业务收益的代表作优先',
          '具备良好的沟通能力，具备跨业务角色协调、解决问题的能力，有强烈的责任心和团队合作精神',
        ],
      },
      {
        company: '字节跳动',
        role: 'Agent产品实习生（巨量投放方向）',
        location: '上海',
        mode: '日常实习',
        tags: ['Agent产品', '广告投放', '商业化'],
        batch: '广告业务 · 职位 ID A68688A',
        interviewMode: '上海',
        description: [
          '团队背景：广告业务为抖音集团的商业化提供产品规划、迭代与运营，负责端到端大型广告系统建设，覆盖抖音、今日头条、番茄小说、红果短剧、穿山……（原文内容到此处截断）',
          '说明：本岗位素材仅包含团队介绍开头，具体职位描述与任职要求待补充',
        ],
      },
    ],
    '数据类': [
      {
        company: '美团',
        role: '智能商业分析师（BA/DS）',
        location: '北京/上海',
        mode: '校园招聘 · 应届',
        tags: ['商业分析', '数据科学', 'LLM应用', '实验平台'],
        batch: '美团应届校园招聘',
        interviewMode: '北京、上海',
        description: [
          '参与业务规划、策略制定、经营分析，为复杂的商业问题设计解决方案',
          '使用一流的数据分析工具和技能，洞察商业规律、用户需求，为业务出谋划策',
          '参与建设业界一流水平的公司级实验中台，为重大实验决策提供科学方案支撑（数据科学方向）',
          '探索大模型在商业分析场景的应用，如利用 LLM 辅助行业研究、自动化报告生成、智能数据洞察、自然语言数据查询等',
        ],
        requirements: [
          '本科及以上学历，数学、统计、计算机、工科、商科等相关专业背景更佳',
          '聪明严谨、积极有韧性，乐于面对挑战、具备优秀的分析能力',
          '具备充分的好奇心，有钻研的精神，喜欢从数据中发现问题、分析规律更佳；对商业运作模式和企业经营感兴趣',
          '数据科学（DS 方向）具备计算机背景或经济学和理工科双学位专业背景更佳',
          '了解大语言模型的基本能力，对 AI 赋能商业分析有探索兴趣，有使用 AI 工具辅助数据分析或报告撰写的经验者优先',
          '优先：有使用 AI 工具辅助商业研究的实践经验，如利用大模型进行行业报告生成、数据可视化、用户调研分析等',
          '优先：了解 Text-to-SQL、自然语言数据分析等 AI + 数据分析前沿方向',
          '优先：了解 LangChain、Dify 等主流 Agent 开发框架，有将 Agent 应用于数据分析或商业研究场景的经验',
        ],
        benefits: [
          '距离决策者最近的岗位，数据规律有机会驱动业务核心决策',
          '多元化的业务场景，丰富的商业视角和实战土壤',
          '体系化的人才培养机制',
          '大模型与商业分析深度融合，可参与构建 AI 增强的智能分析平台',
        ],
      },
      {
        company: '美团',
        role: '美团平台-数据开发工程师',
        location: '北京',
        mode: '日常实习',
        tags: ['数据仓库', 'SQL/Java/Python', 'Flink/Spark', '数据治理'],
        batch: '核心本地商业-基础研发平台 · 日常实习',
        interviewMode: '北京',
        description: [
          '参与美团平台数据仓库及相关服务的研发工作',
          '参与实时、离线、流批一体数据仓库的建设，数据方案设计、模型开发、指标体系的开发和数据治理',
          '参与解决项目中的问题和技术难题，线上疑难问题排查和解决',
        ],
        requirements: [
          '计算机或者相关专业大学本科及以上学历',
          '熟悉 SQL / Java / Python 等至少一种开发语言',
          '了解 hadoop / hive / spark / storm / flink 等原理',
          '了解数据库、范式，了解数据仓库，有使用数据库和编程语言解决实际问题的经历',
          '有较好的学习能力，沟通表达、积极主动',
          '对数据价值和大模型探索充满热情，能快速分析和理解问题',
          '优先：同时具备多种数仓（实时数仓、离线数仓、流批一体数仓）开发经验',
          '优先：对大模型充满好奇，有工作流、Agent、Skill 开发经验',
        ],
        benefits: [
          '团队氛围轻松，学习成长氛围浓厚',
          '有海量数据处理和实践的机会',
          '有建设高效数据开发工具链的机会',
        ],
      },
      {
        company: '美团',
        role: '商业分析实习生（用户画像方向）',
        location: '北京',
        mode: '日常实习',
        tags: ['SQL', '用户画像', '数据挖掘', '大模型应用'],
        batch: '核心本地商业-美团平台 · 日常实习',
        interviewMode: '北京',
        description: [
          '协助商业分析师进行用户数据挖掘和统计分析，探索有价值的用户画像内容与数据机会',
          '参与画像内容的质量建设，设计评估标准并完成抽样评估与问题归因，提升画像准确性与可信度',
          '与算法、数仓团队协作，参与画像内容的语义化加工与适配验证，支持 AI 模型理解与应用',
          '参与画像标签的建设、管理与运维，支持重点业务的画像应用与效果分析',
        ],
        requirements: [
          '熟练掌握 SQL 数据分析工具，能处理原始数据并完成大数据计算',
          '对大模型 / AI 应用与数据的结合方向有浓厚兴趣，具备较强的数据敏感性和逻辑思维能力',
          '具备良好的沟通能力和团队合作精神，能与跨职能团队高效协作',
          '实习周期不少于 3 个月，每周出勤不少于 4 天（简历命名：姓名-学校-毕业年份-入职时间-可实习x月-每周x天）',
          '优先：有 AI 应用的建设经验，对 AI 有一定理解',
        ],
        benefits: [
          '了解用户画像标签体系与流量、交易、位置等多维用户数据，锻炼数据分析和决策支持能力',
          '接触前沿的大模型应用场景，提升技术与业务结合的洞察力',
          '团队正处于 AI 时代画像升级期，深度参与 AI 应用驱动的用户画像体系建设',
        ],
      },
      {
        company: '美团',
        role: '数据分析实习生（小美 Agent）',
        location: '北京',
        mode: '日常实习',
        tags: ['SQL/Python', '用户增长', 'A/B实验', 'LLM评测'],
        batch: '核心本地商业-美团平台 · 日常实习',
        interviewMode: '北京',
        description: [
          '参与小美 Agent 产品经营指标体系（BR 体系）搭建与日常经营诊断，定期输出数据周报，基于业务链路理解输入策略建议',
          '深入分析海量用户对话数据，开展用户场景分析：按用户独立需求目标做对话 Task 拆分与场景归类，识别高频、高价值场景与未满足需求，为产品迭代方向提供数据支撑',
          '开展用户行为与留存分析：搭建留存等分析框架，定位高价值用户群体特征与流失原因，挖掘用户增长空间与北极星指标改善机会',
          '与产品、研发紧密协作，将数据洞察转化为可执行的增长动作，并跟踪落地效果',
        ],
        requirements: [
          '熟练使用 SQL、Python 等分析工具，了解 Hive / Spark 等大数据处理技术者优先',
          '对 AI Agent / LLM 产品有浓厚兴趣或有实际使用经验者优先，愿意深入理解大模型产品的用户心智与交互链路',
          '逻辑思维能力强，对数据敏感，具备从数据中发现问题、提出假设并设计验证方案的能力',
          '有较强的沟通表达与数据呈现能力，自驱力强，具备主人翁意识和团队协作精神',
          '优先：有用户增长、留存分析、渠道 / 漏斗分析等实战项目经验',
          '优先：熟悉 A/B 实验设计与因果推断方法',
          '优先：对 LLM / Agent 评测（对话质量打分、Badcase 归因）有了解或实践经验',
        ],
        benefits: [
          '直接参与美团小美 AI Agent（覆盖外卖、闪购、到店等全业务场景）的数据分析，能观察 AI 应用从模型到落地的关键步骤',
          '洞察直接触达产品决策层，你输出的用户场景分析和增长机会结论会直接进入产品迭代规划',
          '团队本身就是 AI 重度用户：日志归因、case 评测、数据清洗都有自研 Agent 工具链加持',
        ],
      },
      {
        company: '美团',
        role: '餐饮SaaS-渠道销售数据运营实习生',
        location: '成都',
        mode: '日常实习 · 6个月',
        tags: ['SQL/BI', '销售数据运营', 'AI看板', '经营分析'],
        batch: '软硬件服务-餐饮SaaS事业部 · 日常实习',
        interviewMode: '成都',
        description: [
          '协助收集、整理和分析餐饮 SaaS 渠道销售相关数据，支持销售团队制定业务策略',
          '负责销售数据的日常监控与异常排查，输出数据报告并推动问题解决',
          '配合渠道运营团队，优化销售流程与数据管理体系，提升运营效率',
          '参与销售目标拆解与达成跟踪，协助进行业绩分析与复盘',
          '协助搭建渠道 AI 看板，帮助前线业务提升日常工作效率',
        ],
        requirements: [
          '大学本科及以上学历，专业不限；统计学、信息管理、数据分析、计算机等相关专业优先',
          '熟练使用至少一款数据分析工具，具备基础数据处理能力；熟悉 SQL 或 BI 工具者优先',
          '具备较强的逻辑思维能力和数据敏感度，工作细致、责任心强',
          '良好的沟通能力和团队协作意识，能与不同部门和团队沟通合作，推动工作进展',
          '有接触过 AI 工具和项目者优先',
          '优先：有大型互联网公司数据分析、策略运营、商业分析相关实习经验',
          '优先：热爱数据分析，希望长期从事数分 / 商分相关的工作',
        ],
        benefits: [
          '深入参与餐饮 SaaS 行业核心业务的运营工作，帮助了解业务和提升数据分析能力',
          '与资深业务运营团队协作，获得专业指导与快速成长机会',
          '办公环境开放，团队氛围年轻有活力',
        ],
      },
      {
        company: '快手',
        role: 'AI数据架构工程师',
        location: '北京',
        mode: '全职 · 急招',
        tags: ['机器学习平台', '特征工程', 'Java/C++', '分布式计算'],
        batch: '快手 · 工程类-系统架构',
        interviewMode: '北京',
        description: [
          '负责研发快手的机器学习平台，作为公司级平台，支撑包括推荐、广告、搜索等核心业务的算法迭代',
          '通过自研大数据引擎，构建特征工程领域的高性能计算存储框架和统一开发平台，支持算法团队的研发效率',
          '重点研究海量数据的存储与传输格式、分布式计算框架、算法 DSL 语言、TaskFlow 等技术，不断优化模型工程的系统效率',
        ],
        requirements: [
          '本科及以上学历，计算机相关专业优先',
          '编程技能：至少熟练掌握 Java 或 C++ 中的一门编程语言，扎实的计算机基础功底',
          '熟悉 Flink / Hive / HDFS 等数据系统的基本原理，有源码级经验者优先',
          '热爱技术，有较好的学习能力、沟通表达能力和团队协作意识',
          '优先：开源社区活跃贡献者，或有 NOI / ACM 等相关竞赛经验',
        ],
      },
      {
        company: '快手',
        role: '数据FDE工程师-数据研发方向',
        location: '杭州/北京',
        mode: '全职 · 急招',
        tags: ['数据研发', 'DataAgent', '智能数仓', 'Prompt工程'],
        batch: '快手 · 数据平台部 · 工程类-数据研发',
        interviewMode: '杭州、北京',
        description: [
          '团队背景：快手数据平台部为公司核心业务提供数据决策支持和智能化数据建设，一边建设数仓、指标、数据服务、数据平台产品等底层能力，一边深入主站、电商、商业化、生活服务、海外等业务场景',
          '岗位定位：更靠近业务现场，负责把业务问题变成数据和 AI 解决方案；站在一线理解问题、判断价值、设计方案，并借助 Agent 和数据工程能力把结果做出来',
          '参与从业务问题识别、指标设计、数据建模、分析洞察，到 DataAgent、知识工程、智能数仓和数据资产应用的完整过程',
        ],
        requirements: [
          '本科及以上学历，计算机科学、数学、统计学、数据科学、大数据技术、软件工程等相关专业优先',
          '具备扎实的工程实践能力与快速学习能力，熟练掌握至少一门数据处理语言（SQL、Python 或 Java）',
          '对人工智能充满热情，对大数据架构及数据分析挖掘有一定理解',
          '熟悉 Prompt Engineering 方法论，具备应对大模型幻觉、上下文管理、输出稳定性等典型工程挑战的实际经验优先',
          '逻辑思维清晰，善于抽象建模与问题拆解，能将复杂业务问题拆解为可落地的数据 / AI 产品解决方案',
          '具备良好的用户同理心与需求抽象能力，具备较强的跨职能协作能力者优先',
        ],
        benefits: [
          '培养路径：首先帮助打牢数据工程、Agentic 工程、数据分析和 A/B 实验体系等基础',
          '随后进入具体业务线，参与真实数据专题和智能化数据项目',
          '长期可成长为数据应用 FDE、数据内容建设 FDE，或更偏业务策略的数据专家，负责端到端解决复杂业务数据问题',
        ],
      },
      {
        company: '快手',
        role: 'AIGC多模态数据系统研发工程师',
        location: '北京',
        mode: '全职',
        tags: ['AIGC', '多模态数据', '数据系统', 'Flink/Hive/HDFS'],
        batch: '快手 · 工程类-数据研发',
        interviewMode: '北京',
        description: [
          '面向 AIGC 行业的基础模型领域，完成多模态大数据系统和核心组件的架构和开发',
          '设计并维护覆盖大模型多模态数据全生命周期的数据系统，包括数据采集、挖掘、构造、分析和价值验证等',
          '理解 AIGC 的数据需求和逻辑，建设智能高效的数据挖掘手段，实现海量多模态数据的有效治理和数据效果高效转化',
        ],
        requirements: [
          '本科以上学历，计算机相关专业',
          '熟悉 linux 操作系统及开发环境，至少精通 Python / Java 等一门编程语言，具备编写高效数据处理代码的能力优先',
          '熟悉 Flink / Hive / HDFS 等数据系统的基本原理，具备大规模数据处理经验优先',
          '熟悉关系型数据库（如 MySQL、PostgreSQL）和 NoSQL 数据库（如 MongoDB、Hbase、Hive 等）的使用和优化',
          '有较好的学习能力、沟通表达能力和团队协作意识，能有效对接各种需求，并确保进展顺利',
          '优先：有 AIGC 数据工程相关经验，或多模态数据经验',
        ],
      },
      {
        company: '快手',
        role: '【快Star】数据引擎内核研发工程师',
        location: '北京',
        mode: '全职 · 快Star',
        tags: ['SQL引擎', '湖仓一体', 'AIForData', 'Java/C++/Rust'],
        batch: '快手 · 工程类-数据研发',
        interviewMode: '北京',
        description: [
          '深度参与大数据 SQL 引擎的性能优化工作',
          '参与湖仓一体化引擎、多模态分析引擎的研发工作',
          '推动 AI For Data 在大数据引擎的落地应用',
        ],
        requirements: [
          '硕士以上学历，计算机、软件工程等专业优先，对编译原理、计算机体系结构相关课程有过深入的学习',
          '较强的编码能力，熟练使用 Java 或者 C++ / Rust 等至少一门编程语言，熟悉常用的 Debug 和 Profile 工具',
          '具有良好的沟通能力，高度的责任心和团队合作精神',
          '优先：研究生课题跟大数据 SQL 引擎、数据库、分布式系统相关，或对此有深入研究者',
          '优先：有大模型在 SQL 引擎性能调优相关研究经验',
        ],
      },
      {
        company: '京东',
        role: '数据应用工程师',
        location: '北京',
        mode: '校园招聘 · 应届',
        tags: ['SQL/Python', 'ETL', '数据建模', '数据湖'],
        batch: '京东集团校招 · 技术方向数据与算法类（京东工业、京东零售）',
        interviewMode: '北京',
        description: [
          '负责基于数仓的 ETL 及服务端加工及产品应用',
          '负责实时、离线、数据湖、数据服务等工具平台能力的建设与优化',
          '负责分主题、业务域的数据建模、挖掘等研发工作',
          'AI 应用探索：关注 AI 在数据分析与建模中的应用，运用 AI 工具辅助 SQL 生成、数据探索与特征工程，提升分析效率',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '数学、经济、商业分析、运筹学、信息管理、计算机、网络安全等相关专业',
          '熟练使用 SQL，可以使用 Python 进行数据分析和建模，了解机器学习常见算法原理，熟练掌握数据可视化',
          '思维敏捷，能快速理解业务方意图，拥有优秀的沟通能力和团队协作能力，有强烈的责任感与自驱力，可快速响应业务、产品迭代需求',
          '熟练使用 AI 工具（如通用对话式 AI、智能数据分析平台、AI 编程助手等）辅助数据处理与建模；有利用 AI 工具提升数据分析效率的实践经历',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '京东',
        role: '数据开发工程师',
        location: '北京/天津/上海',
        mode: '校园招聘 · 应届',
        tags: ['Java', 'Flink/Spark', '数仓建模', 'Hadoop生态'],
        batch: '京东集团校招 · 技术方向数据与算法类（京东科技/京东健康/京东零售/京东物流）',
        interviewMode: '北京、天津、上海',
        description: [
          '负责公司数据仓库的架构设计、建模',
          '组织数据仓库开发，基于数据仓库，对数据进行挖掘，发现数据中的规律，或者负责应用和构建数学算法，以发现数据中的规律',
          '基于京东海量数据，进行深度数据挖掘，赋能京东高速业务发展，充分发挥数据价值',
          '理解业务需求，建立可靠的数据收集、发布和处理平台，参与离线/实时数据仓库以及 Pipeline 的设计和开发',
          'AI 应用探索：关注 AI 在数据工程领域的应用，运用 AI 工具辅助数据管道开发、数据质量监控及自动化运维，提升数据开发效率',
        ],
        requirements: [
          '2026 年 10 月 1 日至 2027 年 9 月 30 日期间毕业，统招本科及以上学历',
          '对大数据处理、分布式存储等技术有热情，能主动跟踪最新的技术进展',
          '扎实的计算机专业基础知识、编程基础和数据结构算法基础、Java 基础',
          '熟练掌握 Java 语言，熟悉 Flink、Spark、Kafka、Redis、HDFS、Storm 等大数据组件',
          '熟悉 Hadoop 生态，如 Hive、MapReduce 等',
          '熟练使用 AI 编程助手（如 GitHub Copilot、Cursor 等）辅助数据开发；有利用 AI 工具优化数据处理流程的实践经历',
          '对 AI 新技术保持好奇心，乐于主动学习并快速掌握新的 AI 知识和功能，积极拥抱新技术',
          '符合京东价值观：客户为先、创新、拼搏、担当、感恩、诚信',
        ],
      },
      {
        company: '字节跳动',
        role: '商家产品数据科学实习生（TikTok Shop）',
        location: '上海',
        mode: '日常实习',
        tags: ['SQL/Python', '数据洞察', '内容电商'],
        batch: 'TikTok Shop · 产品-数据分析 · 职位 ID A53739',
        interviewMode: '上海',
        description: [
          '团队背景：TikTok Shop 是 TikTok 旗下的内容电商，汇聚全球优质商家与创作者，通过短视频、直播等多场景连接消费者，团队分布在美国、英国、法国、印尼、墨西哥、中国等全球多个国家和地区',
          '负责业务日常数据统计分析，针对异常情况协调资源进行跟踪和深入分析',
          '协助分析师完成数据洞察以及定性和定量分析，迅速定位内部问题或发现机会',
          '协助分析师进行数据分析体系建设和完善，挖掘流量、产品、策略方面的业务机会',
        ],
        requirements: [
          '本科及以上学历在读，计算机、统计、数学等相关专业优先',
          '熟练使用 SQL、Excel、Python 等至少一种脚本语言，熟悉常用数据统计和分析方法',
          '良好的沟通能力、团队合作精神和主动意识',
          '良好的逻辑思维能力、业务解读能力和快速学习能力',
          '对数字比较敏感，热爱数据分析工作',
        ],
        benefits: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
        ],
      },
      {
        company: '字节跳动',
        role: '搜索数据科学实习生（抖音电商）',
        location: '北京/上海',
        mode: '日常实习',
        tags: ['SQL/Python', 'A/B实验', '归因分析', '电商搜索'],
        batch: '抖音电商 · 产品-数据分析 · 职位 ID A136240A',
        interviewMode: '北京、上海',
        description: [
          '团队背景：抖音电商以“总能发现好东西”为主张，众多创作者通过短视频、直播、商城等形式提供个性化消费体验，并积极引入优质合作伙伴为商家变现提供多元选择',
          '负责电商搜索相关分析，深入分析搜索各场域增长与承接策略、营销供给、用户认知和用户体验的关键问题',
          '持续跟踪策略效果，通过 A/B 实验、归因分析等方式评估收益与风险，推动策略持续优化',
          '日常对电商搜索的核心指标进行监控和异动分析，维护好相关的数据资产，并推进相关基建和分析能力的 AI 化',
        ],
        requirements: [
          '本科及以上学历在读，统计学、数学、经济学等相关专业',
          '熟练使用 SQL、Excel、Python 等脚本语言，熟悉常用数据分析和统计方法',
          '有互联网数据分析实习经历，了解 A/B 实验和机器学习的基本原理',
          '具备较强的数据分析能力，能够基于数据发现问题、拆解问题并推动策略落地，熟悉实验设计与指标评估方法',
          '良好的沟通能力、主动意识、逻辑思维能力和快速学习能力',
          '优先：有接触过电商行业，对电商行业基本术语和指标有了解',
          '优先：熟悉 AI Agent 相关的概念，有数据相关的 Skill 或 Agent 创建和落地应用的经验',
          '优先：有过 PSM、DML、Uplift 等因果推断模型项目经验，或者熟悉理论',
        ],
        benefits: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
        ],
      },
      {
        company: '字节跳动',
        role: '数据科学（短剧方向）实习生（TikTok）',
        location: '北京/上海',
        mode: '日常实习',
        tags: ['A/B实验', '因果推断', '内容分层', '指标体系'],
        batch: 'TikTok · 产品-数据分析 · 职位 ID A251583A',
        interviewMode: '北京、上海',
        description: [
          '团队背景：TikTok 是一个覆盖 150 个国家和地区的国际短视频平台，全球总部位于洛杉矶和新加坡，办公地点还包括纽约、伦敦、都柏林、巴黎、柏林、迪拜、雅加达、首尔和东京等多个城市',
          '支持短剧内容质量评估体系建设：参与量化不同质量等级短剧的评价标准，协助挖掘站内外高潜力短剧线索，产出内容分层与供给分析，为内容运营团队提供策略参考',
          '参与短剧用户行为与增长分析：探索用户在短剧消费全链路（拉新、承接、留存/拉活）上的行为特征，协助定位优势目标人群、评估推荐分发策略效果，支持短剧独立 App 的快速增长',
          '参与实验设计与策略评估：在 Mentor 指导下运用 A/B 实验、因果推断、回归分析等统计方法评估各项策略效果，深入解读实验结果、完成专题分析报告，并协助优化实验设计、提升评估效率',
          '支持业务专题洞察：围绕独立端增长、AI 剧内容供给、分成与商业化等方向，利用数据挖掘形成分析洞察，探索潜在优化机会，配合产品/推荐/研发推进优化落地',
          '参与数据基建与工具沉淀：协助搭建和维护短剧业务看板与指标体系，沉淀可复用的分析框架、SQL/Python 脚本与自动化分析任务，将数据分析能力产品化',
        ],
        requirements: [
          '硕士及以上学位在读，统计学、数据科学、经济学、数学、计算机等相关专业',
          '能长期实习者优先；有内容生态、用户产品或短剧/长视频相关行业实习经历者优先',
          '对数据敏感，具备良好的业务理解力，能快速建立业务细节与数据之间的联系，尝试通过数据对业务问题进行抽象、量化与推断',
          '熟练使用 SQL，能使用 Python/R 进行数据处理与分析，具备良好的数据可视化能力；了解常用机器学习算法原理，对 A/B 实验、因果推断等方法有基本概念者优先',
          '具备扎实的逻辑思维能力、问题分析与解决能力，做事严谨细致，有良好的沟通表达能力和跨团队协作意识',
          '学习能力强、好奇心重，对短剧/内容消费业务有浓厚兴趣，自驱力强，能主动发现问题并推动闭环',
        ],
        benefits: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
        ],
      },
      {
        company: '字节跳动',
        role: '大模型数据分析实习生（火山方舟）',
        location: '北京',
        mode: '日常实习',
        tags: ['数据标注', '模型评测', 'SQL/Excel', 'Python'],
        batch: '火山方舟 · 产品-数据分析 · 职位 ID A188487A',
        interviewMode: '北京',
        description: [
          '团队背景：火山方舟是火山引擎推出的一站式大模型服务平台，提供模型推理、评测、精调等全流程服务，方舟搭载豆包及业界主流大模型，并提供丰富的插件生态和 AI 应用开发服务',
          '负责大模型评测集的数据标注工作，依据标注规范对文本、数据等内容进行准确标注，保障标注质量与效率，为模型训练和优化提供可靠的数据支撑',
          '负责评测集质检工作，对已标注数据进行交叉校验、错误排查和偏差修正，统计标注准确率、完整率等核心指标，保障评测集的规范性和可用性',
          '负责模型负面案例的收集、整理与分析，定位问题成因，包括数据问题、标注问题及模型逻辑问题等，输出分析结论并提出优化建议',
          '配合团队完成其他与模型评测、数据处理相关的工作，及时反馈执行过程中的问题，协助持续优化标注规范和评测流程',
        ],
        requirements: [
          '本科及以上学历在读，专业不限，数据分析、统计、计算机、数学、语言类等相关背景优先',
          '对大模型方向有较强兴趣，日常有大模型产品使用习惯，有相关实习或项目经历者优先',
          '具备一定 Python 基础，或能够熟练使用 TRAE 等 AI 编程工具进行数据处理',
          '熟练使用 SQL 和 Excel，具备基础的数据处理、分析和结果整理能力',
          '具备良好的沟通能力、责任心和耐心，逻辑思维清晰，能够发现业务与数据之间的关联',
          '可连续实习 3 个月及以上，工作地为北京',
        ],
        benefits: [
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
        ],
      },
    ],
    '运营类': [
      {
        company: '美团',
        role: 'AI 产品运营岗',
        location: '北京/科威特城/上海/深圳',
        mode: '应届 · 校园招聘',
        tags: ['用户运营', '商家运营', '内容运营', 'AI 工具'],
        description: [
          '最多可投递 3 个职位，但同一时间仅有 1 个职位流程处于进行中，第一志愿将被优先考虑',
          '在这里你有机会参与美团的各类运营岗位，可以全方位感受运营的魅力！如果你对以下任意一个方向感兴趣，欢迎网申这个岗位。',
          '用户运营：以用户为中心，制定运营策略与运营目标，做好全过程的项目推进与执行落地，持续增加用户洞察、为用户创造更多价值。',
          '商家及供给运营：以商家/骑手/司机/供应商为运营主体，运用科学合理的方式制定策略，实现业务渗透、规模增长、结构优化等。',
          '内容运营：以内容/信息/数据的生产、消费、业务应用为核心，开展UGC、PGC、新媒体运营，搭建良性生产循环。',
          '工具系统运营：围绕内部用户，通过数据分析、系统开发和使用、规则流程制定等方式推动各方效率提升。',
          '体验运营：为体验问题定位、分析、解决、评估提供全流程支持，推动服务工具的效率和体验提升。',
          '其中部分境外岗位面向2025年6月至2027年10月毕业的全球毕业生，如遇系统投递问题，请前往Keeta Careers英文招聘官网投递。',
          '工作城市：北京市、科威特城、上海市、深圳市',
        ],
        requirements: [
          '本科及以上学历',
          '对用户侧信息有充分的敏感度',
          '喜欢O2O或B2C行业，善于思考富有创意',
          '强烈的目标导向和分解、落地的能力，强大的执行力',
          '良好的团队合作意识、能有效组织和协调跨职能、跨部门资源',
          '了解AI工具（如大模型对话助手、AI内容生成工具等）的基本使用，对AI赋能运营提效有好奇心和学习意愿；愿意探索AI工具在运营场景的应用，如利用大模型辅助内容生成、用户洞察分析、运营策略优化等，推动运营效率提升',
          '有以下经验者优先：熟练使用SQL、Python',
          '有以下经验者优先：有使用AI工具进行运营工作的经验，如利用大模型辅助文案撰写、数据分析、智能客服等',
          '有以下经验者优先：了解主流 Agent 开发框架（如 LangChain、Dify 等），有使用AI工具提升运营效率的实际案例',
        ],
        benefits: [
          '美团多元化的业务场景为运营提供丰富的实战土壤',
          'AI工具与运营深度融合，可体验AI赋能下的新一代运营工作方式',
          '完善的培养体系与清晰的成长路径',
        ],
      },
      {
        company: '美团',
        role: '产品运营实习生（Keeta 海外）',
        location: '北京',
        mode: '日常实习',
        tags: ['海外业务', '用户增长', 'SQL', '用户研究'],
        batch: 'Keeta · 更新时间 2026/11/03',
        description: [
          '部门介绍：Keeta是全球领先外卖平台美团旗下的独立品牌，肩负着“帮大家吃得更好，生活更好”的使命。依托美团深耕中国市场15年的技术与运营积淀，我们正引领全球餐饮与商品即时配送服务的创新与发展。',
          '自2023年成立以来，Keeta始终扎根社区并创造价值。我们为用户提供可靠的外卖体验，以智慧技术助餐厅提升经营效率，在为骑手拓宽收入来源的同时，也充分提供安全保障措施。基于这份多方共赢、共同成长的理念，我们的业务已从中国香港稳步拓展至中东及巴西，并持续向世界迈进。',
          '参与探索海外外卖业务运营的新增长工具，重点关注用户获取、留存和效率提升',
          '协助进行业务数据分析、运营策略规划与迭代和新营销工具的调研及创新，并与产研团队合作，推动产品功能迭代与落地',
          '设计和执行用户研究活动，进行访谈，深入分析用户行为数据，并将洞察转化为符合海外市场特征的可执行工具/策略实施',
        ],
        requirements: [
          '在读本科或研究生，中文、英语听说读写能力良好',
          '具备较强的数据分析能力，能熟练应用SQL进行数据提取，有在大型互联网公司渠道运营/用户运营实习经验者优先考虑',
          '学习能力强，具备良好的团队协作精神，注重细节，执行力出色',
          '至少连续实习4个月，能够长期实习者优先',
        ],
        benefits: [
          '创新业务的操盘手，挑战与机会并存',
          '能够全方位了解外卖业务模式，有足够的空间和灵活度全面发挥你的才能',
          '核心业务的核心部门，团队气氛好，学习成长型团队',
        ],
      },
      {
        company: '美团',
        role: 'AI 产品创意传播/增长实习生',
        location: '北京',
        mode: '日常实习',
        tags: ['内容营销', 'KOC', 'AI 工具', '小红书/抖音'],
        batch: '核心本地商业-美团平台 · 更新时间 2026/11/02',
        description: [
          '部门介绍：美团平台为用户的基础产品体验负责，还承担了美团的用户增长、市场和品牌营销以及多条业务线的产品设计职责，建立了融合文字、图片、视频和直播等不同形式的内容生态系统，同时整合地图服务部、客户服务和体验部、企业业务部、网约车业务部等部门，致力于用科技提升美团数亿消费者、近千万商家、骑手、司机和团长的服务体验。',
          '我们正在寻找一位对内容有敏锐直觉、真正关注 AI、愿意尝试新玩法的内容营销实习生。你将参与 AI 产品的内容策划、创作与传播，并探索更自然、更灵活的 KOC 合作方式。',
          '策划并产出适合小红书、抖音、公众号等平台的产品内容',
          '挖掘 AI 产品的真实使用场景，把功能卖点转化成用户愿意看、愿意分享的内容',
          '关注平台热点、内容趋势和用户讨论，快速提出选题并落地',
          '寻找和筛选合适的 KOC，设计更灵活、真实的合作玩法',
          '跟踪内容及 KOC 投放数据，复盘效果并持续优化',
          '参与产品研究、用户洞察和内容营销创意讨论',
        ],
        requirements: [
          '内容 sense 很好：熟悉主流内容平台，能判断什么内容“有网感但不油腻”，对选题、标题、表达和视觉有自己的审美',
          '对 AI 好奇且懂：长期关注 AI 产品和行业动态，实际使用过多款 AI 工具，能理解产品，也能用普通用户听得懂的方式讲清楚',
          '对 KOC 有自己的灵活想法：不局限于批量铺量和固定报价，能从人群、场景、内容共创、素人种草等角度设计合作方式',
          '有较强的文案、信息搜集和快速学习能力，能够独立推进任务',
          '对结果和数据敏感，愿意不断测试、复盘和调整',
          '优先：运营过自己的内容账号，或有可展示的内容作品',
          '优先：做出过高互动、高转化内容，或参与过 KOC/KOL 投放',
          '优先：熟悉 Midjourney、ChatGPT、Claude、即梦等 AI 工具',
          '优先：有产品意识，能从用户需求出发思考内容，而不只是追热点',
          '优先：能快速到岗',
        ],
        benefits: [
          'AI创新产品、团队扁平创新力强、实习生项目参与程度高',
        ],
      },
      {
        company: '百度',
        role: 'AI 产品经理',
        location: '北京',
        mode: '校招 · 产品 42 人',
        tags: ['AI 产品', '大模型', 'AIGC', '产品设计'],
        jobId: 'J100665',
        batch: '百度 · 热招职位 · 更新 2026-07-21',
        description: [
          '负责AI/大模型方向产品的规划、设计与迭代，深入理解用户需求，定义产品核心功能与体验',
          '结合大模型能力演进趋势，推动AI能力在产品中的落地，探索人机协作的最优交互模式',
          '跨团队协作，与算法、研发、设计团队紧密配合，推动产品从0到1落地并持续优化',
          '深入分析用户数据与市场反馈，驱动产品关键指标增长',
          '具备AI产品思维，善用AI工具提升工作效率与产品创新能力',
        ],
        requirements: [
          '本科及以上学历，计算机、人工智能、信息管理等相关专业优先',
          '对大模型、AIGC、智能助手等AI产品有深入理解和强烈兴趣',
          '逻辑思维清晰，具备从用户需求出发拆解和定义产品的能力',
          '具备良好的跨团队沟通与推动能力，有较强的学习能力和主动性',
          '有AI/大模型产品相关实习经历者优先',
        ],
      },
      {
        company: '百度',
        role: 'P-STAR 产培生计划（个人超级智能事业群）',
        location: '北京',
        mode: '校招 · 产品若干',
        tags: ['管培生', 'AI 产品', '百度文库/网盘', '中管带教'],
        jobId: 'J101273',
        batch: 'PSIG · 更新 2026-08-24',
        description: [
          'P-STAR 计划旨在寻找最具潜力的产品/运营校招生，我们将提供百度文库、百度网盘两大国民级产品，让产品新星在无限探索的实践中发挥创造力',
          '我们将为产培生制定多元的成长路径，提供专业的培养体系，助力快速成长，一起在AI时代谱写新章',
          '加入我们，意味着您将加入专业的产品/运营团队，在百度各业务中管干部的指导下接受体系化的校招生培养计划。在这里，你将与AI时代共进，用你的想法去塑造、改变未来',
          '项目亮点：产运中管直接带教，专属导师培养制，助力优秀人才快速成长',
          '项目亮点：量身定制学习课程，培养资源丰富、系统化夯实基础，拓宽业务视野',
          '项目亮点：顶尖技术支持，浓厚创新氛围，全方位开拓眼界提升能力',
          '项目亮点：行业可观薪资，3年快速成长，深度参与核心业务/AI前沿业务',
          '我们诚邀充满热情的你，共同打造领先的个人超级智能，满足用户全场景、个性化和自由化的内容生产和消费需求，让你的工作产生更大影响力',
        ],
        requirements: [
          '拥有优秀的逻辑思维与系统分析能力，能解构复杂问题；兼具技术敏感度与商业敏感度，能精准判断技术价值与市场机会',
          '具备敏捷的洞察和思维能力，擅长将抽象思考转化为具体的产品方案与运营策略，并推动其落地以满足用户与客户需求',
          '怀揣打造优秀互联网产品的梦想，对AI行业及产品创新抱有极大热情和好奇心，以此为内在驱动',
          '展现出领导力特质，乐于接受挑战，具备创新洞察与开放热情，有志于成长为产品或运营领域的领军人才',
        ],
      },
      {
        company: '阿里巴巴',
        role: '商品运营（淘宝闪购/阿里国际数字商业）',
        location: '杭州',
        mode: '应届 · 校园招聘',
        tags: ['商品运营', '商品企划', '数据分析', '电商'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生 · 更新 2026-08-06',
        description: [
          '可投递多个业务集团/公司，不同业务集团/公司的应聘流程可并行；每个业务集团/公司只有1次投递机会，且最多可选择 2 个意向投递（含阿里星职位），按照意向顺序流转',
          '熟悉并了解商品运营各个环节流程与职能',
          '洞察分析消费者、商品需求，形成商品策略、营销活动策划并推进落地执行，提升订单增长',
          '制定有效的商品企划，开发有竞争力的商品，快速补充品类需求，控制成本和提升毛利',
          '结合内外资源，引入有竞争力的商家，搭建商家梯队',
          '分析商品特性对用户行为的影响，从中挖掘增长机会点，建设用户决策路径的认知',
          '善于数据分析，并使用数据指导前台运营工作，并通过数据驱动协调各商家共同成长',
          '在招业务：淘宝闪购、阿里国际数字商业集团',
        ],
        requirements: [
          '有过知名电商、社区团购平台领域实习经验者优先考虑',
          '有较好的数据分析和沟通能力，良好的系统及逻辑思维能力，理解事物的复杂性并能从全局角度考虑问题',
          '熟悉各类电脑办公软件Word、Excel、PPT等软件；熟练掌握AE、PS、AI、PR等剪辑软件',
          '有较强表达能力，用对方能够理解的语言进行交流，表达清晰，确保他人能够及时、准确的获得信息，有良好的审美和节奏感强的视频分解能力',
          '为人诚信正直、积极主动、认真细心、能够接受新事物；拥有较强的学习能力、具有较强执行力、原则性及推动力',
        ],
      },
      {
        company: '阿里巴巴',
        role: '运营（商品/社群/内容方向）',
        location: '待补充',
        mode: '应届 · 校园招聘',
        tags: ['商品运营', '社群运营', '内容运营', '供应链'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        description: [
          '说明：原文未标注职位名称与工作城市，此处按「运营类 · 阿里巴巴2027届应届生」归档，投递前请以官网为准',
          '熟悉并了解运营领域（商品、社群、内容等）各个环节流程与职能',
          '收集分析消费者、商品需求，形成商品策略、营销活动策划并推进落地执行，提升订单增长',
          '组织制定商家的采销或者联营模式，负责选品的采购流程的搭建与优化，控制成本和毛利的提升',
          '分析商品特性对用户行为的影响，从中挖掘增长机会点，建设用户决策路径的认知',
          '善于数据分析，并使用数据指导前台运营工作，并通过数据驱动协调各商家共同成长',
          '在招业务：阿里国际数字商业集团、千问办公、阿里健康',
        ],
        requirements: [
          '有较好的数据分析和沟通能力，良好的系统及逻辑思维能力，理解事物的复杂性并能从全局角度考虑问题',
          '熟悉各类电脑办公软件Word、Excel、PPT等软件；熟练掌握AE、PS、AI、PR等剪辑软件',
          '有较强表达能力，用对方能够理解的语言进行交流，表达清晰，确保他人能够及时、准确的获得信息，有良好的审美和节奏感强的视频分解能力',
          '为人诚信正直、积极主动、认真细心、能够接受新事物；拥有较强的学习能力、具有较强执行力、原则性及推动力',
        ],
      },
      {
        company: '阿里巴巴',
        role: 'AI 产品运营',
        location: '杭州/上海/深圳',
        mode: '应届 · 校园招聘',
        tags: ['AI 产品运营', 'Prompt', 'SQL/Python', 'AIGC'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生 · 更新 2026-08-06',
        description: [
          '可投递多个业务集团/公司，不同业务集团/公司的应聘流程可并行；每个业务集团/公司只有1次投递机会，且最多可选择 2 个意向投递（含阿里星职位），按照意向顺序流转',
          '深入全链路业务场景，通过用户研究与竞品分析，定义 AI 赋能的产品方案',
          '将模型能力转化为具体的运营策略，负责提示词（Prompt）优化、标签体系梳理、特征质量管理，与算法/研发团队协作，推动 AI 能力在实际场景中的部署与应用',
          '参与 AI 模型的指标跟踪、灰度发布与效果监控；协助评估模型的稳定性、可用性及输出一致性，确保在线服务的健康运行',
          '监控产品核心指标，利用 SQL/Python 等工具进行数据挖掘与实验评估，基于数据洞察持续迭代优化 AI 策略',
          '负责 AIGC 产品的内容包装与创意传播方案，针对特定场景打造高质量内容，提升用户活跃度与产品忠诚度',
          '在招业务：阿里巴巴控股集团、阿里国际数字商业集团、盒马',
        ],
        requirements: [
          '本科及以上学历，计算机、人工智能、统计学、数学、信息管理、数据科学等相关专业优先',
          '熟练掌握 SQL，具备独立进行数据分析、特征理解与实验评估的能力；熟悉 Python（Pandas/Numpy）或常见机器学习指标（AUC/F1等）者优先',
          '对大模型、多模态生成有浓厚兴趣及深度体验，了解 AIGC 基本原理及工作流（如 ComfyUI、RAG 等）',
          '具备出色的逻辑思维与结构化拆解能力，能将复杂的业务现象抽象为算法可解决的问题；对互联网运营指标有系统性理解',
          '自驱力强，拥有强烈的好奇心与责任感；具备优秀的跨团队沟通协作能力及抗压性，能作为技术与业务间的桥梁推动项目进展',
        ],
      },
      {
        company: '字节跳动',
        role: '美国品牌营销活动实习生（TikTok Shop）',
        location: '上海',
        mode: '日常实习',
        tags: ['市场营销', '电商活动', '跨部门协作', '英语'],
        jobId: 'A175184',
        batch: 'TikTok Shop · 运营 · 日常实习',
        description: [
          '团队介绍：TikTok Shop 是 TikTok 旗下的内容电商。平台汇聚全球优质商家与创作者，通过短视频、直播等多场景连接消费者，让新奇好物畅销全球，让美好生活触手可得。目前团队分布在美国、英国、法国、印尼、墨西哥、中国等全球多个国家和地区，在这里你将有机会深入国际业务场景，面向全世界商家及用户，和跨区域团队协作，共同探索创新购物模式。',
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期3个月及以上的项目实践机会',
          '市场洞察：跟踪分析美国市场文化趋势与消费者偏好',
          '策划执行：协助策划并落地面向美国市场的电商营销活动',
          '协同推进：协调设计、商品等部门，确保活动内容质量',
          '效果复盘：监控活动数据，协助完成复盘并输出优化建议',
          '运营支持：处理活动页面配置、资源上架等基础运营工作',
        ],
        requirements: [
          '本科及以上学历在读，优先考虑传播学、市场营销、电商等相关专业背景',
          '有市场、电商平台或创意类代理公司相关实习经验者优先，市场敏锐度：具备良好的市场感知力，熟悉电商活动',
          '沟通协作：思维分析性与结构性强，擅长跨部门沟通与协同，能够进行多任务处理和优先级管理',
          '专业素养：独立、自我驱动，责任心强',
          '语言能力：英语可作为日常书面工作语言，具备基础口语交流能力',
          '出勤时间：一周5天到岗，实习期不少于6个月',
        ],
      },
      {
        company: '字节跳动',
        role: '东南亚电商资源管理实习生（TikTok Shop）',
        location: '北京',
        mode: '日常实习',
        tags: ['经营分析', 'SQL', '数据分析', '英语'],
        jobId: 'A59338',
        batch: 'TikTok Shop · 运营 · 日常实习',
        description: [
          '团队介绍：TikTok Shop 是 TikTok 旗下的内容电商。平台汇聚全球优质商家与创作者，通过短视频、直播等多场景连接消费者，让新奇好物畅销全球，让美好生活触手可得。目前团队分布在美国、英国、法国、印尼、墨西哥、中国等全球多个国家和地区，在这里你将有机会深入国际业务场景，面向全世界商家及用户，和跨区域团队协作，共同探索创新购物模式。',
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期3个月及以上的项目实践机会',
          '基于业务战略和目标，协助搭建并维护经营指标追踪体系，定期开展追踪，针对异常情况协调资源跟进并深入分析，支撑业务增长相关问题的分析解决',
          '参与各类电商专项分析工作，优化钱效分析体系，迅速定位内部问题或发现机会，协助完成数据提取、处理分析、图表制作，撰写业务分析报告，为业务增长痛点提供客观的量化支撑与备选策略建议',
          '参与跨部门、跨区域重点项目的沟通与协同，协助完成共识推进、会议支持与行动项跟踪，推动战略洞察落地转化为实际业务成果',
        ],
        requirements: [
          '本科及以上学历在读，统计/经济/管理等相关专业优先',
          '可熟练使用SQL和Office工具（尤其Excel），对电商行业有基础理解',
          '实习期保证4个月以上，每周出勤4天以上，能长期实习优先',
          '英文熟练，具有良好的适应性',
        ],
      },
      {
        company: '字节跳动',
        role: 'AI 内容创意制作实习生（豆包工作·飞书商业化）',
        location: '上海/北京',
        mode: '日常实习 · 商业运营',
        tags: ['AIGC', '视频制作', 'Prompt', '内容营销'],
        jobId: 'A203998A',
        batch: '飞书商业化 GTM · 运营-商业运营',
        description: [
          '团队介绍：飞书商业化团队（Go to Market）负责将飞书先进产品和服务全面推向中国和国际市场，通过制定精准的业务战略，进行破圈的市场营销，深入理解不同行业的趋势和特点，传递飞书的理念和价值给不同行业的企业客户并达成业务合作，帮助客户加强使用深度和广度，最终让飞书成为各行各业先进企业的首选、持续助力企业组织升级。',
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期3个月及以上的项目实践机会',
          '内容创意：持续关注AI内容生态与创作趋势，敏锐洞察AI工具能力演进带来的新创作场景、新传播形式与行业案例，能够结合豆包工作产品能力独立策划创意内容，探索兼具传播势能与产品价值的AI内容营销新玩法',
          'AI素材制作：负责豆包工作产品AI创意素材的端到端生产，熟练运用文本、图像、语音、视频等多模态AI工具及剪辑软件，高质量完成选题策划、剧本分镜、镜头生成、配音配乐、字幕包装与后期整合，把控从创意到成片的项目进度与交付质量，持续输出兼具高品质与传播力的内容',
          '运营支持：协助维护素材库，跟踪投放及效果数据，通过标准化整理提升内容决策效率，沉淀爆款案例、产品价值点及可复用SOP，提升团队规模化生产效率，协助对接供应商及承制团队，推动项目进度管理和交付闭环',
        ],
        requirements: [
          '本科及以上学历在读，影视编导、新闻传播、广告设计、数字媒体等相关专业优先',
          '具备扎实的AI视频制作实战经验，能够独立完成从创意构思到成片交付的全流程，熟悉主流AIGC模型及内容生产工具，Prompt能力扎实，具备高质量、高效率的稳定输出能力',
          '具备敏锐的内容判断力与较强网感，对热点趋势、用户偏好和内容传播逻辑有较强理解；同时拥有出色的信息搜集、分析归纳与结构化表达能力；投递请附具代表性的AI内容作品集',
          '可连续实习6个月及以上，每周到岗4-5天，好奇心强，执行力佳',
        ],
      },
      {
        company: '小红书',
        role: '全球增长业务管培生-运营（2027 校招）',
        location: '北京/上海',
        mode: '应届 · 校园招聘',
        tags: ['用户增长', '数据分析', 'AI Native', '英文'],
        batch: '2027 校园招聘 · 职位方向：非技术 · 子方向：运营',
        description: [
          '每人最多可投递 1 个职位方向中的 2 个子方向，最多 5 个职位；投递后，职位方向不可更换，志愿将按顺序依次流转',
          '我们在寻找对增长、产品和用户行为真正好奇的应届毕业生。你会参与全球市场的增长问题，从发现机会、分析数据、设计实验，到推动产品和运营方案落地。这个岗位不是传统意义上的增长运营，也不是只负责执行需求。',
          '我们希望你像一个 builder 一样工作：面对模糊问题，快速找到关键信号，提出假设，借助 AI 和工具验证，并最终把想法变成真实的增长结果。',
          '分析用户增长漏斗、行为数据和市场趋势，识别新的增长机会',
          '参与设计和推动拉新、激活、留存、召回、分享等方向的增长实验',
          '深入理解用户行为和产品路径，将增长机会转化为产品方案',
          '与产品、数据、算法、市场等团队合作，推动方案从 idea 到上线',
          '搭建增长指标、实验框架和复盘机制，持续判断什么真正有效',
          '研究不同国家、用户群体和场景中的增长模式，寻找可以规模化复制的方法',
          '使用 AI 工具加速研究、分析、原型设计、数据处理和实验执行',
          '独立负责部分增长项目，从问题定义、方案设计到上线和复盘',
        ],
        requirements: [
          '本科及以上学历，不限专业',
          '对互联网产品、消费产品、AI 产品和用户增长有强烈兴趣',
          '对数据敏感，能够从数据中发现问题，而不是只做报表',
          '逻辑清晰，能够把复杂和模糊的问题拆解成可验证的假设',
          '有很强的行动力和 ownership，不习惯等别人把问题定义完整',
          '对技术不设边界，愿意主动学习新的工具和工作方式',
          '英文可以作为工作语言',
          '具备 AI-native 的工作习惯，愿意把 AI 当作日常工作基础设施，而不是偶尔使用的辅助工具',
          '加分项：熟练使用 Codex、Cowork、ChatGPT 等 AI 工具完成研究、分析、原型和执行',
          '加分项：能借助 AI 快速写 SQL、处理数据、搭 demo、跑实验，而不是只停留在 prompt 层',
          '加分项：有 vibe coding、rapid prototyping 或独立搭建小工具的经验',
          '加分项：会主动搭建自己的 AI workflow、agent 或自动化工具提升工作效率',
          '加分项：做过真正从 0 到 1 的个人项目、产品、增长实验或创业项目',
          '加分项：对最新 AI 产品、agent、consumer apps 和 growth tools 保持高敏感度',
          '加分项：有海外市场、跨文化项目或国际化产品相关经历',
        ],
      },
      {
        company: '小红书',
        role: '体验运营（2027 校招）',
        location: '上海/北京',
        mode: '应届 · 校园招聘',
        tags: ['体验运营', 'VOC', '数据分析', 'LLM/Agent'],
        batch: '2027 校园招聘 · 职位方向：非技术 · 子方向：运营',
        description: [
          '每人最多可投递 1 个职位方向中的 2 个子方向，最多 5 个职位；投递后，职位方向不可更换，志愿将按顺序依次流转',
          '关于我们：社区与商业体验运营团队，关注小红书用户在社区使用与商业交易过程中的真实体验',
          '社区侧：关注普通用户与创作者在内容浏览、搜索发现、内容发布、互动反馈、账号成长及社区规则理解与使用过程中的体验；商业侧：关注广告主、商家、消费者和买手博主在广告投放、商家经营、交易履约及售后服务等环节中的体验问题',
          '团队通过用户反馈、行为数据和专项调研，识别影响用户体验与平台信任的关键问题；联动产品、策略、运营、客服、治理等团队，推动产品能力、平台规则、流程与服务机制持续优化',
          '我们也探索 AI 在体验洞察和用户服务中的应用，包括智能客服、知识库、内容理解及 Agent 等能力，让用户问题被更快识别、更有效解决，并持续减少重复发生',
          '基于用户原声、VOC、工单、热线、问卷、评论反馈及行为数据，识别内容浏览、搜索、发布、互动、社区规则使用，以及广告投放、商家经营、交易售后等链路中的关键体验断点',
          '将复杂、分散的用户问题拆解为清晰的体验议题，结合定性反馈与定量数据输出分析报告，为产品、策略、运营和治理团队提供决策依据',
          '参与社区与商业体验专项的设计、推进和复盘，跟进解决方案落地，评估实际效果，推动问题形成闭环',
          '建立和迭代体验指标及评估口径，监测关键链路体验变化，对专项动作进行归因分析，用数据判断优先级与改善效果',
          '参与智能化体验能力建设，包括用户反馈的结构化分析、知识库、智能客服、内容理解及大模型 Agent 等方案的设计和落地',
          '与产品、策略、内容运营、商家运营、销售、客服、治理等团队协作，在规则制定、流程设计、产品迭代和应急响应中提供用户体验视角的支持',
        ],
        requirements: [
          '具备数据分析能力，会使用 SQL 或愿意快速学习；能结合用户反馈、内容反馈与行为数据发现问题，并形成有结论、有证据、可落地的分析建议',
          '逻辑清晰、有用户视角和同理心，能够理解普通用户、创作者及商业用户的不同诉求；具备 ownership，愿意持续推动问题闭环',
          '对内容社区、平台治理、电商、广告或平台型产品有兴趣，关注内容生态、商业生态、平台规则及用户体验',
          '对 LLM、Agent、智能客服、知识库等 AI 应用有基础认知和兴趣；了解工具调用、工作流编排、知识库检索等概念者优先',
          '具备良好的沟通协作与项目推动能力，能够与产品、策略、运营、客服、治理等团队协作，在无直接汇报关系的情况下推动共识',
          '有内容社区、用户研究、平台治理、电商、广告、客户服务或数据分析相关实习/项目经历者优先',
          '本科及以上学历，专业不限；统计学、数学、计算机、经济学、心理学、社会学、新闻传播等相关背景优先',
        ],
      },
      {
        company: '小红书',
        role: 'rednote 全球内容运营（Global Content Operations，2027 校招）',
        location: '北京/上海',
        mode: '应届 · 校园招聘',
        tags: ['内容运营', '全球化', 'AI 标注', '英文'],
        batch: '2027 校园招聘 · 职位方向：非技术 · 子方向：运营',
        description: [
          '每人最多可投递 1 个职位方向中的 2 个子方向，最多 5 个职位；投递后，职位方向不可更换，志愿将按顺序依次流转',
          '关于团队：我们是小红书全球内容运营团队，致力于帮助优质内容跨越语言和文化，连接全球用户。团队每天关注不同国家和地区用户的兴趣、内容消费习惯与文化趋势，与增长、推荐算法、产品及 AI 团队紧密合作，持续优化海外用户的内容体验。我们也积极探索 AI 在内容理解、生产和分发中的应用，希望让更多优质内容精准触达全球用户。',
          '洞察不同国家和地区用户的内容偏好、文化趋势和兴趣变化',
          '筛选并优化海外内容供给，持续提升海外用户的内容体验、增长与活跃',
          '借助 AI 工具及内容标注，帮助提升 AI 对不同主题内容的理解能力',
          '通过数据分析发现用户需求和内容机会，不断迭代内容运营策略',
          '与产品、推荐算法、增长等团队紧密合作，持续优化海外内容生态',
          "The Global Content Operations team at Rednote is on a mission to help great content travel across languages and cultures. We work closely with product, recommendation, growth, and AI teams to understand what users around the world love to discover, watch, and share, and continuously improve the content experience for our global community. We're also exploring how AI can enhance content understanding, creation, and distribution at scale.",
          "What You'll Do：Identify content trends, cultural insights, and user interests across different countries and regions.",
          "What You'll Do：Curate and optimize content to improve the experience, growth, and engagement of overseas users.",
          "What You'll Do：Use AI tools and content annotation workflows to improve AI's understanding of different content topics.",
          "What You'll Do：Analyze data to uncover user insights and identify opportunities for content and product growth.",
          "What You'll Do：Partner closely with product, recommendation, growth, and AI teams to experiment, iterate, and improve the global content ecosystem.",
        ],
      },
    ],
    '销售类': [
      {
        company: '美团',
        role: '无人车 KA 项目实习生',
        location: '北京/上海/深圳',
        mode: '日常实习',
        tags: ['KA 项目', '运营支持', '数据分析', '自动驾驶'],
        batch: '软硬件服务 · 无人车业务部',
        description: [
          '部门介绍：无人车业务部成立于 2016 年，旨在用无人驾驶技术提升物流配送的效率和体验。美团无人车以自研 L4 级自动驾驶软硬件技术为核心，与美团即时零售业务结合，形成满足公开道路、社区、工业园区等室外全场景下的无人配送整体解决方案。自 2020 年起，无人车已在北京、深圳等多地进入常态化试运营阶段，在城市复杂场景下提供针对餐饮外卖、生鲜食杂等货物的即时配送服务。2025 年，美团无人车又踏上了同城货运的新探索，并在 2026 年持续扩大运营范围和车队数量，为更多城市带来智能配送服务',
          '协助无人车 KA 项目的日常运营支持工作，包括项目进度跟踪、数据整理与分析',
          '配合销售团队完成客户需求调研、方案整理及项目文档撰写',
          '参与客户沟通会议，记录会议要点并跟进后续行动项',
          '支持项目执行过程中的跨部门协调与资源对接工作',
        ],
        requirements: [
          '专业不限，理工科或商科背景优先',
          '具备良好的沟通能力与团队协作意识，工作细致认真',
          '熟练使用办公软件，具备基础数据分析能力',
          '对自动驾驶或智能出行领域有浓厚兴趣，有相关实习经验优先',
        ],
        benefits: [
          '深入参与前沿无人车技术项目的落地执行，积累行业实践经验',
          '与资深运营及销售团队协作，获得专业指导与成长机会',
          '工作地点覆盖北京、上海、深圳，灵活安排实习地点',
          '表现优异者有机会获得转正机会或推荐信支持',
        ],
      },
      {
        company: '美团',
        role: '商户运营专员',
        location: '成都',
        mode: '应届 · 校园招聘',
        tags: ['商户运营', '收益管理', '渠道合作'],
        description: [
          '【酒店旅行-收益管理】定价运营：负责酒店收益管理工作，包含库存和价格的制定调整，完成营收目标以及品牌价格要求',
          '【酒店旅行-收益管理】收益管理策略迭代：根据当地市场情况，结合市场供需、竞争变化的情况，迭代门店的收益策略；与项目多职能人员保持良好的沟通合作，共同达成项目目标',
          '【核心本地商业-商户运营】负责全国商户线上运营方案，对商户的经营改善负责，促成商户与平台的持续合作',
          '【核心本地商业-商户运营】通过主动电话外呼，与合作商户负责人建立客情，洞察经营需求，并提供专业的线上营销解决方案，提升线上售卖量，提高门店运营效率',
          '【核心本地商业-商户运营】及时处理商户在交易类产品、线上营销活动、商家系统使用中遇到的问题，提高商户及用户满意度；处理客户异议，促成合同签约，并与渠道经理进行客户信息交接',
          '【充电宝业务-商户运营】通过电话和微信对公司下发的客户商机进行有效跟进，主动探寻客户需求，提供充电宝行业及产品介绍',
          '【充电宝业务-商户运营】根据客户所处地区市场、资金情况及资源情况，为客户拟定充电宝合作项目方案',
          '【充电宝业务-商户运营】处理客户异议，促成合同签约，并与渠道经理进行客户信息交接；积极反馈商机跟进过程中发现的问题，为商机投放提供建议，帮助投放组持续优化投放策略',
          '【充电宝业务-商户运营】积极参加公司组织的各项培训，保持开放的学习心态并具备岗位必备的技能要求',
        ],
        requirements: [
          '【酒店旅行-收益管理】本科学历，不限专业和实习经验，对酒店行业和收益管理感兴趣',
          '【酒店旅行-收益管理】学习能力强，对数据敏感，认真负责；优秀的沟通能力和表达能力，能够主动、有效地与内部及其他职能部门沟通',
          '【核心本地商业-商户运营】本科学历，电子商务、工商管理及市场营销类专业优先',
          '【核心本地商业-商户运营】热衷于通过提供解决方案帮助商户获得成功；思维敏捷，能够准确把握平台优势和商户诉求，高效整合各类运营举措促成商户合作',
          '【核心本地商业-商户运营】为人正直，有韧性，有较强的学习能力和适应能力',
          '【充电宝业务-商户运营】本科学历，专业不限（电子商务、工商管理及市场营销类专业优先）',
          '【充电宝业务-商户运营】沟通表达清晰，具备较强的人际沟通能力和灵活应变能力，有责任心和担当，为人正直',
          '【充电宝业务-商户运营】有较强的学习能力，能较快吸收并运用知识，有基础的数据分析和总结能力',
          '【充电宝业务-商户运营】对销售工作有较高的热情，性格坚韧，勇于接受挑战并有进取心，能适应互联网的快速发展节奏',
        ],
      },
      {
        company: '美团',
        role: '大客户合作岗',
        location: '杭州/北京/石家庄/上海/迪拜/广州/成都/武汉/深圳',
        mode: '应届 · 校园招聘',
        tags: ['大客户', '到店/到家', '骑行', '无人机'],
        description: [
          '【核心本地商业-到店业务】推进全国头部本地生活行业大型连锁品牌与美团在品牌营销、促销、用户运营等领域深度合作；研究本地生活行业特点，深入了解品牌经营，帮助品牌制定专业线上线下解决方案并落地运营；通过行业、品牌和线上经营数据分析指导客户经营迭代；在合作中做好平台和商户的深度链接，反向推动平台 B 端和 C 端产品变革；深入洞察行业现状，打磨合作方法论并预判行业趋势；借助 AI 辅助品牌经营分析和方案输出，通过智能化手段提升客户洞察效率',
          '【核心本地商业-到家业务】知晓行业客户分布、标杆客户和竞对策略等，寻找商机；与关键决策人建立并保持客户关系，制定谈判计划，影响其决定并准确评估客情深度；识别客户需求并主动提出优化方案；推动项目问题解决、协调资源优化流程；分析行业和竞对数据，基于客户需求撰写定制分析报告，输出策略；月度拜访、季度组织高层沟通；善用 AI 辅助客户洞察、竞对分析及定制化方案撰写',
          '【骑行业务】支持骑行业务区域开拓发展，与重要关联方保持战略沟通并推进布局；协助区域管理者拓宽和维护主管部门关系；研究互联网交通行业政策法规，配合政策推动交通业务落地；协调主管部门与企业发展的关系，联动业务、产品、技术等部门，挖掘利用内部资源赋能业务',
          '【无人机业务】推进美团无人机在纵向行业或横向区域的业务合作；对垂类大 KA 客户负责，推进业务合作；探索与推进低空航网，推动商业客户合作',
        ],
        requirements: [
          '【到店业务】本科及以上学历；对创新项目有兴趣，有很强的学习能力和适应能力，适应互联网行业的快速发展，精力充沛；具备 AI 工具应用意识，能主动探索并使用 AI 辅助完成数据分析、方案撰写等工作场景，有实际使用经验者优先',
          '【到家业务】本科及以上学历；具备较强的结构化思考与沟通能力、不错的文案撰写和讲解能力，有很强的目标意识和自驱力；思路清晰，能够准确把握产品优势和客户心理；积极主动，正直诚信；了解并能使用 AI 辅助工具进行客户分析、报告撰写、信息检索等日常工作',
          '【骑行业务】本科及以上学历；善于沟通和协调，具有较好的人际关系处理能力和应变能力，善于跨部门沟通协同；有良好的团队合作精神，积极主动；逻辑思维能力优秀，具有扎实的文字功底和方案输出能力',
          '【无人机业务】本科毕业，211/985 或同级别海外院校，理工科背景，对科技领域、低空具身有浓厚兴趣，对市场类工作有一定认知；具备数据分析能力和行业洞察力，对餐饮、医疗、电力、教育等垂直行业有过实习或者调研经验；了解头部 KA 或央国企或部委到地方侧的工作内容和工作方式',
          '备注：其中部分境外岗位面向 2025 年 6 月至 2027 年 10 月毕业的全球毕业生，如遇系统投递问题，请前往 Keeta Careers 英文招聘官网投递',
        ],
      },
      {
        company: '待补充',
        role: '大客户销售经理（上海）',
        location: '上海',
        mode: '校招 · 销售 5 人',
        tags: ['ToB 销售', '大客户开发', '整合营销'],
        batch: '校园招聘 · 上海',
        jobId: 'J101190',
        description: [
          '负责行业大客户的开发以及老客户维护，深挖客户需求',
          '分析内外部产品的优、劣势，跨部门整合资源，向客户提交专业整合营销服务方案',
          '为团队及中台部门提供敏锐的嗅觉参考，洞察市场新机遇',
          '根据客户需求与竞争对手情况，总结市场、行业特性，为公司提供决策支持',
        ],
        requirements: [
          '本科及以上学历，广告、工商管理或市场营销专业优先',
          '有志于从事 TO B 业务大客户销售',
          '良好的沟通能力，较强的学习能力、感染力、沟通协调及团队合作能力',
          '乐观、积极进取、为人正直，敢于面对压力和挑战',
        ],
      },
      {
        company: '待补充',
        role: '整合营销策略（上海）',
        location: '上海',
        mode: '校招 · 销售 5 人',
        tags: ['效果广告', '数据分析', '整合营销'],
        batch: '校园招聘 · 上海',
        jobId: 'J100678',
        description: [
          '基于行业头部客户的效果广告需求（如 ROI 优化、转化提升），结合行业通案制定定制化整合营销方案，并协同销售团队完成落地执行与效果跟踪',
          '通过数据分析工具（如广告平台数据、用户行为数据）定位投放问题，输出效果优化建议与提升报告，精准排查并解决广告投放中的数据异常',
          '基于数据分析输出行业效果广告趋势报告，构建可复用的解决方案库，为团队提供数据化策略支持',
        ],
        requirements: [
          '本科及以上学历，市场营销、广告等相关专业，有相关实习经验者优先',
          '具备出色的沟通能力、数据分析能力及文案写作能力',
          '熟练使用办公软件（Excel/PPT/数据分析工具等）',
          '认真细致、敬业负责，拥有强烈的进取心与合作意识',
        ],
      },
      {
        company: '阿里云',
        role: '管培生（商业技术方向）',
        location: '北京/杭州/上海/深圳',
        mode: '27届秋招 · 应届生',
        tags: ['管培生', '云销售', '商业技术', '客户经营'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '阿里巴巴2027届应届生',
        writtenTestTrack: '【阿里云BTE】27届秋招',
        description: [
          '客情建设和商机拓展，产品和技术价值传递，做好业务支持',
          '推动决策和商机转化，与客户一线技术人员和采购团队建立紧密链接，在商业场景下诊断客户需求，解决客户问题，为客户创造价值',
          '通过集中培训及实战演练，深入理解云架构及应用场景，学习阿里云最佳实践，深入理解业务并帮助客户在数字化转型中取得成功',
          '你将获得：6-8 个月的沉浸式云计算学习与培养机会；产品解决方案团队轮岗及学习经历；顶级行业大咖面对面；全球工作机会',
        ],
        requirements: [
          '泛计算机相关专业，至少熟练掌握一种编程语言；具有 2 年及以上系统学习经历',
          '具备较好的学习能力、沟通能力、协调能力和团队合作能力',
          '担任过学生干部、社团干部等，有校内外大型活动组织经验',
          '加分项：在校期间获得奖学金',
          '加分项：作为项目负责人参加校级及以上大赛并有获奖经历',
          '加分项：有大型互联网公司相关岗位实习经历',
        ],
      },
      {
        company: '阿里巴巴',
        role: '娱跃班 · 渠道销售（虎鲸文娱）',
        location: '北京/上海',
        mode: '27届秋招 · 应届生',
        tags: ['渠道销售', '广告代理', '文娱内容'],
        graduationPeriod: '2026-11-01 - 2027-10-31',
        batch: '虎鲸文娱集团 · 阿里巴巴2027届应届生',
        description: [
          '负责区域广告代理商的开发及维护，建立与代理的良好合作关系',
          '售卖文娱核心内容产品及资源，达成销售目标',
          '内容行业、视频行业、阿里生态营销模型的建立及复制',
        ],
        requirements: [
          '积极、自信、理解能力强，思维活跃，优秀的口头表达能力和沟通技巧',
          '具有广告行业实习经验者优先',
          '敬业、专业，具有开拓精神和团队协作精神，具有良好的抗压能力',
        ],
      },
      {
        company: '字节跳动',
        role: '大客户销售（餐饮）· 抖音生活服务',
        location: '广州',
        mode: '2027 届校园招聘',
        tags: ['大客户销售', '餐饮行业', '生活服务'],
        jobId: 'A30066',
        batch: '抖音生活服务 2027 届校招',
        description: [
          '团队介绍：抖音生活服务依托抖音 POI（Point of Interest）、短视频、直播、搜索等，以「激发线下生意，丰富美好生活」为使命，致力于成为最值得信赖的生活服务平台。截至 2025 年底，业务已覆盖 400+ 城市，超过 1500 万家动销门店',
          '负责生活服务餐饮/游玩/服务/零售行业的大客户销售工作',
          '负责餐饮/游玩/服务/零售行业品牌商家在本地生活服务的各项商务事宜，包括商务谈判、资源投入发掘、资源分配等，提升抖音生活服务份额占比，与公司关联部门沟通协作，确保广告的及时投放与问题反馈、广告资源的合理利用与开发',
          '负责全国餐饮/游玩/服务/零售连锁品牌的市场规划、策略制定及实施，挖掘增长机会点和重大项目拓展，联合商户打造营销事件',
          '通过数据分析客户需求，为客户提供咨询服务、产品培训、优化投放、数据分析等营销策略，制定整合营销方案及策略，推动各行业营销策略的实施，整合内外部资源，包括大促、数据协同、品牌门店赋能等增值服务方案等',
        ],
        requirements: [
          '2027 届获得本科及以上学历',
          '热爱销售工作，具备良好的客户开拓和服务能力，建立良好的客户群体关系的能力',
          '掌握商务谈判、沟通及文字写作表达交流技巧，具有一定的市场洞察力和执行力',
          '性格开朗，敢于面对挑战',
        ],
      },
      {
        company: '字节跳动',
        role: '出海大客户/渠道销售（GBS）',
        location: '广州',
        mode: '2027 届校园招聘',
        tags: ['出海业务', '渠道销售', 'TikTok 商业化'],
        jobId: 'A199143',
        batch: 'Global Business Solutions 2027 届校招',
        description: [
          '团队介绍：Global Business Solutions (GBS) 负责 TikTok 为主的全球产品商业化相关工作，为全球品牌和广告商提供集成的数字营销解决方案。具体包括各区域销售、销售运营、渠道管理、商业化战略、To B 市场营销、营销科学、商业化合作和商业内容安全等职能',
          '参与制定国际化商业化广告客户及代理体系的运营策略，协助完成客户/代理开发与维护的规划工作；基于市场反馈协助构建需求分析模型，参与设计合作伙伴激励方案及生态运营机制，支持服务生态的良性发展',
          '协助搭建代理商分层培训体系，参与培训内容的设计与整理（含业务逻辑、产品能力、运营方法等），跟进业务与项目的周期性运营进展；同时结合广告主多元需求，参与市场推广方案的策划、落地执行及效果跟踪迭代',
          '参与制定多方协同沟通策略，协助构建「专项-培训-中高层」分层沟通机制，支持专项运营计划、培训体系及战略谈判材料的准备，推动内外部目标对齐与协同增长策略的落地',
          '基于行业与市场信息，协助构建跨境行业趋势洞察体系，参与媒体价值与客户/代理需求的匹配分析，支持合作伙伴与客户痛点研究，并为代理商赋能策略提供数据与信息输入；参与潜力合作伙伴的挖掘分析，协助建立筛选、培育与评估的基本框架',
        ],
        requirements: [
          '2027 届获得本科及以上学历，广告学、市场营销、工商管理、传播学、数据分析等相关专业优先',
          '对广告和全球营销趋势有浓厚兴趣，具备较强的学习能力与信息整合能力，善于从数据与案例中发现规律',
          '具备良好的人际沟通与协调能力，乐于与内外部伙伴协作，能够清晰表达观点并推动共识',
          '思维活跃、逻辑清晰，善于拆解复杂问题，具备较强的执行力和结果导向意识',
          '自驱力强，适应多任务并行的环境，具备高效的多任务协同处理能力',
          '英语可作为工作语言，有国际化学习、交换或跨文化项目经验者优先；对跨文化沟通与跨国业务协作有热情者加分',
        ],
      },
      {
        company: '字节跳动',
        role: 'TikTok 商业化 CNOB 实习生（GBS）',
        location: '上海',
        mode: '日常实习',
        tags: ['商业化运营', '广告投放', '日常实习'],
        jobId: 'A231000',
        batch: 'Global Business Solutions · 日常实习（3 个月及以上）',
        description: [
          '团队介绍：Global Business Solutions (GBS) 负责 TikTok 为主的全球产品商业化相关工作，为全球品牌和广告商提供集成的数字营销解决方案。具体包括各区域销售、销售运营、渠道管理、商业化战略、To B 市场营销、营销科学、商业化合作和商业内容安全等职能',
          '日常实习：面向全体在校生，为符合岗位要求的同学提供为期 3 个月及以上的项目实践机会',
          '流程性支持：协助组内销售完成日常运营工作，包括但不限于素材申诉提交、产品功能白名单申请提报等跨部门流程跟进',
          '广告账户初排：具备基础广告投放认知，能够进行初级账户问题排查，识别常见投放异常并同步给对口销售',
          '大促节点支持：参与新游上线及游戏行业重要节点（如版本更新、节日大推）期间的相关推进工作，协助团队完成节点冲刺目标',
        ],
        requirements: [
          '本科及以上学历在读',
          '可每周实习 4 天以上，优先可实习 4 个月以上，执行力强，细心负责，有较强的跨部门沟通协调能力',
          '熟练使用 Excel/飞书等办公工具',
        ],
      },
      {
        company: '字节跳动',
        role: '大客户销售（丽人）· 抖音生活服务',
        location: '北京/上海/广州/成都/杭州',
        mode: '2027 届校园招聘',
        tags: ['大客户销售', '丽人行业', '生活服务'],
        jobId: 'A186913',
        batch: '抖音生活服务 2027 届校招',
        description: [
          '团队介绍：抖音生活服务依托抖音 POI（Point of Interest）、短视频、直播、搜索等，以「激发线下生意，丰富美好生活」为使命，致力于成为最值得信赖的生活服务平台。截至 2025 年底，业务已覆盖 400+ 城市，超过 1500 万家动销门店',
          '负责生活服务餐饮、游玩、服务、零售行业的大客户销售工作',
          '负责餐饮、游玩、服务、零售行业品牌商家在本地生活服务的各项商务事宜，包括商务谈判、资源投入发掘、资源分配等，提升抖音生活服务份额占比，与公司关联部门沟通协作，确保广告的及时投放与问题反馈、广告资源的合理利用与开发',
          '负责全国餐饮、游玩、服务、零售连锁品牌的市场规划、策略制定及实施，挖掘增长机会点和重大项目拓展，联合商户打造营销事件',
          '通过数据分析客户需求，为客户提供咨询服务、产品培训、优化投放、数据分析等营销策略，制定整合营销方案及策略，推动各行业营销策略的实施。整合内外部资源，包括大促、数据协同、品牌门店赋能等增值服务方案等',
        ],
        requirements: [
          '2027 届获得本科及以上学历',
          '热爱销售工作，具备良好的客户开拓和服务能力，建立良好的客户群体关系的能力',
          '掌握商务谈判、沟通及文字写作表达交流技巧，具有一定的市场洞察力和执行力',
          '性格开朗，敢于面对挑战',
        ],
      },
      {
        company: '字节跳动',
        role: '渠道销售（全域经营）· 商业化',
        location: '北京/上海/广州/杭州',
        mode: '2027 届校园招聘',
        tags: ['渠道生态', '巨量引擎', '商业化'],
        jobId: 'A205772',
        batch: '抖音集团商业化 2027 届校招',
        description: [
          '团队介绍：抖音集团商业化是抖音集团旗下的综合数字化营销服务平台，致力于让不分行业、地域的企业及个体都能通过数字化技术激发创造、驱动生意，实现商业的可持续增长',
          '负责巨量引擎渠道生态建设，结合公司产品优势，通过内容生态和精准营销，助力代理商合作伙伴生意增长',
          '根据公司渠道战略方向，帮助代理商合作伙伴进行生意的诊断与分析，为代理商提供专业的数字营销解决方案，促进目标的达成和生意的长效发展',
          '研究广告主需求及行业数据，提炼、沉淀、优化方法论，深入理解广告产品营销体系，进行定期培训和指导，参与产品或策略规划与执行，加强业务合作伙伴的服务能力',
          '深入洞察并掌握市场、行业、政策动态，敏锐分析，不断提升和迭代业务合作的模式和机制，提升效率的同时把控风险，保障生意健康可持续发展',
        ],
        requirements: [
          '2027 届获得本科及以上学历',
          '热爱广告行业，对市场、行业、营销产品具有敏锐洞察力，具有逻辑化与多元化的思维',
          '具有自驱动力、执行力，以及强烈的好奇心与求知欲，具有出色的沟通能力和协调能力',
          '性格开朗，为人正直，责任心强，擅长多任务、跨部门的协同与推进',
        ],
      },
      {
        company: '腾讯',
        role: '云运营商销售经理（移动市场）',
        location: '上海',
        mode: '社会招聘 · 5 年以上',
        tags: ['运营商', '云销售', '政企客户'],
        batch: 'CSIG · 销售、服务与支持',
        description: [
          '与运营商建立和维护良好的合作关系，拓展业务渠道',
          '负责腾讯云与移动市场条线及其专业公司的整体业务合作',
          '根据腾讯云与运营商集团总部达成的合作模式与产品库，推动在各省侧运营商以及对应渠道的业务落地',
          '拉通腾讯云内部产品与销售团队，与移动侧运营商专业公司深度协同，发挥各自优势形成合力，在当地各类云业务项目上实现合作赢单',
        ],
        requirements: [
          '本科及以上学历，有过移动总部市场线条，政企线条服务背景或经历',
          '熟悉市场线权益推广，流量经营，大数据营销，ICT 和云的优先',
          '客户界面良好，需要能同时维系产品线及运营商的关系',
          '通过腾讯云技术认证或同等资格认证的优先录取；通过腾讯云从业资格证或同等资格认证的优先录取',
        ],
      },
      {
        company: '腾讯',
        role: '云医疗行业 KA 销售（北京）',
        location: '北京',
        mode: '社会招聘 · 5 年以上',
        tags: ['医疗行业', 'KA 销售', '云计算'],
        batch: 'CSIG · 销售、服务与支持',
        description: [
          '腾讯汇集了一批综合能力出众的互联网销售，代表公司参与完整的客户业务合作，是客户高度信任的顾问和益友，也是深刻洞悉客户痛点的解决方案制定者与谈判专家',
          '负责国内头部公立医院/卫健委等大客户的关系维护及产品销售工作',
          '洞察相关客户需求，把握市场及行业发展态势，制定有效的客户经营策略、市场竞争策略',
          '负责相关客户的关系拓展、维护和管理；熟练掌握公司产品及解决方案知识，结合客户业务特点清晰呈现产品优势；挖掘商机并对商务谈判、合同签订、项目交付过程和质量、项目回款等销售全周期工作负责',
          '负责相关客户的满意度建设，持续提升公司在客户、行业的品牌影响力',
        ],
        requirements: [
          '本科及以上学历',
          '5 年以上公立医院/卫健委医疗信息化行业从业经验，有一定的行业资源储备；主导或操盘过相关大项目者优先，熟悉云计算产品及解决方案者优先',
          '出色的沟通能力和谈判技巧，良好的市场洞察力和分析判断能力，具备较强的学习能力和适应能力和个人素质',
          '积极主动，富有团队合作精神，能够承受工作压力，具备良好的职业操守',
          '加分项：同等条件下，通过腾讯云认证或取得同等资格认证的候选人优先考虑',
        ],
      },
      {
        company: '腾讯',
        role: '智慧零售大客户销售经理（出海方向）',
        location: '深圳/上海',
        mode: '社会招聘 · 3 年以上',
        tags: ['智慧零售', '公有云', '出海业务'],
        batch: 'CSIG · 销售、服务与支持',
        description: [
          '作为大客户销售，负责智慧零售行业客户（商超百货、购物免税、鞋服美妆、家居家电、食品饮料等）的拓展和深耕，负责目标客户的开发、维护、跟进，并达成制定的销售指标',
          '根据零售行业业务场景，结合腾讯云产品能力、大数据能力以及腾讯内部各类资源，挖掘并发现腾讯与客户之间商业机会结合点',
          '整合腾讯内部资源、能力，形成大客户营销解决方案，并进一步推进零售行业标杆案例的建设',
          '以行业标杆案例为契机，推动在零售行业内部推广腾讯的解决方案，以推动腾讯在智慧零售行业的影响力及市场占比',
          '以智慧零售为依托，构建智慧零售行业的商业生态版图，引入并管理各类合作伙伴',
          '关注客户需求，了解客户动态，做好客户长期维护和动态管理，保持行业样本客户的满意度、活跃度和推荐意愿，并协同标杆客户组织各类大型的市场活动',
        ],
        requirements: [
          '本科及以上学历，具有 3 年以上云或 SaaS 或通信相关行业工作经验',
          '具备敏锐的市场嗅觉，熟悉公有云行业，有泛零售、云、互联网行业大客户服务经验或客户资源者优先',
          '有海外工作经验（特别是中东/东南亚/亚太等地区）以及优秀外语商务沟通能力者优先',
          '具备较强的执行力和工作热情，工作态度端正，具有良好的谈判能力和大局观者优先',
          '理解并熟悉传统零售企业的日常业务、内部营销、IT 等基本情况，了解传统零售企业的决策链条者优先',
          '有很好的销售项目全生命周期的推动和管理能力，擅长数据分析者优先',
          '加分项：同等条件下，通过腾讯云认证或取得同等资格认证的候选人优先考虑',
        ],
      },
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
            className={`career-resource-card career-resource-card--entry${onItemClick ? ' career-resource-card--clickable' : ''}`}
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
                  <Text className="career-resource-title" title={item.title} strong style={item.highlight ? { color: '#b8860b' } : undefined}>
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
    postgraduate: { lead: '绩点、竞赛、论文，', highlight: '保研上岸的最大助力' },
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
      <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} className="career-tabs career-section-tabs" size="large" />
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

// 窄屏判定：手机端把表单控件换成 antd 的 large 尺寸（高度 40px、字号 16px）
// 16px 字号也能避免 iOS Safari 聚焦输入框时自动放大页面
function useNarrowScreen(maxWidth = 576) {
  const query = `(max-width: ${maxWidth}px)`;
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

function ConsultationPage() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const isNarrow = useNarrowScreen();
  const controlSize = isNarrow ? 'large' : 'middle';

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
            size={controlSize}
            onFinish={submit}
          >
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input placeholder="例如：陈小博" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="contact" label="联系方式（手机/微信）" rules={[{ required: true, message: '请输入联系方式' }]}><Input placeholder="例如：138xxxxxxxx / 微信号" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="school" label="学校" rules={[{ required: true, message: '请输入学校名称' }]}><Input placeholder="例如：北京邮电大学" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="major" label="专业" rules={[{ required: true, message: '请输入专业名称' }]}><Input placeholder="例如：计算机科学与技术" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="grade" label="年级" rules={[{ required: true, message: '请选择你所在年级' }]}><Select placeholder="请选择你所在年级" options={consultGradeOptions} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="goal" label="咨询方向" rules={[{ required: true, message: '请选择咨询方向' }]}><Select placeholder="请选择所咨询方向" options={['实习与就业', '考研与保研', '留学', '其他'].map((item) => ({ value: item, label: item }))} /></Form.Item></Col>
            </Row>
            <Form.Item name="description" label="当前困惑" rules={[{ required: true, message: '请描述你当前的困惑' }]}><Input.TextArea rows={5} placeholder="描述你目前的学习/升学/就业困惑" /></Form.Item>
            <div className="consult-submit-row">
              <Button type="primary" htmlType="submit" size={controlSize} loading={submitting}>提交意向</Button>
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
