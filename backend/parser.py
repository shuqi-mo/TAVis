import json
import re

# ======================
# AST 节点定义
# ======================
class ASTNode:
    def __init__(self, name, node_type="operation", children=None, circle=None):
        self.name = name              # 节点名称，例如函数名或数值
        self.type = node_type         # "operation" 表示函数/运算，"value" 表示叶子（数值、标识符）
        self.children = children if children is not None else []
        self.circle = circle          # 合并后生成的 circle 信息

    def to_dict(self):
        """将 AST 转换为字典，便于 JSON 输出"""
        d = {"name": self.name, "type": self.type}
        if self.circle:
            d["circle"] = self.circle
        if self.children:
            d["children"] = [child.to_dict() for child in self.children]
        return d

# ======================
# 解析器（Tokenizer + Recursive Descent Parser）
# ======================
TOKEN_REGEX = r"\s*(?:(\d+)|([a-zA-Z_]\w*)|(.))"
# 第一组匹配数字，第二组匹配标识符（支持下划线），第三组匹配其它单字符（如括号、逗号、运算符）

def tokenize(s):
    tokens = []
    for number, ident, other in re.findall(TOKEN_REGEX, s):
        if number:
            tokens.append(("NUMBER", number))
        elif ident:
            tokens.append(("IDENT", ident))
        elif other:
            tokens.append((other, other))
    return tokens

class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def current(self):
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def consume(self, expected=None):
        token = self.current()
        if expected and token[0] != expected:
            raise ValueError(f"期望 {expected}，但得到 {token}")
        self.pos += 1
        return token

    def parse_expression(self):
        """解析表达式（支持 + 与 - 运算）"""
        node = self.parse_term()
        while self.current() and self.current()[0] in ('+', '-'):
            op = self.consume()[1]
            right = self.parse_term()
            node = ASTNode(op, "operation", [node, right])
        return node

    def parse_term(self):
        """解析乘除表达式（支持 * 与 / 运算）"""
        node = self.parse_factor()
        while self.current() and self.current()[0] in ('*', '/'):
            op = self.consume()[1]
            right = self.parse_factor()
            node = ASTNode(op, "operation", [node, right])
        return node

    def parse_factor(self):
        """解析因子：可能为数值、标识符或函数调用"""
        token = self.current()
        if not token:
            return None
        if token[0] == "NUMBER":
            self.consume()
            return ASTNode(token[1], "value")
        elif token[0] == "IDENT":
            ident = self.consume()[1]
            # 如果后面紧跟 "(" 则解析为函数调用
            if self.current() and self.current()[0] == "(":
                self.consume("(")  # 消耗 "("
                args = self.parse_arguments()
                if self.current() and self.current()[0] == ")":
                    self.consume(")")
                return ASTNode(ident, "operation", args)
            else:
                return ASTNode(ident, "value")
        elif token[0] == "(":
            self.consume("(")
            node = self.parse_expression()
            if self.current() and self.current()[0] == ")":
                self.consume(")")
            return node
        else:
            self.consume()
            return None

    def parse_arguments(self):
        """解析函数调用的参数列表（以逗号分隔）"""
        args = []
        while self.current() and self.current()[0] != ")":
            arg = self.parse_expression()
            if arg:
                args.append(arg)
            if self.current() and self.current()[0] == ",":
                self.consume(",")
        return args

def parse_formula(formula_str):
    tokens = tokenize(formula_str)
    parser = Parser(tokens)
    return parser.parse_expression()

# ======================
# 合并规则
# ======================
def merge_ast(ast1, ast2, indicator_name):
    """
    合并两个 AST（长/短公式），规则如下：
      1. 如果两个 AST 完全相同，则返回 ast1。
      2. 如果两个节点均为 cross，则将它们的子节点取并集（顺序无关，不重复）。
      3. 如果两个节点名称相同且均为 operation，则：
           - 若子节点个数相同，则按对应位置递归合并；
           - 否则取两边子节点的并集。
      4. 其它情况，直接返回 ast1。
    注意：这里不对 EMA 做特殊处理，EMA 的 circle 信息由后处理生成。
    """
    if ast1.to_dict() == ast2.to_dict():
        return ast1

    if ast1.name.lower() == "cross" and ast2.name.lower() == "cross":
        # 对 cross 节点，取 union（不重复添加相同子节点）
        for child in ast2.children:
            if not any(child.to_dict() == exist_child.to_dict() for exist_child in ast1.children):
                ast1.children.append(child)
        return ast1

    if ast1.type == "operation" and ast2.type == "operation" and ast1.name == ast2.name:
        if len(ast1.children) == len(ast2.children):
            for i in range(len(ast1.children)):
                ast1.children[i] = merge_ast(ast1.children[i], ast2.children[i], indicator_name)
        else:
            union_children = list(ast1.children)
            for child in ast2.children:
                if not any(child.to_dict() == exist_child.to_dict() for exist_child in union_children):
                    union_children.append(child)
            ast1.children = union_children
        return ast1

    return ast1

