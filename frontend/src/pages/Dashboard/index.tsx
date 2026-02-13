import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Row, Col, Button, Typography, Space,
  Modal, Form, Input, DatePicker, Select, message, Avatar, Grid, Tag, Tooltip,
} from 'antd'
import {
  UploadOutlined, PlusOutlined, UserOutlined,
  ManOutlined, WomanOutlined, TrophyOutlined,
  ThunderboltOutlined, ExperimentOutlined, SoundOutlined,
  SmileOutlined, CompassOutlined, EyeOutlined,
  StarFilled, RocketOutlined, BulbOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import apiClient, { childApi, analysisApi } from '@/services/api'

echarts.use([RadarChart, TooltipComponent, LegendComponent, CanvasRenderer])

const { Title, Text, Paragraph } = Typography
const { useBreakpoint } = Grid

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
  gender: string
  birth_date: string
  avatar_url?: string
}

interface TraitBadge {
  name: string
  level: number
  category: string
  unlockedAt: string
  icon: React.ReactNode
  color: string
  mediaId?: string
}

interface InsightCard {
  title: string
  description: string
  type: 'growth' | 'milestone' | 'comparison'
  icon: React.ReactNode
}

const DIMENSION_LABELS = ['专注力', '创造力', '运动能力', '语言能力', '情绪管理', '探索欲']

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  '专注力': <EyeOutlined />,
  '创造力': <BulbOutlined />,
  '运动能力': <ThunderboltOutlined />,
  '语言能力': <SoundOutlined />,
  '情绪管理': <SmileOutlined />,
  '探索欲': <CompassOutlined />,
}

const BADGE_COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#ffd93d', '#ff6b6b', '#a29bfe', '#fd79a8']

const genderColors: Record<string, string> = {
  male: '#4facfe',
  female: '#f093fb',
  other: '#43e97b',
}

