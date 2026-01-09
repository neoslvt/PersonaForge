import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  EdgeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import CustomEdge from './CustomEdge'
import { useDialogStore } from '../store/dialogStore'
import DialogNodeComponent from './DialogNodeComponent'
import SetVariableNode from './SetVariableNode'
import ChangeVariableNode from './ChangeVariableNode'
import SetBackgroundNode from './SetBackgroundNode'
import SoundPlayNode from './SoundPlayNode'
import MusicSetNode from './MusicSetNode'
import IfStatementNode from './IfStatementNode'
import SwitchCaseNode from './SwitchCaseNode'
import SceneDescriptionNode from './SceneDescriptionNode'
import NodeChatPanel from './NodeChatPanel'
import LivePreview from './LivePreview'
import { DialogNode } from '../types/models'
import { getAIService } from '../services/aiService'
import { createDialogNode, createSpecialNode } from '../utils/dialogUtils'
import { generateNodeContext, getLastNPCCharacterId, calculateVariables, collectSceneDescriptions } from '../utils/nodeTree'
import './NodeGraphEditor.css'

const nodeTypes: NodeTypes = {
  dialogNode: DialogNodeComponent,
  setVariable: SetVariableNode,
  changeVariable: ChangeVariableNode,
  setBackground: SetBackgroundNode,
  soundPlay: SoundPlayNode,
  musicSet: MusicSetNode,
  ifStatement: IfStatementNode,
  switchCase: SwitchCaseNode,
  sceneDescription: SceneDescriptionNode,
}

const edgeTypes: EdgeTypes = {
  default: CustomEdge,
}

