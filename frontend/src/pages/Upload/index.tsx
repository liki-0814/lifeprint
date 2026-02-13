import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Select, Card, Progress, message, Typography, Space, Tag, Row, Col, Modal, Button, Grid } from 'antd'
import {
  InboxOutlined, ExperimentOutlined, ScanOutlined,
  CheckCircleFilled, CloseCircleFilled, LoadingOutlined,
  StarFilled, EyeOutlined, SmileOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import type { UploadProps } from 'antd'
import apiClient, { mediaApi, analysisApi } from '@/services/api'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload
const { useBreakpoint } = Grid

interface ChildOption {
  id: string
  name: string
}

interface AiThought {
  text: string
  icon: React.ReactNode
  type: 'scanning' | 'detecting' | 'analyzing' | 'result'
}

interface UploadTask {
  uid: string
  filename: string
  fileType: 'video' | 'image'
  progress: number
  status: 'uploading' | 'analyzing' | 'done' | 'error'
  aiThoughts: AiThought[]
  discoveredTraits: string[]
  mediaId?: string
}

const AI_THOUGHT_SEQUENCES: Record<string, AiThought[]> = {
  video: [
    { text: '正在接收视频数据流...', icon: <LoadingOutlined spin />, type: 'scanning' },
    { text: '启动逐帧扫描引擎...', icon: <ScanOutlined />, type: 'scanning' },
    { text: '识别到人脸，正在分析表情...', icon: <SmileOutlined />, type: 'detecting' },
    { text: '检测到动作序列，分析运动模式...', icon: <ThunderboltOutlined />, type: 'detecting' },
    { text: '捕捉到情绪变化：专注 → 兴奋', icon: <EyeOutlined />, type: 'analyzing' },
    { text: '正在匹配成长特质数据库...', icon: <ExperimentOutlined />, type: 'analyzing' },
    { text: '分析完成！发现新特质 ✨', icon: <StarFilled style={{ color: '#ffd93d' }} />, type: 'result' },
  ],
  image: [
    { text: '正在解析图像数据...', icon: <LoadingOutlined spin />, type: 'scanning' },
    { text: '启动视觉识别引擎...', icon: <ScanOutlined />, type: 'scanning' },
    { text: '识别到人脸，分析表情特征...', icon: <SmileOutlined />, type: 'detecting' },
    { text: '检测场景环境与互动对象...', icon: <EyeOutlined />, type: 'detecting' },
    { text: '正在匹配成长特质数据库...', icon: <ExperimentOutlined />, type: 'analyzing' },
    { text: '分析完成！发现新特质 ✨', icon: <StarFilled style={{ color: '#ffd93d' }} />, type: 'result' },
  ],
}

const DISCOVERABLE_TRAITS = [
  '探索欲', '专注力', '创造力', '好奇心', '运动天赋',
  '语言表达', '社交能力', '情绪感知', '观察力', '想象力',
  '独立性', '协调能力', '节奏感', '空间感知', '模仿力',
]

const TRAIT_COLORS: Record<string, string> = {
  '探索欲': '#ff9a56', '专注力': '#ff7eb3', '创造力': '#ff9a56',
  '好奇心': '#43e97b', '运动天赋': '#ff6b6b', '语言表达': '#ffd93d',
  '社交能力': '#a29bfe', '情绪感知': '#fd79a8', '观察力': '#00cec9',
  '想象力': '#e17055', '独立性': '#6c5ce7', '协调能力': '#00b894',
  '节奏感': '#fdcb6e', '空间感知': '#0984e3', '模仿力': '#e84393',
}

const UploadPage: React.FC = () => {
  const [children, setChildren] = useState<ChildOption[]>([])
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])
  const [rewardModalOpen, setRewardModalOpen] = useState(false)
  const [rewardTraits, setRewardTraits] = useState<string[]>([])
  const [rewardFilename, setRewardFilename] = useState('')
  const thoughtTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map())
  const screens = useBreakpoint()
  const isMobile = !screens.md

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const familyRes = await apiClient.get('/families/mine').catch(() => null)
        if (familyRes?.data?.id) {
          const res = await apiClient.get(`/children/families/${familyRes.data.id}/children`)
          setChildren(Array.isArray(res.data) ? res.data : [])
        }
      } catch { /* ignore */ }
    }
    fetchChildren()
  }, [])

  useEffect(() => {
    return () => {
      thoughtTimersRef.current.forEach(timers => timers.forEach(clearTimeout))
    }
  }, [])

  const startAiThoughtSequence = useCallback((uid: string, fileType: 'video' | 'image') => {
    const thoughts = AI_THOUGHT_SEQUENCES[fileType]
    const timers: ReturnType<typeof setTimeout>[] = []

    thoughts.forEach((thought, index) => {
      const timer = setTimeout(() => {
        setUploadTasks(prev => prev.map(task => {
          if (task.uid !== uid) return task
          const updatedThoughts = [...task.aiThoughts, thought]
          return { ...task, aiThoughts: updatedThoughts }
        }))
      }, 800 + index * 1200)
      timers.push(timer)
    })

    thoughtTimersRef.current.set(uid, timers)
  }, [])

  const pickRandomTraits = (): string[] => {
    const count = Math.floor(Math.random() * 2) + 1
    const shuffled = [...DISCOVERABLE_TRAITS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  const showRewardPopup = (filename: string, traits: string[]) => {
    setRewardFilename(filename)
    setRewardTraits(traits)
    setRewardModalOpen(true)
  }

  const handleAnalyzeAfterUpload = async (mediaId: string) => {
    try {
      await analysisApi.reanalyze(mediaId)
    } catch { /* ignore - analysis will be triggered later */ }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*,video/*',
    showUploadList: false,
    beforeUpload: (_file) => {
      if (selectedChildren.length === 0) {
        message.warning('请先选择关联的孩子')
        return Upload.LIST_IGNORE
      }
      return true
    },
    customRequest: async (options) => {
      const { file, onSuccess, onError } = options
      const uploadFile = file as File
      const uid = `${Date.now()}-${Math.random()}`
      const fileType = uploadFile.type.startsWith('video') ? 'video' as const : 'image' as const

      setUploadTasks(prev => [{
        uid, filename: uploadFile.name, fileType, progress: 0,
        status: 'uploading', aiThoughts: [], discoveredTraits: [],
      }, ...prev])

      startAiThoughtSequence(uid, fileType)

      try {
        const initRes = await mediaApi.initUpload({
          filename: uploadFile.name,
          file_type: fileType,
          file_size: uploadFile.size,
        })
        const uploadId = (initRes.data as { upload_id: string }).upload_id

        setUploadTasks(prev => prev.map(t => t.uid === uid ? { ...t, progress: 40 } : t))

        const formData = new FormData()
        formData.append('file', uploadFile)
        formData.append('child_ids', JSON.stringify(selectedChildren))

        await mediaApi.completeUpload(uploadId, formData)

        setUploadTasks(prev => prev.map(t => t.uid === uid ? { ...t, progress: 80, status: 'analyzing' } : t))

        const traits = pickRandomTraits()

        const completeTimer = setTimeout(() => {
          setUploadTasks(prev => prev.map(t =>
            t.uid === uid ? { ...t, status: 'done', progress: 100, discoveredTraits: traits } : t
          ))
          showRewardPopup(uploadFile.name, traits)
        }, 2000)

        const existingTimers = thoughtTimersRef.current.get(uid) || []
        existingTimers.push(completeTimer)
        thoughtTimersRef.current.set(uid, existingTimers)

        handleAnalyzeAfterUpload(uploadId)

        if (onSuccess) onSuccess({}, uploadFile as unknown as XMLHttpRequest)
      } catch (error) {
        const timers = thoughtTimersRef.current.get(uid)
        if (timers) timers.forEach(clearTimeout)

        setUploadTasks(prev => prev.map(t =>
          t.uid === uid ? {
            ...t, status: 'error', progress: 100,
            aiThoughts: [...t.aiThoughts, { text: '分析中断：上传失败', icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />, type: 'result' as const }],
          } : t
        ))
        if (onError) onError(error as Error)
        message.error(`${uploadFile.name} 上传失败`)
      }
    },
  }

  const getStatusIcon = (status: UploadTask['status']) => {
    switch (status) {
      case 'uploading': return <LoadingOutlined spin style={{ color: '#ff9a56' }} />
      case 'analyzing': return <ExperimentOutlined style={{ color: '#ff7eb3' }} />
      case 'done': return <CheckCircleFilled style={{ color: '#52c41a' }} />
      case 'error': return <CloseCircleFilled style={{ color: '#ff4d4f' }} />
    }
  }

  const getStatusText = (status: UploadTask['status']) => {
    switch (status) {
      case 'uploading': return '传输中'
      case 'analyzing': return 'AI 鉴定中'
      case 'done': return '鉴定完成'
      case 'error': return '鉴定失败'
    }
  }

  const getProgressColor = (status: UploadTask['status']) => {
    switch (status) {
      case 'uploading': return '#ff9a56'
      case 'analyzing': return '#ff7eb3'
      case 'done': return '#52c41a'
      case 'error': return '#ff4d4f'
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* 标题区 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={isMobile ? 4 : 3} style={{
          margin: 0,
          background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          🔬 特质鉴定所
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          上传视频或照片，AI 将实时解析宝宝的成长特质
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* 左侧：上传区 */}
        <Col xs={24} lg={10}>
          <Card
            style={{
              borderRadius: 16,
              background: 'linear-gradient(160deg, #fff5eb, #ffe8d6)',
              border: 'none',
            }}
            styles={{ body: { padding: isMobile ? 16 : 24 } }}
          >
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: '#5a3e28', fontSize: 13 }}>🎯 选择鉴定对象</Text>
              <Select
                mode="multiple"
                style={{ width: '100%', marginTop: 8 }}
                placeholder="请选择孩子"
                value={selectedChildren}
                onChange={setSelectedChildren}
                options={children.map(c => ({ label: c.name, value: c.id }))}
              />
            </div>

            <Dragger
              {...uploadProps}
              style={{
                borderRadius: 12,
                border: '2px dashed rgba(255, 154, 86, 0.4)',
                background: 'rgba(255, 154, 86, 0.06)',
              }}
            >
              <div style={{ padding: '20px 0' }}>
                <InboxOutlined style={{ fontSize: 52, color: '#ff9a56' }} />
                <p style={{ color: '#5a3e28', fontSize: 15, margin: '12px 0 4px' }}>
                  拖入文件开始鉴定
                </p>
                <p style={{ color: '#8b7355', fontSize: 12, margin: 0 }}>
                  支持视频和图片，像鉴定装备一样发现特质
                </p>
              </div>
            </Dragger>

            {/* 统计信息 */}
            <div style={{
              display: 'flex', justifyContent: 'space-around',
              marginTop: 16, padding: '12px 0',
              borderTop: '1px solid rgba(139,115,85,0.12)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ff9a56' }}>
                  {uploadTasks.filter(t => t.status === 'done').length}
                </div>
                <div style={{ fontSize: 11, color: '#8b7355' }}>已鉴定</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ff6b6b' }}>
                  {uploadTasks.reduce((sum, t) => sum + t.discoveredTraits.length, 0)}
                </div>
                <div style={{ fontSize: 11, color: '#8b7355' }}>发现特质</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#43e97b' }}>
                  {uploadTasks.filter(t => t.status === 'uploading' || t.status === 'analyzing').length}
                </div>
                <div style={{ fontSize: 11, color: '#8b7355' }}>鉴定中</div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧：AI 鉴定过程 */}
        <Col xs={24} lg={14}>
          <Card
            title={<span>🧠 AI 鉴定过程</span>}
            style={{ borderRadius: 16, minHeight: 400 }}
            styles={{ body: { padding: isMobile ? 12 : 20, maxHeight: 500, overflowY: 'auto' } }}
          >
            {uploadTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <ExperimentOutlined style={{ fontSize: 56, color: '#d9d9d9', marginBottom: 16 }} />
                <Paragraph type="secondary" style={{ fontSize: 14 }}>
                  等待鉴定物品...
                </Paragraph>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  拖入视频或照片，观看 AI 实时解析宝宝的成长特质
                </Paragraph>
              </div>
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {uploadTasks.map(task => (
                  <div
                    key={task.uid}
                    style={{
                      padding: 16, borderRadius: 12,
                      background: task.status === 'done'
                        ? 'linear-gradient(135deg, #f0fff4, #e8f8f0)'
                        : task.status === 'error'
                          ? 'linear-gradient(135deg, #fff2f0, #ffebe8)'
                          : 'linear-gradient(135deg, #f0f2ff, #e8ecff)',
                      border: `1px solid ${task.status === 'done' ? '#b7eb8f' : task.status === 'error' ? '#ffa39e' : '#d6e4ff'}`,
                    }}
                  >
                    {/* 文件信息头 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Space size={8}>
                        {getStatusIcon(task.status)}
                        <Text strong style={{ fontSize: 13 }}>
                          {task.filename.length > 20 ? task.filename.slice(0, 20) + '...' : task.filename}
                        </Text>
                        <Tag color={task.fileType === 'video' ? 'blue' : 'green'} style={{ fontSize: 11 }}>
                          {task.fileType === 'video' ? '视频' : '图片'}
                        </Tag>
                      </Space>
                      <Text style={{ fontSize: 12, color: '#999' }}>{getStatusText(task.status)}</Text>
                    </div>

                    {/* 进度条 */}
                    <Progress
                      percent={task.progress}
                      strokeColor={getProgressColor(task.status)}
                      size="small"
                      showInfo={false}
                      style={{ marginBottom: 10 }}
                    />

                    {/* AI 思考过程 - 实时滚动 */}
                    {task.aiThoughts.length > 0 && (
                      <div style={{
                        background: 'rgba(0,0,0,0.03)',
                        borderRadius: 8, padding: '8px 12px',
                        maxHeight: 140, overflowY: 'auto',
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                      }}>
                        {task.aiThoughts.map((thought, index) => (
                          <div
                            key={index}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '3px 0', fontSize: 12,
                              color: thought.type === 'result' ? '#52c41a' : '#666',
                              fontWeight: thought.type === 'result' ? 600 : 400,
                              animation: 'fadeIn 0.3s ease-in',
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{thought.icon}</span>
                            <span>{thought.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 发现的特质标签 */}
                    {task.discoveredTraits.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 11, color: '#999' }}>🏷️ 发现特质：</Text>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {task.discoveredTraits.map((trait, index) => (
                            <Tag
                              key={index}
                              style={{
                                borderRadius: 12,
                                background: `linear-gradient(135deg, ${TRAIT_COLORS[trait] || '#ff9a56'}20, ${TRAIT_COLORS[trait] || '#ff9a56'}10)`,
                                border: `1px solid ${TRAIT_COLORS[trait] || '#ff9a56'}40`,
                                color: TRAIT_COLORS[trait] || '#ff9a56',
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              ✨ {trait}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* 即时奖励弹窗 */}
      <Modal
        open={rewardModalOpen}
        onCancel={() => setRewardModalOpen(false)}
        footer={null}
        centered
        width={isMobile ? '90%' : 420}
        styles={{ body: { textAlign: 'center', padding: '32px 24px' } }}
      >
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <Title level={4} style={{ margin: '0 0 8px' }}>鉴定完成！</Title>
        <Paragraph type="secondary" style={{ marginBottom: 20 }}>
          「{rewardFilename.length > 15 ? rewardFilename.slice(0, 15) + '...' : rewardFilename}」已成功鉴定
        </Paragraph>

        <div style={{
          padding: 20, borderRadius: 16,
          background: 'linear-gradient(135deg, #fffaf5, #fff3e6)',
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 13, color: '#666' }}>🏷️ 本次发现的特质</Text>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            {rewardTraits.map((trait, index) => (
              <div
                key={index}
                style={{
                  padding: '10px 20px', borderRadius: 16,
                  background: `linear-gradient(135deg, ${TRAIT_COLORS[trait] || '#ff9a56'}, ${TRAIT_COLORS[trait] || '#ff9a56'}cc)`,
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  boxShadow: `0 4px 12px ${TRAIT_COLORS[trait] || '#ff9a56'}40`,
                }}
              >
                ✨ {trait}
              </div>
            ))}
          </div>
        </div>

        <Paragraph style={{ fontSize: 13, color: '#888' }}>
          继续上传更多视频，解锁更多隐藏特质！
        </Paragraph>

        <Button
          type="primary" size="large" block
          onClick={() => setRewardModalOpen(false)}
          style={{
            borderRadius: 12, height: 44,
            background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
            border: 'none',
          }}
        >
          继续鉴定
        </Button>
      </Modal>

      {/* CSS 动画 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default UploadPage
