import React, { useState } from "react";
import "./index.css";

const data = {
  name: "indicators",
  type: "operation",
  children: [
    {
      name: "MACD",
      type: "operation",
      children: {
        name: "cross",
        type: "operation",
        children: [
          {
            name: "12",
            type: "operation",
            circle: {
              value: "2",
              node: ["EMA", "close"],
              group: "MACD_EMA_close",
            },
          },
          {
            name: "26",
            type: "operation",
            circle: {
              value: "2",
              node: ["EMA", "close"],
              group: "MACD_EMA_close",
            },
          },
        ],
      },
    },
    {
      name: "RSI",
      type: "operation",
      children: {
        name: "cross",
        type: "operation",
        children: [
          { name: "30", type: "value" },
          { name: "rsi(close,9)", type: "operation" },
          { name: "70", type: "value" },
        ],
      },
    },
    {
      name: "boll",
      type: "operation",
      children: {
        name: "cross",
        type: "operation",
        children: [
          { name: "close", type: "value" },
          {
            name: "+",
            type: "operation",
            circle: {
              value: "2",
              node: ["SMA(close, 9)", "movingstd(close, 9)"],
              group: "boll_plus_minus",
            },
            children: [
              {
                name: "SMA",
                type: "operation",
                circle: {
                  value: "2",
                  node: ["close", "9"],
                  group: "boll_sma_std",
                },
              },
              {
                name: "*",
                type: "operation",
                children: [
                  { name: "2", type: "value" },
                  {
                    name: "movingstd",
                    type: "operation",
                    circle: {
                      value: "2",
                      node: ["close", "9"],
                      group: "boll_sma_std",
                    },
                  },
                ],
              },
            ],
          },
          {
            name: "-",
            type: "operation",
            circle: {
              value: "2",
              node: ["SMA(close, 9)", "movingstd(close, 9)"],
              group: "boll_plus_minus",
            },
            children: [
              {
                name: "SMA",
                type: "operation",
                circle: {
                  value: "2",
                  node: ["close", "9"],
                  group: "boll_sma_std",
                },
              },
              {
                name: "*",
                type: "operation",
                children: [
                  { name: "2", type: "value" },
                  {
                    name: "movingstd",
                    type: "operation",
                    circle: {
                      value: "2",
                      node: ["close", "9"],
                      group: "boll_sma_std",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
};

// 2. 递归组件：渲染当前节点，并对其所有子节点进行递归渲染
function NodeBox({ node, hoveredGroup, setHoveredGroup }) {
  // 先把孩子统一转成数组形式
  let childrenArray = [];
  if (Array.isArray(node.children)) {
    childrenArray = node.children;
  } else if (node.children && typeof node.children === "object") {
    childrenArray = [node.children];
  }

  // 判断有没有子节点
  const hasChildren = childrenArray.length > 0;

  // 如果节点自带 circle，则渲染对应数量的小圆
  const hasCircle = !!node.circle;
  let circleCount = 0;
  let circleNodes = [];
  let circleGroup = null;
  if (hasCircle) {
    circleCount = parseInt(node.circle.value, 10) || 0; // 转换成数字
    circleNodes = node.circle.node || [];
    circleGroup = node.circle.group || null;
  }

  const handleCircleMouseEnter = () => {
    if (circleGroup) {
      setHoveredGroup(circleGroup);
    }
  };
  const handleCircleMouseLeave = () => {
    setHoveredGroup(null);
  };

  return (
    <div
      className={`node-box ${node.type === "value" ? "dashed" : ""} ${
        !hasChildren ? "no-children" : ""
      }`}
    >
      {/* 在节点左上角渲染自己的 circle (如果有的话) */}
      {hasCircle && (
        <div className="circle-container">
          {Array.from({ length: circleCount }).map((_, i) => {
            // 判断当前 circle 是否要高亮
            const isHighlight = hoveredGroup && hoveredGroup === circleGroup;

            return (
              <div
                key={i}
                className={`circle ${isHighlight ? "highlight" : ""}`}
                data-tooltip={circleNodes[i] || ""}
                onMouseEnter={handleCircleMouseEnter}
                onMouseLeave={handleCircleMouseLeave}
              />
            );
          })}
        </div>
      )}

      {/* 显示当前节点的信息 */}
      {node.name && <div className="node-title">{node.name}</div>}

      {/* 递归渲染孩子们 */}
      <div className="children-wrapper">
        {childrenArray.map((child, idx) => {
          // 如果 child 没有 name/type，且存在 circle，就认为是纯 circle 节点，跳过
          if (!child.name && !child.type && child.circle) {
            return null;
          }
          return (
            <NodeBox
              key={idx}
              node={child}
              hoveredGroup={hoveredGroup}
              setHoveredGroup={setHoveredGroup}
            />
          );
        })}
      </div>
    </div>
  );
}

// 3. 主组件：渲染整个树
export default function TreeComponent() {
  // 用于存储当前悬浮 circle 的 group，默认为 null
  const [hoveredGroup, setHoveredGroup] = useState(null);

  return (
    <div id="tree">
      <NodeBox
        node={data}
        hoveredGroup={hoveredGroup}
        setHoveredGroup={setHoveredGroup}
      />
    </div>
  );
}
