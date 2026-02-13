import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, List, Tag, Button, Typography, Space, Empty } from 'antd'
import { UploadOutlined, FileTextOutlined, ClockCircleOutlined, HeartOutlined, PictureOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import apiClient from '@/services/api'

const { Title } = Typography

interface MediaItem {
  id: string
  original_filename: string
  file_type: string
  uploaded_at: string
  analysis_status: string
}

interface ChildItem {
  id: string
  name: string
}

const DashboardPage: React.FC = () => {
  const [recentMedia, setRecentMedia] = useState<MediaItem[]>([])
  const [children, setChildren] = useState<ChildItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const familyRes = await apiClient.get('/families/mine').catch(() => null)
        if (familyRes?.data?.id) {
          const [childRes, mediaRes] = await Promise.all([
            apiClient.get(`/children/families/${familyRes.data.id}/children`).catch(() => ({ data: [] })),
            apiClient.get(`/media/families/${familyRes.data.id}/media?page_size=8`).catch(() => ({ data: [] })),
          ])
          setChildren(Array.isArray(childRes.data) ? childRes.data : [])
          setRecentMedia(Array.isArray(mediaRes.data) ? mediaRes.data : [])
        }
      } catch {
        /* 首次使用可能没有家庭数据 */
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const analysisCompleted = recentMedia.filter(m => m.analysis_status === 'completed').length

  const statusTagColor: Record<string, string> = {
    pending: 'default',
    processing: 'processing',
    completed: 'success',
    failed: 'error',
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>🏠 欢迎回来</Title>
        <Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/upload')}>上传媒体</Button>
          <Button icon={<ClockCircleOutlined />} onClick={() => navigate('/timeline')}>时间线</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>孩子数量</span>} value={children.length} prefix={<HeartOutlined />} valueStyle={{ color: '#fff', fontSize: 32 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>媒体总数</span>} value={recentMedia.length} prefix={<PictureOutlined />} valueStyle={{ color: '#fff', fontSize: 32 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>分析完成</span>} value={analysisCompleted} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#fff', fontSize: 32 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>孩子报告</span>} value={children.length} prefix={<FileTextOutlined />} valueStyle={{ color: '#fff', fontSize: 32 }} />
          </Card>
        </Col>
      </Row>

      <Card title="最近上传" style={{ borderRadius: 12 }} loading={loading}>
        {recentMedia.length === 0 ? (
          <Empty description="暂无上传记录，快去上传第一个文件吧！" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
            dataSource={recentMedia}
            renderItem={(item) => (
              <List.Item>
                <Card hoverable style={{ borderRadius: 8 }}>
                  <Card.Meta
                    title={<div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.original_filename}</div>}
                    description={
                      <Space direction="vertical" size={4}>
                        <span style={{ fontSize: 12, color: '#999' }}>{new Date(item.uploaded_at).toLocaleString('zh-CN')}</span>
                        <Tag color={statusTagColor[item.analysis_status] || 'default'}>{item.analysis_status === 'completed' ? '已分析' : item.analysis_status === 'processing' ? '分析中' : item.analysis_status === 'failed' ? '失败' : '待分析'}</Tag>
                      </Space>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  )
}

export default DashboardPage
