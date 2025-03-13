import gymnasium as gym
from gymnasium import spaces
from utils import setup_logger
from parser import restore_indicators, process_data
from evaluation import *
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3 import DQN
import os
import json

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

    def set_params_state(self, params_dict):
        """
        根据给定的参数字典设置环境的当前状态
        
        参数:
        - params_dict: 包含参数ID和值的字典
        """
        # 将参数字典转换为规范化状态向量
        for i, param_def in enumerate(self.param_list):
            param_id = param_def["id"]
            if param_id in params_dict:
                value = params_dict[param_id]
                
                if param_def["type"] in ["int", "float"]:
                    # 数值型参数归一化
                    norm_value = (value - param_def["min"]) / (param_def["max"] - param_def["min"])
                    self.state[i] = norm_value
                elif param_def["type"] == "str":
                    # 字符串参数查找索引并归一化
                    try:
                        index = param_def["options"].index(value)
                        if len(param_def["options"]) > 1:
                            self.state[i] = index / (len(param_def["options"]) - 1)
                        else:
                            self.state[i] = 0.0
                    except ValueError:
                        # 如果值不在选项中，使用默认值
                        self.state[i] = param_def["default"]
        
        # 重置最佳记录，以便在微调中跟踪新的最佳结果
        self.best_reward = -float('inf')
        self.best_params = None
        
        return self.state.copy()

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

def fine_tune_strategy(raw_strategy_json, model_path="best_strategy_model", best_params_path="best_params.json", 
                      fine_tune_steps=10, stocks_paths=None):
    """
    基于已有的最佳策略和模型进行微调
    
    参数:
    - raw_strategy_json: 原始或修改后的策略json
    - model_path: 之前训练好的模型路径
    - best_params_path: 最佳参数保存的路径
    - fine_tune_steps: 微调步数
    - stocks_paths: 股票数据文件路径列表
    
    返回:
    - 微调后的最佳参数
    """
    # 载入策略
    strategy_json = json.loads(raw_strategy_json) if isinstance(raw_strategy_json, str) else raw_strategy_json
    new_strategy, strategy_config = extract_parameters_from_indicators(strategy_json)
    
    # 载入股票数据
    if stocks_paths is None:
        stocks_paths = [
            "stock/600893.SH.csv",
            "stock/000651.SZ.csv",
            "stock/002241.SZ.csv",
            "stock/002555.SZ.csv",
            "stock/002594.SZ.csv"
        ]
    
    virtual_prices = [pd.read_csv(path) for path in stocks_paths]
    
    # 创建环境
    env = TradingStrategyEnv(new_strategy, strategy_config, virtual_prices, max_steps=fine_tune_steps)
    env = DiscretizedActionWrapper(env)
    
    # 检查是否有最佳参数文件
    if os.path.exists(best_params_path):
        with open(best_params_path, 'r') as f:
            best_data = json.load(f)
            previous_best_params = best_data['best_params']
            
        # 将最佳参数设置为初始状态
        # 需要修改环境类，添加一个设置当前参数的方法
        if hasattr(env.unwrapped, 'set_params_state'):
            env.unwrapped.set_params_state(previous_best_params)
        else:
            logger.warning("环境没有set_params_state方法，无法直接设置最佳参数作为起点")
    else:
        logger.warning(f"没有找到最佳参数文件: {best_params_path}")
    
    # 检查模型是否存在
    if os.path.exists(model_path + ".zip"):
        # 加载模型
        try:
            model = DQN.load(model_path, env=env)
            logger.info("成功加载之前训练的模型")
        except Exception as e:
            logger.error(f"加载模型失败: {e}")
            logger.info("创建新模型")
            model = DQN("MlpPolicy", env, verbose=1)
    else:
        logger.warning(f"没有找到模型文件: {model_path}.zip")
        logger.info("创建新模型")
        model = DQN("MlpPolicy", env, verbose=1)
    
    # 执行微调
    obs, _ = env.reset()
    total_reward = 0
    best_step_reward = -float('inf')
    best_step_params = None
    
    logger.info("开始微调过程...")
    
    for step in range(fine_tune_steps):
        # 使用模型预测动作
        action, _ = model.predict(obs, deterministic=False)  # 使用一定的随机性
        
        # 执行动作
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        
        logger.info(f"微调步骤 {step+1}/{fine_tune_steps}, 奖励: {reward:.4f}")
        
        # 记录这一步的最佳参数
        if reward > best_step_reward:
            best_step_reward = reward
            best_step_params = info["actual_params"].copy()
            logger.info(f"发现更好的参数! 奖励: {reward:.4f}")
            logger.info(f"参数: {best_step_params}")
        
        if terminated or truncated:
            break
    
    # 获取环境中记录的最佳参数
    env_best_reward = env.unwrapped.best_reward
    env_best_params = env.unwrapped.best_params
    
    # 比较环境记录的最佳和步骤中的最佳
    final_best_params = env_best_params if env_best_reward > best_step_reward else best_step_params
    final_best_reward = max(env_best_reward, best_step_reward)
    
    # 保存微调后的最佳参数
    with open('fine_tuned_params.json', 'w') as f:
        json.dump({
            'best_reward': final_best_reward,
            'best_params': final_best_params
        }, f, indent=2)
    
    # 使用最佳参数恢复完整策略
    restored_strategy = restore_indicators(new_strategy, final_best_params)
    with open('fine_tuned_strategy.json', 'w') as f:
        json.dump(restored_strategy, f, indent=2)
    
    logger.info("微调完成")
    logger.info(f"微调后最佳奖励: {final_best_reward:.4f}")
    logger.info(f"微调后最佳参数: {final_best_params}")
    logger.info("参数已保存到 fine_tuned_params.json")
    logger.info("完整策略已保存到 fine_tuned_strategy.json")
    
    return final_best_params, final_best_reward, restored_strategy