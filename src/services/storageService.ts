import { Dialog, Character, Scene } from '../types/models'

declare global {
  interface Window {
    electronAPI?: {
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, data: string) => Promise<void>
      readDir: (path: string) => Promise<string[]>
      mkdir: (path: string) => Promise<void>
      exists: (path: string) => Promise<boolean>
      joinPath: (...paths: string[]) => string
      getUserDataPath: () => Promise<string>
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>
      showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>
    }
  }
}

export class StorageService {
  private basePath: string = 'characters'
  
  async ensureBaseDirectory(): Promise<void> {
    if (window.electronAPI) {
      const exists = await window.electronAPI.exists(this.basePath)
      if (!exists) {
        await window.electronAPI.mkdir(this.basePath)
      }
    }
  }
  
  async saveDialog(dialog: Dialog, filePath?: string): Promise<void> {
    if (!window.electronAPI) {
      console.warn('Electron API not available, saving to localStorage')
      localStorage.setItem(`dialog_${dialog.id}`, JSON.stringify(dialog))
      return
    }
    
    await this.ensureBaseDirectory()
    
    const path = filePath || window.electronAPI.joinPath(this.basePath, `${dialog.id}.dialog.json`)
    await window.electronAPI.writeFile(path, JSON.stringify(dialog, null, 2))
  }
  
  async loadDialog(filePath: string): Promise<Dialog> {
    if (!window.electronAPI) {
      const data = localStorage.getItem(`dialog_${filePath}`)
      if (!data) throw new Error('Dialog not found')
      return JSON.parse(data)
    }
    
    const data = await window.electronAPI.readFile(filePath)
    return JSON.parse(data)
  }
  
  async saveCharacter(character: Character): Promise<void> {
    if (!window.electronAPI) {
      localStorage.setItem(`character_${character.id}`, JSON.stringify(character))
      return
    }
    
    await this.ensureBaseDirectory()
    
    const charDir = window.electronAPI.joinPath(this.basePath, character.id)
    const exists = await window.electronAPI.exists(charDir)
    if (!exists) {
      await window.electronAPI.mkdir(charDir)
    }
    
    const charFile = window.electronAPI.joinPath(charDir, 'character.json')
    await window.electronAPI.writeFile(charFile, JSON.stringify(character, null, 2))
  }
  
  async loadCharacter(characterId: string): Promise<Character> {
    if (!window.electronAPI) {
      const data = localStorage.getItem(`character_${characterId}`)
      if (!data) throw new Error('Character not found')
      return JSON.parse(data)
    }
    
    const charDir = window.electronAPI.joinPath(this.basePath, characterId)
    const charFile = window.electronAPI.joinPath(charDir, 'character.json')
    
    const data = await window.electronAPI.readFile(charFile)
    return JSON.parse(data)
  }
  
  async listCharacters(): Promise<string[]> {
    if (!window.electronAPI) {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith('character_'))
      return keys.map((key) => key.replace('character_', ''))
    }
    
    await this.ensureBaseDirectory()
    const entries = await window.electronAPI.readDir(this.basePath)
    
    const characters: string[] = []
    for (const entry of entries) {
      const charDir = window.electronAPI!.joinPath(this.basePath, entry)
      const charFile = window.electronAPI!.joinPath(charDir, 'character.json')
      const exists = await window.electronAPI!.exists(charFile)
      if (exists) {
        characters.push(entry)
      }
    }
    
    return characters
  }
  
  async saveScene(scene: Scene): Promise<void> {
    if (!window.electronAPI) {
      localStorage.setItem(`scene_${scene.id}`, JSON.stringify(scene))
      return
    }
    
    await this.ensureBaseDirectory()
    
    const sceneDir = window.electronAPI.joinPath(this.basePath, 'scenes')
    const exists = await window.electronAPI.exists(sceneDir)
    if (!exists) {
      await window.electronAPI.mkdir(sceneDir)
    }
    
    const sceneFile = window.electronAPI.joinPath(sceneDir, `${scene.id}.json`)
    await window.electronAPI.writeFile(sceneFile, JSON.stringify(scene, null, 2))
  }
  
  async loadScene(sceneId: string): Promise<Scene> {
    if (!window.electronAPI) {
      const data = localStorage.getItem(`scene_${sceneId}`)
      if (!data) throw new Error('Scene not found')
      return JSON.parse(data)
    }
    
    const sceneDir = window.electronAPI.joinPath(this.basePath, 'scenes')
    const sceneFile = window.electronAPI.joinPath(sceneDir, `${sceneId}.json`)
    
    const data = await window.electronAPI.readFile(sceneFile)
    return JSON.parse(data)
  }
}

export const storageService = new StorageService()

