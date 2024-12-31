import numpy as np
import pandas as pd

class CustomList:
    def __init__(self, data):
        self.data = data

    def __lt__(self, other):
        # 返回比较结果的布尔列表
        return CustomList([1 if a < b else 0 for a, b in zip(self.data, other.data)])

    def __and__(self, other):
        # 对两个 CustomList 实例的 data 属性进行按位与运算
        return CustomList([a & b for a, b in zip(self.data, other.data)])

    def __or__(self, other):
        # 对两个 CustomList 实例的 data 属性进行按位或运算
        return CustomList([a | b for a, b in zip(self.data, other.data)])

    def __add__(self, other):
        # 实现加法运算
        return CustomList([a + b for a, b in zip(self.data, other.data)])

    def __sub__(self, other):
        # 实现减法运算
        return CustomList([a - b for a, b in zip(self.data, other.data)])

    def __mul__(self, other):
        # 实现 CustomList 和常量的乘法
        if isinstance(other, (int, float)):
            return CustomList([a * other for a in self.data])
        else:
            raise TypeError(f"Unsupported type for multiplication: {type(other)}")
    
    def __rmul__(self, other):
        return self.__mul__(other)

    def __getitem__(self, key):
        # 支持索引和切片操作
        if isinstance(key, slice):
            return CustomList(self.data[key])
        elif isinstance(key, int):
            return self.data[key]
        else:
            raise TypeError("Invalid argument type.")

    def __iter__(self):
        # 支持迭代操作（例如 sum() 和 for 循环）
        return iter(self.data)
    
    def __len__(self):
        # 返回列表长度，支持 len()
        return len(self.data)

    def shift(self, n, fill_value=None):
        """
        实现 shift 功能，向右或向左移动元素。
        n > 0: 向右移动 n 位，填充 fill_value
        n < 0: 向左移动 n 位，填充 fill_value
        """
        if n == 0:
            return CustomList(self.data)  # 如果移动为 0，返回原数据
        length = len(self.data)
        if n > 0:  # 向右移动
            return CustomList([fill_value] * n + self.data[:length - n])
        else:  # 向左移动
            return CustomList(self.data[-n:] + [fill_value] * (-n))

    def __repr__(self):
        return str(self.data)

def cross(short, long):
    # 确保short和long都是numpy数组
    short = np.array(short)
    long = np.array(long)
    
    # 如果short或long是单个数字，将其转换为长度相同的数组
    if short.ndim == 0:  # 如果short是单个数字
        short = np.full_like(long, short)
    if long.ndim == 0:  # 如果long是单个数字
        long = np.full_like(short, long)
    
    n = max(len(short), len(long))  # 确保n是较长数组的长度
    trade = np.zeros(n)
    for i in range(n-1):
        if short[i] == 0 or long[i] == 0 or short[i+1] == 0 or long[i+1] == 0:
            continue
        if short[i] < long[i] and short[i+1] > long[i+1]:
            trade[i+1] = 1
    return trade

def SMA(price, days):
    n = len(price)
    sma = []
    for i in range(n):
        if i < days:
            sma.append(0)
            continue
        else:
            t = 0
            for j in range(days):
                t += price[i-j]
            sma.append(round(t/days,2))
    return CustomList(sma)

def EMA(price, days):
    ema = []
    for i in range(days-1):
        ema.append(0)
    ema.append(sum(price[:days]) / days)
    alpha = 2 / (days + 1)
    for p in price[days:]:
        ema.append(alpha * p + (1 - alpha) * ema[-1])
    return CustomList(ema)

def WMA(price, days):
    wma = []
    n = len(price)
    for i in range(days):
        wma.append(0)
    weights = np.arange(1, days + 1)
    total = weights.sum()
    for i in range(days,n):
        p = price[i-days:i]
        wma.append(np.dot(p,weights)/total)
    return CustomList(wma)

def SMMA(price, days):
    smma = []
    for i in range(days-1):
        smma.append(0)
    smma.append(sum(price[:days]) / days)
    for i in range(days,len(price)):
        smma.append((smma[-1] * (days-1) + price[i]) / days)
    return CustomList(smma)

def VWMA(price, volume, days):
    n = len(price)
    vwma = []
    for i in range(n):
        if i < days:
            vwma.append(0)
            continue
        else:
            t = 0
            d = 0
            for j in range(days):
                t += price[i-j] * volume[i-j]
                d += volume[i-j]
            vwma.append(round(t/d,2))
    return CustomList(vwma)

def movingstd(price, days):
    res = []
    for i in range(len(price)):
        if i < days:
            res.append(0)
            continue
        else:
            w = price[i:i+days]
            res.append(np.std(w))
    return CustomList(res)

def rsi(price, days):
    price = pd.Series(price)
    delta = price.diff()
    gain = (delta.where(delta > 0, 0)).fillna(0)
    loss = (-delta.where(delta < 0, 0)).fillna(0)
    avg_gain = gain.rolling(days, min_periods=1).mean()
    avg_loss = loss.rolling(days, min_periods=1).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    for i in range(days):
        rsi[i] = 0
    return CustomList(rsi)