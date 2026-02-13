import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Select, Button, message, Alert, Space, Divider, Typography, Tag } from 'antd'
import { ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { settingsApi } from '@/services/api'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

interface SettingsFormValues {
  llm_provider: string
  llm_api_key: string
  llm_base_url: string
  llm_model: string
  llm_vision_model: string
}

interface SettingsData {
  llm_provider: string | null
  llm_api_key_masked: string | null
  llm_base_url: string | null
  llm_model: string | null
  llm_vision_model: string | null
}

const providerDefaults: Record<string, { baseUrl: string; model: string; visionModel: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    visionModel: 'gpt-4o',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    visionModel: 'claude-sonnet-4-20250514',
  },
}

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm<SettingsFormValues>()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [currentSettings, setCurrentSettings] = useState<SettingsData | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get()
      const data = response.data as SettingsData
      setCurrentSettings(data)
      form.setFieldsValue({
        llm_provider: data.llm_provider || 'openai',
        llm_api_key: '',
        llm_base_url: data.llm_base_url || providerDefaults.openai.baseUrl,
        llm_model: data.llm_model || providerDefaults.openai.model,
        llm_vision_model: data.llm_vision_model || providerDefaults.openai.visionModel,
      })
    } catch {
      message.error('加载设置失败')
    }
  }

  const handleProviderChange = (provider: string) => {
    const defaults = providerDefaults[provider]
    if (defaults) {
      form.setFieldsValue({
        llm_base_url: defaults.baseUrl,
        llm_model: defaults.model,
        llm_vision_model: defaults.visionModel,
      })
    }
  }

  const handleSave = async (values: SettingsFormValues) => {
    setLoading(true)
    try {
      const payload: Record<string, string> = {
        llm_provider: values.llm_provider,
        llm_base_url: values.llm_base_url,
        llm_model: values.llm_model,
        llm_vision_model: values.llm_vision_model,
      }
      if (values.llm_api_key) {
        payload.llm_api_key = values.llm_api_key
      }
      await settingsApi.update(payload)
      message.success('设置已保存')
      await loadSettings()
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await settingsApi.test()
      const data = response.data as { success: boolean; message: string }
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: '连接测试失败，请检查配置' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={4}>
        <ApiOutlined style={{ marginRight: 8 }} />
        API 设置
      </Title>

      <Alert
        message="配置您的大模型 API"
        description={
          <Paragraph style={{ marginBottom: 0 }}>
            LifePrint 使用大语言模型进行行为分析、情绪识别和成长报告生成。
            您需要配置自己的 API Key 才能使用这些功能。
            支持 <Tag color="blue">OpenAI</Tag> 和 <Tag color="purple">Anthropic</Tag> 两种 API 格式，
            也兼容所有 OpenAI 格式的第三方 API（如 DeepSeek、Groq 等）。
          </Paragraph>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {currentSettings?.llm_api_key_masked && (
        <Alert
          message={`当前已配置 API Key：${currentSettings.llm_api_key_masked}`}
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            llm_provider: 'openai',
            llm_base_url: providerDefaults.openai.baseUrl,
            llm_model: providerDefaults.openai.model,
            llm_vision_model: providerDefaults.openai.visionModel,
          }}
        >
          <Form.Item
            name="llm_provider"
            label="LLM 提供商"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select onChange={handleProviderChange}>
              <Option value="openai">OpenAI（兼容 DashScope / DeepSeek / Groq 等）</Option>
              <Option value="anthropic">Anthropic（Claude）</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="llm_api_key"
            label="API Key"
            extra={currentSettings?.llm_api_key_masked ? '留空则保持当前 Key 不变' : '必须填写才能使用 AI 功能'}
          >
            <Input.Password placeholder="sk-..." style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="llm_base_url"
            label="Base URL"
            rules={[{ required: true, message: '请输入 Base URL' }]}
            extra="OpenAI 默认：https://api.openai.com/v1 | Anthropic 默认：https://api.anthropic.com"
          >
            <Input placeholder="https://api.openai.com/v1" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="llm_model"
            label="文本模型"
            rules={[{ required: true, message: '请输入模型名称' }]}
            extra="用于生成成长报告等纯文本任务"
          >
            <Input placeholder="gpt-4o" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="llm_vision_model"
            label="视觉模型"
            rules={[{ required: true, message: '请输入视觉模型名称' }]}
            extra="用于分析图片中的行为和情绪（需支持多模态）"
          >
            <Input placeholder="gpt-4o" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Divider />

          <Space>
            <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: 8 }}>
              保存设置
            </Button>
            <Button onClick={handleTest} loading={testing} style={{ borderRadius: 8 }}>
              测试连接
            </Button>
          </Space>
        </Form>

        {testResult && (
          <Alert
            message={testResult.success ? '连接成功' : '连接失败'}
            description={testResult.message}
            type={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <Card style={{ marginTop: 16 }} title="常见配置示例">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>OpenAI 官方</Text>
            <br />
            <Text type="secondary">Base URL: https://api.openai.com/v1 | 模型: gpt-4o</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>Anthropic Claude</Text>
            <br />
            <Text type="secondary">Base URL: https://api.anthropic.com | 模型: claude-sonnet-4-20250514</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>DeepSeek</Text>
            <br />
            <Text type="secondary">Provider: OpenAI | Base URL: https://api.deepseek.com/v1 | 模型: deepseek-chat</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>阿里云 DashScope</Text>
            <br />
            <Text type="secondary">Provider: OpenAI | Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1 | 模型: qwen-plus / qwen-vl-max</Text>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default SettingsPage
