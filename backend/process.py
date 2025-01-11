from indicator import *
import re
from dtaidistance import dtw
from sklearn.preprocessing import MinMaxScaler
import numpy as np

def execute_expr(expr, stock):
    # 处理表达式的函数
    def preprocess_expression(expression, stock_df):
        # 替换关键字为stock中的列名
        def replace_keywords(match):
            keyword = match.group(0)
            if keyword in stock_df.columns:
                return f"CustomList(list(stock['{keyword}']))"
            return keyword
        
        # 替换表达式中的close, open, high, low等为stock["close"], stock["open"]等
        processed_expression = re.sub(r'\b(close|open|high|low)\b', replace_keywords, expression)

        # 处理带索引的关键字（[n]）
        def replace_indexed_keywords(match):
            n = int(match.group(1)) if match.group(1) else 0  # 提取n值
            return f".shift({n}, fill_value=0)"
    
        # 匹配 [n] 格式并替换
        processed_expression = re.sub(r'\[(\d+)\]', replace_indexed_keywords, processed_expression)
        
        return processed_expression

    processed_expression = preprocess_expression(expr, stock)
    # print(processed_expression)
    res = eval(processed_expression)
    # print(res)
    return np.array(res)

def process_trades(buy, sell):
    # 初始化最终交易数组，长度与输入数组相同，初始值为0
    trades = [0] * len(buy)
    
    # 标记买入和卖出的状态
    buy_status = False
    sell_status = False
    
    # 遍历数组，处理买入和卖出
    for i in range(len(buy)):
        if buy[i] == 1 and not buy_status:
            # 如果当前是买入且之前没有买入操作，则标记买入状态，并在最终数组中标记为1
            trades[i] = 1
            buy_status = True
            sell_status = False
        elif sell[i] == 1 and not sell_status:
            # 如果当前是卖出且之前没有卖出操作，则标记卖出状态，并在最终数组中标记为-1
            trades[i] = -1
            sell_status = True
            buy_status = False
    
    return trades

# 计算欧式距离矩阵的函数
def compute_euclidean_distance_matrix(data):
    # 使用广播机制高效计算欧式距离
    distance_matrix = np.linalg.norm(data[:, np.newaxis] - data[np.newaxis, :], axis=2)
    return distance_matrix

# 使用 dtaidistance 库内置的高效距离矩阵计算方法
def compute_dtw_distance_matrix_fast(data):
    # 计算DTW距离矩阵
    distance_matrix = dtw.distance_matrix_fast(data, parallel=True, compact=False)
    return distance_matrix

# 结合两种距离矩阵的函数
def combine_distance_matrices(euclidean_matrix, dtw_matrix, weight_euclidean=0.5, weight_dtw=0.5):
    scaler = MinMaxScaler()
    # 归一化欧式距离
    euclidean_scaled = scaler.fit_transform(euclidean_matrix)
    # 归一化DTW距离
    dtw_scaled = scaler.fit_transform(dtw_matrix)
    
    # 加权结合
    combined_matrix = weight_euclidean * euclidean_scaled + weight_dtw * dtw_scaled
    return combined_matrix