export default function NodeGraphEditor() {
  const {
    currentDialog,
    currentScene,
    characters,
    addNode,
    linkNodes,
    unlinkNodes,
    saveToHistory,
    undo,
    redo,
    updateNodePositions,
  } = useDialogStore()

  const [chatNodeId, setChatNodeId] = useState<string | null>(null)
  const [chatStartNodeId, setChatStartNodeId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const initialNodes = useMemo(() => {
    if (!currentDialog) return []
    
    const nodes: Node[] = Object.values(currentDialog.nodes).map((node, index) => {
      const savedPosition = currentDialog.nodePositions?.[node.id]
      const defaultPosition = {
        x: (index % 5) * 250,
        y: Math.floor(index / 5) * 150,
      }
      
      // Determine node type based on node.type field, default to 'dialogNode'
      const nodeType = node.type && node.type !== 'dialog' 
        ? node.type 
        : 'dialogNode'
      
      return {
        id: node.id,
        type: nodeType,
        position: savedPosition || defaultPosition,
        data: { node },
      }
    })
    
    return nodes
  }, [currentDialog])

  const initialEdges = useMemo(() => {
    if (!currentDialog) return []
    
    const edges: Edge[] = []
    Object.values(currentDialog.nodes).forEach((node) => {
      if (node.type === 'ifStatement') {
        // For if statements, childNodeIds[0] is true branch, childNodeIds[1] is false branch
        if (node.childNodeIds[0]) {
          edges.push({
            id: `${node.id}-${node.childNodeIds[0]}`,
            source: node.id,
            target: node.childNodeIds[0],
            sourceHandle: 'true',
          })
        }
        if (node.childNodeIds[1]) {
          edges.push({
            id: `${node.id}-${node.childNodeIds[1]}`,
            source: node.id,
            target: node.childNodeIds[1],
            sourceHandle: 'false',
          })
        }
      } else if (node.type === 'switchCase' && node.cases) {
        // For switch cases, each case has its own handle
        node.cases.forEach((caseItem, index) => {
          if (caseItem.nodeId) {
            edges.push({
              id: `${node.id}-${caseItem.nodeId}`,
              source: node.id,
              target: caseItem.nodeId,
              sourceHandle: `case-${index}`,
            })
          }
        })
      } else {
        // For regular nodes, connect all children normally
      node.childNodeIds.forEach((childId) => {
        edges.push({
          id: `${node.id}-${childId}`,
          source: node.id,
          target: childId,
        })
      })
      }
    })
    
    return edges
  }, [currentDialog])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const setNodesRef = useRef(setNodes)
  setNodesRef.current = setNodes

  // Handle edge deletions (when edges are explicitly deleted, e.g., by pressing Delete key or clicking delete button)
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        if (edge.source && edge.target) {
          unlinkNodes(edge.source, edge.target)
        }
      })
      saveToHistory()
    },
    [unlinkNodes, saveToHistory]
  )

  // Handle custom delete edge event from CustomEdge component
  useEffect(() => {
    const handleDeleteEdge = (e: CustomEvent) => {
      const edgeId = e.detail.edgeId
      const edge = edges.find((ed) => ed.id === edgeId)
      if (edge && edge.source && edge.target) {
        // Remove the edge from ReactFlow
        setEdges((eds) => eds.filter((ed) => ed.id !== edgeId))
        // Unlink nodes in the store
        unlinkNodes(edge.source, edge.target)
        saveToHistory()
      }
    }

    window.addEventListener('deleteEdge' as any, handleDeleteEdge as EventListener)
    return () => {
      window.removeEventListener('deleteEdge' as any, handleDeleteEdge as EventListener)
    }
  }, [edges, setEdges, unlinkNodes, saveToHistory])

  // Enhanced onEdgesChange to also handle deletions from the UI
  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      // Process deletions from edge changes (e.g., when edge is removed via UI interaction)
      const deletionChanges = changes.filter((change) => change.type === 'remove')
      if (deletionChanges.length > 0) {
        deletionChanges.forEach((change) => {
          const edge = edges.find((e) => e.id === change.id)
          if (edge && edge.source && edge.target) {
            unlinkNodes(edge.source, edge.target)
          }
        })
        saveToHistory()
      }
      
      // Call the default handler to update ReactFlow's internal state
      onEdgesChange(changes)
    },
    [edges, onEdgesChange, unlinkNodes, saveToHistory]
  )

  useEffect(() => {
    if (!currentDialog) return
    
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]))
      
      const updatedNodes = initialNodes.map((node) => {
        const existingPosition = positionMap.get(node.id)
        if (existingPosition) {
          return { ...node, position: existingPosition }
        }
        return node
      })
      
      return updatedNodes
    })
    
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges, currentDialog])

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (currentDialog) {
        updateNodePositions({ [node.id]: node.position })
      }
    },
    [updateNodePositions, currentDialog]
  )

  const handleGenerateResponse = useCallback(
    async (nodeId: string) => {
      if (!currentDialog) return
      
      const node = currentDialog.nodes[nodeId]
      if (!node || node.speaker !== 'player') return
      
      const parentNodeId = node.parentNodeIds[0]
      if (!parentNodeId) {
        alert('No parent NPC node found. Connect this node to an NPC node first.')
        return
      }
      
      const parentNode = currentDialog.nodes[parentNodeId]
      if (!parentNode || parentNode.speaker !== 'NPC') {
        alert('Parent node is not an NPC. Connect to an NPC node first.')
        return
      }
      
      if (!parentNode.characterId) {
        alert('Please select a character for the parent NPC node first.')
        return
      }
      
      const character = characters[parentNode.characterId]
      if (!character) {
        alert('Character not found. Please select a valid character for the NPC node.')
        return
      }
      
      const context = generateNodeContext(
        currentDialog.nodes,
        currentDialog.rootNodeId,
        nodeId
      )
      
      const inheritedCharacterId = getLastNPCCharacterId(
        currentDialog.nodes,
        currentDialog.rootNodeId,
        nodeId
      ) || parentNode.characterId
      
      // Calculate variables and collect scene descriptions
      const variables = calculateVariables(
        currentDialog.nodes,
        currentDialog.rootNodeId,
        nodeId
      )
      const sceneDescriptions = collectSceneDescriptions(
        currentDialog.nodes,
        currentDialog.rootNodeId,
        nodeId
      )
      
      const aiService = getAIService()
      
      try {
        const response = await aiService.generateNPCResponse(
          context,
          character,
          currentScene || undefined,
          variables,
          sceneDescriptions
        )
        
        // Detect emotion from the response
        const detectedEmotion = await aiService.detectEmotion(
          response,
          character,
          variables,
          sceneDescriptions
        )
        
        const newNodeId = `node_${Date.now()}`
        const newNode: DialogNode = {
          id: newNodeId,
          speaker: 'NPC',
          text: response,
          characterId: inheritedCharacterId,
          childNodeIds: [],
          parentNodeIds: [nodeId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          showAvatar: true,
          emotion: detectedEmotion as any,
        }
        
        addNode(newNode)
        linkNodes(nodeId, newNodeId)
        
        // Analyze response and create variable nodes if needed
        const nodeActions = await aiService.analyzeAndCreateNodes(
          response,
          character,
          variables,
          sceneDescriptions
        )
        
        let lastNodeId = newNodeId
        const autoCreatedNodes: DialogNode[] = []
        
        for (const action of nodeActions) {
          const actionNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          let actionNode: DialogNode
          
          if (action.type === 'setVariable') {
            actionNode = {
              id: actionNodeId,
              type: 'setVariable',
              speaker: 'NPC',
              text: '',
              variableName: action.variableName,
              variableValue: action.variableValue,
              childNodeIds: [],
              parentNodeIds: [lastNodeId],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          } else {
            actionNode = {
              id: actionNodeId,
              type: 'changeVariable',
              speaker: 'NPC',
              text: '',
              variableName: action.variableName,
              variableOperation: action.variableOperation,
              variableValue: action.variableValue,
              childNodeIds: [],
              parentNodeIds: [lastNodeId],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }
          
          addNode(actionNode)
          linkNodes(lastNodeId, actionNodeId)
          autoCreatedNodes.push(actionNode)
          lastNodeId = actionNodeId
        }
        
        saveToHistory()
        
        setNodesRef.current((nds) => {
          const existingNode = nds.find((n) => n.id === newNodeId)
          if (existingNode) {
            // If the dialog node already exists, just add the auto-created nodes
            const newFlowNodes: Node[] = []
            let currentY = existingNode.position.y + 150
            
            autoCreatedNodes.forEach((actionNode) => {
              const existingActionNode = nds.find((n) => n.id === actionNode.id)
              if (!existingActionNode) {
                newFlowNodes.push({
                  id: actionNode.id,
                  type: actionNode.type || 'setVariable',
                  position: {
                    x: existingNode.position.x,
                    y: currentY,
                  },
                  data: { node: actionNode },
                })
                currentY += 100
              }
            })
            
            return newFlowNodes.length > 0 ? [...nds, ...newFlowNodes] : nds
          }
          
          const parentNode = nds.find((n) => n.id === nodeId)
          const parentPosition = parentNode?.position || { x: 0, y: 0 }
          
          const flowNodes: Node[] = [{
              id: newNodeId,
              type: 'dialogNode',
              position: {
                x: parentPosition.x,
                y: parentPosition.y + 150,
              },
              data: { node: newNode },
          }]
          
          // Add auto-created nodes
          let currentY = parentPosition.y + 250
          autoCreatedNodes.forEach((actionNode) => {
            flowNodes.push({
              id: actionNode.id,
              type: actionNode.type || 'setVariable',
              position: {
                x: parentPosition.x,
                y: currentY,
              },
              data: { node: actionNode },
            })
            currentY += 100
          })
          
          return [...nds, ...flowNodes]
        })
        
        // Add edges for auto-created nodes
        if (autoCreatedNodes.length > 0) {
          setEdges((eds) => {
            const newEdges: Edge[] = []
            let prevNodeId = newNodeId
            
            autoCreatedNodes.forEach((actionNode) => {
              const edgeId = `${prevNodeId}-${actionNode.id}`
              if (!eds.find(e => e.id === edgeId)) {
                newEdges.push({
                  id: edgeId,
                  source: prevNodeId,
                  target: actionNode.id,
                })
              }
              prevNodeId = actionNode.id
            })
            
            return newEdges.length > 0 ? [...eds, ...newEdges] : eds
          })
        }
      } catch (error) {
        console.error('Error generating AI response:', error)
      }
    },
    [currentDialog, characters, currentScene, addNode, linkNodes, saveToHistory]
  )

  const handleAddPlayerResponse = useCallback(
    (parentNodeId: string) => {
      if (!currentDialog) return
      
      const parentNode = currentDialog.nodes[parentNodeId]
      if (!parentNode || parentNode.speaker !== 'NPC') return
      
      const newNode = createDialogNode('player', '[Player response]', [parentNodeId])
      
      addNode(newNode)
      linkNodes(parentNodeId, newNode.id)
      saveToHistory()
      
      setNodesRef.current((nds) => {
        const existingNode = nds.find((n) => n.id === newNode.id)
        if (existingNode) return nds
        
        const parentFlowNode = nds.find((n) => n.id === parentNodeId)
        const parentPosition = parentFlowNode?.position || { x: 0, y: 0 }
        
        const siblingCount = parentNode.childNodeIds.length
        const newPosition = {
          x: parentPosition.x + (siblingCount > 0 ? siblingCount * 220 : 0),
          y: parentPosition.y + 150,
        }
        
        return [
          ...nds,
          {
            id: newNode.id,
            type: 'dialogNode',
            position: newPosition,
            data: { node: newNode },
          },
        ]
      })
      
      setEdges((eds) => [
        ...eds,
        {
          id: `${parentNodeId}-${newNode.id}`,
          source: parentNodeId,
          target: newNode.id,
        },
      ])
    },
    [currentDialog, addNode, linkNodes, saveToHistory, setEdges]
  )

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setChatNodeId(nodeId)
    setChatStartNodeId(nodeId)
  }, [])

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onGenerate: handleGenerateResponse,
          onAddPlayerResponse: handleAddPlayerResponse,
          onDoubleClick: handleNodeDoubleClick,
        },
      }))
    )
  }, [handleGenerateResponse, handleAddPlayerResponse, handleNodeDoubleClick, setNodes])

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        const sourceNode = currentDialog?.nodes[params.source]
        
        // For if statement nodes, we need to handle true/false branches
        if (sourceNode?.type === 'ifStatement' && params.sourceHandle) {
          // sourceHandle will be "true" or "false"
          const isTrueBranch = params.sourceHandle === 'true'
          
          // Get current children
          const currentChildren = [...(sourceNode.childNodeIds || [])]
          
          // Update the correct branch
          if (isTrueBranch) {
            // True branch is at index 0
            if (currentChildren[0] && currentChildren[0] !== params.target) {
              // Remove old true branch connection
              unlinkNodes(params.source, currentChildren[0])
            }
            currentChildren[0] = params.target
          } else {
            // False branch is at index 1
            if (currentChildren[1] && currentChildren[1] !== params.target) {
              // Remove old false branch connection
              unlinkNodes(params.source, currentChildren[1])
            }
            // Ensure array has at least 2 elements
            while (currentChildren.length < 2) {
              currentChildren.push('')
            }
            currentChildren[1] = params.target
          }
          
          // Update the node with new childNodeIds
          const { updateNode } = useDialogStore.getState()
          updateNode(params.source, { childNodeIds: currentChildren.filter(id => id !== '') })
          
          // Also update the target node's parentNodeIds
          linkNodes(params.source, params.target)
        } else {
          // For regular nodes, use normal linking
        linkNodes(params.source, params.target)
        }
        
        setEdges((eds) => addEdge(params, eds))
        saveToHistory()
      }
    },
    [currentDialog, linkNodes, unlinkNodes, setEdges, saveToHistory]
  )

  const handleAddNode = useCallback(() => {
    if (!currentDialog) return
    
    const newNode = createDialogNode('player', '', [])
    
    addNode(newNode)
    saveToHistory()
    
            if (!currentDialog.rootNodeId) {
              useDialogStore.setState({
                currentDialog: currentDialog ? { ...currentDialog, rootNodeId: newNode.id } : null
              })
            }
    
    setNodes((nds) => {
      const newPosition = {
        x: (nds.length % 5) * 250,
        y: Math.floor(nds.length / 5) * 150,
      }
      
      return [
        ...nds,
        {
          id: newNode.id,
          type: 'dialogNode',
          position: newPosition,
          data: { node: newNode },
        },
      ]
    })
  }, [currentDialog, addNode, saveToHistory, setNodes])

  const handleAddSpecialNode = useCallback((nodeType: string) => {
    if (!currentDialog) return
    
    const newNode = createSpecialNode(nodeType as any)
    
    addNode(newNode)
    saveToHistory()
    
    setNodes((nds) => {
      const newPosition = {
        x: (nds.length % 5) * 250,
        y: Math.floor(nds.length / 5) * 150,
      }
      
      return [
        ...nds,
        {
          id: newNode.id,
          type: nodeType,
          position: newPosition,
          data: { node: newNode },
        },
      ]
    })
  }, [currentDialog, addNode, saveToHistory, setNodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  if (!currentDialog) {
    return (
      <div className="node-graph-empty">
        <p>No dialog loaded. Create a new dialog from the Dialog menu.</p>
      </div>
    )
  }

  return (
    <div className="node-graph-editor">
      <div className="node-graph-toolbar">
        <div className="node-graph-toolbar-group">
          <button onClick={handleAddNode}>Add Dialog Node</button>
          <div className="node-graph-dropdown">
            <button className="node-graph-dropdown-button">Add Special Node ▼</button>
            <div className="node-graph-dropdown-content">
              <button onClick={() => handleAddSpecialNode('setVariable')}>Set Variable</button>
              <button onClick={() => handleAddSpecialNode('changeVariable')}>Change Variable</button>
              <button onClick={() => handleAddSpecialNode('setBackground')}>Set Background</button>
              <button onClick={() => handleAddSpecialNode('soundPlay')}>Play Sound</button>
              <button onClick={() => handleAddSpecialNode('musicSet')}>Set Music</button>
              <button onClick={() => handleAddSpecialNode('ifStatement')}>If Statement</button>
              <button onClick={() => handleAddSpecialNode('switchCase')}>Switch Case</button>
              <button onClick={() => handleAddSpecialNode('sceneDescription')}>Scene Description</button>
            </div>
          </div>
        </div>
        <div className="node-graph-toolbar-group">
        <button onClick={undo}>Undo (Ctrl+Z)</button>
        <button onClick={redo}>Redo (Ctrl+Y)</button>
        <button onClick={() => setShowPreview(true)} className="play-button">
          ▶ Play
        </button>
        </div>
        <div className="node-graph-info">
          <span>Connect nodes by dragging from output (bottom) to input (top)</span>
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        connectionLineStyle={{ stroke: '#007acc', strokeWidth: 2 }}
        defaultEdgeOptions={{ 
          type: 'default',
          style: { stroke: '#007acc', strokeWidth: 2 },
          deletable: true
        }}
      >
        <Controls />
        <Background />
        <MiniMap />
      </ReactFlow>
      {chatNodeId && (
        <NodeChatPanel
          nodeId={chatNodeId}
          onClose={() => {
            setChatNodeId(null)
            setChatStartNodeId(null)
          }}
          onNodeChange={(newNodeId) => {
            setChatNodeId(newNodeId)
            const latestDialog = useDialogStore.getState().currentDialog
            if (latestDialog && chatStartNodeId) {
              const findDescendants = (nodeId: string, visited: Set<string> = new Set()): string[] => {
                if (visited.has(nodeId)) return []
                visited.add(nodeId)
                
                const node = latestDialog.nodes[nodeId]
                if (!node) return []
                
                const descendants: string[] = [nodeId]
                node.childNodeIds.forEach(childId => {
                  descendants.push(...findDescendants(childId, visited))
                })
                
                return descendants
              }
              
              const descendantIds = new Set(findDescendants(chatStartNodeId))
              
              setNodes((nds) => {
                const existingIds = new Set(nds.map((n) => n.id))
                const newNodes: Node[] = []
                const newNodesMap = new Map<string, Node>()
                
                const startNode = nds.find((n) => n.id === chatStartNodeId)
                if (!startNode) return nds
                
                const allNewNodes = Object.values(latestDialog.nodes).filter(
                  (node) => !existingIds.has(node.id)
                )
                
                const sortedNewNodes: typeof allNewNodes = []
                const remainingNodes = new Set(allNewNodes)
                const processedIds = new Set(existingIds)
                
                while (remainingNodes.size > 0) {
                  let foundAny = false
                  
                  for (const node of remainingNodes) {
                    const parentId = node.parentNodeIds[0]
                    if (!parentId || processedIds.has(parentId)) {
                      sortedNewNodes.push(node)
                      remainingNodes.delete(node)
                      processedIds.add(node.id)
                      foundAny = true
                    }
                  }
                  
                  if (!foundAny) {
                    remainingNodes.forEach(node => {
                      sortedNewNodes.push(node)
                      processedIds.add(node.id)
                    })
                    remainingNodes.clear()
                  }
                }
                
                sortedNewNodes.forEach((node) => {
                  const isDescendant = descendantIds.has(node.id)
                  
                  const parentId = node.parentNodeIds[0]
                  let parentNode: Node | undefined
                  
                  if (parentId) {
                    parentNode = nds.find((n) => n.id === parentId)
                  }
                  
                  if (!parentNode && parentId) {
                    parentNode = newNodesMap.get(parentId)
                  }
                  
                  if (!parentNode && isDescendant) {
                    const currentChatNode = nds.find((n) => n.id === chatNodeId) || startNode
                    parentNode = currentChatNode
                  }
                  
                  if (!parentNode && parentId) {
                    console.warn(`Could not find parent node ${parentId} for node ${node.id}`)
                  }
                  
                  const parentPosition = parentNode?.position || { x: 0, y: 0 }
                  
                  const newPosition = {
                    x: parentPosition.x,
                    y: parentPosition.y + 150,
                  }
                  
                  const newNode: Node = {
                    id: node.id,
                    type: 'dialogNode',
                    position: newPosition,
                    data: { node },
                  }
                  
                  newNodes.push(newNode)
                  newNodesMap.set(node.id, newNode)
                })
                
                if (newNodes.length > 0) {
                  const positionsToSave: Record<string, { x: number; y: number }> = {}
                  newNodes.forEach((n) => {
                    positionsToSave[n.id] = n.position
                  })
                  updateNodePositions(positionsToSave)
                }
                
                return [...nds, ...newNodes]
              })
              
              setEdges((eds) => {
                const existingEdgeIds = new Set(eds.map((e) => e.id))
                const newEdges: Edge[] = []
                
                Object.values(latestDialog.nodes).forEach((node) => {
                  node.childNodeIds.forEach((childId) => {
                    const edgeId = `${node.id}-${childId}`
                    if (!existingEdgeIds.has(edgeId)) {
                      newEdges.push({
                        id: edgeId,
                        source: node.id,
                        target: childId,
                      })
                    }
                  })
                })
                
                return [...eds, ...newEdges]
              })
            }
          }}
        />
      )}
      {showPreview && (
        <div className="node-graph-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="node-graph-preview-container" onClick={(e) => e.stopPropagation()}>
            <div className="node-graph-preview-header">
              <h3>Live Preview</h3>
              <button 
                className="node-graph-preview-close"
                onClick={() => setShowPreview(false)}
                title="Close Preview"
              >
                ×
              </button>
            </div>
            <div className="node-graph-preview-content">
              <LivePreview />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
