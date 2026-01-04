export type Speaker = 'NPC' | 'player'

export interface DialogNode {
  id: string
  speaker: Speaker
  text: string
  characterId?: string
  childNodeIds: string[]
  parentNodeIds: string[]
  createdAt: number
  updatedAt: number
}

export interface Scene {
  id: string
  description: string
  backgroundImagePath?: string
  dialogNodeId?: string
  createdAt: number
  updatedAt: number
}

export interface Character {
  id: string
  name: string
  personality: string
  visualPrompt: string
  imagePath?: string
  createdAt: number
  updatedAt: number
}

export interface Dialog {
  id: string
  characterId?: string
  rootNodeId: string | null
  nodes: Record<string, DialogNode>
  nodePositions?: Record<string, { x: number; y: number }>
  sceneId?: string
  createdAt: number
  updatedAt: number
}

