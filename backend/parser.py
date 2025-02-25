import ast
import re
import random

random.seed(42)

# ─────────────────────────────
# 利用 AST 提取表达式中的变量名称
def extract_vars(expr):
    try:
        tree = ast.parse(expr, mode='eval')
    except Exception:
        return []
    vars_found = []
    class VarVisitor(ast.NodeVisitor):
        def visit_Name(self, node):
            vars_found.append(node.id)
        def visit_Call(self, node):
            # 不将函数名本身作为依赖，只遍历参数
            for arg in node.args:
                self.visit(arg)
    VarVisitor().visit(tree.body)
    return vars_found


# ─────────────────────────────
# 根据表达式判断类型
def determine_type(expr):
    if isinstance(expr, (int, float)):
        return "constant"
    if isinstance(expr, str):
        s = expr.strip()
        # 判断是否为函数调用形式，如 "EMA(close,12)" 或 "rsi(close,14)"
        if re.match(r'^[A-Za-z_]\w*\s*\(.*\)$', s):
            return "function"
        # 若包含算术运算符，则认为需要解析其依赖（extend 类型）
        if any(op in s for op in ['+', '-', '*', '/']):
            return "extend"
        # 否则视为价格时间序列
        return "timeseries"
    return "constant"


# ─────────────────────────────
# 处理指标中的单个变量（依赖）
def process_variable(key, indicator, cache):
    if key in cache:
        return cache[key]
    expr = indicator[key]
    node = {}
    t = determine_type(expr)
    if t == "constant":
        node["name"] = str(expr).replace(" ", "")
        node["type"] = "timeseries"
    elif t in ["function", "timeseries"]:
        node["name"] = expr.replace(" ", "")
        node["type"] = t
    elif t == "extend":
        node["name"] = key
        node["type"] = "extend"
        # 解析表达式中的依赖变量
        deps = extract_vars(expr)
        ordered = []
        # 按照 indicator 中键的顺序（排除 name、long、short）选取依赖
        for k in indicator:
            if k not in ["name", "long", "short"] and k in deps:
                ordered.append(k)
        children = []
        for dep in ordered:
            child = process_variable(dep, indicator, cache)
            children.append(child)
        node["children"] = children
    else:
        node["name"] = str(expr)
        node["type"] = t
    cache[key] = node
    return node


# ─────────────────────────────
# 类型优先级（用于排序顶层依赖节点，仅作为参考）
def type_priority(t):
    mapping = {
        "function": 1,
        "timeseries": 2,
        "extend": 3,
        "link": 4,
        "context": 5
    }
    return mapping.get(t, 99)


# ─────────────────────────────
# 处理单个指标（indicator）
def process_indicator(indicator):
    cache = {}
    node = {"name": indicator["name"], "type": "extend"}
    # 提取 "long" 与 "short" 表达式中引用的变量
    deps_set = set()
    for key_expr in ["long", "short"]:
        if key_expr in indicator:
            deps_set.update(extract_vars(indicator[key_expr]))
    deps = []
    # 根据 indicator 中的键顺序，选择在 long/short 中出现的依赖
    for k in indicator:
        if k not in ["name", "long", "short"] and k in deps_set:
            deps.append(k)
    children = []
    for dep in deps:
        child_node = process_variable(dep, indicator, cache)
        children.append(child_node)
    # 对顶层指标节点的 children 按类型优先级排序（例如 rsi 的常数先于函数）
    children = sorted(children, key=lambda child: type_priority(child["type"]))
    node["children"] = children
    return node


# ─────────────────────────────
# 为去重比较定义归一化函数
# 对于 extend 类型的节点，忽略自身的 name，只考虑 children 结构
def normalized_structure(node):
    t = node["type"]
    if t == "extend":
        # 对 extend 节点，只取 children 结构（若没有 children，则视为空元组）
        return (t, tuple(normalized_structure(child) for child in node.get("children", [])))
    else:
        # 对于其它节点，比较 type 和 name
        return (t, node.get("name"))


# 对同级节点中的 extend 类型节点进行去重：
# 如果某个 extend 节点的 children 结构与之前的某个 extend 节点相同，
# 则用一个 link 节点替换其 children，引用第一次出现的节点的 name。
def deduplicate_indicator_children(children):
    seen = {}
    for child in children:
        if child["type"] == "extend" and "children" in child:
            # 归一化子树结构（仅比较 children 部分）
            key = tuple(normalized_structure(c) for c in child["children"])
            if key in seen:
                # 找到了相同结构的子树，将当前节点的 children 替换为 link 节点
                child["children"] = [{"name": seen[key], "type": "link"}]
            else:
                seen[key] = child["name"]
        # 递归处理每个子节点的 children
        if "children" in child:
            deduplicate_indicator_children(child["children"])


# ─────────────────────────────
# 处理 evaluation 部分，输出为数组形式
def process_evaluation(evaluation):
    eval_list = []
    for key, value in evaluation.items():
        if key == "period":
            node = {"name": key, "type": "extend", "children": []}
            if isinstance(value, list) and len(value) == 2:
                # 格式为 "[start,end]"
                node["children"].append({"name": f"{value[0]} {value[1]}", "type": "context"})
            eval_list.append(node)
        else:
            node = {"name": key, "type": "extend", "children": []}
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        for subkey, subvalue in item.items():
                            subnode = {
                                "name": subkey,
                                "type": "extend",
                                "children": [{"name": subvalue, "type": "context"}]
                            }
                            node["children"].append(subnode)
            eval_list.append(node)
    return eval_list


# ─────────────────────────────
# 主转换函数，返回 indicatorsData 与 evaluationData（均为数组形式）
def transform_code(code):
    # 处理 indicators 部分
    indicators_list = []
    for indicator in code.get("indicators", []):
        node = process_indicator(indicator)
        # 在每个指标的 children 中进行去重
        deduplicate_indicator_children(node["children"])
        indicators_list.append(node)
    # 处理 evaluation 部分
    evaluation_list = process_evaluation(code.get("evaluation", {}))
    return indicators_list, evaluation_list