import React, { useState, useMemo, useEffect } from "react";
import { Button, Select, Flex } from "antd";
import StrategyMap from "./StrategyMap";
import MultiBarcodeTree from "./MultiBarcodeTree";
import * as d3 from "d3";
import axios from "axios";

const { Option } = Select;

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

const Comparison = ({
  initialCode,
  indicators,
  evaluation,
  onSelectCode,
  stockList,
}) => {
  const API_URL = "http://localhost:5000";

  const [treeData, setTreeData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [valueKey, setValueKey] = useState("totalTrades");
  const [groups, setGroups] = useState([]);
  const [codeList, setCodeList] = useState([initialCode]);
  const [sharedChildrenMap, setShareChildrenMap] = useState(null);

  useEffect(() => {
    if (!initialCode) return;
    // 先调用 process_strategy 接口获取策略表现数据
    const fetchInitialData = async () => {
      let exprLongList = [];
      let exprShortList = [];
      const startDate = evaluation.startDate;
      const endDate = evaluation.endDate;
      const getStopLossThreshold = evaluation.getStopLossThreshold();
      const getTakeProfitThreshold = evaluation.getTakeProfitThreshold();
      const getAheadStopTime = evaluation.getAheadStopTime();
      for (let i = 0; i < indicators.length; i++) {
        exprLongList.push(indicators[i].exprLong);
        exprShortList.push(indicators[i].exprShort);
      }
      try {
        const response = await axios.post(`${API_URL}/process_strategy`, {
          exprLongList,
          exprShortList,
          stockList,
          startDate,
          endDate,
          getStopLossThreshold,
          getTakeProfitThreshold,
          getAheadStopTime,
        });
        // 假设后端返回的数据格式为：
        // { totalTrades, successRate, avgReturn, totalProfit }
        const initialNode = {
          code: initialCode,
          totalTrades: response.data[0],
          successRate: response.data[1],
          avgReturn: response.data[2],
          totalProfit: response.data[3],
          children: [], // 单节点，无子节点
        };
        // console.log(initialNode);
        setTreeData(initialNode);
      } catch (error) {
        console.error("Error fetching initial node data:", error);
      }
    };
    fetchInitialData();
  }, [stockList]);

  useEffect(()=>{
    // console.log(codeList);
    axios
      .post(`${API_URL}/process_code`, { codeList })
      .then((response) => {
        // console.log(response.data);
        setGroups(response.data[0]);
        setShareChildrenMap(response.data[1]);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  },[codeList]);

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
    onSelectCode(node.data.code);
  };

  // Save：根据 initialCode 调用后端接口获取最新数据，并更新节点
  const handleSave = async () => {
    if (!selectedNode) return;
    let exprLongList = [];
    let exprShortList = [];
    const startDate = evaluation.startDate;
    const endDate = evaluation.endDate;
    const getStopLossThreshold = evaluation.getStopLossThreshold();
    const getTakeProfitThreshold = evaluation.getTakeProfitThreshold();
    const getAheadStopTime = evaluation.getAheadStopTime();
    for (let i = 0; i < indicators.length; i++) {
      exprLongList.push(indicators[i].exprLong);
      exprShortList.push(indicators[i].exprShort);
    }
    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_strategy`, {
        exprLongList,
        exprShortList,
        startDate,
        endDate,
        stockList,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      });
      const newNode = {
        code: initialCode, // 节点的 code 使用父组件传入的 initialCode
        totalTrades: response.data[0],
        successRate: response.data[1],
        avgReturn: response.data[2],
        totalProfit: response.data[3],
        children: [],
      };
      let newTree = structuredClone(treeData);
      traverseTree(newTree, selectedNode.data.code, (node) => {
        if (!node.children) {
          node.children = [];
        }
        node.children.push(newNode);
      });
      setTreeData(newTree);
      setSelectedNode(null);

      setCodeList((prevCodeList) => [...prevCodeList, newNode.code]);
    } catch (error) {
      console.error("Error:", error);
    }
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
    // setCode("");
  };

  return (
    <Flex gap="small">
      <MultiBarcodeTree
        data={groups}
        sharedChildrenMap={sharedChildrenMap}
        // data={groupsData}
        width={780}
        height={400}
        margin={20}
        gap={4}
      />
      <Flex vertical gap="small">
        <Flex gap="small">
          <Flex gap="small" style={{paddingTop: 15}}>
          <Select
            value={valueKey}
            onChange={(val) => setValueKey(val)}
            style={{ width: 100 }}
          >
            <Option value="totalTrades">totalTrades</Option>
            <Option value="successRate">successRate</Option>
            <Option value="avgReturn">avgReturn</Option>
            <Option value="totalProfit">totalProfit</Option>
          </Select>
          <Button type="primary" onClick={handleSave}>
            Save
          </Button>
          <Button danger onClick={handleDelete}>
            Delete
          </Button>
          </Flex>
          <ColorLegend minVal={minVal} maxVal={maxVal} valueKey={valueKey} />
        </Flex>

        <div style={{ border: "1px solid #ddd", borderRadius: "15px" }}>
          <StrategyMap
            data={treeData}
            width={300}
            height={310}
            onNodeClick={handleNodeClick}
            valueKey={valueKey}
            selectedNode={selectedNode}
          />
        </div>
      </Flex>
    </Flex>
  );
};

function ColorLegend({ minVal, maxVal, valueKey }) {
  const legendWidth = 100;
  const legendHeight = 15;
  const colorScale = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([minVal, maxVal]);
  const leftColor = colorScale(minVal);
  const rightColor = colorScale(maxVal);

  // 格式化数值，根据指标做不同处理
  const formatValue = (value, key) => {
    if (value === undefined || value === null) return "-";
    if (key === "successRate" || key === "avgReturn") {
      return (value * 100).toFixed(2) + "%";
    } else if (key === "totalProfit") {
      return value.toFixed(2);
    } else {
      return value;
    }
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>{valueKey}</div>
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
        <span>{formatValue(minVal, valueKey)}</span>
        <span>{formatValue(maxVal, valueKey)}</span>
      </div>
    </div>
  );
}

export default Comparison;
