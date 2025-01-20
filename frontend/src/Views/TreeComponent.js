import React from "react";
import "./TreeComponent.css"

const data = {
  name: "indicators",
  children: [
    {
      name: "MACD",
      value: 2,
      children: [
        { name: "EMA(close,12)" },
        { name: "EMA(close,26)" },
      ],
    },
    {
      name: "RSI",
      value: 3,
      children: [
        { name: "30" },
        { name: "rsi(close,9)" },
        { name: "70" },
      ],
    },
    {
      name: "boll",
      children: [
        { name: "EMA(close,9)-2*movingstd(close,9)" },
        { name: "close" },
        { name: "EMA(close,9)+2*movingstd(close,9)" },
      ],
    },
  ],
};

// 2. 递归组件：渲染当前节点，并对其所有子节点进行递归渲染
function TreeNode({ node, className }) {
  return (
    <div className={`node ${className}`}>
      <span>{node.name}</span>
      {node.children && node.children.length > 0 && (
        <div className="children">
          {node.children.map((child) => {
            // 如果想根据 name 动态生成 className，可以做一些字符串处理
            // 如把不合法的字符去掉，这里只是演示直接小写+前缀
            const childClass = `node-${child.name.toLowerCase()}`;
            return (
              <TreeNode
                key={child.name}
                node={child}
                className={childClass}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// 3. 主组件：渲染整个树
export default function TreeComponent() {
  return (
    <div id="tree">
      <TreeNode node={data} className="node-root" />
    </div>
  );
}