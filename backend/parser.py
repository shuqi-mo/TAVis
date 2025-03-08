import ast
import re

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
        "context": 4
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
# 将多个策略（每个策略包含 indicators 与 evaluation）转换为树结构
def process_strategies(codes):
    strategies = []
    for code in codes:
        indicators_tree = []
        for indicator in code.get("indicators", []):
            node = process_indicator(indicator)
            indicators_tree.append(node)
        evaluation_tree = process_evaluation(code.get("evaluation", {}))
        strategies.append([indicators_tree, evaluation_tree])
    return strategies

# ─────────────────────────────
# 递归计算并添加 level, depth 与 childCount
def assign_levels_and_counts(node, level=0):
    node["level"] = level
    if "children" in node and node["children"]:
        for child in node["children"]:
            assign_levels_and_counts(child, level + 1)
        node["depth"] = 1 + max(child["depth"] for child in node["children"])
        node["childCount"] = sum(1 + child.get("childCount", 0) for child in node["children"])
    else:
        node["depth"] = 1
        node["childCount"] = 0

# ─────────────────────────────
# 为基准策略递归分配 index（顶级指标 index 为 "1","2",...；子节点 index 为 "父index-序号"）
def assign_index_rec(node, prefix):
    if "children" in node and node["children"]:
        for i, child in enumerate(node["children"], start=1):
            child["index"] = prefix + "-" + str(i)
            assign_index_rec(child, child["index"])

def assign_index_baseline(indicators):
    for i, node in enumerate(indicators, start=1):
        node["index"] = str(i)
        assign_index_rec(node, node["index"])

def assign_index_evaluation(evaluations):
    for i, node in enumerate(evaluations, start=1):
        node["index"] = str(i)
        assign_index_rec(node, node["index"])

# ─────────────────────────────
# 归一化结构：对于 extend 节点，仅比较 children 结构；其它节点比较 type 与 name
def normalized_structure(node):
    t = node["type"]
    if t == "extend":
        children = node.get("children")
        if children:
            return (t, tuple(normalized_structure(child) for child in children))
        else:
            return (t, ())
    else:
        return (t, None)

# ─────────────────────────────
# 判断两个节点结构是否一致（对于 extend 节点，忽略自身 name，只比较 children 结构）
def same_structure(baseline, node):
    if baseline["type"] != node["type"]:
        return False
    if baseline["type"] == "extend":
        b_children = baseline.get("children", [])
        n_children = node.get("children", [])
        if len(b_children) != len(n_children):
            return False
        return all(same_structure(bc, nc) for bc, nc in zip(b_children, n_children))
    else:
        return True

# ─────────────────────────────
# 递归比较节点：若结构一致，则赋予基准节点的 index；对于非 extend 节点，若名称不同则标记 diff
def compare_and_assign_symmetric(baseline, node, strategies):
    # 同步赋予非基准节点基准的 index
    node["index"] = baseline.get("index")
    
    # 对于叶子节点或 context 节点
    if baseline["type"] != "extend":
        if baseline.get("name") != node.get("name"):
            # 基准节点添加 diff 标记
            baseline["diff"] = node.get("index")
            node["diff"] = baseline.get("index")
            
            # 遍历其他策略，同样在相同位置的节点添加 diff
            for strat in strategies:
                for strat_node in strat[0]:  # 遍历所有指标树
                    if normalized_structure(strat_node) == normalized_structure(baseline):
                        strat_node["diff"] = baseline["index"]
                for strat_node in strat[1]:  # 遍历所有评估树
                    if normalized_structure(strat_node) == normalized_structure(baseline):
                        strat_node["diff"] = baseline["index"]

    # 递归比较 children
    b_children = baseline.get("children", [])
    n_children = node.get("children", [])
    if b_children and n_children and len(b_children) == len(n_children):
        for bc, nc in zip(b_children, n_children):
            compare_and_assign_symmetric(bc, nc, strategies)

# ─────────────────────────────
# 更新 collapse 属性：若直接子节点中有 diff，则 collapse 为 false，否则为 true
def update_collapse(node):
    if "children" in node and node["children"]:
        node["collapse"] = False if any("diff" in child for child in node["children"]) else True
        for child in node["children"]:
            update_collapse(child)

# ─────────────────────────────
# 对同级 extend 节点进行去重：若 children 结构相同则生成 sharedKey，并将该子树存入全局 sharedChildrenMap
def deduplicate_children(node, shared_map, counter):
    if "children" in node and node["children"]:
        groups = {}
        for child in node["children"]:
            if child["type"] == "extend" and "children" in child and child.get("children"):
                key = tuple(normalized_structure(c) for c in child["children"])
                groups.setdefault(key, []).append(child)
        for group in groups.values():
            if len(group) > 1:
                # 若组内节点名称依次为 "up" 和 "down"，则使用 "upDownChildren"
                names = [child["name"] for child in group]
                if names == ["up", "down"]:
                    shared_key = "upDownChildren"
                else:
                    shared_key = "sharedKey" + str(counter[0])
                    counter[0] += 1
                # 将组内节点 children 提取出来（以第一个为准）
                shared_children = group[0].pop("children", [])
                for child in group:
                    child["sharedKey"] = shared_key
                    if "children" in child:
                        child.pop("children")
                if shared_key not in shared_map:
                    # 调整 shared children 的 level（设为组内节点 level+1）
                    for sc in shared_children:
                        sc["level"] = group[0]["level"] + 1
                        assign_levels_and_counts(sc, sc["level"])
                    shared_map[shared_key] = shared_children
        for child in node.get("children", []):
            deduplicate_children(child, shared_map, counter)