"use client";
import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { graphApi } from "../lib/api";

// Renders a subject's concept graph. Concepts flow left-to-right by unit/topic;
// edges are REQUIRES relationships pulled straight from the ai-service /graph
// endpoints (which read Neo4j).
//
// Usage: <KnowledgeGraphView subjectId="dbms" />
export default function KnowledgeGraphView({ subjectId }) {
  const [graph, setGraph] = useState(null);

  useEffect(() => {
    graphApi.subjectGraph(subjectId).then(setGraph).catch(() => setGraph({ nodes: [], edges: [] }));
  }, [subjectId]);

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };

    // Naive layout: group by topic, lay out in columns. Good enough for a
    // capstone demo; swap for dagre/elk auto-layout if the graph gets large.
    const topics = [...new Set(graph.nodes.map((n) => n.topic))];
    const nodes = graph.nodes.map((n, i) => {
      const topicIndex = topics.indexOf(n.topic);
      const indexInTopic = graph.nodes.filter((x) => x.topic === n.topic).indexOf(n);
      return {
        id: n.id,
        data: { label: n.label },
        position: { x: topicIndex * 260, y: indexInTopic * 90 },
        style: { borderRadius: 8, border: "1px solid #ccc", padding: 8, background: "#fff" },
      };
    });
    const edges = graph.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: "requires",
      animated: true,
    }));
    return { nodes, edges };
  }, [graph]);

  if (!graph) return <p>Loading knowledge graph...</p>;

  return (
    <div style={{ height: 500, background: "#fafafa", borderRadius: 8, border: "1px solid #eee" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
