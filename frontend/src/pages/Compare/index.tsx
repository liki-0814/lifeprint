import React, { useState, useEffect } from 'react'
import { Card, Typography, Space, Select, Row, Col, Empty, Spin } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react'
import apiClient from '@/services/api'

const { Title } = Typography

interface ChildOption {
  id: string
  name: string
}

interface GrowthMetric {
  month: string
  cognitive: number
  social: number
  motor: number
  language: number
  emotional: number
}

const ComparePage: React.FC = () => {
  const [children, setChildren] = useState<ChildOption[]>([])
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [metricsMap, setMetricsMap] = useState<Record<string, GrowthMetric[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const familyRes = await apiClient.get('/families/mine').catch(() => null)
        if (familyRes?.data?.id) {
          const res = await apiClient.get(`/children/families/${familyRes.data.id}/children`)
          setChildren(Array.isArray(res.data) ? res.data : [])
        }
      } catch {
        /* 忽略 */
      }
    }
    fetchChildren()
  }, [])

  useEffect(() => {
    if (selectedChildren.length === 0) return
    const fetchMetrics = async () => {
      setLoading(true)
      const newMetrics: Record<string, GrowthMetric[]> = {}
      for (const childId of selectedChildren) {
        try {
          const response = await apiClient.get(`/autonomy/children/${childId}/metrics`)
          newMetrics[childId] = Array.isArray(response.data) ? response.data : []
        } catch {
          newMetrics[childId] = []
        }
      }
      setMetricsMap(newMetrics)
      setLoading(false)
    }
    fetchMetrics()
  }, [selectedChildren])

  const dimensions = ['cognitive', 'social', 'motor', 'language', 'emotional'] as const
  const dimensionLabels: Record<string, string> = {
    cognitive: '认知发展',
    social: '社交能力',
    motor: '运动能力',
    language: '语言表达',
    emotional: '情绪管理',
  }

  const colors = ['#667eea', '#f5576c', '#43e97b', '#4facfe', '#f093fb']

  const lineChartOption = {
    tooltip: { trigger: 'axis' as const },
    legend: {
      data: selectedChildren.map(childId => {
        const child = children.find(c => c.id === childId)
        return child?.name || childId
      }),
    },
    xAxis: {
      type: 'category' as const,
      data: selectedChildren.length > 0 && metricsMap[selectedChildren[0]]
        ? metricsMap[selectedChildren[0]].map(m => m.month)
        : [],
    },
    yAxis: { type: 'value' as const, max: 100 },
    series: selectedChildren.flatMap((childId, childIndex) => {
      const child = children.find(c => c.id === childId)
      const metrics = metricsMap[childId] || []
      return dimensions.map((dim, dimIndex) => ({
        name: `${child?.name || childId} - ${dimensionLabels[dim]}`,
        type: 'line' as const,
        data: metrics.map(m => m[dim]),
        smooth: true,
        lineStyle: { color: colors[(childIndex * dimensions.length + dimIndex) % colors.length] },
        itemStyle: { color: colors[(childIndex * dimensions.length + dimIndex) % colors.length] },
      }))
    }),
  }

  const radarOption = selectedChildren.length > 0 ? {
    radar: {
      indicator: dimensions.map(dim => ({ name: dimensionLabels[dim], max: 100 })),
      shape: 'circle' as const,
    },
    series: [{
      type: 'radar',
      data: selectedChildren.map((childId, index) => {
        const child = children.find(c => c.id === childId)
        const metrics = metricsMap[childId] || []
        const latestMetric = metrics[metrics.length - 1]
        return {
          name: child?.name || childId,
          value: latestMetric ? dimensions.map(dim => latestMetric[dim]) : [0, 0, 0, 0, 0],
          areaStyle: { color: `${colors[index % colors.length]}33` },
          lineStyle: { color: colors[index % colors.length] },
          itemStyle: { color: colors[index % colors.length] },
        }
      }),
    }],
    legend: {
      data: selectedChildren.map(childId => {
        const child = children.find(c => c.id === childId)
        return child?.name || childId
      }),
    },
  } : null

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}><SwapOutlined /> 成长对比</Title>
        <Select
          mode="multiple"
          placeholder="选择要对比的孩子（最多3个）"
          style={{ minWidth: 300 }}
          value={selectedChildren}
          onChange={(values: string[]) => setSelectedChildren(values.slice(0, 3))}
          options={children.map(c => ({ label: c.name, value: c.id }))}
        />
      </div>

      <Spin spinning={loading}>
        {selectedChildren.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
            <Empty description="请选择要对比的孩子" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card title="📈 成长趋势对比" style={{ borderRadius: 12 }}>
                <ReactEChartsCore option={lineChartOption} style={{ height: 400 }} />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              {radarOption && (
                <Card title="🎯 能力雷达对比" style={{ borderRadius: 12 }}>
                  <ReactEChartsCore option={radarOption} style={{ height: 400 }} />
                </Card>
              )}
            </Col>
          </Row>
        )}
      </Spin>
    </Space>
  )
}

export default ComparePage
