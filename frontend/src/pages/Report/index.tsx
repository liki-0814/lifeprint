import React, { useState, useEffect } from 'react'
import { Card, Typography, Space, Row, Col, List, Tag, Button, Descriptions, Empty, Spin } from 'antd'
import { FileTextOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react'
import { useParams } from 'react-router-dom'
import { reportApi } from '@/services/api'

const { Title, Text, Paragraph } = Typography

interface RadarDataItem {
  dimension: string
  score: number
}

interface SparkCard {
  title: string
  description: string
  date: string
}

interface ReportItem {
  id: string
  report_month: string
  summary_text: string
  narrative: string | null
  radar_data: RadarDataItem[]
  spark_cards: SparkCard[]
  created_at: string
}

const ReportPage: React.FC = () => {
  const { childId } = useParams<{ childId: string }>()
  const [reports, setReports] = useState<ReportItem[]>([])
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!childId) return
    const fetchReports = async () => {
      setLoading(true)
      try {
        const response = await reportApi.list(childId)
        const data = Array.isArray(response.data) ? response.data as ReportItem[] : []
        setReports(data)
        if (data.length > 0) setSelectedReport(data[0])
      } catch {
        /* 忽略 */
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [childId])

  const handleGenerate = async () => {
    if (!childId) return
    setGenerating(true)
    try {
      await reportApi.generate(childId)
      const response = await reportApi.list(childId)
      const data = Array.isArray(response.data) ? response.data as ReportItem[] : []
      setReports(data)
      if (data.length > 0) setSelectedReport(data[0])
    } catch {
      /* 忽略 */
    } finally {
      setGenerating(false)
    }
  }

  const radarOption = selectedReport?.radar_data ? {
    radar: {
      indicator: selectedReport.radar_data.map(item => ({ name: item.dimension, max: 100 })),
      shape: 'circle',
      splitNumber: 5,
    },
    series: [{
      type: 'radar',
      data: [{
        value: selectedReport.radar_data.map(item => item.score),
        name: '成长指标',
        areaStyle: { color: 'rgba(102, 126, 234, 0.3)' },
        lineStyle: { color: '#667eea' },
        itemStyle: { color: '#667eea' },
      }],
    }],
  } : null

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>📊 月度成长报告</Title>
        <Button type="primary" icon={<ReloadOutlined />} loading={generating} onClick={handleGenerate}>生成报告</Button>
      </div>

      <Spin spinning={loading}>
        {reports.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
            <Empty description="暂无报告，点击右上角生成第一份报告" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card title="报告列表" style={{ borderRadius: 12 }}>
                <List
                  dataSource={reports}
                  renderItem={(item: ReportItem) => (
                    <List.Item
                      onClick={() => setSelectedReport(item)}
                      style={{ cursor: 'pointer', background: selectedReport?.id === item.id ? '#f0f5ff' : 'transparent', borderRadius: 8, padding: '8px 12px' }}
                    >
                      <List.Item.Meta
                        avatar={<FileTextOutlined style={{ fontSize: 20, color: '#667eea' }} />}
                        title={item.report_month}
                        description={new Date(item.created_at).toLocaleDateString('zh-CN')}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} md={16}>
              {selectedReport && (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Card title={`${selectedReport.report_month} 成长报告`} style={{ borderRadius: 12 }} extra={<Button icon={<DownloadOutlined />} onClick={() => childId && reportApi.downloadPdf(childId, selectedReport.id)}>下载 PDF</Button>}>
                    <Descriptions column={1} bordered>
                      <Descriptions.Item label="报告月份"><Tag color="blue">{selectedReport.report_month}</Tag></Descriptions.Item>
                      <Descriptions.Item label="生成时间">{new Date(selectedReport.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
                    </Descriptions>
                    <div style={{ marginTop: 16 }}>
                      <Title level={5}>📝 月度总结</Title>
                      <Paragraph>{selectedReport.summary_text}</Paragraph>
                    </div>
                    {selectedReport.narrative && (
                      <div style={{ marginTop: 16 }}>
                        <Title level={5}>📖 成长叙事</Title>
                        <Paragraph>{selectedReport.narrative}</Paragraph>
                      </div>
                    )}
                  </Card>

                  {radarOption && (
                    <Card title="🎯 能力雷达图" style={{ borderRadius: 12 }}>
                      <ReactEChartsCore option={radarOption} style={{ height: 350 }} />
                    </Card>
                  )}

                  {selectedReport.spark_cards && selectedReport.spark_cards.length > 0 && (
                    <Card title="✨ 火花卡片" style={{ borderRadius: 12 }}>
                      <Row gutter={[12, 12]}>
                        {selectedReport.spark_cards.map((card, index) => (
                          <Col xs={24} sm={12} key={index}>
                            <Card size="small" style={{ borderRadius: 8, background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }}>
                              <Text strong>{card.title}</Text>
                              <Paragraph style={{ margin: '8px 0 0', fontSize: 13 }}>{card.description}</Paragraph>
                              <Text type="secondary" style={{ fontSize: 12 }}>{card.date}</Text>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  )}
                </Space>
              )}
            </Col>
          </Row>
        )}
      </Spin>
    </Space>
  )
}

export default ReportPage
