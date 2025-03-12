import gymnasium as gym
from gymnasium import spaces
from utils import setup_logger
from parser import restore_indicators, process_data
from evaluation import *
from stable_baselines3.common.callbacks import BaseCallback

logger = setup_logger('training.log')
class TradingStrategyEnv(gym.Env):
    """
    用于交易策略超参数优化的自定义 Gymnasium 环境
    状态：各指标参数的归一化向量
    动作：调整某一指标的参数值（增量变化）
    Reward：只采用回测得到的平均收益率（avg_return）计算，并归一化
    """
    metadata = {"render.modes": ["human"]}

    def __init__(self, new_strategy, strategy_config, virtual_prices, max_steps=20):
        super(TradingStrategyEnv, self).__init__()
        self.new_strategy = new_strategy
        self.strategy_config = strategy_config  # 新的配置变量为平铺式字典
        self.virtual_prices = virtual_prices  # 多只股票的价格数据
        self.max_steps = max_steps
        self.current_step = 0
        self.best_reward = -float('inf')
        self.best_params = None

        # 根据更新后的策略配置构建参数列表
        # 依据每个参数的 key（例如 "param_0"）和 context 解析所属指标和变量名称（仅用于展示）
        self.param_list = []
        for key in sorted(self.strategy_config.keys(), key=lambda k: int(k.split('_')[1])):
            param_info = self.strategy_config[key]
            # context 格式示例："indicators[0].shortterm"
            context = param_info["context"]
            indicator_part, param_name = context.split(".")
            param_def = {
                "id": key,
                "indicator": indicator_part,  # 例如 "indicators[0]"
                "param": param_name,            # 例如 "shortterm"
                "type": param_info["type"]
            }
            if param_info["type"] == "str":
                param_def["options"] = param_info["options"]
                default_value = param_info["value"]
                try:
                    index = param_def["options"].index(default_value)
                except ValueError:
                    index = 0
                if len(param_def["options"]) > 1:
                    param_def["default"] = index / (len(param_def["options"]) - 1)
                else:
                    param_def["default"] = 0.0
            else:
                # 数值型参数：int 或 float
                param_def["min"] = param_info["min"]
                param_def["max"] = param_info["max"]
                default_value = param_info["value"]
                param_def["default"] = (default_value - param_def["min"]) / (param_def["max"] - param_def["min"])
            self.param_list.append(param_def)

        self.num_params = len(self.param_list)
        self.observation_space = spaces.Box(low=0.0, high=1.0, shape=(self.num_params,), dtype=np.float32)
        # 动作空间为 Tuple：(参数索引, delta)
        self.action_space = spaces.Tuple((
            spaces.Discrete(self.num_params),
            spaces.Box(low=-0.1, high=0.1, shape=(1,), dtype=np.float32)
        ))
        self.state = self._init_state()

    def _init_state(self):
        # 初始状态为各参数归一化后的默认值
        state = np.array([p["default"] for p in self.param_list], dtype=np.float32)
        return state

    def _denormalize(self, state):
        """
        将归一化的 state 转换为实际的参数值，返回格式为平铺字典：
        { "param_0": actual_value, "param_1": actual_value, ... }
        """
        actual_params = {}
        for i, param_def in enumerate(self.param_list):
            norm_value = state[i]
            if param_def["type"] in ["int", "float"]:
                value = param_def["min"] + norm_value * (param_def["max"] - param_def["min"])
                if param_def["type"] == "int":
                    value = int(round(value))
            elif param_def["type"] == "str":
                options = param_def["options"]
                index = int(round(norm_value * (len(options) - 1)))
                index = max(0, min(index, len(options) - 1))
                value = options[index]
            actual_params[param_def["id"]] = value
        return actual_params

    def _simulate_performance(self, actual_params):
        """
        根据实际参数生成交易信号，并利用回测结果计算策略表现
        此处仅为示例，返回随机 reward 值
        """
        tradeCount = 0
        successCount = 0
        profitCount = 0
        avgReturnList = []

        restored_strategy = restore_indicators(self.new_strategy, actual_params)
        process_strategy = process_data(restored_strategy)

        for stock in self.virtual_prices:
            for indicator in process_strategy["indicators"]:
                long = execute_expr(indicator["long"], stock)
                short = execute_expr(indicator["short"], stock)
                long = CustomList(long)
                short = CustomList(short)
                trade_origin = process_trades(long, short)
                price, trade = updatePeriod(stock, trade_origin, process_strategy["evaluation"]["startDate"], process_strategy["evaluation"]["endDate"])
                res_singlestock = calBacktest(price, trade, process_strategy["evaluation"]["ahead"])
                tradeCount += len(res_singlestock[0])
                if len(res_singlestock[0]) == 0:
                    continue
                successCount += sum(res_singlestock[0])
                profitCount += res_singlestock[1][-1]
                for r in res_singlestock[2]:
                    avgReturnList.append(r)

        if tradeCount:
            return successCount / tradeCount
        else:
            return 0

    def step(self, action):
        """
        执行动作，更新状态，并返回 (observation, reward, terminated, truncated, info)
        """
        param_index, delta_arr = action
        delta = float(delta_arr[0])
        param_def = self.param_list[param_index]
        # 对于离散型参数（字符串），使用其唯一 id 取值
        if param_def["type"] == "str":
            options = param_def["options"]
            current_actual = self._denormalize(self.state)[param_def["id"]]
            try:
                current_index = options.index(current_actual)
            except ValueError:
                # 如果当前值不在 options 中，则取默认位置 0
                current_index = 0
            # 更大的变化幅度：直接将delta映射为-1, 0, 1的变化
            # 这里将小的delta[-0.1, 0.1]转换为更大的范围[-1, 1]
            delta_sign = 1 if delta > 0.02 else (-1 if delta < -0.02 else 0)
            new_index = (current_index + delta_sign) % len(options)
            self.state[param_index] = new_index / (len(options) - 1) if len(options) > 1 else 0.0
        else:
            # 数值型参数，在 min 和 max 之间调整
            min_val = param_def["min"]
            max_val = param_def["max"]
            current_value = self._denormalize(self.state)[param_def["id"]]
            # new_value = np.clip(current_value + delta, min_val, max_val)
            new_value = np.clip(current_value + delta * (max_val - min_val), min_val, max_val)
            norm_new_value = (new_value - min_val) / (max_val - min_val)
            self.state[param_index] = norm_new_value

        actual_params = self._denormalize(self.state)
        reward = self._simulate_performance(actual_params)
        logger.info(f"当前步骤: {self.current_step}")
        logger.info(f"当前参数状态: {self.state}")
        logger.info(f"当前参数: {actual_params}")
        logger.info(f"对应的 reward 值: {reward}")

        self.current_step += 1
        terminated = False
        truncated = self.current_step >= self.max_steps
        info = {"actual_params": actual_params, "performance": reward}
        if reward > self.best_reward:
            self.best_reward = reward
            self.best_params = actual_params
            print(f"发现更好的参数组合! Reward: {reward}")
            print(f"最佳参数: {actual_params}")
        return self.state.copy(), reward, terminated, truncated, info

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.current_step = 0
        self.state = self._init_state()
        return self.state.copy(), {}

    def render(self, mode="human"):
        actual_params = self._denormalize(self.state)
        print("当前参数配置:", actual_params)

