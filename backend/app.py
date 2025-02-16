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

file_path = "static/data/"
file_name = "600893.SH.csv"
csv_files = []
# 遍历data文件夹中的文件
for file in os.listdir(file_path):
    # 检查文件是否以.csv结尾
    if file.endswith('.csv'):
        csv_files.append(file[:9])

stock_file_path = "static/stock/"
stock_csv_files = []
# 遍历data文件夹中的文件
for file in os.listdir(stock_file_path):
    # 检查文件是否以.csv结尾
    if file.endswith('.csv'):
        stock_csv_files.append(file[:9])

data_df = pd.read_csv(file_path + file_name)
app.secret_key = 'secret_key'

@app.route('/get_stock_list')
def get_stock_list():
    return jsonify(csv_files)

@app.route('/get_stock_data')
def get_stock_data():
    data = {}
    data["name"] = file_name[:9]
    stock = []
    for index, rows in data_df.iterrows():
        stock.append([rows["trade_date"],rows["open"],rows["close"],rows["high"],rows["low"],rows["vol"]])
    data["data"] = stock
    return jsonify(data)

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
    data_df = pd.read_csv(file_path + data["selectStock"] + ".csv")
    for index, rows in data_df.iterrows():
        stock.append([rows["trade_date"],rows["open"],rows["close"],rows["high"],rows["low"],rows["vol"]])
    res["data"] = stock
    return jsonify(res)

@app.route('/process_stock', methods=['POST'])
def process_stock():
    data = request.get_json()
    data_df = pd.read_csv(file_path + data["selectStock"] + ".csv")

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
    for item in csv_files:
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
        successRate = sum(res[0]) / totalTrade
        totalProfit = res[1][-1]
        averProfit = sum(res[2]) / len(res[2])
        performance.append([name, totalTrade, successRate, averProfit, totalProfit])
        boxplotData.append([name, res[3]])
        indiatorPerformance.append([name, res[4]])
    
    # 多个股票数据处理
    for item in csv_files:
        stock = pd.read_csv(file_path + item + ".csv")
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
            successCount += sum(res_singlestock[0])
            profitCount += res_singlestock[1][-1]
            for r in res_singlestock[2]:
                avgReturnList.append(r)
            for r in res_singlestock[3]:
                curve.append(r)
                current_performance.append(r[-1])
            ring_indicator_stock[data["indicatorName"][i]].append([item, current_performance])
            ring_stock_indicator[item].append([data["indicatorName"][i], current_performance])
        res_stock.append([item, tradeCount, successCount / tradeCount, sum(avgReturnList) / len(avgReturnList), profitCount])
        res_curve.append([item, curve])
    
    ring_indicator_stock_format = transform_data_ring(ring_indicator_stock)
    ring_stock_indicator_format = transform_data_ring(ring_stock_indicator)

    return jsonify([float_trade, performance, boxplotData, res_stock, res_curve, ring_indicator_stock_format, ring_stock_indicator_format])

@app.route('/process_exampler', methods=['POST'])
def process_exampler():
    data = request.get_json()
    data_df = pd.read_csv(file_path + data["selectStock"] + ".csv")
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
    indicatorsData, evaluationData = transform_code(data["code"])
    return jsonify([indicatorsData, evaluationData])

@app.route('/process_strategy', methods=['POST'])
def process_strategy():
    data = request.get_json()
    tradeCount = 0
    successCount = 0
    profitCount = 0
    avgReturnList = []
    for item in csv_files:
        stock = pd.read_csv(file_path + item + ".csv")
        for i in range(len(data["exprLongList"])):
            long = execute_expr(data["exprLongList"][i], stock)
            short = execute_expr(data["exprShortList"][i], stock)
            long = CustomList(long)
            short = CustomList(short)
            trade_origin = process_trades(long, short)
            price, trade = updatePeriod(stock, trade_origin, data["startDate"], data["endDate"])
            res_singlestock = calBacktest(price, trade, data["getAheadStopTime"])
            tradeCount += len(res_singlestock[0])
            successCount += sum(res_singlestock[0])
            profitCount += res_singlestock[1][-1]
            for r in res_singlestock[2]:
                avgReturnList.append(r)
    return jsonify([tradeCount, successCount / tradeCount, sum(avgReturnList) / len(avgReturnList), profitCount])

if __name__ == '__main__':
    app.run()