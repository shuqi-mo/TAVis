import React, { useState } from "react";
import { Button, Input, Space } from "antd";
import StrategyMap from "./StrategyMap";

const initialData = {
  name: "Root Node",
  code: "root",
  children: [
    {
      name: "Node A",
      code: "A",
    },
    {
      name: "Node B",
      code: "B",
      children: [
        { name: "Node C", code: "C" },
        { name: "Node D", code: "D" },
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
    name: `Child of ${node.code}`,
    code: newCode,
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
  const [code, setCode] = useState("");

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
      <Space>
        <Input
          placeholder="请输入 code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ width: 200 }}
        />
        <Button type="primary" onClick={handleSave}>
          Save
        </Button>
        <Button danger onClick={handleDelete}>
          Delete
        </Button>
      </Space>

      <div style={{ marginTop: 20, border: "1px solid #ddd" }}>
        <StrategyMap
          data={treeData}
          width={460}
          height={400}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};

export default Comparison;
