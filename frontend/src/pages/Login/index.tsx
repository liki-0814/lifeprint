import React, { useState } from 'react'
import { Form, Input, Button, Card, message, Typography, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface LoginFormValues {
  username: string
  password: string
}

interface LoginResponseData {
  access_token: string
  token_type: string
  user: { id: string; username: string; email: string; created_at: string }
}

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      const response = await authApi.login(values)
      const data = response.data as LoginResponseData
      login(data.user, data.access_token)
      message.success('登录成功！')
      navigate('/')
    } catch {
      message.error('登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: '100%', maxWidth: 450, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              🌱
            </div>
            <Title level={3} style={{ margin: 0 }}>LifePrint</Title>
            <Text type="secondary" style={{ fontStyle: 'italic' }}>
              记录不是为了留住过去，而是为了理解未来
            </Text>
          </div>
          <Form name="login" onFinish={handleLogin} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block style={{ borderRadius: 8, height: 44, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                登录
              </Button>
            </Form.Item>
          </Form>
          <Text type="secondary">
            还没有账号？ <Link to="/register" style={{ color: '#667eea' }}>立即注册</Link>
          </Text>
        </Space>
      </Card>
    </div>
  )
}

export default LoginPage
