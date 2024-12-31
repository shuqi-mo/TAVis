import React from "react";
import { Table } from "antd";

const StocksTable = ({ stocks }) => {
  const calculatePerformance = (stock) => {
    // 计算 Total Trades: totalSuccess 数组的总长度
    const totalTrades = stock.success.reduce(
      (sum, successArray) => sum + successArray.length,
      0
    );

    // 计算 Success Rate: 计算 totalSuccess 数组中1的个数除以所有元素的总数
    const totalSuccessCount = stock.success.reduce(
      (sum, successArray) =>
        sum + successArray.filter((val) => val === 1).length,
      0
    );
    const successRate = totalSuccessCount / totalTrades;

    // 计算 Average Return: totalReturn 数组元素的平均值
    const totalReturnSum = stock.singlereturn.reduce(
      (sum, returnArray) =>
        sum + returnArray.reduce((innerSum, val) => innerSum + val, 0),
      0
    );
    const totalReturnCount = stock.singlereturn.reduce(
      (sum, returnArray) => sum + returnArray.length,
      0
    );
    const averageReturn = totalReturnSum / totalReturnCount;

    // 计算 Total Profit: totalProfit 数组最后一个数组的总和
    const totalProfit = stock.totalprofit[stock.totalprofit.length - 1].reduce(
      (sum, profit) => sum + profit,
      0
    );

    return {
      stock: stock.stock,
      totalTrades,
      successRate,
      averageReturn,
      totalProfit: totalProfit.toFixed(2),
    };
  };
  // 使用 map 处理每个股票数据
  const dataSource = stocks.map((stock) => calculatePerformance(stock));

  const columns = [
    { title: "Stock Name", dataIndex: "stock", key: "stock" },
    {
      title: "Total Trades",
      dataIndex: "totalTrades",
      key: "totalTrades",
      sorter: (a, b) => a.totalTrades - b.totalTrades,
    },
    {
      title: "Success Rate",
      dataIndex: "successRate",
      key: "successRate",
      render: (successRate) => `${(successRate * 100).toFixed(2)}%`,
      sorter: (a, b) => a.successRate - b.successRate,
    },
    {
      title: "Average Return",
      dataIndex: "averageReturn",
      key: "averageReturn",
      render: (averageReturn) => `${(averageReturn * 100).toFixed(2)}%`,
      sorter: (a, b) => a.averageReturn - b.averageReturn,
    },
    {
      title: "Total Profit",
      dataIndex: "totalProfit",
      key: "totalProfit",
      sorter: (a, b) => a.totalProfit - b.totalProfit,
    },
  ];

  return <Table columns={columns} dataSource={dataSource} pagination={false} />;
};

export default StocksTable;
