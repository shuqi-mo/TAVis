import React from "react";
import { Table } from "antd";

const IndicatorsTable = ({ indicators }) => {
  // 格式化数据
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Total Trades",
      dataIndex: "totalTrades",
      key: "totalTrades",
      sorter: (a, b) => a.totalTrades - b.totalTrades, // 按照交易次数排序
    },
    {
      title: "Success Rate",
      dataIndex: "successRate",
      key: "successRate",
      render: (successRate) => `${(successRate * 100).toFixed(2)}%`,
      sorter: (a, b) => a.successRate - b.successRate, // 按照成功率排序
    },
    {
      title: "Average Return",
      dataIndex: "avgReturn",
      key: "avgReturn",
      render: (avgReturn) => `${(avgReturn * 100).toFixed(2)}%`,
      sorter: (a, b) => a.avgReturn - b.avgReturn, // 按照平均回报率排序
    },
    {
      title: "Total Profit",
      dataIndex: "totalProfit",
      key: "totalProfit",
      render: (totalProfit) => totalProfit.toFixed(2),
      sorter: (a, b) => a.totalProfit - b.totalProfit, // 按照总利润排序
    },
  ];

  const data = indicators.map((indicator, index) => {
    const successCount = indicator.success.filter((s) => s === 1).length;
    const successRate = successCount / indicator.success.length;
    const avgReturn =
      indicator.singlereturn.reduce((sum, value) => sum + value, 0) /
      indicator.singlereturn.length;
    const totalProfit = indicator.totalprofit[indicator.totalprofit.length - 1];

    return {
      key: indicator.name,
      name: indicator.name,
      totalTrades: indicator.success.length,
      successRate: successRate,
      avgReturn: avgReturn,
      totalProfit: totalProfit,
    };
  });

  return <Table columns={columns} dataSource={data} pagination={false} />;
};

export default IndicatorsTable;
