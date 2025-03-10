from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
from sklearn.manifold import TSNE
import csv

from indicator import *
from process import *
from evaluation import *
from parser import *

app = Flask(__name__)
CORS(app)

stock_file_path = "static/stock/"
stock_csv_files = []
# 遍历data文件夹中的文件
for file in os.listdir(stock_file_path):
    # 检查文件是否以.csv结尾
    if file.endswith('.csv'):
        stock_csv_files.append(file[:9])

app.secret_key = 'secret_key'

@app.route('/get_all_stocks')
def get_all_stocks():
    csv_files = []
    # 遍历data文件夹中的文件
    for file in os.listdir(stock_file_path):
        if file.endswith('.csv'):
            csv_files.append(file[:9])
    return jsonify(csv_files)

@app.route('/get_scatterdata_default')
def get_scatterdata_default():
    csv_file_path = os.path.join('static', 'stock_embedding.csv')
    scatter_data = []  # 存储所有三维数组
    try:
        with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
            csv_reader = csv.reader(csvfile)
            # 跳过第一行标题
            headers = next(csv_reader, None)
            # 遍历每一行数据
            for row in csv_reader:
                # 检查是否至少有三列数据
                if len(row) >= 3:
                    try:
                        # 尝试将前三个值转换为浮点数
                        point = [row[0], float(row[1]), float(row[2])]
                    except ValueError:
                        # 如果转换失败，则保留原始数据（例如字符串）
                        point = [row[0], row[1], row[2]]
                    scatter_data.append(point)
    except FileNotFoundError:
        print(f"文件 {csv_file_path} 未找到。")
    except Exception as e:
        print(f"读取 CSV 文件时发生错误: {e}")
    return jsonify(scatter_data)

@app.route('/update_single_stock_data', methods=['POST'])
def update_single_stock_data():
    data = request.get_json()
    res = {}
    res["name"] = data["selectStock"]
    stock = []
    data_df = pd.read_csv(stock_file_path + data["selectStock"] + ".csv")
    for index, rows in data_df.iterrows():
        stock.append([rows["trade_date"],rows["open"],rows["close"],rows["high"],rows["low"],rows["vol"]])
    res["data"] = stock
    return jsonify(res)

@app.route('/process_stock', methods=['POST'])
def process_stock():
    data = request.get_json()
    data_df = pd.read_csv(stock_file_path + data["selectStock"] + ".csv")

    # 单个股票处理结果
    float_trade = []
    performance = []
    boxplotData = []
    indiatorPerformance = []

    # 多个股票处理结果
    res_stock = []
    res_curve = []

    # 环状图数据
    ring_indicator_stock = {}
    ring_stock_indicator = {}
    for i in range(len(data["indicatorName"])):
        ring_indicator_stock[data["indicatorName"][i]] = []
    for item in data["stockList"]:
        ring_stock_indicator[item] = []

    # 单个股票数据处理
    for i in range(len(data["indicatorName"])):
        name = data["indicatorName"][i]
        long = execute_expr(data["exprLongList"][i], data_df)
        short = execute_expr(data["exprShortList"][i], data_df)
        long = CustomList(long)
        short = CustomList(short)
        trade_origin = process_trades(long, short)
        float_trade.append([float(x) for x in trade_origin])
        price, trade = updatePeriod(data_df, trade_origin, data["startDate"], data["endDate"])
        res = calBacktest(price, trade, data["getAheadStopTime"])
        totalTrade = len(res[0])
        if totalTrade == 0:
            continue
        successRate = sum(res[0]) / totalTrade
        totalProfit = res[1][-1]
        averProfit = sum(res[2]) / len(res[2])
        performance.append([name, totalTrade, successRate, averProfit, totalProfit])
        boxplotData.append([name, res[3]])
        indiatorPerformance.append([name, res[4]])
    
    # 多个股票数据处理
    for item in data["stockList"]:
        stock = pd.read_csv(stock_file_path + item + ".csv")
        tradeCount = 0
        successCount = 0
        profitCount = 0
        avgReturnList = []
        curve = []
        for i in range(len(data["indicatorName"])):
            current_performance = []
            long = execute_expr(data["exprLongList"][i], stock)
            short = execute_expr(data["exprShortList"][i], stock)
            long = CustomList(long)
            short = CustomList(short)
            trade_origin = process_trades(long, short)
            price, trade = updatePeriod(stock, trade_origin, data["startDate"], data["endDate"])
            res_singlestock = calBacktest(price, trade, data["getAheadStopTime"])
            tradeCount += len(res_singlestock[0])
            if len(res_singlestock[0]) == 0:
                if ring_indicator_stock.get(data["indicatorName"][i]) is not None:
                    del ring_indicator_stock[data["indicatorName"][i]]
                continue
            successCount += sum(res_singlestock[0])
            profitCount += res_singlestock[1][-1]
            for r in res_singlestock[2]:
                avgReturnList.append(r)
            for r in res_singlestock[3]:
                curve.append(r)
                # current_performance.append(r[-1])
            for r in res_singlestock[5]:
                current_performance.append(r[-1])
            ring_indicator_stock[data["indicatorName"][i]].append([item, current_performance])
            ring_stock_indicator[item].append([data["indicatorName"][i], current_performance])
        res_stock.append([item, tradeCount, successCount / tradeCount, sum(avgReturnList) / len(avgReturnList), profitCount])
        res_curve.append([item, curve])
    
    ring_indicator_stock_format = transform_data_ring(ring_indicator_stock)
    ring_stock_indicator_format = transform_data_ring(ring_stock_indicator)
    print(ring_indicator_stock)
    anova_analysis_indicator_stock = anova_analysis(ring_indicator_stock)
    anova_analysis_stock_indicator = anova_analysis(ring_stock_indicator)

    return jsonify([float_trade, performance, boxplotData, res_stock, res_curve, ring_indicator_stock_format, ring_stock_indicator_format, anova_analysis_indicator_stock, anova_analysis_stock_indicator])

