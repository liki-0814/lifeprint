import React, { useState, useEffect } from 'react'
import { Card, Typography, Space, Row, Col, Progress, Tag, Empty, Spin } from 'antd'
import { TrophyOutlined, StarOutlined, RocketOutlined } from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { autonomyApi } from '@/services/api'

const { Title, Text } = Typography

interface SkillItem {
  name: string
  category: string
  level: number
  max_level: number
  description: string
}

interface InitiativeItem {
  date: string
  action: string
  category: string
  score: number
}

const categoryColors: Record<string, string> = {
  '自理能力': '#667eea',
  '社交能力': '#f5576c',
  '认知发展': '#43e97b',
  '运动能力': '#4facfe',
  '语言表达': '#f093fb',
  '情绪管理': '#ffd93d',
}

const SkillTreePage: React.FC = () => {
  const { childId } = useParams<{ childId: string }>()
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [initiatives, setInitiatives] = useState<InitiativeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!childId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [skillRes, initRes] = await Promise.all([
          autonomyApi.getSkills(childId).catch(() => ({ data: [] })),
          autonomyApi.getInitiative(childId).catch(() => ({ data: [] })),
        ])
        setSkills(Array.isArray(skillRes.data) ? skillRes.data : [])
        setInitiatives(Array.isArray(initRes.data) ? initRes.data : [])
      } catch {
        /* 忽略 */
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [childId])

  const groupedSkills = skills.reduce<Record<string, SkillItem[]>>((groups, skill) => {
    if (!groups[skill.category]) groups[skill.category] = []
    groups[skill.category].push(skill)
    return groups
  }, {})

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={2} style={{ margin: 0 }}>🌳 技能树</Title>

      <Spin spinning={loading}>
        {skills.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
            <Empty description="暂无技能数据，上传更多媒体后将自动生成" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {Object.entries(groupedSkills).map(([category, categorySkills]) => (
              <Col xs={24} md={12} key={category}>
                <Card
                  title={
                    <Space>
                      <TrophyOutlined style={{ color: categoryColors[category] || '#667eea' }} />
                      <span>{category}</span>
                      <Tag color={categoryColors[category] || '#667eea'}>{categorySkills.length} 项技能</Tag>
                    </Space>
                  }
                  style={{ borderRadius: 12 }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {categorySkills.map(skill => (
                      <div key={skill.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text strong>{skill.name}</Text>
                          <Text type="secondary">Lv.{skill.level}/{skill.max_level}</Text>
                        </div>
                        <Progress
                          percent={Math.round((skill.level / skill.max_level) * 100)}
                          strokeColor={categoryColors[skill.category] || '#667eea'}
                          size="small"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>{skill.description}</Text>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {initiatives.length > 0 && (
          <Card title={<Space><RocketOutlined style={{ color: '#f5576c' }} /><span>主动性记录</span></Space>} style={{ borderRadius: 12, marginTop: 16 }}>
            <Row gutter={[12, 12]}>
              {initiatives.slice(0, 12).map((item, index) => (
                <Col xs={24} sm={12} md={8} key={index}>
                  <Card size="small" style={{ borderRadius: 8 }}>
                    <Space direction="vertical" size={4}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Tag color={categoryColors[item.category] || 'blue'}>{item.category}</Tag>
                        <Space size={2}>
                          {Array.from({ length: Math.min(item.score, 5) }).map((_, starIndex) => (
                            <StarOutlined key={starIndex} style={{ color: '#ffd93d', fontSize: 12 }} />
                          ))}
                        </Space>
                      </div>
                      <Text strong style={{ fontSize: 13 }}>{item.action}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.date}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </Spin>
    </Space>
  )
}

export default SkillTreePage
