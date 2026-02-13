import React, { useState } from 'react'
import { Form, Input, Button, Card, message, Typography, Space } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface RegisterFormValues {
  username: string
  email: string
  password: string
  confirmPassword: string
}

interface RegisterResponseData {
  access_token: string
  token_type: string
  user: { id: string; username: string; email: string; created_at: string }
}

const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { register: storeRegister } = useAuthStore()

  const handleRegister = async (values: RegisterFormValues) => {
    setLoading(true)
    try {
      const response = await authApi.register({
        username: values.username,
        email: values.email,
        password: values.password,
      })
      const data = response.data as RegisterResponseData
      storeRegister(data.user, data.access_token)
      message.success('注册成功！请配置您的 API Key')
      navigate('/settings')
    } catch {
      message.error('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: '100%', maxWidth: 450, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>创建账号</Title>
            <Text type="secondary">加入 LifePrint，开始记录美好时光</Text>
          </div>
          <Form name="register" onFinish={handleRegister} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '用户名至少3个字符' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="邮箱" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6个字符' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="confirmPassword" dependencies={['password']} rules={[{ required: true, message: '请确认密码' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error('两次密码不一致')); } })]}>
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block style={{ borderRadius: 8, height: 44, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                注册
              </Button>
            </Form.Item>
          </Form>
          <Text type="secondary">
            已有账号？ <Link to="/login" style={{ color: '#667eea' }}>立即登录</Link>
          </Text>
        </Space>
      </Card>
    </div>
  )
}

export default RegisterPage