@app.route('/process_exampler', methods=['POST'])
def process_exampler():
    data = request.get_json()
    data_df = pd.read_csv(stock_file_path + data["selectStock"] + ".csv")
    variableList = []
    for i in range(len(data["indicatorName"])):
        name = data["indicatorName"][i]
        variable = []
        for j in range(len(data["exprVariableList"][i])):
            res = execute_expr(data["exprVariableList"][i][j], data_df)
            if res.dtype.kind in 'biu':
                res = [int(res)] * len(data_df["close"])
            # 将结果转换为列表
            res = list(res)
            variable.append(res)
        variableList.append([name, variable, data["variableList"][i]])
    return jsonify(variableList)

@app.route('/process_stock_all', methods=['POST'])
def process_stock_all():
    data = request.get_json()
    res = []
    
    # 所有股票数据处理
    for item in stock_csv_files:
        stock = pd.read_csv(stock_file_path + item + ".csv")
        if len(stock) == 0 or stock['trade_date'][0] > data["startDate"] or stock['trade_date'][len(stock)-1] < data["endDate"]:
            continue
        print(item)
        tradeCount = 0
        successCount = 0
        profitCount = 0
        avgReturnList = []
        for i in range(len(data["indicatorName"])):
            long = execute_expr(data["exprLongList"][i], stock)
            short = execute_expr(data["exprShortList"][i], stock)
            long = CustomList(long)
            short = CustomList(short)
            trade_origin = process_trades(long, short)
            price, trade = updatePeriod(stock, trade_origin, data["startDate"], data["endDate"])
            res_singlestock = calBacktest(price, trade, data["getAheadStopTime"])
            if len(res_singlestock[0]) == 0:
                continue
            tradeCount += len(res_singlestock[0])
            successCount += sum(res_singlestock[0])
            profitCount += res_singlestock[1][-1]
            for r in res_singlestock[2]:
                avgReturnList.append(r)
        if tradeCount:
            res.append([item, tradeCount, successCount / tradeCount, sum(avgReturnList) / len(avgReturnList), profitCount])
        else:
            res.append([item, 0, 0, 0, 0])
    return jsonify(res)

