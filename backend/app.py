from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
from sklearn.manifold import TSNE
import umap

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

@app.route('/process_scatterplot', methods=['POST'])
def process_scatterplot():
    data = request.get_json()
    stocks_data = []
    # results = []
    for item in stock_csv_files:
        stock = pd.read_csv(stock_file_path + item + ".csv")
        trade_list = []
        trade_origin = []
        print(item)
        if len(stock) == 0 or stock['trade_date'][0] > data["startDate"] or stock['trade_date'][len(stock)-1] < data["endDate"]:
            continue
        for i in range(len(data["exprLongList"])):
            long = execute_expr(data["exprLongList"][i], stock)
            short = execute_expr(data["exprShortList"][i], stock)
            long = CustomList(long)
            short = CustomList(short)
            trade_list.append(process_trades(long, short)) 
        n = len(trade_list)
        for i in range(len(trade_list[0])):
            count  = 0
            for j in range(n):
                count += trade_list[j][i]
            if count > 0:
                trade_origin.append(1)
            elif count < 0:
                trade_origin.append(-1)
            else:
                trade_origin.append(0)
        price, trade = updatePeriod(stock, trade_origin, data["startDate"], data["endDate"])
        res_backtest = calBacktest(price, trade, data["getAheadStopTime"])
        stocks_data.append(np.array(res_backtest[4]))
        # results.append([item, len(res_backtest[4])])
        # 获取所有数组的长度
        lengths = [len(arr) for arr in stocks_data]

        # 统计每个长度出现的次数
        length_counts = {}
        for length in lengths:
            if length in length_counts:
                length_counts[length] += 1
            else:
                length_counts[length] = 1

        # 找出出现次数最多的长度
        max_count_length = max(length_counts, key=length_counts.get)

        # 仅保留长度为出现次数最多的长度的元素
        filtered_stocks_data = [arr for arr in stocks_data if len(arr) <= max_count_length and len(arr) >= max_count_length * 0.9]
        
    # results_df = pd.DataFrame(results, columns=['Stock', 'Length of res_backtest[4]'])
    # results_df.to_csv('results.csv', index=False)
    
    # 计算欧式距离矩阵
    # euclidean_distance_matrix = compute_euclidean_distance_matrix(np.array(filtered_stocks_data))
    series = []
    for item in filtered_stocks_data:
        series.append(np.array(item))
    # 计算DTW距离矩阵
    dtw_distance_matrix = compute_dtw_distance_matrix_fast(series)
    # 结合两种距离矩阵
    # combined_distance_matrix = combine_distance_matrices(
    #     euclidean_distance_matrix, 
    #     dtw_distance_matrix, 
    #     weight_euclidean=0.5, 
    #     weight_dtw=0.5
    # )
    tsne = TSNE(
        n_components=2, 
        metric='precomputed', 
        random_state=42, 
        perplexity=3, 
        n_iter=1000, 
        init='random'  # 修改初始化方法
    )
    reducer = umap.UMAP(n_components=2, metric='precomputed', random_state=42)
    # coords = tsne.fit_transform(combined_distance_matrix)
    # coords = tsne.fit_transform(dtw_distance_matrix)
    coords = reducer.fit_transform(dtw_distance_matrix)
    coords_list = coords.tolist()
    return jsonify(coords_list)

if __name__ == '__main__':
    app.run()