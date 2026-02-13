import React, { useState, useEffect } from 'react'
import { Timeline as AntTimeline, Card, Tag, Typography, Space, Select, DatePicker, Empty, Spin } from 'antd'
import { PlayCircleOutlined, PictureOutlined, AudioOutlined } from '@ant-design/icons'
import apiClient from '@/services/api'

const { Title, Text } = Typography

interface TimelineMediaItem {
  id: string
  original_filename: string
  file_type: string
  uploaded_at: string
  analysis_status: string
  thumbnail_url?: string
}

interface ChildOption {
  id: string
  name: string
}

const fileTypeIcon: Record<string, React.ReactNode> = {
  video: <PlayCircleOutlined style={{ color: '#667eea' }} />,
  image: <PictureOutlined style={{ color: '#f5576c' }} />,
  audio: <AudioOutlined style={{ color: '#43e97b' }} />,
}

const TimelinePage: React.FC = () => {
  const [mediaList, setMediaList] = useState<TimelineMediaItem[]>([])
  const [children, setChildren] = useState<ChildOption[]>([])
  const [selectedChild, setSelectedChild] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const familyRes = await apiClient.get('/families/mine').catch(() => null)
        if (familyRes?.data?.id) {
          const [childRes, mediaRes] = await Promise.all([
            apiClient.get(`/children/families/${familyRes.data.id}/children`).catch(() => ({ data: [] })),
            apiClient.get(`/media/families/${familyRes.data.id}/media?page_size=50`).catch(() => ({ data: [] })),
          ])
          setChildren(Array.isArray(childRes.data) ? childRes.data : [])
          setMediaList(Array.isArray(mediaRes.data) ? mediaRes.data : [])
        }
      } catch {
        /* 首次使用可能没有数据 */
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredMedia = selectedChild
    ? mediaList.filter(() => true)
    : mediaList

  const groupedByDate = filteredMedia.reduce<Record<string, TimelineMediaItem[]>>((groups, item) => {
    const date = new Date(item.uploaded_at).toLocaleDateString('zh-CN')
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
    return groups
  }, {})

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>📅 成长时间轴</Title>
        <Space>
          <Select allowClear placeholder="筛选孩子" style={{ width: 150 }} value={selectedChild} onChange={setSelectedChild} options={children.map(c => ({ label: c.name, value: c.id }))} />
          <DatePicker.RangePicker style={{ borderRadius: 8 }} />
        </Space>
      </div>

      <Spin spinning={loading}>
        {sortedDates.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
            <Empty description="暂无成长记录" />
          </Card>
        ) : (
          <AntTimeline mode="left">
            {sortedDates.map(date => (
              <AntTimeline.Item key={date} label={<Text strong style={{ fontSize: 14 }}>{date}</Text>}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {groupedByDate[date].map(item => (
                    <Card key={item.id} size="small" hoverable style={{ borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 24 }}>{fileTypeIcon[item.file_type] || <PictureOutlined />}</div>
                        <div style={{ flex: 1 }}>
                          <Text strong style={{ display: 'block' }}>{item.original_filename}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.uploaded_at).toLocaleTimeString('zh-CN')}</Text>
                        </div>
                        <Tag color={item.analysis_status === 'completed' ? 'success' : item.analysis_status === 'processing' ? 'processing' : 'default'}>
                          {item.analysis_status === 'completed' ? '已分析' : item.analysis_status === 'processing' ? '分析中' : '待分析'}
                        </Tag>
                      </div>
                    </Card>
                  ))}
                </Space>
              </AntTimeline.Item>
            ))}
          </AntTimeline>
        )}
      </Spin>
    </Space>
  )
}

export default TimelinePage
