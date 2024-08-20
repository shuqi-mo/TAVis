from indicator import *
from strategy import *

def execute(parse, stock):
    n = len(parse)
    if n == 3:
        funname = parse[0]
        param1 = parse[1]
        param2 = parse[2]
        if len(param1) == 3:
            param1 = execute(param1, stock)
        if len(param2) == 3:
            param2 = execute(param2, stock)
    if param1 == "close":
        param1 = list(stock["close"])
    expr = eval(funname + "(" + str(param1) + "," + str(param2) + ")")
    return expr