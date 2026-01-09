import { useCallback } from 'react'
import { BaseEdge, EdgeProps, getBezierPath, useReactFlow } from 'reactflow'

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const onDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setEdges((edges) => edges.filter((edge) => edge.id !== id))
      // Dispatch custom event for the parent to handle unlinking
      window.dispatchEvent(
        new CustomEvent('deleteEdge', {
          detail: { edgeId: id },
        })
      )
    },
    [id, setEdges]
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      <foreignObject
        width={100}
        height={40}
        x={labelX - 50}
        y={labelY - 20}
        className="edge-button-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div className="edge-button-wrapper">
          <button
            className="edge-delete-button"
            onClick={onDelete}
            title="Delete connection"
          >
            ×
          </button>
        </div>
      </foreignObject>
    </>
  )
}