class DiscretizedActionWrapper(gym.ActionWrapper):
    """
    将原环境动作空间离散化，将 (param_index, delta) 转换为一个离散整数
    """
    def __init__(self, env, delta_values=[-0.3, -0.15, 0, 0.15, 0.3]):
        super(DiscretizedActionWrapper, self).__init__(env)
        self.delta_values = delta_values
        self.num_deltas = len(delta_values)
        self.num_params = env.action_space.spaces[0].n
        self.action_space = spaces.Discrete(self.num_params * self.num_deltas)

    def action(self, action):
        param_index = action // self.num_deltas
        delta_index = action % self.num_deltas
        delta = np.array([self.delta_values[delta_index]], dtype=np.float32)
        return (param_index, delta)

class BestParamsCallback(BaseCallback):
    def __init__(self, verbose=0):
        super(BestParamsCallback, self).__init__(verbose)
        self.best_reward = -float('inf')
        self.best_params = None

    def _on_step(self):
        # 在每个步骤后检查是否有新的最佳参数
        if self.training_env.get_attr('best_reward')[0] > self.best_reward:
            self.best_reward = self.training_env.get_attr('best_reward')[0]
            self.best_params = self.training_env.get_attr('best_params')[0]
            logger.info(f"新的最佳参数! Reward: {self.best_reward}")
            logger.info(f"参数: {self.best_params}")

            # 保存最佳参数到文件
            with open('best_params.json', 'w') as f:
                json.dump({
                    'best_reward': self.best_reward,
                    'best_params': self.best_params
                }, f, indent=2)

        return True
