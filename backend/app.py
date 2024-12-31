from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import time

from indicator import *
from process import *
from evaluation import *

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
    res["name"] = data["item"]
    stock = []
    data_df = pd.read_csv(file_path + data["item"] + ".csv")
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
    return jsonify([float_trade, performance])

@app.route('/process_stocks', methods=['POST'])
def process_stocks():
    data = request.get_json()
    start_time = time.time()  # 记录开始时间
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
        print(item)
    end_time = time.time()  # 记录结束时间
    elapsed_time = end_time - start_time  # 计算运行时间
    print(f"程序运行时间：{elapsed_time} 秒")
    return jsonify(res)

@app.route('/get_data')
def get_data():
    price = data_df["close"]
    mid = EMA(price, 20)
    band = movingstd(mid, 20)
    multiplier = 2
    up = mid + multiplier * band
    down = mid - multiplier * band
    return jsonify([list(price)[20:],list(up)[20:],list(down)[20:]])

if __name__ == '__main__':
    app.run()