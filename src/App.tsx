import { BookOutlined, CrownOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, FormOutlined, LockOutlined, ProfileOutlined, ReadOutlined, RocketOutlined, TeamOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Collapse, Divider, Empty, Form, Input, Layout, List, Menu, message, Radio, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Timeline, Typography } from 'antd';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createOrder, fetchDocMarkdown, fetchMe, fetchNoteMarkdown, getAssignmentDetail, getAssignments, getAssignmentSolutions, getCourseNotes, getCourseResourceDetail, getCourseResources, getDocsByCourse, getHomeResources, getMajors, getMembershipPlans, getTestMaterials, getTestSolutions, getUserCourses, loginWithPhone, submitConsultationLead, updateMe } from './api';
import type { CourseNoteItem, DocItem, DocSection, TestMaterialItem } from './api';
import type { Assignment, AssignmentDetail, Course, CourseResourceCategory, CourseResourceDetail, CourseResourceGroup, CourseResourceItem, Grade, Major, MajorCourse, MemberLevel, MembershipPlan, MeUser, Profile } from './types';

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
  const [isLoggedIn, setIsLoggedIn] = useLocalState('isLoggedIn', false);
  const [memberLevel, setMemberLevel] = useLocalState<MemberLevel>('memberLevel', 'free');
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
            <span>{memberNames[memberLevel]}</span>
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
    if (!isLoggedIn || !profile.phone) {
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
          <Title level={1}>将每一次课程作业，<br /><span>变成绩点提升和未来职业竞争力</span></Title>
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
    if (!isLoggedIn || !profile.phone) {
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
    if (!isLoggedIn || !profile.phone) {
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
    if (!isLoggedIn || !profile.phone) {
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
function CareerPlanningPage() {
  const navigate = useNavigate();

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

  const graduateExamData = [
    { title: '考研院校与方向选择', desc: '结合自身实力与目标，科学选择目标院校和研究方向', tag: '择校', color: 'blue' },
    { title: '408统考全年复习规划', desc: '数据结构/组成原理/操作系统/计算机网络四科时间分配与阶段目标', tag: '规划', color: 'green' },
    { title: '数学与英语备考策略', desc: '高数/线代/概率+英语一/英语二 分阶段备考方法与资料推荐', tag: '公共课', color: 'purple' },
    { title: '考研复试准备指南', desc: '机试训练、专业面试、英语口试的准备方法', tag: '复试', color: 'orange' },
    { title: '考研最新资讯', desc: '报名时间、大纲变化、各校复试线预测等实时更新', tag: '动态', color: 'red' },
  ];

  const internshipData = [
    { title: '大厂实习申请全流程', desc: '从简历投递到Offer接收的完整链路，含时间节点与注意事项', tag: '流程', color: 'blue' },
    { title: '技术面试准备路线图', desc: '算法/系统设计/项目深挖的分阶段准备策略', tag: '面试', color: 'green' },
    { title: '简历与项目包装指南', desc: '如何用STAR法则描述项目经历，突出技术亮点', tag: '简历', color: 'purple' },
    { title: '互联网行业岗位解读', desc: '后端/前端/算法/数据/测试等岗位要求、发展路径分析', tag: '岗位', color: 'orange' },
    { title: '实习招聘日历', desc: '各大厂春招/秋招/日常实习时间线与内推渠道汇总', tag: '动态', color: 'red' },
  ];

  const studentCases = [
    { name: '张同学', school: '某211计算机', achievement: '成功保研至清华大学计算机系', period: '2023届', story: '大二开始规划，GPA排名前5%，两段科研经历+一篇论文，夏令营拿到清华、北大、浙大offer。', avatar: '🎓' },
    { name: '李同学', school: '某双非软件工程', achievement: '拿到CMU MSCS全奖录取', period: '2023届', story: '从双非起步，通过科研实习+高质量推荐信+精准选校策略，逆袭拿到CMU全奖。', avatar: '🌏' },
    { name: '王同学', school: '某985信息学院', achievement: '秋招拿到字节跳动SP Offer', period: '2024届', story: '大三两段大厂实习，系统化刷题+项目沉淀，最终斩获字节、腾讯、阿里多个SP。', avatar: '💼' },
    { name: '赵同学', school: '某211数学系', achievement: '跨考上岸浙大计算机', period: '2024届', story: '数学系转码，408零基础用8个月系统备考，初试400+，复试机试满分。', avatar: '📚' },
    { name: '陈同学', school: '某普通一本CS', achievement: '香港科技大学MSc录取', period: '2024届', story: '普通一本背景，通过高GPA+实习经历+精心打磨的文书，成功申请港科大。', avatar: '🏆' },
  ];

  const renderResourceList = (data: typeof postgraduateData) => (
    <List
      dataSource={data}
      renderItem={(item) => (
        <List.Item>
          <Card className="career-resource-card" hoverable>
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
      key: 'exam',
      label: <span><ReadOutlined /> 考研专区</span>,
      children: (
        <div className="career-tab-content">
          <div className="career-section-header">
            <Title level={4}>考研专区</Title>
            <Paragraph type="secondary">从择校到复试的一站式考研规划与备考资料</Paragraph>
          </div>
          {renderResourceList(graduateExamData)}
        </div>
      ),
    },
    {
      key: 'internship',
      label: <span><ProfileOutlined /> 实习专区</span>,
      children: (
        <div className="career-tab-content">
          <div className="career-section-header">
            <Title level={4}>实习专区</Title>
            <Paragraph type="secondary">助你拿到心仪的大厂实习Offer，积累核心竞争力</Paragraph>
          </div>
          {renderResourceList(internshipData)}
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
        <Title level={2}>生涯规划</Title>
        <Paragraph>无论你选择保研、留学、考研还是就业，这里都有为你量身整理的路径资料与真实案例</Paragraph>
      </div>
      <Tabs defaultActiveKey="postgraduate" items={tabItems} className="career-tabs" size="large" />
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