const DashboardPage: React.FC = () => {
  const [recentMedia, setRecentMedia] = useState<MediaItem[]>([])
  const [children, setChildren] = useState<ChildItem[]>([])
  const [selectedChild, setSelectedChild] = useState<ChildItem | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [_loading, setLoading] = useState(true)
  const [createChildOpen, setCreateChildOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [radarData, setRadarData] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [traitBadges, setTraitBadges] = useState<TraitBadge[]>([])
  const [insights, setInsights] = useState<InsightCard[]>([])
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState<TraitBadge | null>(null)
  const [childForm] = Form.useForm()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const computeRecordDays = useCallback(() => {
    if (recentMedia.length === 0) return 0
    const dates = recentMedia.map(m => new Date(m.uploaded_at).getTime())
    const earliest = Math.min(...dates)
    return Math.max(1, Math.ceil((Date.now() - earliest) / (1000 * 60 * 60 * 24)))
  }, [recentMedia])

  const buildTraitBadges = useCallback((analysisResults: Array<{ analysis_type: string; result_data: Record<string, unknown>; analyzed_at: string; media_id: string }>) => {
    const traitMap = new Map<string, { count: number; latestDate: string; mediaId: string }>()

    for (const result of analysisResults) {
      const data = result.result_data
      const traits = (data?.traits as string[]) || (data?.tags as string[]) || (data?.labels as string[]) || []
      for (const trait of traits) {
        const existing = traitMap.get(trait)
        if (existing) {
          existing.count += 1
          if (result.analyzed_at > existing.latestDate) {
            existing.latestDate = result.analyzed_at
            existing.mediaId = result.media_id
          }
        } else {
          traitMap.set(trait, { count: 1, latestDate: result.analyzed_at, mediaId: result.media_id })
        }
      }
    }

    const badges: TraitBadge[] = []
    let colorIndex = 0
    traitMap.forEach((value, traitName) => {
      const level = Math.min(5, Math.ceil(value.count / 2))
      const categoryMap: Record<string, string> = {
        '专注': '专注力', '认真': '专注力', '集中': '专注力',
        '创造': '创造力', '想象': '创造力', '积木': '创造力', '画画': '创造力',
        '跑': '运动能力', '跳': '运动能力', '爬': '运动能力', '走': '运动能力',
        '说话': '语言能力', '唱歌': '语言能力', '模仿': '语言能力',
        '开心': '情绪管理', '平静': '情绪管理', '笑': '情绪管理',
        '好奇': '探索欲', '探索': '探索欲', '观察': '探索欲',
      }
      let category = '探索欲'
      for (const [keyword, cat] of Object.entries(categoryMap)) {
        if (traitName.includes(keyword)) { category = cat; break }
      }

      badges.push({
        name: traitName,
        level,
        category,
        unlockedAt: new Date(value.latestDate).toLocaleDateString('zh-CN'),
        icon: DIMENSION_ICONS[category] || <StarFilled />,
        color: BADGE_COLORS[colorIndex % BADGE_COLORS.length],
        mediaId: value.mediaId,
      })
      colorIndex++
    })

    return badges
  }, [])

  const buildRadarFromBadges = useCallback((badges: TraitBadge[]) => {
    const dimensionScores: Record<string, number> = {}
    for (const label of DIMENSION_LABELS) dimensionScores[label] = 0

    for (const badge of badges) {
      if (dimensionScores[badge.category] !== undefined) {
        dimensionScores[badge.category] += badge.level
      }
    }

    const maxScore = Math.max(1, ...Object.values(dimensionScores))
    return DIMENSION_LABELS.map(label =>
      Math.min(100, Math.round((dimensionScores[label] / maxScore) * 100))
    )
  }, [])

  const buildInsights = useCallback((badges: TraitBadge[], mediaCount: number, recordDays: number): InsightCard[] => {
    const insightCards: InsightCard[] = []

    if (badges.length > 0) {
      const topBadge = badges.reduce((prev, curr) => curr.level > prev.level ? curr : prev, badges[0])
      insightCards.push({
        title: '🌟 突出特质发现',
        description: `宝宝在「${topBadge.name}」方面表现突出，已达到 Lv.${topBadge.level}！这个特质在多段视频中被反复识别。`,
        type: 'milestone',
        icon: <TrophyOutlined style={{ color: '#ffd93d' }} />,
      })
    }

    if (recordDays > 0) {
      insightCards.push({
        title: '📈 成长轨迹',
        description: `累计记录成长 ${recordDays} 天，共上传 ${mediaCount} 段珍贵记忆，识别出 ${badges.length} 个独特特质。`,
        type: 'growth',
        icon: <RocketOutlined style={{ color: '#4facfe' }} />,
      })
    }

    if (badges.length >= 3) {
      const categories = [...new Set(badges.map(b => b.category))]
      insightCards.push({
        title: '🎯 多维发展',
        description: `宝宝已在 ${categories.length} 个维度展现天赋：${categories.slice(0, 3).join('、')}${categories.length > 3 ? '等' : ''}。全面发展中！`,
        type: 'comparison',
        icon: <ExperimentOutlined style={{ color: '#43e97b' }} />,
      })
    }

    if (insightCards.length === 0) {
      insightCards.push({
        title: '🚀 开始探索',
        description: '上传宝宝的视频或照片，AI 将自动识别成长特质，为你绘制专属的成长画像！',
        type: 'growth',
        icon: <RocketOutlined style={{ color: '#667eea' }} />,
      })
    }

    return insightCards
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const familyRes = await apiClient.get('/families/mine').catch(() => null)
      if (familyRes?.data?.id) {
        setFamilyId(familyRes.data.id)
        const [childRes, mediaRes] = await Promise.all([
          apiClient.get(`/children/families/${familyRes.data.id}/children`).catch(() => ({ data: [] })),
          apiClient.get(`/media/families/${familyRes.data.id}/media?page_size=50`).catch(() => ({ data: [] })),
        ])
        const childrenData: ChildItem[] = Array.isArray(childRes.data) ? childRes.data : []
        const mediaData: MediaItem[] = Array.isArray(mediaRes.data) ? mediaRes.data : []
        setChildren(childrenData)
        setRecentMedia(mediaData)

        if (childrenData.length > 0) {
          const firstChild = childrenData[0]
          setSelectedChild(firstChild)

          const analysisResults: Array<{ analysis_type: string; result_data: Record<string, unknown>; analyzed_at: string; media_id: string }> = []
          const completedMedia = mediaData.filter(m => m.analysis_status === 'completed')
          const fetchPromises = completedMedia.slice(0, 20).map(media =>
            analysisApi.getResults(media.id).catch(() => ({ data: [] }))
          )
          const resultsArray = await Promise.all(fetchPromises)
          for (const res of resultsArray) {
            if (Array.isArray(res.data)) {
              analysisResults.push(...res.data)
            }
          }

          const badges = buildTraitBadges(analysisResults)
          setTraitBadges(badges)
          setRadarData(buildRadarFromBadges(badges))
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [buildTraitBadges, buildRadarFromBadges])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const recordDays = computeRecordDays()
    setInsights(buildInsights(traitBadges, recentMedia.length, recordDays))
  }, [traitBadges, recentMedia, computeRecordDays, buildInsights])

  const ensureFamilyId = async (): Promise<string | null> => {
    if (familyId) return familyId
    try {
      const res = await apiClient.get('/families/mine')
      if (res.data?.id) { setFamilyId(res.data.id); return res.data.id }
    } catch { message.error('获取家庭信息失败') }
    return null
  }

  const handleCreateChild = async () => {
    try {
      const values = await childForm.validateFields()
      setSubmitting(true)
      const currentFamilyId = await ensureFamilyId()
      if (!currentFamilyId) { message.error('无法获取家庭信息，请重试'); return }
      await childApi.create(currentFamilyId, {
        name: values.childName,
        birth_date: values.birthDate.format('YYYY-MM-DD'),
        gender: values.gender,
      })
      message.success('孩子添加成功！')
      setCreateChildOpen(false)
      childForm.resetFields()
      await fetchData()
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error('添加孩子失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBadgeClick = (badge: TraitBadge) => {
    setSelectedBadge(badge)
    setEvidenceModalOpen(true)
  }

  const getAgeText = (birthDate: string) => {
    const birth = new Date(birthDate)
    const ageInMonths = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    return ageInMonths >= 12
      ? `${Math.floor(ageInMonths / 12)}岁${ageInMonths % 12 > 0 ? `${ageInMonths % 12}个月` : ''}`
      : `${ageInMonths}个月`
  }

  const radarChartOption = {
    tooltip: {},
    radar: {
      indicator: DIMENSION_LABELS.map(label => ({ name: label, max: 100 })),
      shape: 'polygon' as const,
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: isMobile ? 11 : 13,
        fontWeight: 500,
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(255, 154, 86, 0.05)', 'rgba(255, 154, 86, 0.1)', 'rgba(255, 154, 86, 0.15)', 'rgba(255, 154, 86, 0.2)'],
        },
      },
      splitLine: { lineStyle: { color: 'rgba(255, 154, 86, 0.2)' } },
      axisLine: { lineStyle: { color: 'rgba(255, 154, 86, 0.3)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: radarData,
        name: selectedChild?.name || '宝宝',
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 154, 86, 0.5)' },
            { offset: 1, color: 'rgba(255, 107, 107, 0.15)' },
          ]),
        },
        lineStyle: { color: '#ff9a56', width: 2 },
        itemStyle: { color: '#ff9a56' },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
  }

  const recordDays = computeRecordDays()

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={isMobile ? 4 : 3} style={{ margin: 0, background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ⚔️ 成长角色面板
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>AI 驱动的儿童成长特质解码系统</Text>
        </div>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateChildOpen(true)}
            style={{ background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)', border: 'none', borderRadius: 8 }}>
            添加孩子
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => navigate('/upload')} style={{ borderRadius: 8 }}>上传鉴定</Button>
        </Space>
      </div>

      {/* 孩子选择器（多孩子时显示） */}
      {children.length > 1 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {children.map(child => (
            <Card
              key={child.id}
              hoverable
              size="small"
              onClick={() => setSelectedChild(child)}
              style={{
                borderRadius: 12,
                minWidth: 120,
                textAlign: 'center',
                border: selectedChild?.id === child.id ? '2px solid #ff9a56' : '1px solid #f0f0f0',
                background: selectedChild?.id === child.id ? 'linear-gradient(135deg, rgba(255,154,86,0.08), rgba(255,107,107,0.08))' : '#fff',
              }}
            >
              <Avatar
                size={40}
                style={{ background: genderColors[child.gender] || '#999', marginBottom: 4 }}
                icon={child.gender === 'male' ? <ManOutlined /> : child.gender === 'female' ? <WomanOutlined /> : <UserOutlined />}
              />
              <div><Text strong style={{ fontSize: 13 }}>{child.name}</Text></div>
              <Text type="secondary" style={{ fontSize: 11 }}>{getAgeText(child.birth_date)}</Text>
            </Card>
          ))}
        </div>
      )}

      {/* 核心区域：数字孪生 + 雷达图 */}
      {selectedChild ? (
        <Row gutter={[16, 16]}>
          {/* 左侧：孩子数字孪生 */}
          <Col xs={24} md={10}>
            <Card
              style={{
                borderRadius: 16,
                background: 'linear-gradient(160deg, #fff5eb 0%, #ffe8d6 50%, #ffd4b8 100%)',
                border: 'none',
                overflow: 'hidden',
                position: 'relative',
              }}
              styles={{ body: { padding: isMobile ? 20 : 28 } }}
            >
              {/* 装饰性光效 */}
              <div style={{
                position: 'absolute', top: -40, right: -40, width: 120, height: 120,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,154,86,0.2), transparent)',
              }} />
              <div style={{
                position: 'absolute', bottom: -30, left: -30, width: 80, height: 80,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,107,0.15), transparent)',
              }} />

              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: isMobile ? 80 : 100, height: isMobile ? 80 : 100,
                  borderRadius: '50%', margin: '0 auto 16px',
                  background: `linear-gradient(135deg, ${genderColors[selectedChild.gender]}, ${selectedChild.gender === 'male' ? '#00f2fe' : '#f5576c'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 30px ${genderColors[selectedChild.gender]}60`,
                  border: '3px solid rgba(255,255,255,0.2)',
                }}>
                  {selectedChild.gender === 'male'
                    ? <ManOutlined style={{ fontSize: isMobile ? 36 : 44, color: '#5a3e28' }} />
                    : selectedChild.gender === 'female'
                      ? <WomanOutlined style={{ fontSize: isMobile ? 36 : 44, color: '#5a3e28' }} />
                      : <UserOutlined style={{ fontSize: isMobile ? 36 : 44, color: '#5a3e28' }} />
                  }
                </div>

                <Title level={4} style={{ color: '#5a3e28', margin: '0 0 4px' }}>{selectedChild.name}</Title>
                <Tag color="purple" style={{ borderRadius: 12, fontSize: 12 }}>
                  {getAgeText(selectedChild.birth_date)}
                </Tag>

                <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 16 : 28, marginTop: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#ff9a56' }}>{recordDays}</div>
                    <div style={{ fontSize: 11, color: '#8b7355' }}>记录天数</div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(139,115,85,0.15)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#ff6b6b' }}>{recentMedia.length}</div>
                    <div style={{ fontSize: 11, color: '#8b7355' }}>珍贵记忆</div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(139,115,85,0.15)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#43e97b' }}>{traitBadges.length}</div>
                    <div style={{ fontSize: 11, color: '#8b7355' }}>识别特质</div>
                  </div>
                </div>

                <Button
                  type="primary" ghost size="small"
                  style={{ marginTop: 16, borderRadius: 16, borderColor: 'rgba(139,115,85,0.3)', color: '#5a3e28' }}
                  onClick={() => navigate(`/report/${selectedChild.id}`)}
                >
                  查看成长报告 →
                </Button>
              </div>
            </Card>
          </Col>

          {/* 右侧：六维雷达图 */}
          <Col xs={24} md={14}>
            <Card
              title={<span>🎯 六维能力雷达</span>}
              style={{ borderRadius: 16, height: '100%' }}
              styles={{ body: { padding: isMobile ? 8 : 16 } }}
            >
              {traitBadges.length > 0 ? (
                <ReactEChartsCore
                  echarts={echarts}
                  option={radarChartOption}
                  style={{ height: isMobile ? 260 : 300 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <ExperimentOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                  <Paragraph type="secondary">
                    上传宝宝的视频后，AI 将自动分析并生成能力雷达图
                  </Paragraph>
                  <Button type="primary" onClick={() => navigate('/upload')} style={{ borderRadius: 8 }}>
                    去上传第一段视频
                  </Button>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      ) : (
        /* 无孩子时的引导 */
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 20px', background: 'linear-gradient(160deg, #fffaf5, #fff3e6)' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>👶</div>
          <Title level={4}>开始你的成长记录之旅</Title>
          <Paragraph type="secondary">添加孩子信息，上传视频和照片，AI 将为你解码宝宝的成长特质</Paragraph>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreateChildOpen(true)}
            style={{ background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)', border: 'none', borderRadius: 12 }}>
            添加第一个孩子
          </Button>
        </Card>
      )}

      {/* 天赋徽章墙 */}
      {traitBadges.length > 0 && (
        <Card
          title={<span>🏆 天赋徽章墙</span>}
          style={{ borderRadius: 16, marginTop: 16 }}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>点击徽章查看证据视频</Text>}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {traitBadges.map((badge, index) => (
              <Tooltip key={index} title={`点击查看「${badge.name}」的证据视频`}>
                <div
                  onClick={() => handleBadgeClick(badge)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', borderRadius: 12,
                    background: `linear-gradient(135deg, ${badge.color}15, ${badge.color}08)`,
                    border: `1px solid ${badge.color}30`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: isMobile ? 'calc(50% - 6px)' : 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = `0 4px 12px ${badge.color}30`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${badge.color}, ${badge.color}99)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16,
                  }}>
                    {badge.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
                      {badge.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      Lv.{badge.level} · {badge.unlockedAt}
                    </div>
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </Card>
      )}

      {/* 洞察卡片 */}
      <div style={{ marginTop: 16 }}>
        <Row gutter={[12, 12]}>
          {insights.map((insight, index) => (
            <Col xs={24} md={8} key={index}>
              <Card
                hoverable
                style={{
                  borderRadius: 14,
                  background: insight.type === 'milestone'
                    ? 'linear-gradient(135deg, #fff9e6, #fff3cc)'
                    : insight.type === 'comparison'
                      ? 'linear-gradient(135deg, #e8f8f0, #d4f1e4)'
                      : 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                  border: 'none',
                }}
                styles={{ body: { padding: isMobile ? 16 : 20 } }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 28, lineHeight: 1 }}>{insight.icon}</div>
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{insight.title}</Text>
                    <Paragraph style={{ fontSize: 13, color: '#555', margin: '6px 0 0' }}>
                      {insight.description}
                    </Paragraph>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 证据回溯弹窗 */}
      <Modal
        title={
          selectedBadge ? (
            <Space>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${selectedBadge.color}, ${selectedBadge.color}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                {selectedBadge.icon}
              </div>
              <span>「{selectedBadge.name}」证据回溯</span>
            </Space>
          ) : '证据回溯'
        }
        open={evidenceModalOpen}
        onCancel={() => setEvidenceModalOpen(false)}
        footer={[
          <Button key="timeline" onClick={() => { setEvidenceModalOpen(false); navigate('/timeline') }}>
            查看时间线
          </Button>,
          <Button key="close" type="primary" onClick={() => setEvidenceModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={isMobile ? '95%' : 520}
      >
        {selectedBadge && (
          <div style={{ padding: '12px 0' }}>
            <div style={{
              padding: 16, borderRadius: 12,
              background: `linear-gradient(135deg, ${selectedBadge.color}10, ${selectedBadge.color}05)`,
              border: `1px solid ${selectedBadge.color}20`,
              marginBottom: 16,
            }}>
              <Space direction="vertical" size={8}>
                <Text strong style={{ fontSize: 15 }}>特质等级：Lv.{selectedBadge.level}</Text>
                <Text type="secondary">所属维度：{selectedBadge.category}</Text>
                <Text type="secondary">解锁时间：{selectedBadge.unlockedAt}</Text>
              </Space>
            </div>
            <Paragraph style={{ color: '#666' }}>
              AI 在分析视频时多次识别到宝宝展现了「{selectedBadge.name}」特质。
              该特质属于「{selectedBadge.category}」维度，当前等级为 Lv.{selectedBadge.level}。
            </Paragraph>
            <Paragraph style={{ color: '#666' }}>
              随着更多视频的上传和分析，该特质的等级可能会进一步提升。
              你可以在时间线页面查看所有相关的视频记录。
            </Paragraph>
            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => { setEvidenceModalOpen(false); navigate('/timeline') }}
            >
              → 前往时间线查看相关视频
            </Button>
          </div>
        )}
      </Modal>

      {/* 添加孩子弹窗 */}
      <Modal
        title="添加孩子"
        open={createChildOpen}
        onOk={handleCreateChild}
        onCancel={() => { setCreateChildOpen(false); childForm.resetFields() }}
        confirmLoading={submitting}
        okText="添加"
        cancelText="取消"
      >
        <Form form={childForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="childName" label="孩子姓名" rules={[{ required: true, message: '请输入孩子姓名' }]}>
            <Input placeholder="请输入孩子姓名" maxLength={50} />
          </Form.Item>
          <Form.Item name="birthDate" label="出生日期" rules={[{ required: true, message: '请选择出生日期' }]}>
            <DatePicker style={{ width: '100%' }} placeholder="请选择出生日期" />
          </Form.Item>
          <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
            <Select placeholder="请选择性别">
              <Select.Option value="male">👦 男孩</Select.Option>
              <Select.Option value="female">👧 女孩</Select.Option>
              <Select.Option value="other">🧒 其他</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DashboardPage
