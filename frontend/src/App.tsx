import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ConfigProvider, Layout, Menu, Drawer, Grid } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  DashboardOutlined,
  UploadOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuOutlined,
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
const { useBreakpoint } = Grid

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/upload', icon: <UploadOutlined />, label: '上传记录' },
  { key: '/timeline', icon: <ClockCircleOutlined />, label: '成长时间轴' },
  { key: '/report', icon: <FileTextOutlined />, label: '成长报告' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
]

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [drawerVisible, setDrawerVisible] = useState(false)

  useEffect(() => {
    if (!isMobile) {
      setDrawerVisible(false)
    }
  }, [isMobile])

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

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    setDrawerVisible(false)
  }

  const siderMenu = (
    <>
      <div style={{ height: 48, margin: 16, display: 'flex', alignItems: 'center', fontSize: 18, fontWeight: 'bold', color: '#667eea' }}>
        🌱 LifePrint
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          width={220}
          styles={{ body: { padding: 0 } }}
        >
          {siderMenu}
        </Drawer>
      ) : (
        <Sider theme="light" width={200}>
          {siderMenu}
        </Sider>
      )}
      <Layout>
        <Header style={{
          background: '#fff',
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <MenuOutlined
                onClick={() => setDrawerVisible(true)}
                style={{ fontSize: 18, cursor: 'pointer' }}
              />
            )}
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 500 }}>
              {isMobile ? 'LifePrint' : '儿童成长记录平台'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            {isAuthenticated && !isMobile && <span>欢迎，{user?.username}</span>}
            {isAuthenticated && (
              <LogoutOutlined
                onClick={() => { logout(); navigate('/login') }}
                style={{ cursor: 'pointer', fontSize: 16 }}
              />
            )}
          </div>
        </Header>
        <Content style={{
          margin: isMobile ? 8 : 24,
          padding: isMobile ? 12 : 24,
          background: '#fff',
          borderRadius: 8,
          minHeight: 280,
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/report" element={<Report />} />
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
