import React, { useState } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import './AngleSelector.scss';

interface Angle {
  title: string;
  argument: string;
  score: { R: number; N: number; C: number };
}

interface AngleSelectorProps {
  data: {
    mainstream: Angle[];
    contrarian: Angle[];
  };
  onConfirm: (result: { selectedAngles: string[], thoughts: string }) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export const AngleSelector: React.FC<AngleSelectorProps> = ({ data, onConfirm, onRefresh, loading }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState('');

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
            onClick={onRefresh}
            style={{marginBottom: '10px'}}
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
        onClick={() => onConfirm({ selectedAngles: selected, thoughts })}
        loading={loading}
        className='confirm-btn'
      >
        确认选择 ({selected.length})
      </Button>

      {loading && <View className='loading-mask'>处理中...</View>}
    </View>
  );
};
