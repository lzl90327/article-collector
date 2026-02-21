import React, { useState, useEffect } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import { PhaseId, PhaseMetadata, PendingInput } from '../../../types/phase';
import './BriefCard.scss';

// 新 Props 接口（适配 Phase 系统）
interface BriefCardNewProps {
  workflowId: string;
  phaseId: PhaseId;
  phaseMeta?: PhaseMetadata;
  fields: Map<string, unknown>;
  pendingInput?: PendingInput | null;
  loading?: boolean;
  onSubmitInput: (field: string, value: unknown) => void;
  onTriggerPhase: (targetPhase?: string) => void;
}

// 兼容旧 Props 接口
interface BriefCardLegacyProps {
  data: any;
  onConfirm: (updatedData: any) => void;
  loading?: boolean;
}

type BriefCardProps = BriefCardNewProps | BriefCardLegacyProps;

// 判断是否是新 Props
function isNewProps(props: BriefCardProps): props is BriefCardNewProps {
  return 'workflowId' in props;
}

export const BriefCard: React.FC<BriefCardProps> = (props) => {
  const [formData, setFormData] = useState<any>({});
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingKey, setEditingKey] = useState('');
  const [editingLabel, setEditingLabel] = useState('');
  const [editingValue, setEditingValue] = useState('');

  // 根据 Props 类型获取数据
  const data = isNewProps(props) 
    ? (props.fields.get('briefData') as any) || {}
    : props.data;
  
  const loading = props.loading;

  useEffect(() => {
    setFormData(data);
  }, [data]);

  if (!data) return null;

  const sections = [
    { key: 'thesis', label: '核心主张 (Thesis)' },
    { key: 'target_audience', label: '目标读者' },
    { key: 'existing_belief', label: '读者现状' },
    { key: 'change_goal', label: '改变目标' },
  ];

  const handleEditClick = (key: string, label: string, value: string) => {
    setEditingKey(key);
    setEditingLabel(label);
    setEditingValue(value || '');
    setEditDialogVisible(true);
  };

  const handleSaveEdit = () => {
    setFormData((prev: any) => ({
      ...prev,
      [editingKey]: editingValue
    }));
    setEditDialogVisible(false);
  };

  const handleCancelEdit = () => {
    setEditDialogVisible(false);
    setEditingValue('');
  };

  const handleConfirm = () => {
    if (isNewProps(props)) {
      // 新接口：提交 briefData 字段
      props.onSubmitInput('briefData', formData);
    } else {
      // 旧接口：直接调用 onConfirm
      props.onConfirm(formData);
    }
  };

  return (
    <View className='brief-card'>
      <View className='card-header'>写作 Brief (可微调)</View>
      
      {sections.map(({ key, label }) => (
        <View className='section' key={key}>
          <View className='section-header'>
            <Text className='label'>{label}</Text>
            <Text 
              className='edit-hint'
              onClick={() => handleEditClick(key, label, formData[key])}
            >
              点击编辑
            </Text>
          </View>
          <View 
            className='content-text'
            onClick={() => handleEditClick(key, label, formData[key])}
          >
            {formData[key]}
          </View>
        </View>
      ))}

      <Button 
        block 
        type='primary' 
        onClick={handleConfirm}
        loading={loading}
        className='confirm-btn'
      >
        确认并生成切入点
      </Button>

      {/* 编辑对话框 - 使用自定义弹窗 */}
      {editDialogVisible && (
        <View className='edit-modal-overlay' onClick={handleCancelEdit}>
          <View className='edit-modal' onClick={(e) => e.stopPropagation()}>
            <View className='edit-modal-header'>
              <Text className='edit-modal-title'>编辑: {editingLabel}</Text>
            </View>
            <View className='edit-modal-body'>
              <Textarea
                className='edit-textarea'
                value={editingValue}
                onInput={(e) => setEditingValue(e.detail.value)}
                placeholder={`请输入${editingLabel}...`}
                maxlength={-1}
                autoHeight
              />
            </View>
            <View className='edit-modal-footer'>
              <View className='edit-btn edit-btn-cancel' onClick={handleCancelEdit}>
                <Text>取消</Text>
              </View>
              <View className='edit-btn edit-btn-save' onClick={handleSaveEdit}>
                <Text>保存</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
