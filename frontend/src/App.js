import { useEffect, useState } from "react";
import _ from "lodash";
import axios from "axios";
import Candle from "./Views/Candle";
import "./App.scss";
import CodeEditor from "./Views/CodeEditor";
import { Indicator, Evaluation } from "./utils/ClassDefinitions";
import IndicatorsTable from "./Views/IndicatorsTable";
import { Layout, Menu, Flex, Radio } from "antd";
import StocksTable from "./Views/StocksTable";
import { SlidersOutlined } from "@ant-design/icons";
import CurveBoxplot from "./Views/CurveBoxplot";
import Exampler from "./Views/Exampler";
import Pattern from "./Views/Pattern";
import ScatterPlot from "./Views/ScatterPlot";

const { Sider } = Layout;

function App() {
  const API_URL = "http://localhost:5000";
  const test1 = require("./case/test1.json");

  const [data, setData] = useState(null);
  const [code, setCode] = useState(JSON.stringify(test1, null, 2));
  const [trade, setTrade] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [selectStock, setSelectStock] = useState("600893.SH");
  const [stockList, setStockList] = useState(["600893.SH"]);
  const [stockPerformance, setStockPerformance] = useState([]);
  const [curveBoxplotData, setCurveBoxplotData] = useState(null);
  const [examplerData, setExamplerData] = useState(null);
  const [scatterData, setScatterData] = useState(null);

  const [collapsed, setCollapsed] = useState(true);
  const [position, setPosition] = useState("current stock");

  // 创建策略实例并计算
  const indicators = JSON.parse(code).indicators.map((strategyData) => {
    const indicator = new Indicator(strategyData);
    return {
      name: indicator.name,
      exprLong: indicator.exprLong(),
      exprShort: indicator.exprShort(),
      variable: indicator.getSortedVariables(),
      exprVariable: indicator
        .getSortedVariables()
        .map((item) => indicator.exprVariables(item)),
    };
  });

  // console.log(indicators);

  const evaluationData = JSON.parse(code).evaluation;

  // 创建 Evaluation 实例
  const evaluation = new Evaluation(evaluationData.period, evaluationData.stop);

  const updateCode = (newValue) => {
    setCode(newValue);
  };

  // 更新股票清单和选中股票
  useEffect(() => {
    axios
      .get(`${API_URL}/get_stock_data`)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
    axios
      .get(`${API_URL}/get_stock_list`)
      .then((response) => {
        // setData(response.data);
        setStockList(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, []);

  // 计算指标交易序列和收益，更新回测和exampler
  async function processStrategies() {
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
    // console.log(exprVariableList);
    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_single_stock`, {
        indicatorName,
        exprLongList,
        exprShortList,
        selectStock,
        startDate,
        endDate,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      });
      // console.log(response.data);
      var t = [];
      for (let i = 0; i < response.data[0][0].length; i++) {
        var cur = 0;
        for (let j = 0; j < response.data[0].length; j++) {
          cur += response.data[0][j][i];
        }
        if (cur > 0) {
          t.push(1);
        } else if (cur < 0) {
          t.push(-1);
        } else {
          t.push(0);
        }
      }
      setTrade(t);
      // 提取 indicators 中的必要字段并更新 backtest
      const newBacktest = response.data[1].map((indicator) => ({
        name: indicator[0],
        success: indicator[1],
        totalprofit: indicator[2],
        singlereturn: indicator[3],
      }));
      setBacktest(newBacktest);
      // 更新curveBoxplotData
      setCurveBoxplotData(response.data[2]);
    } catch (error) {
      console.error("Error:", error);
    }
    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_exampler`, {
        indicatorName,
        selectStock,
        variableList,
        exprVariableList,
        startDate,
        endDate,
      });
      // console.log(response.data);
      setExamplerData(response.data);
    } catch (error) {
      console.error("Error:", error);
    }
    axios
      .post(`${API_URL}/process_scatterplot`, {
        exprLongList,
        exprShortList,
        startDate,
        endDate,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      })
      .then((response) => {
        setScatterData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  // 更新选中股票数据，代码更新时执行策略
  useEffect(() => {
    axios
      .post(`${API_URL}/update_single_stock_data`, { selectStock })
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
    processStrategies();
  }, [selectStock, code]);

  const handleExecute = async () => {
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
      const response = await axios.post(`${API_URL}/process_stocks`, {
        exprLongList,
        exprShortList,
        startDate,
        endDate,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      });

      const performance = response.data.map((stock) => ({
        stock: stock[0],
        success: stock[1],
        totalprofit: stock[2],
        singlereturn: stock[3],
      }));
      // console.log(performance);
      setStockPerformance(performance);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  function getItem(label, key, icon, children) {
    return {
      key,
      icon,
      children,
      label,
    };
  }

  const stockItems = stockList.map((code, index) => getItem(code, index + 2));

  const items = [
    getItem("Selected stocks", "1", <SlidersOutlined />, stockItems),
  ];

  const handleMenuSelect = (event) => {
    const selectedItem = stockItems.find(
      (item) => item.key === Number(event.key)
    );
    setSelectStock(selectedItem.label);
  };

  return (
    <Layout>
      <div className="page-title">TAVis</div>
      <Layout
        style={{
          minHeight: "100vh",
          background: "white",
        }}
      >
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
        >
          <Menu
            theme="dark"
            defaultSelectedKeys={["6"]}
            mode="inline"
            items={items}
            onSelect={handleMenuSelect}
          />
        </Sider>
        <Flex gap="small">
          <Flex vertical="true">
            <div className="view-title">Candlestick View</div>
            {trade && (
              <div className="candle">
                <Candle data={data} trade={trade} />
              </div>
            )}
            <div className="view-title">Inspection View</div>
            <Flex>
              <Flex vertical="true">
                {curveBoxplotData &&
                  curveBoxplotData.map((item) => (
                    <CurveBoxplot boxplotData={item} />
                  ))}
              </Flex>
              <Flex vertical="true">
                {examplerData &&
                  examplerData.map((item) => (
                    <Exampler data={item[1]} legend={item[2]} />
                  ))}
              </Flex>
            </Flex>
          </Flex>
          <Flex vertical="true">
            <Flex gap="small">
              <CodeEditor code={code} onCodeChange={updateCode} />
              <div
                style={{
                  width: 280,
                  height: 380,
                }}
              >
                <div className="view-title">Performance</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Radio.Group
                    size="small"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    <Radio.Button value="current stock">current</Radio.Button>
                    <Radio.Button
                      value="selected stocks"
                      onClick={() => handleExecute()}
                    >
                      stocks
                    </Radio.Button>
                  </Radio.Group>
                </div>
                {backtest && position === "current stock" && (
                  <div style={{ padding: "10px", overflowY: "auto" }}>
                    <IndicatorsTable indicators={backtest} />
                  </div>
                )}
                {backtest && position === "selected stocks" && (
                  <div style={{ padding: "10px", overflowY: "auto" }}>
                    <StocksTable stocks={stockPerformance} />
                  </div>
                )}
              </div>
            </Flex>
            <div className="view-title">Pattern Analysis View</div>
            {trade && (
              <Pattern
                selectStock={selectStock}
                trade={trade}
                startDate={evaluation.startDate}
                endDate={evaluation.endDate}
              />
            )}
          </Flex>
          <Flex vertical="true">
            <div className="view-title">Stock Selection View</div>
            {scatterData && <ScatterPlot data={scatterData} />}
            <div className="view-title">Comparison View</div>
          </Flex>
        </Flex>
      </Layout>
    </Layout>
  );
}

export default App;
