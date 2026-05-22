import { BookOutlined, CrownOutlined, EyeOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Divider, Empty, Form, Input, Layout, List, Menu, message, Radio, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createOrder, getAssignmentDetail, getAssignments, getHomeResources, getMembershipPlans, submitConsultationLead } from './api';
import type { Assignment, AssignmentDetail, Course, Grade, MemberLevel, MembershipPlan, Profile } from './types';

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
  const [profile, setProfile] = useLocalState<Profile>('profile', {
    nickname: '未命名同学',
    phone: '',
    school: '',
    major: '',
    grade: undefined
  });

  return (
    <Layout className="app-shell">
      <Header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-logo" src="/logo.png" alt="平台 Logo" />
          <span>计算机专业学习与发展规划平台</span>
        </Link>
        <Menu mode="horizontal" className="nav" selectedKeys={[getSelectedNavKey(location.pathname)]} items={[
          { key: 'home', label: <Link to="/">学习资源</Link> },
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
          <Route path="/" element={<Home isLoggedIn={isLoggedIn} />} />
          <Route path="/assignments/:id" element={<AssignmentPage memberLevel={memberLevel} />} />
          <Route path="/membership" element={<MembershipPage memberLevel={memberLevel} setMemberLevel={setMemberLevel} />} />
          <Route
            path="/profile"
            element={(
              <ProfilePage
                profile={profile}
                setProfile={setProfile}
                memberLevel={memberLevel}
                setMemberLevel={setMemberLevel}
                isLoggedIn={isLoggedIn}
                setIsLoggedIn={setIsLoggedIn}
              />
            )}
          />
          <Route path="/consultation" element={<ConsultationPage profile={profile} />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Content>
      <Footer className="footer">MVP Demo · 内容用于学习参考和产品验证</Footer>
    </Layout>
  );
}

function getSelectedNavKey(pathname: string) {
  if (pathname === '/' || pathname.startsWith('/assignments')) return 'home';
  if (pathname.startsWith('/consultation')) return 'consultation';
  if (pathname.startsWith('/about')) return 'about';
  return '';
}

function Home({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>();
  const [selectedCourse, setSelectedCourse] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHomeResources().then((data) => {
      setGrades(data.grades);
      setCourses(data.courses);
      setAllAssignments(data.assignments);
      setAssignments(data.assignments);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getAssignments({ gradeId: selectedGrade, courseId: selectedCourse, q: keyword })
      .then((res) => setAssignments(res.data))
      .finally(() => setLoading(false));
  }, [selectedGrade, selectedCourse, keyword]);

  const visibleCourses = useMemo(() => {
    let result = selectedGrade ? courses.filter((course) => course.gradeId === selectedGrade) : courses;
    // 按浏览量降序排序
    return [...result].sort((a, b) => b.viewCount - a.viewCount);
  }, [courses, selectedGrade]);
  const selectedGradeName = selectedGrade ? grades.find((grade) => grade.id === selectedGrade)?.name || '年级' : '全部年级';
  const selectedCourseText = selectedCourse ? courses.find((course) => course.id === selectedCourse)?.name || '已选课程' : `${visibleCourses.length} 个课程`;

  return (
    <div>
      <section className="hero">
        <div>
          <Title level={1}>将每一次课程作业，<br /><span>变成绩点提升和未来职业竞争力</span></Title>
          <Paragraph>覆盖计算机专业核心课程，从参考解析、知识点提炼，到企业应用和 AI 实现，帮学生真正理解、掌握并迁移到未来发展。</Paragraph>
        </div>
        <Card className="hero-card">
          <Statistic title="已覆盖课程" value={courses.length} suffix="门" />
          <Statistic title="学习资源" value={allAssignments.length} suffix="项" />
        </Card>
      </section>

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
          <strong>{assignments.length} 项课程资源</strong>
        </div>
        <div className="resource-cascade">
          <div className="cascade-column cascade-column-grade">
            <div className="cascade-title">
              <span>年级</span>
            </div>
            <Radio.Group value={selectedGrade ?? 'all'} onChange={(event) => { setSelectedGrade(event.target.value === 'all' ? undefined : event.target.value); setSelectedCourse(undefined); }} className="grade-list">
              <Radio.Button value="all">全部</Radio.Button>
              {grades.map((grade) => <Radio.Button key={grade.id} value={grade.id}>{grade.name}</Radio.Button>)}
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
              renderItem={(course) => (
                <List.Item className={course.id === selectedCourse ? 'active-list-item' : ''} onClick={() => setSelectedCourse(course.id)}>
                  <Space>
                    <BookOutlined />
                    <Text strong={course.id === selectedCourse}>{course.name}</Text>
                    {course.isHot && <Tag color="red">热门</Tag>}
                  </Space>
                </List.Item>
              )}
            />
          </div>
          <div className="cascade-column cascade-column-main">
            <div className="cascade-title">
              <span>课程资源</span>
            </div>
            <Input.Search className="resource-search" placeholder="搜索课程资源/课程" allowClear onSearch={setKeyword} onChange={(e) => !e.target.value && setKeyword('')} />
            <List
              loading={loading}
              dataSource={assignments}
              pagination={{
                pageSize: 10,
                hideOnSinglePage: true,
                showSizeChanger: false
              }}
              locale={{ emptyText: <Empty description="暂无匹配资源" /> }}
              renderItem={(assignment) => (
                <AssignmentCard
                  assignment={assignment}
                  isLoggedIn={isLoggedIn}
                />
              )}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function AssignmentCard({ assignment, isLoggedIn }: { assignment: Assignment; isLoggedIn: boolean }) {
  const navigate = useNavigate();

  return (
    <List.Item className="assignment-list-item">
      <div className="assignment-item-main" onClick={() => {
        if (!isLoggedIn) {
          message.info('请先登录后再查看作业详情');
          navigate('/profile');
          return;
        }
        navigate(`/assignments/${assignment.id}`);
      }}>
        <div className="assignment-item-left">
          <div className="assignment-item-header">
            <Space wrap size={[5, 4]}>
              <Tag color="geekblue">{assignment.gradeName}</Tag>
              <Tag>{assignment.courseName}</Tag>
              <Tag color="purple">{assignmentTypeMap[assignment.assignmentType]}</Tag>
              <Tag color={assignment.difficulty === 'hard' ? 'red' : assignment.difficulty === 'medium' ? 'orange' : 'green'}>
                {difficultyMap[assignment.difficulty]}
              </Tag>
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

function AssignmentPage({ memberLevel }: { memberLevel: MemberLevel }) {
  const { id } = useParams();
  const [detail, setDetail] = useState<AssignmentDetail>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) getAssignmentDetail(id, memberLevel).then(setDetail);
  }, [id, memberLevel]);

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

function MembershipPage({ memberLevel, setMemberLevel }: { memberLevel: MemberLevel; setMemberLevel: (level: MemberLevel) => void }) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [buying, setBuying] = useState<MemberLevel>();
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
    if (level === 'free') {
      setMemberLevel('free');
      message.success('已切换到免费体验版');
      return;
    }

    setBuying(level);
    try {
      await createOrder(level);
      setMemberLevel(level);
      message.success('模拟支付成功，会员已生效');
    } finally {
      setBuying(undefined);
    }
  }

  return (
    <div>
      <Title>会员与付费</Title>
      <Paragraph>按学期付费，分别满足看懂方向、提升绩点、提升职业竞争力的不同需求。</Paragraph>
      <Row gutter={[16, 16]}>
        {plans.map((plan) => (
          <Col xs={24} md={8} key={plan.level} className="plan-card-column">
            <Card className={plan.level === memberLevel ? 'plan-card current-plan' : 'plan-card'} title={<Space><CrownOutlined />{plan.name}</Space>}>
              <div className="plan-card-content">
                <Title level={2}>{plan.price === 0 ? '免费' : `¥${plan.price}`}<Text className="price-period"> / {plan.period}</Text></Title>
                <Paragraph className="plan-tagline">{plan.tagline}</Paragraph>
                <List dataSource={plan.benefits} renderItem={(item) => <List.Item>✓ {item}</List.Item>} />
                <div className="plan-card-action">
                  <Button block type="primary" className="plan-action-button" loading={buying === plan.level} onClick={() => buy(plan.level)}>
                    {plan.level === memberLevel ? '当前版本' : plan.price === 0 ? '切换体验' : '模拟购买'}
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        ))}
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
  setMemberLevel,
  isLoggedIn,
  setIsLoggedIn
}: {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  memberLevel: MemberLevel;
  setMemberLevel: (level: MemberLevel) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState('profile');
  const navigate = useNavigate();

  function login(values: { phone: string; code: string }) {
    const matchedName = matchUserName(values.phone);
    setProfile({
      ...profile,
      phone: values.phone,
      nickname: profile.nickname && profile.nickname !== '未命名同学' ? profile.nickname : matchedName
    });
    setIsLoggedIn(true);
    setIsEditing(true);
    message.success(`登录成功，已为你匹配用户名：${matchedName}`);
    navigate('/');
  }

  function save(values: Profile) {
    setProfile({ ...profile, ...values });
    setIsEditing(false);
    message.success('个人信息已保存');
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
                  <Button type="primary" size="large" block htmlType="submit">立即登录 / 注册</Button>
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
                <Form layout="vertical" initialValues={profile} onFinish={(values) => save(values as Profile)}>
                  <Row gutter={[24, 18]}>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="nickname" label="用户名"><Input size="large" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="phone" label="手机号"><Input size="large" disabled /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="school" label="学校"><Input size="large" placeholder="请输入学校" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="major" label="专业"><Input size="large" placeholder="请输入专业" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item className="profile-form-item" name="grade" label="年级"><Select size="large" options={gradeOptions} /></Form.Item></Col>
                  </Row>
                  <div className="profile-section-actions">
                    <Button onClick={() => setIsEditing(false)}>取消编辑</Button>
                    <Button type="primary" htmlType="submit">保存资料</Button>
                  </div>
                </Form>
              </Space>
            )
          )}
          {activeProfileSection === 'membership' && (
            <Space direction="vertical" size={16} className="full-width">
              <ProfileInfoGrid
                items={[
                  { label: '当前版本', value: <Tag color={memberColors[memberLevel]}>{memberNames[memberLevel]}</Tag> },
                  { label: '付费周期', value: '按学期' },
                  { label: '状态', value: 'MVP 模拟生效中' }
                ]}
              />
              <div className="profile-section-actions">
                <Link to="/membership"><Button type="primary">升级会员</Button></Link>
                <Button onClick={() => setMemberLevel('free')}>重置为免费体验</Button>
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

function ConsultationPage({ profile }: { profile: Profile }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: Record<string, string>) {
    setSubmitting(true);
    try {
      await submitConsultationLead(values);
      form.resetFields();
      message.success('咨询意向已提交，我们会尽快联系你');
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
          <Paragraph>不只回答“该选哪条路”，而是结合你的课程基础、绩点目标、项目经历和家庭规划，拆出可执行的升学、留学、实习与职业发展方案。</Paragraph>
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
