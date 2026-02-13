import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ConfigProvider, Layout, Menu } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  DashboardOutlined,
  UploadOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Upload from './pages/Upload'
import Timeline from './pages/Timeline'
import Report from './pages/Report'
import SkillTree from './pages/SkillTree'
import Compare from './pages/Compare'
import Settings from './pages/Settings'
import { useAuthStore } from './stores/authStore'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/upload', icon: <UploadOutlined />, label: '上传记录' },
  { key: '/timeline', icon: <ClockCircleOutlined />, label: '成长时间轴' },
  { key: '/compare', icon: <SwapOutlined />, label: '成长对比' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
]

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuthStore()

  const isAuthPage = ['/login', '/register'].includes(location.pathname)

  if (!isAuthenticated && !isAuthPage) {
    return <Navigate to="/register" replace />
  }

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div style={{ height: 48, margin: 16, display: 'flex', alignItems: 'center', fontSize: 18, fontWeight: 'bold', color: '#667eea' }}>
          🌱 LifePrint
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>儿童成长记录平台</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isAuthenticated && <span>欢迎，{user?.username}</span>}
            {isAuthenticated ? (
              <LogoutOutlined onClick={() => { logout(); navigate('/login') }} style={{ cursor: 'pointer', fontSize: 16 }} />
            ) : (
              <a onClick={() => navigate('/login')}>登录</a>
            )}
          </div>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/report/:childId" element={<Report />} />
            <Route path="/skills/:childId" element={<SkillTree />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

const App: React.FC = () => (
  <ConfigProvider locale={zhCN}>
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  </ConfigProvider>
)

export default App