@app.route('/process_code', methods=['POST'])
def process_code():
    data = request.get_json()
    for i in range(len(data["codeList"])):
        data["codeList"][i] = eval(data["codeList"][i])
    # 1. 将每个策略转换为指标树和评估树
    strategies = process_strategies(data["codeList"])

     # 2. 为每个策略的所有节点计算 level、depth 与 childCount
    for strat in strategies:
        for tree in strat[0]:  # indicators
            assign_levels_and_counts(tree, 0)
        for tree in strat[1]:  # evaluation
            assign_levels_and_counts(tree, 0)
    
    # 3. 选取指标数量最多的策略作为基准策略
    baseline_idx = max(range(len(strategies)), key=lambda i: len(strategies[i][0]))
    baseline_strategy = strategies[baseline_idx]
    
    # 4. 为基准策略的指标树和评估树分配 index
    assign_index_baseline(baseline_strategy[0])
    assign_index_evaluation(baseline_strategy[1])
    
    # 构造基准映射（归一化结构作为 key）
    baseline_ind_map = {}
    for node in baseline_strategy[0]:
        baseline_ind_map[normalized_structure(node)] = node
    baseline_eval_map = {}
    for node in baseline_strategy[1]:
        baseline_eval_map[normalized_structure(node)] = node
    
    # 5. 对非基准策略，根据归一化结构比较赋予相同 index，并比较差异设置 diff
    for i, strat in enumerate(strategies):
        if i == baseline_idx:
            continue
        # 对指标部分
        for node in strat[0]:
            norm = normalized_structure(node)
            if norm in baseline_ind_map:
                compare_and_assign_symmetric(baseline_ind_map[norm], node, strategies)
            else:
                # 未匹配到则按本策略顺序赋 index
                pass
        # 对评估部分
        for node in strat[1]:
            norm = normalized_structure(node)
            if norm in baseline_eval_map:
                compare_and_assign_symmetric(baseline_eval_map[norm], node, strategies)
            else:
                pass
        # 若顶级节点未设置 index，则按本策略顺序赋 index
        for j, node in enumerate(strat[0], start=1):
            if "index" not in node:
                node["index"] = str(j)
                assign_index_rec(node, node["index"])
        for j, node in enumerate(strat[1], start=1):
            if "index" not in node:
                node["index"] = str(j)
                assign_index_rec(node, node["index"])
    
    # 6. 更新 collapse：若直接子节点中存在 diff，则父节点 collapse = false，否则为 true
    for strat in strategies:
        for node in strat[0]:
            update_collapse(node)
        for node in strat[1]:
            update_collapse(node)
    
    # 7. 对指标树中同级 extend 节点去重，生成 sharedChildrenMap
    sharedChildrenMap = {}
    counter = [1]  # 用于生成唯一 sharedKey
    for strat in strategies:
        for node in strat[0]:
            deduplicate_children(node, sharedChildrenMap, counter)
    
    # 最终输出数据：每个策略均输出 [indicatorsData, evaluationData]
    output_data = strategies
    return jsonify([output_data, sharedChildrenMap])

@app.route('/process_strategy', methods=['POST'])
def process_strategy():
    data = request.get_json()
    tradeCount = 0
    successCount = 0
    profitCount = 0
    avgReturnList = []
    for item in data["stockList"]:
        stock = pd.read_csv(stock_file_path + item + ".csv")
        for i in range(len(data["exprLongList"])):
            long = execute_expr(data["exprLongList"][i], stock)
            short = execute_expr(data["exprShortList"][i], stock)
            long = CustomList(long)
            short = CustomList(short)
            trade_origin = process_trades(long, short)
            price, trade = updatePeriod(stock, trade_origin, data["startDate"], data["endDate"])
            res_singlestock = calBacktest(price, trade, data["getAheadStopTime"])
            tradeCount += len(res_singlestock[0])
            if len(res_singlestock[0]) == 0:
                continue
            successCount += sum(res_singlestock[0])
            profitCount += res_singlestock[1][-1]
            for r in res_singlestock[2]:
                avgReturnList.append(r)
    return jsonify([tradeCount, successCount / tradeCount, sum(avgReturnList) / len(avgReturnList), profitCount])

if __name__ == '__main__':
    app.run()