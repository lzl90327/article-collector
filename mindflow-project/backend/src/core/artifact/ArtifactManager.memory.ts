/**
 * 内存存储版本的 ArtifactManager
 * 用于测试环境，无需数据库连接
 */

import { EventEmitter } from 'events';
import { Artifact, ArtifactVersion } from './ArtifactManager';

export interface MemoryArtifactStore {
  artifacts: Map<string, Artifact>;
}

export class MemoryArtifactManager extends EventEmitter {
  private store: MemoryArtifactStore;

  constructor(store?: MemoryArtifactStore) {
    super();
    this.store = store || { artifacts: new Map() };
  }

  async createArtifact(
    workflowId: string,
    type: string,
    content: any,
    createdBy: 'user' | 'ai' | 'system' = 'system',
    changeSummary?: string
  ): Promise<Artifact> {
    const artifactId = `${workflowId}_${type}`;
    const existingArtifact = this.store.artifacts.get(artifactId);

    let artifact: Artifact;

    if (existingArtifact) {
      // Update existing artifact
      const newVersion: ArtifactVersion = {
        version: existingArtifact.currentVersion + 1,
        content,
        createdAt: new Date(),
        createdBy,
        changeSummary
      };
      artifact = {
        ...existingArtifact,
        currentVersion: newVersion.version,
        versions: [...existingArtifact.versions, newVersion]
      };
    } else {
      // Create new artifact
      artifact = {
        id: artifactId,
        type,
        workflowId,
        currentVersion: 1,
        versions: [{
          version: 1,
          content,
          createdAt: new Date(),
          createdBy,
          changeSummary
        }]
      };
    }

    this.store.artifacts.set(artifactId, artifact);
    this.emit('artifact:created', { artifactId, type, workflowId, version: artifact.currentVersion });

    return artifact;
  }

  async getArtifact(query: { workflowId: string; type?: string; version?: number }): Promise<Artifact | null> {
    const { workflowId, type, version } = query;

    if (!type) {
      throw new Error('Artifact type is required for retrieval');
    }

    const artifactId = `${workflowId}_${type}`;
    const artifact = this.store.artifacts.get(artifactId);

    if (!artifact) {
      return null;
    }

    if (version !== undefined) {
      const specificVersion = artifact.versions.find(v => v.version === version);
      if (!specificVersion) {
        return null;
      }
      return {
        ...artifact,
        currentVersion: version,
        versions: [specificVersion]
      };
    }

    return artifact;
  }

  async getLatestVersion(workflowId: string, type: string): Promise<ArtifactVersion | null> {
    const artifact = await this.getArtifact({ workflowId, type });
    if (!artifact || artifact.versions.length === 0) {
      return null;
    }
    return artifact.versions[artifact.versions.length - 1];
  }

  async getVersionHistory(workflowId: string, type: string): Promise<ArtifactVersion[]> {
    const artifact = await this.getArtifact({ workflowId, type });
    if (!artifact) {
      return [];
    }
    return artifact.versions;
  }

  async listArtifacts(workflowId: string): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    for (const artifact of this.store.artifacts.values()) {
      if (artifact.workflowId === workflowId) {
        artifacts.push(artifact);
      }
    }
    return artifacts;
  }

  async deleteArtifact(workflowId: string, type: string): Promise<void> {
    const artifactId = `${workflowId}_${type}`;
    this.store.artifacts.delete(artifactId);
    this.emit('artifact:deleted', { workflowId, type });
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for memory store
  }
}

// 导出兼容的类型
export { Artifact, ArtifactVersion };
