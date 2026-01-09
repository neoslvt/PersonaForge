export type Speaker = 'NPC' | 'player'
export type NodeType = 'dialog' | 'setVariable' | 'changeVariable' | 'setBackground' | 'soundPlay' | 'musicSet' | 'ifStatement' | 'switchCase' | 'sceneDescription'
export type Emotion = 'excited' | 'horny' | 'flirt' | 'very happy' | 'happy cry' | 'shy' | 'happy' | 'neutral' | 'questioning' | 'thinking' | 'surprised' | 'confused' | 'disappointed' | 'angry' | 'little sad' | 'sad' | 'cry'

export interface DialogNode {
  id: string
  type?: NodeType // Defaults to 'dialog' for backward compatibility
  speaker: Speaker
  text: string
  characterId?: string
  childNodeIds: string[]
  parentNodeIds: string[]
  createdAt: number
  updatedAt: number
  // Avatar and emotion (for NPC dialog nodes)
  showAvatar?: boolean
  emotion?: Emotion
  // Variable nodes
  variableName?: string
  variableValue?: string | number
  variableOperation?: 'set' | 'add' | 'subtract'
  // Background node
  backgroundImage?: string
  // Sound/Music nodes
  soundFile?: string
  musicFile?: string
  fadeIn?: number // seconds
  fadeOut?: number // seconds
  // If statement node
  conditionVariable?: string
  conditionOperator?: '==' | '!=' | '>' | '<' | '>=' | '<='
  conditionValue?: string | number
  // Switch case node
  switchVariable?: string
  cases?: Array<{ value: string | number; nodeId?: string }>
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

