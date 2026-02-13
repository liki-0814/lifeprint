import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Tag, Typography, Space, Select, Spin, Button, Grid, message,
} from 'antd'
import {
  PlayCircleOutlined, PictureOutlined, TrophyOutlined,
  FileTextOutlined, StarFilled,
  ThunderboltOutlined, FileSearchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import apiClient, { reportApi, analysisApi } from '@/services/api'

const { Title, Text, Paragraph } = Typography
const { useBreakpoint } = Grid

interface TimelineMediaItem {
  id: string
  original_filename: string
  file_type: string
  uploaded_at: string
  analysis_status: string
}

interface ChildOption {
  id: string
  name: string
  birth_date: string
}

interface MilestoneEvent {
  date: string
  title: string
  description: string
  type: 'milestone' | 'media' | 'report'
  icon: React.ReactNode
  color: string
  mediaItems?: TimelineMediaItem[]
  mediaCount?: number
}

const TimelinePage: React.FC = () => {
  const [mediaList, setMediaList] = useState<TimelineMediaItem[]>([])
  const [children, setChildren] = useState<ChildOption[]>([])
  const [selectedChild, setSelectedChild] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [_familyId, setFamilyId] = useState<string | null>(null)
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const familyRes = await apiClient.get('/families/mine').catch(() => null)
      if (familyRes?.data?.id) {
        setFamilyId(familyRes.data.id)
        const [childRes, mediaRes] = await Promise.all([
          apiClient.get(`/children/families/${familyRes.data.id}/children`).catch(() => ({ data: [] })),
          apiClient.get(`/media/families/${familyRes.data.id}/media?page_size=100`).catch(() => ({ data: [] })),
        ])
        setChildren(Array.isArray(childRes.data) ? childRes.data : [])
        setMediaList(Array.isArray(mediaRes.data) ? mediaRes.data : [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenerateReport = async () => {
    const childId = selectedChild || children[0]?.id
    if (!childId) { message.warning('请先添加孩子'); return }
    setGeneratingReport(true)
    try {
      await reportApi.generate(childId)
      message.success('成长报告生成中，请稍后查看！')
      navigate(`/report/${childId}`)
    } catch {
      message.error('生成报告失败，请重试')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleAnalyze = async (mediaId: string) => {
    try {
      await analysisApi.reanalyze(mediaId)
      message.success('已触发分析')
      await fetchData()
    } catch {
      message.error('触发分析失败')
    }
  }

  const buildMilestones = useCallback((): MilestoneEvent[] => {
    const events: MilestoneEvent[] = []

    const groupedByMonth = mediaList.reduce<Record<string, TimelineMediaItem[]>>((groups, item) => {
      const monthKey = new Date(item.uploaded_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
      if (!groups[monthKey]) groups[monthKey] = []
      groups[monthKey].push(item)
      return groups
    }, {})

    const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
      const dateA = new Date(groupedByMonth[a][0].uploaded_at)
      const dateB = new Date(groupedByMonth[b][0].uploaded_at)
      return dateB.getTime() - dateA.getTime()
    })

    sortedMonths.forEach((month, monthIndex) => {
      const items = groupedByMonth[month]
      const completedCount = items.filter(m => m.analysis_status === 'completed').length
      const videoCount = items.filter(m => m.file_type === 'video').length
      const imageCount = items.filter(m => m.file_type === 'image').length

      const isMilestone = items.length >= 3 || completedCount >= 2 || monthIndex === 0

      if (isMilestone) {
        events.push({
          date: month,
          title: monthIndex === 0 ? `${month} · 最新动态` : `${month} · 成长里程碑`,
          description: `上传 ${items.length} 条记录（${videoCount} 个视频，${imageCount} 张图片），完成 ${completedCount} 项 AI 分析`,
          type: 'milestone',
          icon: monthIndex === 0 ? <ThunderboltOutlined /> : <TrophyOutlined />,
          color: monthIndex === 0 ? '#ff9a56' : '#ffd93d',
          mediaItems: items,
          mediaCount: items.length,
        })
      } else {
        events.push({
          date: month,
          title: month,
          description: `${items.length} 条记录`,
          type: 'media',
          icon: <StarFilled />,
          color: '#d9d9d9',
          mediaItems: items,
          mediaCount: items.length,
        })
      }
    })

    return events
  }, [mediaList])

  const milestones = buildMilestones()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* 标题区 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Title level={isMobile ? 4 : 3} style={{
            margin: 0,
            background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            📜 成长进化史
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            不只是流水账，而是宝宝的进化里程碑
          </Text>
        </div>
        <Space wrap>
          <Select
            allowClear
            placeholder="筛选孩子"
            style={{ width: 140, borderRadius: 8 }}
            value={selectedChild}
            onChange={setSelectedChild}
            options={children.map(c => ({ label: c.name, value: c.id }))}
          />
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            loading={generatingReport}
            onClick={handleGenerateReport}
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
              border: 'none',
            }}
          >
            生成本月成长报告
          </Button>
        </Space>
      </div>

      {/* 月度报告快捷入口 */}
      <Card
        style={{
          borderRadius: 16, marginBottom: 20,
          background: 'linear-gradient(135deg, #fff5eb, #ffe8d6)',
          border: '1px solid rgba(255,154,86,0.2)',
        }}
        styles={{ body: { padding: isMobile ? 14 : 20 } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FileSearchOutlined style={{ fontSize: 22, color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 15, color: '#5a3e28' }}>📝 月度成长报告</Text>
            <div style={{ fontSize: 13, color: '#8b7355', marginTop: 2 }}>
              AI 自动汇总本月的成长数据，生成专业的成长叙事报告
            </div>
          </div>
          <Space>
            {children.length > 0 && (
              <Tag color="orange" style={{ borderRadius: 10, fontSize: 12 }}>
                {children.length} 个孩子
              </Tag>
            )}
            <Tag color="volcano" style={{ borderRadius: 10, fontSize: 12 }}>
              {mediaList.filter(m => m.analysis_status === 'completed').length} 项已分析
            </Tag>
            <Button
              type="primary"
              size="small"
              icon={<FileTextOutlined />}
              loading={generatingReport}
              onClick={handleGenerateReport}
              style={{
                borderRadius: 8,
                background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
                border: 'none',
              }}
            >
              生成报告
            </Button>
          </Space>
        </div>
      </Card>

      {/* 里程碑时间线 */}
      <Spin spinning={loading}>
        {milestones.length === 0 ? (
          <Card style={{
            borderRadius: 16, textAlign: 'center', padding: '60px 20px',
            background: 'linear-gradient(160deg, #fffaf5, #fff3e6)',
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📜</div>
            <Title level={4}>开始书写进化史</Title>
            <Paragraph type="secondary">上传宝宝的视频和照片，AI 将自动标记里程碑事件</Paragraph>
            <Button
              type="primary"
              onClick={() => navigate('/upload')}
              style={{ borderRadius: 10, background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)', border: 'none' }}
            >
              去上传第一段记录
            </Button>
          </Card>
        ) : (
          <div style={{ position: 'relative', paddingLeft: isMobile ? 28 : 40 }}>
            {/* 时间线竖线 */}
            <div style={{
              position: 'absolute', left: isMobile ? 11 : 15, top: 0, bottom: 0,
              width: 2, background: 'linear-gradient(180deg, #ff9a56, #ff7eb3, #e8ddd4)',
            }} />

            {milestones.map((milestone, index) => (
              <div key={index} style={{ position: 'relative', marginBottom: 20 }}>
                {/* 时间线节点 */}
                <div style={{
                  position: 'absolute',
                  left: isMobile ? -28 : -40,
                  top: 16,
                  width: milestone.type === 'milestone' ? 28 : 20,
                  height: milestone.type === 'milestone' ? 28 : 20,
                  borderRadius: '50%',
                  background: milestone.type === 'milestone'
                    ? `linear-gradient(135deg, ${milestone.color}, ${milestone.color}cc)`
                    : '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: milestone.type === 'milestone' ? '#fff' : '#999',
                  fontSize: milestone.type === 'milestone' ? 14 : 10,
                  boxShadow: milestone.type === 'milestone' ? `0 0 12px ${milestone.color}40` : 'none',
                  border: milestone.type === 'milestone' ? 'none' : '2px solid #e8e8e8',
                  marginLeft: milestone.type === 'milestone' ? 0 : 4,
                  marginTop: milestone.type === 'milestone' ? 0 : 4,
                }}>
                  {milestone.type === 'milestone' && milestone.icon}
                </div>

                {/* 里程碑卡片 */}
                <Card
                  hoverable
                  style={{
                    borderRadius: 14,
                    border: milestone.type === 'milestone' ? `1px solid ${milestone.color}30` : '1px solid #f0f0f0',
                    background: milestone.type === 'milestone'
                      ? `linear-gradient(135deg, ${milestone.color}08, ${milestone.color}03)`
                      : '#fff',
                  }}
                  styles={{ body: { padding: isMobile ? 14 : 18 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <Text strong style={{
                        fontSize: milestone.type === 'milestone' ? 15 : 13,
                        color: milestone.type === 'milestone' ? '#5a3e28' : '#8b7355',
                      }}>
                        {milestone.title}
                      </Text>
                      {milestone.type === 'milestone' && (
                        <Tag color="gold" style={{ marginLeft: 8, borderRadius: 8, fontSize: 11 }}>里程碑</Tag>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{milestone.mediaCount} 条</Text>
                  </div>

                  <Paragraph style={{ fontSize: 13, color: '#8b7355', margin: '0 0 10px' }}>
                    {milestone.description}
                  </Paragraph>

                  {/* 媒体文件列表 */}
                  {milestone.mediaItems && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {milestone.mediaItems.slice(0, 6).map(item => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 10px', borderRadius: 8,
                            background: '#fdf6f0', fontSize: 12,
                            flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto',
                            minWidth: 0,
                          }}
                        >
                          {item.file_type === 'video'
                            ? <PlayCircleOutlined style={{ color: '#ff9a56', flexShrink: 0 }} />
                            : <PictureOutlined style={{ color: '#f5576c', flexShrink: 0 }} />
                          }
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.original_filename}
                          </span>
                          {item.analysis_status === 'completed' ? (
                            <Tag color="success" style={{ fontSize: 10, margin: 0, flexShrink: 0 }}>已分析</Tag>
                          ) : item.analysis_status === 'pending' ? (
                            <Button
                              type="link" size="small"
                              style={{ padding: 0, fontSize: 11, flexShrink: 0 }}
                              onClick={() => handleAnalyze(item.id)}
                            >
                              分析
                            </Button>
                          ) : (
                            <Tag color="processing" style={{ fontSize: 10, margin: 0, flexShrink: 0 }}>
                              {item.analysis_status === 'processing' ? '分析中' : '失败'}
                            </Tag>
                          )}
                        </div>
                      ))}
                      {milestone.mediaItems && milestone.mediaItems.length > 6 && (
                        <div style={{
                          padding: '6px 10px', borderRadius: 8,
                          background: '#fff3e6', fontSize: 12, color: '#ff9a56',
                        }}>
                          +{milestone.mediaItems.length - 6} 更多
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}

export default TimelinePage
