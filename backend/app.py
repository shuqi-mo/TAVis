from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import time

from indicator import *
from process import *
from evaluation import *
from pattern import *

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

@app.route('/process_single_stock', methods=['POST'])
def process_single_stock():
    data = request.get_json()
    data_df = pd.read_csv(file_path + data["selectStock"] + ".csv")
    float_trade = []
    performance = []
    boxplotData = []
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
        performance.append([name, res[0], res[1], res[2]])
        boxplotData.append([name, res[3]])
    return jsonify([float_trade, performance, boxplotData])

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
            variable.append(list(res))
        variableList.append([name, variable, data["variableList"][i]])
    
    mask = (data_df['trade_date'] >= data["startDate"]) & (data_df['trade_date'] <= data["endDate"])
    for i in range(len(data["indicatorName"])):
        for j in range(len(data["exprVariableList"][i])):
            origin = pd.Series(variableList[i][1][j])
            update = origin[mask].reset_index(drop=True)
            update = list(update)
            variableList[i][1][j] = update
    return jsonify(variableList)

@app.route('/process_stocks', methods=['POST'])
def process_stocks():
    data = request.get_json()
    res = []
    for item in csv_files:
        stock = pd.read_csv(file_path + item + ".csv")
        totalSuccess = []
        totalProfit = []
        totalReturn = []
        for i in range(len(data["exprLongList"])):
            long = execute_expr(data["exprLongList"][i], stock)
            short = execute_expr(data["exprShortList"][i], stock)
            long = CustomList(long)
            short = CustomList(short)
            trade_origin = process_trades(long, short)
            price, trade = updatePeriod(stock, trade_origin, data["startDate"], data["endDate"])
            res_singlestock = calBacktest(price, trade, data["getAheadStopTime"])
            totalSuccess.append(res_singlestock[0])
            totalProfit.append(res_singlestock[1])
            totalReturn.append(res_singlestock[2])
        res.append([item, totalSuccess, totalProfit, totalReturn])
    return jsonify(res)

@app.route('/process_pattern', methods=['POST'])
def process_pattern():
    data = request.get_json()
    data_df = pd.read_csv(file_path + data["selectStock"] + ".csv")
    mask = (data_df['trade_date'] >= data["startDate"]) & (data_df['trade_date'] <= data["endDate"])
    update_data_df = data_df[mask].reset_index(drop=True)
    matcher = PatternMatcher(minsup=data["minsup"])
    matcher.data = list(update_data_df["close"])
    matcher.generate_candL2(matcher.pattern)
    matcher.generate_fre(matcher.pattern, matcher.L2)
    matcher.Cancalute(matcher.pattern)
    matcher.process_patterns()
    pattern_dict = matcher.find_pattern_subsequences()
    pattern_list = [convert_np_types(item) for item in matcher.fre_pattern_list]
    trade = [1 if x == -1 else x for x in data["trade"]]
    trade_counts = matcher.calculate_trade_counts(pattern_dict, trade, pattern_list)
    return jsonify([pattern_list, trade_counts])

if __name__ == '__main__':
    app.run()