import { useEffect, useState } from "react";
import _ from "lodash";
import axios from "axios";
import Candle from "./Views/Candle";
import "./App.scss";
import Panel from "./Views/Panel";
import CodeEditor from "./Views/CodeEditor";
import { Indicator, Evaluation } from "./utils/ClassDefinitions";
import IndicatorsTable from "./Views/IndicatorsTable";
import { Button } from "antd";
import StocksTable from "./Views/StocksTable";
import TreeGraph from "./Views/TreeGraph";
import LineChart from "./Views/LineChart";

const graphData = [
  ["long", "up"],
  ["long", "price"],
  ["short", "price"],
  ["short", "down"],
  ["up", "mid"],
  ["up", "band"],
  ["up", "multiplier"],
  ["down", "mid"],
  ["down", "band"],
  ["down", "multiplier"],
];

function buildGraph(data) {
  const nodes = {}; // 用来存储所有唯一的节点
  const links = []; // 存储所有的边

  data.forEach(([parent, child]) => {
    // 确保每个节点是对象，并包含唯一的标识符
    if (!nodes[parent]) {
      nodes[parent] = { id: parent, name: parent }; // 用 id 作为唯一标识
    }
    if (!nodes[child]) {
      nodes[child] = { id: child, name: child }; // 用 id 作为唯一标识
    }

    // 创建边
    links.push({ source: nodes[parent], target: nodes[child] });
  });

  return { nodes: Object.values(nodes), links };
}

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
  const [lines, setLines] = useState(null);

  // 创建策略实例并计算
  const indicators = JSON.parse(code).indicators.map((strategyData) => {
    const indicator = new Indicator(strategyData);
    return {
      name: indicator.name,
      exprLong: indicator.exprLong(),
      exprShort: indicator.exprShort(),
      trade: null,
      success: null,
      singlereturn: null,
      totalprofit: null,
    };
  });

  const evaluationData = JSON.parse(code).evaluation;

  // 创建 Evaluation 实例
  const evaluation = new Evaluation(evaluationData.period, evaluationData.stop);

  const updateValue = (newValue) => {
    setData(newValue);
  };

  const updateStock = (newName) => {
    setSelectStock(newName);
  };

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
    axios
      .get(`${API_URL}/get_data`)
      .then((response) => {
        // console.log(response.data);
        setLines(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, []);

  // 计算指标交易序列和收益
  async function processStrategies() {
    let indicatorName = [];
    let exprLongList = [];
    let exprShortList = [];
    const startDate = evaluation.startDate;
    const endDate = evaluation.endDate;
    const getStopLossThreshold = evaluation.getStopLossThreshold();
    const getTakeProfitThreshold = evaluation.getTakeProfitThreshold();
    const getAheadStopTime = evaluation.getAheadStopTime();
    for (let i = 0; i < indicators.length; i++) {
      indicatorName.push(indicators[i].name);
      exprLongList.push(indicators[i].exprLong);
      exprShortList.push(indicators[i].exprShort);
    }
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
    } catch (error) {
      console.error("Error:", error);
    }
  }

  useEffect(() => {
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

  const graph = buildGraph(graphData);
  // console.log(graph);

  const handleNodeClick = (nodeName) => {
    console.log(nodeName);
  };

  return (
    <div>
      <div className="panel">
        <Panel
          stockList={stockList}
          onUpdateValue={updateValue}
          onUpdateStock={updateStock}
        />
      </div>
      <div className="timeselector">
        {trade && (
          <div className="candle">
            <Candle data={data} trade={trade} />
          </div>
        )}
        <div>
          <TreeGraph data={graph} onNodeClick={handleNodeClick} />
        </div>
        {lines && (<div>
          <LineChart lines={lines}/>
        </div>)}
        {backtest && (
          <div style={{ padding: "20px" }}>
            <IndicatorsTable indicators={backtest} />
            <Button type="primary" onClick={() => handleExecute()}>
              Update for stocklist
            </Button>
            <StocksTable stocks={stockPerformance} />
          </div>
        )}
      </div>
      <div className="right">
        <div className="editor">
          <CodeEditor code={code} onCodeChange={updateCode} />
        </div>
      </div>
    </div>
  );
}

export default App;
