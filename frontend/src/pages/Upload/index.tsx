import React, { useState, useEffect } from 'react'
import { Upload, Select, Card, Progress, message, Typography, Space, List, Tag, Row, Col } from 'antd'
import { InboxOutlined, CloudUploadOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import apiClient, { mediaApi } from '@/services/api'

const { Title, Text } = Typography
const { Dragger } = Upload

interface ChildOption {
  id: string
  name: string
}

interface UploadTask {
  uid: string
  filename: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  analysisStatus: string
}

const UploadPage: React.FC = () => {
  const [children, setChildren] = useState<ChildOption[]>([])
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])

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

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*,video/*',
    showUploadList: false,
    beforeUpload: (file) => {
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

      setUploadTasks(prev => [...prev, { uid, filename: uploadFile.name, progress: 0, status: 'uploading', analysisStatus: 'pending' }])

      try {
        const initRes = await mediaApi.initUpload({ filename: uploadFile.name, file_type: uploadFile.type.startsWith('video') ? 'video' : 'image', file_size: uploadFile.size })
        const uploadId = (initRes.data as { upload_id: string }).upload_id

        const formData = new FormData()
        formData.append('file', uploadFile)
        formData.append('child_ids', JSON.stringify(selectedChildren))

        await mediaApi.completeUpload(uploadId, formData)

        setUploadTasks(prev => prev.map(t => t.uid === uid ? { ...t, status: 'done', progress: 100, analysisStatus: 'processing' } : t))
        if (onSuccess) onSuccess({}, uploadFile as unknown as XMLHttpRequest)
        message.success(`${uploadFile.name} 上传成功`)
      } catch (error) {
        setUploadTasks(prev => prev.map(t => t.uid === uid ? { ...t, status: 'error', analysisStatus: 'failed' } : t))
        if (onError) onError(error as Error)
        message.error(`${uploadFile.name} 上传失败`)
      }
    },
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={2}>📤 上传媒体</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="上传设置" style={{ borderRadius: 12 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text strong>选择关联的孩子</Text>
                <Select mode="multiple" style={{ width: '100%', marginTop: 8 }} placeholder="请选择孩子" value={selectedChildren} onChange={setSelectedChildren} options={children.map(c => ({ label: c.name, value: c.id }))} />
              </div>
              <Dragger {...uploadProps} style={{ borderRadius: 8 }}>
                <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 48, color: '#667eea' }} /></p>
                <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
                <p className="ant-upload-hint">支持图片和视频，可批量上传</p>
              </Dragger>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="上传进度" style={{ borderRadius: 12 }}>
            {uploadTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <CloudUploadOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>暂无上传任务</p>
              </div>
            ) : (
              <List dataSource={uploadTasks} renderItem={(task) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text strong>{task.filename}</Text>
                      <Tag color={task.status === 'done' ? 'success' : task.status === 'error' ? 'error' : 'processing'}>{task.status === 'done' ? '完成' : task.status === 'error' ? '失败' : '上传中'}</Tag>
                    </div>
                    <Progress percent={task.progress} status={task.status === 'error' ? 'exception' : 'active'} />
                  </div>
                </List.Item>
              )} />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

export default UploadPage
