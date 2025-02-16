import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FilterOutlined,
  SettingOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import ScatterPlot from "./ScatterPlot"; // 请确保ScatterPlot组件已实现

const StockSelection = () => {
  const API_URL = "http://localhost:5000";
  const [data, setData] = useState([]); // 存储后端返回的数据

  // 获取后端数据的函数
  const fetchData = async () => {
    axios
      .get(`${API_URL}/get_scatterdata_default`)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
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
        <button
          onClick={fetchData}
          style={{ border: "none", background: "none", cursor: "pointer" }}
        >
          <RedoOutlined style={{ fontSize: "18px" }} />
        </button>
      </div>

      {/* 散点图组件，将数据传入 */}
      <ScatterPlot data={data} width={350} height={350}/>
    </div>
  );
};

export default StockSelection;
