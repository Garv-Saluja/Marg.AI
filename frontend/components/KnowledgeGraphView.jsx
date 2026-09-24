"use client";

import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import { graphApi } from "../lib/api";

export default function KnowledgeGraphView({ subjectId }) {
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadGraph() {
      try {
        setError(false);
        const result = await graphApi.subjectGraph(subjectId);
        setGraph(result);
      } catch (err) {
        setGraph({ nodes: [], edges: [] });
        setError(true);
      }
    }

    if (subjectId) {
      loadGraph();
    }
  }, [subjectId]);

  const { nodes, edges, topicCount } = useMemo(() => {
    if (!graph) {
      return {
        nodes: [],
        edges: [],
        topicCount: 0,
      };
    }

    const topics = [
      ...new Set(
        graph.nodes
          .map((node) => node.topic)
          .filter(Boolean)
      ),
    ];

    const nodes = graph.nodes.map((node) => {
      const topicIndex = Math.max(
        topics.indexOf(node.topic),
        0
      );

      const topicNodes = graph.nodes.filter(
        (item) => item.topic === node.topic
      );

      const indexInTopic = topicNodes.indexOf(node);

      return {
        id: node.id,
        data: {
          label: node.label,
        },
        position: {
          x: topicIndex * 280,
          y: indexInTopic * 105,
        },
        style: {
          width: 210,
          padding: "14px 16px",
          borderRadius: 0,
          border: "1px solid #202020",
          background: "#ffffff",
          color: "#202020",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "none",
        },
      };
    });

    const edges = graph.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: "requires",
      animated: true,
      style: {
        stroke: "#ea2804",
        strokeWidth: 1.5,
      },
      labelStyle: {
        fill: "#646464",
        fontSize: 10,
        fontFamily: "JetBrains Mono, monospace",
      },
      labelBgStyle: {
        fill: "#f9f7f3",
        fillOpacity: 0.95,
      },
      markerEnd: {
        type: "arrowclosed",
        color: "#ea2804",
      },
    }));

    return {
      nodes,
      edges,
      topicCount: topics.length,
    };
  }, [graph]);

  if (!graph) {
    return (
      <div className="marg-graph-loading">
        <div className="marg-card-kicker">
          KNOWLEDGE GRAPH
        </div>

        <h3>Building your concept map...</h3>

        <div className="marg-loading-line" />
        <div className="marg-loading-line short" />
      </div>
    );
  }

  if (error || nodes.length === 0) {
    return (
      <div className="marg-graph-empty">
        <div className="marg-graph-empty-icon">+</div>

        <div>
          <div className="marg-card-kicker">
            KNOWLEDGE GRAPH
          </div>

          <h3>
            {error
              ? "We couldn't load the knowledge graph."
              : "No concepts mapped yet."}
          </h3>

          <p>
            {error
              ? "Try refreshing the page or checking the subject."
              : "Process a syllabus to build the concept graph."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="marg-graph-wrapper">
      <div className="marg-graph-header">
        <div>
          <div className="marg-card-kicker">
            KNOWLEDGE GRAPH
          </div>

          <h2>How the concepts connect.</h2>

          <p>
            Prerequisite relationships are shown as{" "}
            <strong>requires</strong> connections.
          </p>
        </div>

        <div className="marg-graph-stats">
          <div>
            <strong>{nodes.length}</strong>
            <span>CONCEPTS</span>
          </div>

          <div>
            <strong>{edges.length}</strong>
            <span>RELATIONSHIPS</span>
          </div>

          <div>
            <strong>{topicCount}</strong>
            <span>TOPICS</span>
          </div>
        </div>
      </div>

      <div className="marg-graph-canvas">
        <div className="marg-graph-label">
          MARG.AI / CONCEPT MAP
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{
            padding: 0.2,
          }}
          attributionPosition="bottom-left"
        >
          <Background
            color="#d8d5cf"
            gap={24}
            size={1}
          />

          <Controls />

          <MiniMap
            nodeColor="#ea2804"
            maskColor="rgba(249,247,243,0.75)"
          />
        </ReactFlow>
      </div>
    </section>
  );
}