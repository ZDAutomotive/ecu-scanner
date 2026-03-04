# ECU 扫码验证系统 - 业务流程泳道图

## 完整业务流程

```mermaid
sequenceDiagram
    participant 扫码枪
    participant SerialListener
    participant ValidationService
    participant Database
    participant WebSocket
    participant 前端
    participant 用户

    rect rgb(240, 248, 255)
        Note over 扫码枪, SerialListener: 场景1: 自动扫码 (实时)
        扫码枪->>SerialListener: 发送条码数据 (串口)
        SerialListener->>SerialListener: 读取缓冲数据
        SerialListener->>ValidationService: process_scan(barcode)

        rect rgb(255, 250, 240)
            Note over ValidationService, Database: 校验流程
            ValidationService->>ValidationService: validate_format() 格式校验
            alt 格式无效
                ValidationService-->>WebSocket: 返回失败状态
            else 格式有效
                ValidationService->>ValidationService: parse_barcode() 解析条码
                ValidationService->>ValidationService: determine_control_domain() 确定控制域
                ValidationService->>Database: check_duplicate() 防重校验
                alt 已存在成功记录
                    ValidationService-->>WebSocket: 返回 duplicate 状态
                else 无重复
                    ValidationService->>Database: validate_hw_id() HW ID 校验
                    alt HW ID 不匹配
                        ValidationService-->>WebSocket: 返回 failed 状态
                    else HW ID 匹配
                        ValidationService->>Database: 创建 ScanRecord (success)
                        ValidationService-->>WebSocket: 返回 success 状态
                    end
                end
            end
        end

        WebSocket->>前端: 推送扫码结果
        前端->>用户: 显示 PASS/FAIL 状态
    end

    rect rgb(240, 255, 240)
        Note over 用户, ValidationService: 场景2: 手动扫码
        用户->>前端: 输入条码
        前端->>ValidationService: POST /api/scan
        ValidationService->>ValidationService: process_scan() 同上
        ValidationService-->>前端: 返回结果
        前端->>用户: 显示结果
    end

    rect rgb(255, 245, 230)
        Note over 前端, Database: 场景3: 数据管理
        用户->>前端: 查询/筛选
        前端->>Database: GET /api/scan-records
        Database-->>前端: 返回记录列表
        前端->>用户: 显示表格

        用户->>前端: 导出 CSV
        前端->>Database: GET /api/export/csv
        Database-->>前端: 返回 CSV 文件
    end

    rect rgb(245, 240, 255)
        Note over 前端, Database: 场景4: 系统配置
        用户->>前端: 添加控制域
        前端->>Database: POST /api/control-domains
        Database-->>前端: 返回成功

        用户->>前端: 添加硬件配置
        前端->>Database: POST /api/hardware-config
        Database-->>前端: 返回成功
    end
```

## 核心模块交互

```mermaid
flowchart TB
    subgraph 硬件层
        扫码枪[扫码枪<br/>Honeywell 1950g]
        PC[工控PC]
    end

    subgraph 后端服务
        SerialListener[SerialListener<br/>串口监听]
        Validation[ValidationService<br/>校验服务]
        Routes[API Routes<br/>路由]
        WebSocketMgr[ConnectionManager<br/>WebSocket管理]
    end

    subgraph 数据层
        SQLite[(SQLite<br/>数据库)]
    end

    subgraph 前端
        WebSocket[WebSocket客户端]
        Dashboard[Dashboard<br/>扫码工作站]
        Management[Management<br/>数据管理]
        Settings[Settings<br/>系统设置]
    end

    扫码枪 -- 串口 --> SerialListener
    SerialListener --> Validation
    Validation --> SQLite
    Validation --> WebSocketMgr
    WebSocketMgr --> WebSocket

    Routes --> Validation
    Routes --> SQLite

    WebSocket --> Dashboard
    Dashboard --> 用户
    Management --> 用户
    Settings --> 用户
```

## API 端点汇总

| 模块 | 端点 | 方法 | 说明 |
|------|------|------|------|
| **健康检查** | `/` | GET | API 状态 |
| | `/api/health` | GET | 健康检查 |
| **扫码** | `/api/scan` | POST | 手动扫码 |
| | `/ws/scan` | WebSocket | 实时推送 |
| **串口** | `/api/serial/status` | GET | 获取串口状态 |
| | `/api/serial/connect` | POST | 连接串口 |
| | `/api/serial/disconnect` | POST | 断开串口 |
| **控制域** | `/api/control-domains` | GET | 获取控制域列表 |
| | `/api/control-domains` | POST | 创建控制域 |
| **硬件配置** | `/api/hardware-config` | GET | 获取硬件配置 |
| | `/api/hardware-config` | POST | 创建硬件配置 |
| **扫码记录** | `/api/scan-records` | GET | 获取扫码记录 |
| **刷写记录** | `/api/flash-records` | GET | 获取刷写记录 |
| | `/api/flash-records` | POST | 创建刷写记录 |
| **统计** | `/api/statistics/coverage` | GET | 获取覆盖率统计 |
| **导出** | `/api/export/csv` | GET | 导出CSV |

## 状态流转

```mermaid
stateDiagram-v2
    [*] --> 等待扫码

    等待扫码 --> 解析中: 收到条码
    解析中 --> 格式校验

    格式校验 --> 格式失败: 格式无效
    格式失败 --> 显示FAIL

    格式校验 --> 解析条码: 格式有效
    解析条码 --> 防重校验

    防重校验 --> 重复扫码: SN已存在
    重复扫码 --> 显示重复

    防重校验 --> HW校验: SN唯一
    HW校验 --> HW不匹配: HW ID不符
    HW不匹配 --> 显示FAIL

    HW校验 --> HW匹配: HW ID符合
    HW匹配 --> 记录成功
    记录成功 --> 显示PASS
    显示PASS --> 等待扫码

    显示FAIL --> 等待扫码
    显示重复 --> 等待扫码
```

## 数据库表结构

### scan_records (扫码流水表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| barcode | String | 原始条码 |
| part_number | String | 零件号 |
| hardware_id | String | 硬件号 |
| serial_number | String | 序列号 |
| control_domain | String | 控制域 |
| status | String | 状态(pending/success/failed/duplicate) |
| error_message | String | 错误信息 |
| scanned_at | DateTime | 扫码时间 |

### flash_records (刷写状态表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| serial_number | String | 序列号 |
| part_number | String | 零件号 |
| hardware_id | String | 硬件号 |
| control_domain | String | 控制域 |
| flash_status | String | 刷写状态 |
| flash_result | String | 刷写结果 |
| flashed_at | DateTime | 刷写时间 |

### control_domain_config (控制域配置)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| name | String | 名称 |
| domain_code | String | 代码 |
| description | String | 描述 |
| created_at | DateTime | 创建时间 |

### hardware_config (硬件配置)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| part_number | String | 零件号 |
| hardware_id | String | 硬件号 |
| control_domain | String | 控制域 |
| description | String | 描述 |
| is_active | Integer | 是否启用 |
| created_at | DateTime | 创建时间 |
