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

def summarize_trades(indicatorName, trade_origin):
    trades = []
    i = 0
    n = len(trade_origin)

    while i < n:
        if trade_origin[i] == 1:
            # 开始一个long交易
            start = i
            i += 1
            j = i
            while j < n and trade_origin[j] != -1:
                j += 1
            if j < n and trade_origin[j] == -1:
                # 找到对应的卖出时机
                end = j
                trades.append([indicatorName, 'long', start, end])
            i += 1
        elif trade_origin[i] == -1:
            # 开始一个short交易
            start = i
            i += 1
            j = i
            while j < n and trade_origin[j] != 1:
                j += 1
            if j < n and trade_origin[j] == 1:
                # 找到对应的买入时机
                end = j
                trades.append([indicatorName, 'short', start, end])
            i += 1
        else:
            # 如果是0，则跳过
            i += 1

    return trades

def sort_by_third_element(trade_list):
    """
    按照第三个元素（起始时间）从小到大排序
    """
    return sorted(trade_list, key=lambda x: x[2])

def categorize_trades(trade_summarization):
    """
    给每一段交易分类，根据区间内long和short信号的统计
    """
    # 先按照起始时间排序
    sorted_trades = sort_by_third_element(trade_summarization)
    
    # 创建结果列表
    categorized_trades = []
    
    for trade in sorted_trades:
        indicator, signal_type, start_time, end_time = trade
        
        # 统计区间内其他交易的信号
        long_count = 0
        short_count = 0
        
        for other_trade in sorted_trades:
            if other_trade == trade:  # 跳过自身
                continue
                
            other_indicator, other_signal, other_start, other_end = other_trade
            
            # 检查other交易的起始或终止时间是否在当前交易区间内
            # long信号的起始时间或short信号的终止时间在区间内，计为long信号
            if other_signal == 'long' and start_time <= other_start <= end_time:
                long_count += 1
            elif other_signal == 'short' and start_time <= other_end <= end_time:
                long_count += 1
            
            # long信号的终止时间或short信号的起始时间在区间内，计为short信号
            if other_signal == 'long' and start_time <= other_end <= end_time:
                short_count += 1
            elif other_signal == 'short' and start_time <= other_start <= end_time:
                short_count += 1
        
        # 计算信号净值并确定分类
        signal_difference = long_count - short_count
        
        # 根据原交易信号确定正负
        if signal_type == 'long':
            expected_direction = 1
        else:  # 'short'
            expected_direction = -1
        
        # 分类
        if signal_difference == 0:
            category = "Neural"
        else:
            actual_direction = 1 if signal_difference > 0 else -1
            if actual_direction == expected_direction:
                # 正档
                if abs(signal_difference) <= 2:
                    category = "Weakly Supportive"
                else:
                    category = "Strongly Supportive"
            else:
                # 负档
                if abs(signal_difference) <= 2:
                    category = "Weakly Contradictive"
                else:
                    category = "Strongly Contradictive"
        
        # 添加到结果列表
        categorized_trades.append(trade + [long_count, short_count, signal_difference, category])
    
    return categorized_trades