import React from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import './AuditReport.scss';

// Backend AuditReport type
interface BackendAuditReport {
  auditor_role: string;
  score: number;
  criticisms: string[];
  suggestions: string[];
}

interface AuditReportProps {
  report: BackendAuditReport | BackendAuditReport[];
  onConfirm: () => void;
  loading?: boolean;
}

export const AuditReport: React.FC<AuditReportProps> = ({ report, onConfirm, loading = false }) => {
  // Debug log
  console.log('[AuditReport] Received report:', report);

  // Safety check for report data
  if (!report) {
    return (
      <View className='audit-container'>
        <Text className='audit-header'>赛博编辑部审计报告</Text>
        <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
          审计报告数据加载中...
        </Text>
      </View>
    );
  }

  // Handle both single report and array of reports
  const reports = Array.isArray(report) ? report : [report];
  
  if (reports.length === 0) {
    return (
      <View className='audit-container'>
        <Text className='audit-header'>赛博编辑部审计报告</Text>
        <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
          暂无审计报告
        </Text>
      </View>
    );
  }

  // Calculate average score
  const averageScore = reports.reduce((sum, r) => sum + (r.score ?? 0), 0) / reports.length;

  const renderScore = () => {
    return (
      <View className='radar-container'>
        <View className='total-score'>
          <Text className='score-text'>{averageScore.toFixed(1)}</Text>
          <Text className='score-label'>综合评分</Text>
        </View>
        <View className='dimension-list'>
          {reports.map((r, idx) => (
            <View key={idx} className='dimension-item'>
              <Text className='dim-label'>{r.auditor_role || '审计员'}</Text>
              <View className='progress-bar'>
                <View 
                  className='progress-fill' 
                  style={{ width: `${(r.score ?? 0) * 10}%` }}
                ></View>
              </View>
              <Text className='dim-score'>{r.score ?? 0}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderCriticisms = () => {
    const allCriticisms = reports.flatMap(r => r.criticisms || []);
    
    if (allCriticisms.length === 0) {
      return (
        <View className='issues-container'>
          <Text className='issues-title'>批评意见:</Text>
          <Text className='no-issues'>暂无批评意见</Text>
        </View>
      );
    }

    return (
      <View className='issues-container'>
        <Text className='issues-title'>批评意见:</Text>
        {allCriticisms.map((issue, idx) => (
          <View key={idx} className='issue-item'>
            <Text className='issue-text'>• {issue}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSuggestions = () => {
    const allSuggestions = reports.flatMap(r => r.suggestions || []);
    
    return (
      <View className='suggestions-section'>
        <Text className='section-title'>改进建议:</Text>
        {allSuggestions.length === 0 ? (
          <Text style={{ color: '#999', fontStyle: 'italic' }}>暂无建议</Text>
        ) : (
          allSuggestions.map((sug, idx) => (
            <View key={idx} className='suggestion-item'>
              <Text>👉 {sug}</Text>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <ScrollView scrollY className='audit-container'>
      <Text className='audit-header'>赛博编辑部审计报告</Text>
      
      {renderScore()}
      
      {renderCriticisms()}

      {renderSuggestions()}

      <Button 
        className='confirm-btn' 
        onClick={onConfirm} 
        disabled={loading}
      >
        {loading ? '处理中...' : '采纳建议并润色'}
      </Button>
    </ScrollView>
  );
};
