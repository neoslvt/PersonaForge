import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface IfStatementNodeData {
  node: DialogNode
}

export default function IfStatementNode({ data, id }: NodeProps<IfStatementNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [conditionVariable, setConditionVariable] = useState(node.conditionVariable || '')
  const [conditionValue, setConditionValue] = useState(node.conditionValue?.toString() || '')

  useEffect(() => {
    setConditionVariable(node.conditionVariable || '')
    setConditionValue(node.conditionValue?.toString() || '')
  }, [node.conditionVariable, node.conditionValue])

  const handleVariableChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConditionVariable(e.target.value)
    },
    []
  )

  const handleVariableBlur = useCallback(() => {
    updateNode(id, { conditionVariable: conditionVariable || undefined })
  }, [id, conditionVariable, updateNode])

  const handleOperatorChange = useCallback(
    (conditionOperator: string) => {
      updateNode(id, { conditionOperator: conditionOperator as any })
    },
    [id, updateNode]
  )

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConditionValue(e.target.value)
    },
    []
  )

  const handleValueBlur = useCallback(() => {
    const numValue = parseFloat(conditionValue)
    updateNode(id, { 
      conditionValue: conditionValue === '' ? undefined : (isNaN(numValue) ? conditionValue : numValue)
    })
  }, [id, conditionValue, updateNode])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  return (
    <div className="dialog-node dialog-node-if">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">If Statement</span>
        <button 
          onClick={handleDelete} 
          className="dialog-node-delete" 
          title="Delete node"
        >
          ×
        </button>
      </div>
      
      <div className="dialog-node-content">
        <div className="dialog-node-field">
          <label>Variable:</label>
          <input
            type="text"
            value={conditionVariable}
            onChange={handleVariableChange}
            onBlur={handleVariableBlur}
            placeholder="variable_name"
            className="dialog-node-input"
          />
        </div>
        <div className="dialog-node-field">
          <label>Operator:</label>
          <select
            value={node.conditionOperator || '=='}
            onChange={(e) => handleOperatorChange(e.target.value)}
            className="dialog-node-select"
          >
            <option value="==">== (equals)</option>
            <option value="!=">!= (not equals)</option>
            <option value=">">&gt; (greater than)</option>
            <option value="<">&lt; (less than)</option>
            <option value=">=">&gt;= (greater or equal)</option>
            <option value="<=">&lt;= (less or equal)</option>
          </select>
        </div>
        <div className="dialog-node-field">
          <label>Value:</label>
          <input
            type="text"
            value={conditionValue}
            onChange={handleValueChange}
            onBlur={handleValueBlur}
            placeholder="0 or text"
            className="dialog-node-input"
          />
        </div>
      </div>
      
      <div className="dialog-node-branches">
        <div className="dialog-node-branch">
          <span className="dialog-node-branch-label">True</span>
          <Handle type="source" position={Position.Bottom} id="true" />
        </div>
        <div className="dialog-node-branch">
          <span className="dialog-node-branch-label">False</span>
          <Handle type="source" position={Position.Bottom} id="false" />
        </div>
      </div>
    </div>
  )
}

