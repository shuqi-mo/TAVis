from pyparsing import Word, alphas, alphanums, Group, Suppress, Forward, nums, ZeroOrMore, OneOrMore

def parseCode(text):
    # 定义数字和标识符
    number = Word(nums)
    identifier = Word(alphas, alphanums + "_")
    action = Word(alphas)
    colon = Suppress(":")

    # 使用 Forward 声明一个前瞻性解析表达式
    expr = Forward()

    # 定义函数调用和表达式列表
    func_call = Group(
        identifier("func_name") +
        Suppress("(") +
        expr("arg") + 
        ZeroOrMore(Suppress(",") + expr("arg")) +
        Suppress(")")
    )
    expr <<= func_call | number | identifier
    complex_expr = OneOrMore(Group(action + colon + expr))
    result = complex_expr.parseString(text['code'])
    return(result)