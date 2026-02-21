import React, { useState, useEffect } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import './BriefCard.scss';

interface BriefCardProps {
  data: any;
  onConfirm: (updatedData: any) => void;
  loading?: boolean;
}

export const BriefCard: React.FC<BriefCardProps> = ({ data, onConfirm, loading }) => {
  const [formData, setFormData] = useState(data);

  useEffect(() => {
    setFormData(data);
  }, [data]);

  if (!data) return null;

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <View className='brief-card'>
      <View className='card-header'>写作 Brief (可微调)</View>
      
      <View className='section'>
        <Text className='label'>核心主张 (Thesis)</Text>
        <Textarea 
          className='content-input' 
          value={formData.thesis} 
          onInput={(e) => handleChange('thesis', e.detail.value)}
          autoHeight
        />
      </View>

      <View className='section'>
        <Text className='label'>目标读者</Text>
        <Textarea 
          className='content-input' 
          value={formData.target_audience}
          onInput={(e) => handleChange('target_audience', e.detail.value)}
          autoHeight
        />
      </View>

      <View className='section'>
        <Text className='label'>读者现状</Text>
        <Textarea 
          className='content-input' 
          value={formData.existing_belief}
          onInput={(e) => handleChange('existing_belief', e.detail.value)}
          autoHeight
        />
      </View>

      <View className='section'>
        <Text className='label'>改变目标</Text>
        <Textarea 
          className='content-input' 
          value={formData.change_goal}
          onInput={(e) => handleChange('change_goal', e.detail.value)}
          autoHeight
        />
      </View>

      <Button 
        block 
        type='primary' 
        onClick={() => onConfirm(formData)}
        loading={loading}
        className='confirm-btn'
      >
        确认并生成切入点
      </Button>
    </View>
  );
};
