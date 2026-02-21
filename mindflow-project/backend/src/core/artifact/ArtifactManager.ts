import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';

export interface ArtifactVersion {
  version: number;
  content: any;
  createdAt: Date;
  createdBy: 'user' | 'ai' | 'system';
  changeSummary?: string;
}

export interface Artifact {
  id: string;
  type: string;
  workflowId: string;
  currentVersion: number;
  versions: ArtifactVersion[];
  metadata?: any;
}

export interface ArtifactQuery {
  workflowId: string;
  type?: string;
  version?: number;
}

export class ArtifactManager extends EventEmitter {
  private prisma: PrismaClient;

  constructor() {
    super();
    this.prisma = new PrismaClient();
  }

  async createArtifact(
    workflowId: string,
    type: string,
    content: any,
    createdBy: 'user' | 'ai' | 'system' = 'system',
    changeSummary?: string
  ): Promise<Artifact> {
    const artifactId = `${workflowId}_${type}`;
    
    const artifact = await this.prisma.artifact.upsert({
      where: { id: artifactId },
      create: {
        id: artifactId,
        workflowId,
        type,
        currentVersion: 1,
        versions: [{
          version: 1,
          content,
          createdAt: new Date().toISOString(),
          createdBy,
          changeSummary
        }],
        metadata: {}
      },
      update: {
        currentVersion: { increment: 1 },
        versions: {
          push: {
            version: { increment: 1 },
            content,
            createdAt: new Date().toISOString(),
            createdBy,
            changeSummary
          }
        }
      }
    });

    this.emit('artifact:created', { artifactId, type, workflowId, version: artifact.currentVersion });
    
    return this.mapToArtifact(artifact);
  }

  async getArtifact(query: ArtifactQuery): Promise<Artifact | null> {
    const { workflowId, type, version } = query;
    
    if (!type) {
      throw new Error('Artifact type is required for retrieval');
    }

    const artifactId = `${workflowId}_${type}`;
    
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId }
    });

    if (!artifact) {
      return null;
    }

    const mappedArtifact = this.mapToArtifact(artifact);

    if (version !== undefined) {
      const specificVersion = mappedArtifact.versions.find(v => v.version === version);
      if (!specificVersion) {
        return null;
      }
      return {
        ...mappedArtifact,
        currentVersion: version,
        versions: [specificVersion]
      };
    }

    return mappedArtifact;
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

  async compareVersions(
    workflowId: string,
    type: string,
    versionA: number,
    versionB: number
  ): Promise<{ versionA: ArtifactVersion; versionB: ArtifactVersion; differences: any }> {
    const artifact = await this.getArtifact({ workflowId, type });
    if (!artifact) {
      throw new Error(`Artifact ${type} not found for workflow ${workflowId}`);
    }

    const vA = artifact.versions.find(v => v.version === versionA);
    const vB = artifact.versions.find(v => v.version === versionB);

    if (!vA || !vB) {
      throw new Error('One or both versions not found');
    }

    const differences = this.calculateDifferences(vA.content, vB.content);

    return {
      versionA: vA,
      versionB: vB,
      differences
    };
  }

  async rollback(workflowId: string, type: string, targetVersion: number): Promise<Artifact> {
    const artifact = await this.getArtifact({ workflowId, type });
    if (!artifact) {
      throw new Error(`Artifact ${type} not found for workflow ${workflowId}`);
    }

    const target = artifact.versions.find(v => v.version === targetVersion);
    if (!target) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    const newArtifact = await this.createArtifact(
      workflowId,
      type,
      target.content,
      'system',
      `Rollback to version ${targetVersion}`
    );

    this.emit('artifact:rollback', { workflowId, type, fromVersion: artifact.currentVersion, toVersion: targetVersion });

    return newArtifact;
  }

  async listArtifacts(workflowId: string): Promise<Artifact[]> {
    const artifacts = await this.prisma.artifact.findMany({
      where: { workflowId }
    });

    return artifacts.map(a => this.mapToArtifact(a));
  }

  async deleteArtifact(workflowId: string, type: string): Promise<void> {
    const artifactId = `${workflowId}_${type}`;
    
    await this.prisma.artifact.delete({
      where: { id: artifactId }
    });

    this.emit('artifact:deleted', { workflowId, type });
  }

  private mapToArtifact(dbArtifact: any): Artifact {
    return {
      id: dbArtifact.id,
      type: dbArtifact.type,
      workflowId: dbArtifact.workflowId,
      currentVersion: dbArtifact.currentVersion,
      versions: dbArtifact.versions.map((v: any) => ({
        version: v.version,
        content: v.content,
        createdAt: new Date(v.createdAt),
        createdBy: v.createdBy,
        changeSummary: v.changeSummary
      })),
      metadata: dbArtifact.metadata
    };
  }

  private calculateDifferences(contentA: any, contentB: any): any {
    const differences: any = {};
    
    const allKeys = new Set([...Object.keys(contentA || {}), ...Object.keys(contentB || {})]);
    
    for (const key of allKeys) {
      const valA = contentA?.[key];
      const valB = contentB?.[key];
      
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        differences[key] = {
          before: valA,
          after: valB
        };
      }
    }

    return differences;
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export const artifactManager = new ArtifactManager();
