import React, { useState, useEffect } from "react";
import axios from "axios";
import { Select } from "antd";
import {
  FilterOutlined,
  SettingOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import * as d3 from "d3";
import ScatterPlot from "./ScatterPlot";

const { Option } = Select;

// color legend 组件（使用从绿色到红色的渐变）
function ColorLegend({ minVal, maxVal, medianVal, valueKey }) {
  const legendWidth = 80;
  const legendHeight = 6;
  // 构造 diverging color scale，注意：使用反转插值使得最小值为绿色，最大值为红色
  const colorScale = d3
    .scaleDiverging()
    .domain([minVal, medianVal, maxVal])
    .interpolator((t) => d3.interpolateRdYlGn(1 - t));
  const leftColor = colorScale(minVal);
  const rightColor = colorScale(maxVal);

  // 格式化数值（可根据指标调整）
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
    <div style={{ marginLeft: 5 }}>
      <div style={{ fontWeight: "bold", marginBottom: 2 }}>{valueKey}</div>
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
          fontSize: "12px",
        }}
      >
        <span>{formatValue(minVal, valueKey)}</span>
        <span>{formatValue(maxVal, valueKey)}</span>
      </div>
    </div>
  );
}

const StockSelection = ({ indicators, evaluation }) => {
  const API_URL = "http://localhost:5000";
  const [defaultData, setDefaultData] = useState([]);
  const [stocksPerformance, setStocksPerformance] = useState(null);
  const [valueKey, setValueKey] = useState("totalProfit");

  // mapping: 性能数据中各指标在数组中的位置
  const metricIndex = {
    totalTrades: 1,
    successRate: 2,
    avgReturn: 3,
    totalProfit: 4,
  };

  // 根据 stocksPerformance 和当前选中的指标计算最小值、最大值和中位数
  let minVal, maxVal, medianVal;
  if (stocksPerformance) {
    const metricValues = stocksPerformance
      .map((item) => parseFloat(item[metricIndex[valueKey]]))
      .filter((v) => !isNaN(v));
    if (metricValues.length > 0) {
      minVal = d3.min(metricValues);
      maxVal = d3.max(metricValues);
      medianVal = d3.median(metricValues);
    }
  }

  // 获取后端数据的函数
  const fetchData = async () => {
    axios
      .get(`${API_URL}/get_scatterdata_default`)
      .then((response) => {
        setDefaultData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  const handleExecute = async () => {
    let indicatorName = [];
    let exprLongList = [];
    let exprShortList = [];
    let exprVariableList = [];
    let variableList = [];

    const startDate = evaluation.startDate;
    const endDate = evaluation.endDate;
    const getStopLossThreshold = evaluation.getStopLossThreshold();
    const getTakeProfitThreshold = evaluation.getTakeProfitThreshold();
    const getAheadStopTime = evaluation.getAheadStopTime();

    for (let i = 0; i < indicators.length; i++) {
      indicatorName.push(indicators[i].name);
      exprLongList.push(indicators[i].exprLong);
      exprShortList.push(indicators[i].exprShort);
      exprVariableList.push(indicators[i].exprVariable);
      variableList.push(indicators[i].variable);
    }
    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_stock_all`, {
        indicatorName,
        exprLongList,
        exprShortList,
        startDate,
        endDate,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      });
      setStocksPerformance(response.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // 组件加载时自动获取数据
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      {/* 按钮区域 */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button
          onClick={() => handleExecute()}
          style={{ border: "none", background: "none", cursor: "pointer" }}
        >
          <PlayCircleOutlined style={{ fontSize: "18px" }} />
        </button>
        <button
          onClick={() => {
            // TODO: 添加过滤功能
            console.log("Filter clicked");
          }}
          style={{ border: "none", background: "none", cursor: "pointer" }}
        >
          <FilterOutlined style={{ fontSize: "18px" }} />
        </button>
        <button
          onClick={() => {
            // TODO: 添加设置功能
            console.log("Setting clicked");
          }}
          style={{ border: "none", background: "none", cursor: "pointer" }}
        >
          <SettingOutlined style={{ fontSize: "18px" }} />
        </button>
        {/* 单选框：选择用于散点图上色的指标 */}
        <Select
          value={valueKey}
          onChange={(val) => setValueKey(val)}
          style={{ width: 80 }}
        >
          <Option value="totalTrades">totalTrades</Option>
          <Option value="successRate">successRate</Option>
          <Option value="avgReturn">avgReturn</Option>
          <Option value="totalProfit">totalProfit</Option>
        </Select>
        {/* Color legend */}
        {minVal !== undefined &&
          maxVal !== undefined &&
          medianVal !== undefined && (
            <ColorLegend
              minVal={minVal}
              maxVal={maxVal}
              medianVal={medianVal}
              valueKey={valueKey}
            />
          )}
      </div>

      {/* 散点图组件，将数据传入 */}
      <ScatterPlot
        data={defaultData}
        performance={stocksPerformance}
        valueKey={valueKey}
        colorStats={{ min: minVal, median: medianVal, max: maxVal }}
        width={350}
        height={350}
      />
    </div>
  );
};

export default StockSelection;
