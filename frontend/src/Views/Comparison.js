import React, { useState, useMemo } from "react";
import { Button, Input, Space, Select } from "antd";
import StrategyMap from "./StrategyMap";
import * as d3 from "d3";

const { Option } = Select;

const initialData = {
  name: "Root Node",
  code: "root",
  value1: 0.8,
  value2: 0.5,
  value3: 0.3,
  children: [
    {
      name: "Node A",
      code: "A",
      value1: 0.2,
      value2: 0.7,
      value3: 0.4,
    },
    {
      name: "Node B",
      code: "B",
      value1: 0.6,
      value2: 0.1,
      value3: 0.9,
      children: [
        { name: "Node C", code: "C", value1: 0.4, value2: 0.8, value3: 0.2 },
        { name: "Node D", code: "D", value1: 0.1, value2: 0.3, value3: 0.85 },
      ],
    },
  ],
};

function traverseTree(root, targetCode, callback, parent = null) {
  if (!root) return;
  if (root.code === targetCode) {
    callback(root, parent);
    return;
  }
  if (root.children) {
    for (let child of root.children) {
      traverseTree(child, targetCode, callback, root);
    }
  }
}

function addChildNode(node, newCode) {
  if (!node.children) {
    node.children = [];
  }
  node.children.push({
    name: `Node ${newCode}`,
    code: newCode,
    value: Math.floor(Math.random() * 10) + 1, // 用随机值做示例
  });
}

function removeNode(root, targetCode) {
  if (!root) return null;

  // 如果就是 root，则整棵树都被删
  if (root.code === targetCode) {
    return null;
  }

  // 否则在 children 中找
  if (root.children) {
    root.children = root.children
      .map((child) => removeNode(child, targetCode))
      .filter(Boolean);
  }
  return root;
}

const Comparison = () => {
  const [treeData, setTreeData] = useState(initialData);
  const [selectedNode, setSelectedNode] = useState(null);
  const [valueKey, setValueKey] = useState("value1");
  const [code, setCode] = useState("");

  const { minVal, maxVal } = useMemo(() => {
    // 1) 将树拍平(或用 d3.hierarchy 也行)
    const allValues = [];
    function traverse(node) {
      if (!node) return;
      if (node[valueKey] !== undefined) {
        allValues.push(node[valueKey]);
      }
      if (node.children) {
        node.children.forEach((c) => traverse(c));
      }
    }
    traverse(treeData);
    const minVal = d3.min(allValues) ?? 0;
    const maxVal = d3.max(allValues) ?? 1;
    return { minVal, maxVal };
  }, [treeData, valueKey]);

  // 点击节点时触发
  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setCode(node.data.code || "");
  };

  // Save：在原节点下新增一个子节点，其 code = 用户输入的新 code
  const handleSave = () => {
    if (!selectedNode) return;

    const oldCode = selectedNode.data.code;
    if (!oldCode) return;

    // 如果用户没有改动 code 或者新 code 为空，就不做事
    if (code === oldCode || !code.trim()) {
      return;
    }

    // 克隆一份 treeData
    let newTree = structuredClone(treeData);

    // 找到 oldCode 对应的节点
    traverseTree(newTree, oldCode, (node, parent) => {
      // 在该节点下新增一个子节点
      addChildNode(node, code);
    });

    setTreeData(newTree);
    setSelectedNode(null);
    setCode("");
  };

  // Delete：删除当前节点及其所有子节点
  const handleDelete = () => {
    if (!selectedNode) return;

    const targetCode = selectedNode.data.code;
    if (!targetCode) return;

    let newTree = structuredClone(treeData);
    newTree = removeNode(newTree, targetCode); // 把该节点删掉

    setTreeData(newTree || {});
    setSelectedNode(null);
    setCode("");
  };

  return (
    <div style={{ padding: 20 }}>
      <Select
        value={valueKey}
        onChange={(val) => setValueKey(val)}
        style={{ width: 120, marginBottom: 20 }}
      >
        <Option value="value1">Value1</Option>
        <Option value="value2">Value2</Option>
        <Option value="value3">Value3</Option>
      </Select>
      <Space>
        <Input
          placeholder="节点 code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ width: 100 }}
        />
        <Button type="primary" onClick={handleSave}>
          Save
        </Button>
        <Button danger onClick={handleDelete}>
          Delete
        </Button>
      </Space>

      {/* 一个小的颜色示意图/图例 */}
      <ColorLegend minVal={minVal} maxVal={maxVal} valueKey={valueKey} />

      <div style={{ marginTop: 20, border: "1px solid #ddd" }}>
        <StrategyMap
          data={treeData}
          width={460}
          height={400}
          onNodeClick={handleNodeClick}
          valueKey={valueKey}
          selectedNode={selectedNode}
        />
      </div>
    </div>
  );
};

function ColorLegend({ minVal, maxVal, valueKey }) {
  const legendWidth = 200;
  const legendHeight = 15;
  const colorScale = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([minVal, maxVal]);
  const leftColor = colorScale(minVal);
  const rightColor = colorScale(maxVal);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>
        当前属性: {valueKey} (min={minVal}, max={maxVal})
      </div>
      <div
        style={{
          position: "relative",
          width: legendWidth,
          height: legendHeight,
          background: `linear-gradient(to right, ${leftColor}, ${rightColor})`,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: legendWidth,
        }}
      >
        <span>{minVal}</span>
        <span>{maxVal}</span>
      </div>
    </div>
  );
}

export default Comparison;