def merge_indicator(long_expr, short_expr, indicator_name):
    """
    解析 long 与 short 公式，生成各自的 AST 后合并，返回合并后的 AST。
    """
    ast_long = parse_formula(long_expr)
    ast_short = parse_formula(short_expr)
    merged = merge_ast(ast_long, ast_short, indicator_name)
    return merged

# ======================
# 辅助函数：将 AST 节点转换为字符串表示（并对 * 运算进行简化处理）
# ======================
def node_to_str(node):
    if node.type == "value" or not node.children:
        return node.name
    # 如果是 "*" 运算且其中一个子节点为 "2"，则返回另一子节点的字符串表示
    if node.name == "*" and len(node.children) == 2:
        if node.children[0].type == "value" and node.children[0].name == "2":
            return node_to_str(node.children[1])
        elif node.children[1].type == "value" and node.children[1].name == "2":
            return node_to_str(node.children[0])
    return f"{node.name}(" + ",".join(node_to_str(child) for child in node.children) + ")"

# ======================
# 后处理：为 AST 添加 circle 信息
# ======================
def add_circle_info_to_tree(node, indicator_name):
    """
    递归遍历 AST，按规则为部分 operation 节点添加 circle 信息：
      1. 如果当前节点为 cross，则检查其子节点中是否存在多个 "+" 或 "-" 节点，
         若存在，则取这些节点子节点字符串表示的交集（利用 node_to_str 已做简化），
         并为这些节点添加 circle 信息，group 为 "{indicator}_plus_minus"；
      2. 如果当前节点为 SMA 或 movingstd 且有两个子节点，则添加 circle 信息，
         group 为 "{indicator}_sma_std"，node 为其子节点名称列表；
      3. 如果当前节点为 EMA 且有两个子节点，则“折叠”该节点，
         用第二个子节点的名称替换当前节点名称，并添加 circle 信息，
         group 为 "{indicator}_EMA_{first_param}"，node 为 ["EMA", first_param]。
      4. 对其它节点，递归处理其子节点。
    """
    if node.type == "operation":
        # 处理 cross 节点中 "+" 和 "-" 子节点的 circle 信息
        if node.name.lower() == "cross" and node.children:
            plus_minus_nodes = [child for child in node.children if child.name in ["+", "-"]]
            if len(plus_minus_nodes) >= 2:
                sets = [set(node_to_str(child_) for child_ in child.children) 
                        for child in plus_minus_nodes if child.children]
                if sets:
                    common = set.intersection(*sets)
                    if common:
                        common_list = sorted(list(common))
                        count = len(plus_minus_nodes)
                        for child in plus_minus_nodes:
                            child.circle = {"value": str(count),
                                            "node": common_list,
                                            "group": f"{indicator_name}_plus_minus"}
        # 处理 SMA 和 movingstd 节点
        if node.name.upper() in ["SMA", "MOVINGSTD"] and len(node.children) == 2:
            node.circle = {"value": "2",
                           "node": [child.name for child in node.children],
                           "group": f"{indicator_name}_sma_std"}
        # 处理 EMA 节点：折叠为只显示第二参数，并添加 circle 信息
        if node.name.upper() == "EMA" and len(node.children) == 2:
            first_param = node.children[0].name
            second_param = node.children[1].name
            circle = {
                "value": "2",
                "node": ["EMA", first_param],
                "group": f"{indicator_name}_EMA_{first_param}"
            }
            node.name = second_param
            node.circle = circle
            node.children = []  # 折叠后不保留子节点
        # 递归处理所有子节点
        for child in node.children:
            add_circle_info_to_tree(child, indicator_name)

# ======================
# 构造最终输出树
# ======================
def build_output(indicators):
    """
    根据每个指标的 long/short 公式构造输出树，
    根节点名称为 "indicators"，其 children 为各指标节点，
    每个指标节点下挂合并后的公式 AST（后处理时生成 circle 信息）。
    """
    children = []
    for ind in indicators:
        name = ind["name"]
        merged_ast = merge_indicator(ind["long"], ind["short"], name)
        indicator_node = ASTNode(name, "operation", [merged_ast])
        # 后处理：为该指标下的 AST 添加 circle 信息
        add_circle_info_to_tree(merged_ast, name)
        children.append(indicator_node)
    return ASTNode("indicators", "operation", children)