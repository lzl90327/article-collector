import React, { useState } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import { PhaseId, PhaseMetadata, PendingInput } from '../../../types/phase';
import './AngleSelector.scss';

interface Angle {
  title: string;
  argument: string;
  score: { R: number; N: number; C: number };
}

// 新 Props 接口（适配 Phase 系统）
interface AngleSelectorNewProps {
  workflowId: string;
  phaseId: PhaseId;
  phaseMeta?: PhaseMetadata;
  fields: Map<string, unknown>;
  pendingInput?: PendingInput | null;
  loading?: boolean;
  onSubmitInput: (field: string, value: unknown) => void;
  onTriggerPhase: (targetPhase?: string) => void;
  onSendMessage?: (message: string) => void;
}

// 兼容旧 Props 接口
interface AngleSelectorLegacyProps {
  data: {
    mainstream: Angle[];
    contrarian: Angle[];
  };
  onConfirm: (result: { selectedAngles: string[], thoughts: string }) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

type AngleSelectorProps = AngleSelectorNewProps | AngleSelectorLegacyProps;

// 判断是否是新 Props
function isNewProps(props: AngleSelectorProps): props is AngleSelectorNewProps {
  return 'workflowId' in props;
}

export const AngleSelector: React.FC<AngleSelectorProps> = (props) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState('');

  // 根据 Props 类型获取数据
  const data = isNewProps(props)
    ? (props.fields.get('angle_pool') as { mainstream: Angle[], contrarian: Angle[] }) || { mainstream: [], contrarian: [] }
    : props.data;

  const loading = props.loading;

  if (!data) return null;

  const toggleSelect = (title: string) => {
    setSelected(prev => {
      if (prev.includes(title)) {
        return prev.filter(t => t !== title);
      } else {
        return [...prev, title];
      }
    });
  };

  const renderAngleCard = (angle: Angle, type: 'mainstream' | 'contrarian') => {
    const isSelected = selected.includes(angle.title);
    return (
      <View
        className={`angle-card ${type} ${isSelected ? 'selected' : ''}`}
        onClick={() => toggleSelect(angle.title)}
        key={angle.title}
      >
        <View className='angle-header'>
          <Text className='title'>{angle.title}</Text>
          <Text className='tag'>{type === 'mainstream' ? '主流' : '异见'}</Text>
          {isSelected && <Text className='check-mark'>✓</Text>}
        </View>
        <View className='argument'>{angle.argument}</View>
        <View className='scores'>
          <Text>相关: {angle.score.R}</Text>
          <Text>新颖: {angle.score.N}</Text>
          <Text>可信: {angle.score.C}</Text>
        </View>
      </View>
    );
  };

  const handleConfirm = () => {
    if (isNewProps(props)) {
      // 新接口：提交 angle_selection 字段
      props.onSubmitInput('angle_selection', {
        selectedAngles: selected,
        thoughts
      });
    } else {
      // 旧接口：直接调用 onConfirm
      props.onConfirm({ selectedAngles: selected, thoughts });
    }
  };

  const handleRefresh = () => {
    if (isNewProps(props)) {
      // 新接口：触发 Phase 重新生成角度
      props.onTriggerPhase();
    } else if (props.onRefresh) {
      // 旧接口：调用 onRefresh
      props.onRefresh();
    }
  };

  return (
    <View className='angle-selector'>
      <View className='header'>请选择切入点 (可多选)</View>

      <View className='section-title'>主流派 (Blue)</View>
      {data.mainstream.map(angle => renderAngleCard(angle, 'mainstream'))}

      <View className='section-title'>异见派 (Red)</View>
      {data.contrarian.map(angle => renderAngleCard(angle, 'contrarian'))}

      <View className='actions-area'>
        <Button
          size='small'
          fill='outline'
          onClick={handleRefresh}
          style={{ marginBottom: '10px' }}
        >
          🔄 换一批
        </Button>

        <Text className='label'>补充想法 (可选):</Text>
        <Textarea
          className='thoughts-input'
          placeholder="关于这个切入点，我还有些想法..."
          value={thoughts}
          onInput={(e) => setThoughts(e.detail.value)}
          autoHeight
        />
      </View>

      <Button
        block
        type='primary'
        disabled={selected.length === 0}
        onClick={handleConfirm}
        loading={loading}
        className='confirm-btn'
      >
        确认选择 ({selected.length})
      </Button>

      {loading && <View className='loading-mask'>处理中...</View>}
    </View>
  );
};
