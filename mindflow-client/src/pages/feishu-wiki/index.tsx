import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Loading } from '@tarojs/components';
import Taro from '@tarojs/components';
import { getWikiNodes } from '../../api/feishu';
import './index.scss';

interface WikiNode {
  title: string;
  obj_type: 'docx' | 'file' | 'folder';
  node_token: string;
  obj_token: string;
  parent_node_token?: string;
}

/**
 * 飞书知识库文档列表页面
 */
export default function FeishuWiki() {
  const [nodes, setNodes] = useState<WikiNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentNode, setCurrentNode] = useState<{ title: string; token: string } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ title: string; token: string }[]>([]);

  // 知识库配置（实际项目中应该从配置或用户设置中获取）
  const spaceId = '7597246840014130375'; // 文章素材库

  useEffect(() => {
    loadNodes();
  }, []);

  /**
   * 加载节点列表
   */
  const loadNodes = useCallback(async (parentToken?: string) => {
    try {
      setLoading(true);
      const res = await getWikiNodes(spaceId, parentToken);
      
      if (res.data?.items) {
        setNodes(res.data.items);
      }
    } catch (error) {
      console.error('加载文档列表失败:', error);
      Taro.showToast({
        title: '加载失败',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  /**
   * 进入子目录
   */
  const enterFolder = (node: WikiNode) => {
    if (node.obj_type === 'folder' || node.obj_type === 'docx') {
      // 添加到面包屑
      const newBreadcrumb = { title: node.title, token: node.node_token };
      setBreadcrumbs([...breadcrumbs, newBreadcrumb]);
      setCurrentNode(newBreadcrumb);
      
      // 加载子节点
      loadNodes(node.node_token);
    }
  };

  /**
   * 返回上一级
   */
  const goBack = () => {
    if (breadcrumbs.length <= 1) {
      // 返回根目录
      setBreadcrumbs([]);
      setCurrentNode(null);
      loadNodes();
    } else {
      // 返回上一级
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      const parentNode = newBreadcrumbs[newBreadcrumbs.length - 1];
      setCurrentNode(parentNode);
      loadNodes(parentNode?.token);
    }
  };

  /**
   * 跳转到指定层级
   */
  const jumpToLevel = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    const targetNode = newBreadcrumbs[index];
    setCurrentNode(targetNode);
    loadNodes(targetNode?.token);
  };

  /**
   * 查看文档详情
   */
  const viewDocument = (node: WikiNode) => {
    Taro.navigateTo({
      url: `/pages/feishu-doc/index?nodeToken=${node.node_token}&title=${encodeURIComponent(node.title)}`,
    });
  };

  /**
   * 获取文件图标
   */
  const getFileIcon = (objType: string) => {
    switch (objType) {
      case 'folder':
        return '📁';
      case 'docx':
        return '📄';
      case 'file':
        return '📎';
      default:
        return '📄';
    }
  };

  return (
    <View className="feishu-wiki">
      {/* 面包屑导航 */}
      <View className="breadcrumb">
        <Text className="breadcrumb-item" onClick={() => jumpToLevel(-1)}>
          根目录
        </Text>
        {breadcrumbs.map((item, index) => (
          <View key={item.token} className="breadcrumb-segment">
            <Text className="breadcrumb-separator">/</Text>
            <Text 
              className="breadcrumb-item"
              onClick={() => jumpToLevel(index)}
            >
              {item.title}
            </Text>
          </View>
        ))}
      </View>

      {/* 返回按钮 */}
      {breadcrumbs.length > 0 && (
        <View className="back-btn" onClick={goBack}>
          <Text className="back-icon">←</Text>
          <Text className="back-text">返回上一级</Text>
        </View>
      )}

      {/* 文档列表 */}
      <ScrollView className="node-list" scrollY>
        {loading ? (
          <View className="loading-container">
            <Loading type="circular" color="#1989fa" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : nodes.length === 0 ? (
          <View className="empty-container">
            <Text className="empty-icon">📂</Text>
            <Text className="empty-text">暂无文档</Text>
          </View>
        ) : (
          nodes.map((node) => (
            <View 
              key={node.node_token}
              className="node-item"
              onClick={() => {
                if (node.obj_type === 'folder') {
                  enterFolder(node);
                } else {
                  viewDocument(node);
                }
              }}
            >
              <Text className="node-icon">{getFileIcon(node.obj_type)}</Text>
              <View className="node-info">
                <Text className="node-title">{node.title}</Text>
                <Text className="node-type">
                  {node.obj_type === 'docx' ? '文档' : 
                   node.obj_type === 'folder' ? '文件夹' : '文件'}
                </Text>
              </View>
              {node.obj_type === 'folder' && (
                <Text className="node-arrow">→</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 底部统计 */}
      <View className="footer">
        <Text className="footer-text">
          共 {nodes.length} 个{item}
        </Text>
      </View>
    </View>
  );
}
