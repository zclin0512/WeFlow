# welive 最终用法文档

本文只说明 `welive` 的调用方式。所有命令默认输出到 stdout；多数业务命令输出 JSON，native 返回非 0 状态时进程也会以失败退出。

## 快速起步

Windows：

```powershell
$exe = ".\welive.exe"
& $exe init
# 首次运行会在程序目录创建 welive.yaml；填好后即可直接使用：
& $exe sessions
& $exe messages --session-id "wxid_xxx" --limit 20
& $exe export-all-sessions --out-dir "C:\tmp\welive_export"
```

Linux/macOS：

```bash
./welive init
# 首次运行会在程序目录创建 welive.yaml；填好后即可直接使用：
./welive sessions
./welive messages --session-id wxid_xxx --limit 20
./welive export-all-sessions --out-dir /tmp/welive_export
```

不使用本地 state 时，也可以每次显式传全局参数：

```powershell
& $exe --session-db "C:\path\to\db_storage\session\session.db" --key "<hex-key>" --my-wxid "wxid_me" sessions
```

## 通用规则

基本格式：

```text
welive [全局参数] <命令> [命令参数]
```

全局参数：

| 参数 | 做什么 | 对返回/解析的影响 |
| --- | --- | --- |
| `--config PATH` | 指定 `welive.yaml` 路径。默认会自动查找当前目录、程序目录，以及当前目录/仓库下的 `dist/welive-<platform>-<arch>/welive.yaml`；配合 `--state-dir` 时读取 `DIR/welive.yaml`。 | 不直接改变业务 JSON 字段；影响 CLI 从哪里读取 `session_db`、`db_key`、账号目录和图片密钥。 |
| `--state-dir DIR` | 指定本地状态目录，里面保存 `welive.yaml` 和服务任务输出；未指定时使用当前运行目录。 | `task result` 的 `stdout_path`/`stderr_path` 会落在该目录下；`init` 会把配置写到 `DIR/welive.yaml`。 |
| `--addr HOST:PORT` | 指定服务地址，默认 `127.0.0.1:7676`；`web` 默认 `127.0.0.1:18080`；`monitor sse` 默认 `127.0.0.1:8788`。 | `service`、`task`、`web`、`monitor sse` 使用该地址；返回中的 `addr`/`url` 会体现该值。 |
| `--session-db PATH` | 指定账号的 `session.db`。账号业务命令需要它，除非已 `init`。 | 决定读取哪个账号；不会在普通业务返回里回显，`init` 和部分状态接口会返回脱敏前路径，请外发日志时自行替换为 `C:\path\to\session.db`。 |
| `--key HEX` | 指定数据库 hex key。账号业务命令需要它，除非已 `init`。也可写成 `--key @PATH` 从文件读取。 | 只用于解密数据库；CLI 不会在成功返回中回显密钥。不要把真实 key 放进 issue、日志或任务参数截图。 |
| `--my-wxid WXID` | 指定当前账号 wxid，用于判断自己发出的消息和解析导出。 | 影响 `messages`/`search`/`export-session --parse-content` 中 `sender_username`、自己发送消息判断、语音候选查找和 `export-all-sessions --scope private` 口径。 |


运行时依赖：

| 项目 | 说明 |
| --- | --- |
| 语音解码 | 使用内置原生 SILK C SDK + Rust FFI，不需要 Node.js、`node_modules` 或 `silk-wasm`。 |
| 图片解密 | DAT/XOR/AES/WXGF 内嵌图片由 CLI 直接处理，输出实际图片路径。 |
| `ffmpeg` | 仅作为 WXGF/HEVC 图片转换兜底；未安装时不会影响普通图片和语音导出。可用 `WELIVE_FFMPEG` 指定路径。 |

会话参数规则：

| 写法 | 适用命令 |
| --- | --- |
| `--session-id ID` | 消息、导出、媒体、反撤回等会话命令。 |
| `--username ID` | `take_session_arg` 支持的命令可用作 `--session-id` 的别名。 |

文件参数规则：

| 写法 | 适用参数 |
| --- | --- |
| `@PATH` | `--usernames-json`、`--chatroom-ids-json`、`--session-ids-json`、`--requests-json`、`--candidates-json`、`--create-sql` 支持从文件读取。 |
| 普通字符串 | `--sql` 按字面 SQL 字符串传入，不会展开 `@PATH`。 |

本地状态目录优先级：

1. `--state-dir DIR`
2. 环境变量 `WELIVE_WCDB_STATE_DIR`
3. 当前运行目录

## 初始化

推荐方式：

```powershell
& $exe init
```

如果 `welive.yaml` 不存在，这次命令只会创建模板并提示填写。用户填入下面几个值后，再执行一次 `welive init` 即完成初始化：

```yaml
# Example: C:\Users\you\Documents\xwechat_files
database_root: 'C:\Users\you\Documents\xwechat_files'
# Example: wxid_xxx_1234
wxid: 'wxid_xxx_1234'
# Example: 64位字符串：:123456789e1d0f6a7b5c3d9e123456782d3e4f5a6b7c8d9e0f1a2b3c4d12345678
db_key: '<hex-key>'
# Example: 0x01
image_xor_key: '0x01'
# Example: b18012345678af7e
image_aes_key: '<aes-key>'
```

`database_root` 必须是包含 wxid 账号目录的 `xwechat_files` 目录，不能直接填账号目录；CLI 会用 `database_root + wxid` 推导 `db_storage/session/session.db`。`wxid` 填账号目录的完整名字，例如 `wxid_xxx_1234`。

指定 YAML 路径：

```powershell
& $exe --config "C:\path\welive.yaml" init
```

兼容旧 env 文件导入：

```powershell
& $exe init --env env.env [--addr HOST:PORT]
```

兼容旧手动初始化：

```powershell
& $exe init --session-db PATH --key HEX `
  [--my-wxid WXID] `
  [--dir ACCOUNT_DIR | --account-dir ACCOUNT_DIR] `
  [--image-xor-key KEY] [--image-aes-key KEY] `
  [--addr HOST:PORT]
```

`welive.yaml` 只需要上面五个字段。旧 `env.env` 导入额外兼容支持的键名：

| 键名 | 含义 |
| --- | --- |
| `session_db`、`sessiondb` | `session.db` 路径。 |
| `dbkey`、`key` | 数据库 hex key。 |
| `wxid`、`my_wxid`、`mywxid` | 当前账号 wxid。 |
| `account_dir`、`accountdir`、`dir` | 账号目录。 |
| `picxorkey`、`image_xor_key`、`imagexorkey` | 图片 DAT XOR key，支持十进制或 `0x53` 这类十六进制字节。 |
| `picaeskey`、`image_aes_key`、`imageaeskey` | 图片 AES key。 |
| `locate`、`wechat_root`、`xwechat_root` | xwechat 根目录；配合 wxid 推导账号目录。 |

如果旧参数或 env 只提供账号目录/session.db，CLI 会尽量反推出父级 `xwechat_files` 并保存成新的五字段 YAML。

## 完整命令索引

| 命令 | 用法 |
| --- | --- |
| `help` | 打印内置帮助。 |
| `bindings` | 打印绑定清单，仅 debug 或 `expose-bindings` 构建可用。 |
| `logs` | 读取 native 日志。 |
| `handle` | 输出当前账号 handle。 |
| `sessions` | 列出会话。 |
| `messages` | 读取会话消息。 |
| `message-count` | 读取单会话消息数。 |
| `message-dates` | 读取单会话消息日期分布。 |
| `message-by-id` | 按 local id 读取单条消息。 |
| `search` | 搜索消息。 |
| `export-session` | 导出单个会话。 |
| `export-all-sessions` | 导出所有匹配会话。 |
| `session-pack` | 一次返回单会话常用信息包。 |
| `contact-pack` | 一次返回联系人常用信息包。 |
| `schema-pack` | 一次返回表结构常用信息包。 |
| `contact`、`contacts` | 查询联系人。 |
| `display-names`、`avatars` | 查询显示名和头像 URL。 |
| `contact-status`、`contact-alias-map`、`contact-friend-flags` | 查询联系人状态、别名、好友标记。 |
| `group-count`、`group-counts`、`group-members`、`group-nicknames`、`chat-room-ext` | 查询群相关信息。 |
| `message-dbs`、`media-dbs`、`message-tables` | 列出消息库、媒体库、会话消息表。 |
| `exec`、`list-tables`、`schema`、`columns`、`time-range` | 数据库查询和表结构读取。 |
| `snapshot-export`、`snapshot-import` | 表快照导出和导入。 |
| `message-meta` | 按消息表读取元信息。 |
| `session-message-counts` | 批量读取会话消息数。 |
| `messages-by-type` | 按消息类型读取消息。 |
| `media-stream` | 扫描图片/视频媒体流。 |
| `voice-data`、`voice-batch`、`media-schema`、`head-images` | 语音、媒体结构和头像图片。 |
| `hardlink-image`、`hardlink-image-batch`、`hardlink-video`、`hardlink-video-batch` | 解析图片或视频 hardlink。 |
| `sns-timeline`、`sns-users`、`sns-guard` | 朋友圈读取和防删除管理。 |
| `emoticon` | 表情 CDN、caption 和自定义表情管理。 |
| `anti-revoke` | 消息反撤回触发器管理。 |
| `update-message`、`delete-message`、`mark-read` | 消息写操作和已读管理。 |
| `monitor` | native 监控管道和 SSE 监听。 |
| `service`、`serve` | 本地任务服务。 |
| `web` | 本地 Web 控制台，映射 CLI 功能、状态和任务输出。 |
| `task`、`agent` | 提交和查询后台任务。 |

## 返回、示例与解析速查

本节里的输出示例都经过脱敏处理：`wxid_peer_***`、`12345@chatroom`、`gh_***`、`C:\path\...`、`012345...` 都是占位值，不要把真实 `wxid`、数据库路径、手机号、URL token、`db_key`、`image_aes_key` 或原始聊天内容贴到公开日志里。示例保留真实返回形态，字段集合仍可能随微信数据库版本和 native 层兼容逻辑略有差异。

通用返回规则：

| 场景 | 返回规则 | 快速解析 |
| --- | --- | --- |
| 普通读取命令 | stdout 通常是 JSON 数组、JSON 对象、数字或字符串；native 状态非 0 时进程退出码为失败。 | `welive sessions \| jq '.[0]'`；PowerShell 可先保存 stdout，再用 `ConvertFrom-Json`。 |
| `messages`、`message-by-id`、`messages-by-type`、`search` | stdout 是解析后的消息 JSON；CLI 会尽量补出 `message_content`、媒体/语音解析字段。 | `jq -r '.[].message_content'`，单条对象用 `jq -r '.message_content'`。 |
| `export-session --jsonl` | 输出文件是 JSONL，一行一条消息；不加 `--out` 时写 stdout。 | `jq -r '.message_content' session.jsonl` 或 PowerShell `Get-Content session.jsonl` 后逐行 `ConvertFrom-Json`。 |
| `export-session --readable` | 输出文件是 Markdown，不是 JSON。 | 适合人工阅读；自动化解析优先用 JSONL。 |
| `export-all-sessions` | stdout 返回总览 JSON；目录中写 `progress.json`、`final_summary.csv`、`session_counts.csv`、`exports/*.jsonl`、`DONE`/`FAILED`。 | 先看 stdout 的 `summary`，再读 `final_summary.csv`；单会话内容读 `exports/<session>.jsonl`。 |
| `task`/`agent` | stdout 是任务控制面 JSON；真正命令 stdout 包在 `task result` 的 `stdout` 字符串里，也写在 `stdout_path` 文件。 | 先取 `.status`/`.progress`；任务完成后取 `.stdout`，如果 stdout 本身是 JSON 再二次解析。 |
| `service run`、`web run`、`monitor sse` | 前台常驻，正常运行时不会结束；监听地址写 stderr 或通过 HTTP/SSE 访问。 | 脚本里用 `service start`、`web start` 或 `task submit`。 |

常用解析片段：

```powershell
# PowerShell：数组 JSON
$sessions = & $exe sessions | ConvertFrom-Json
$sessions | Select-Object username, nick_name, last_time

# PowerShell：JSONL
Get-Content C:\tmp\session.jsonl | ForEach-Object {
  $_ | ConvertFrom-Json | Select-Object create_time, sender_username, message_content
}
```

```bash
# jq：会话 id
welive sessions | jq -r '.[].username'

# jq：消息正文
welive messages --session-id wxid_peer_*** --limit 20 | jq -r '.[].message_content'

# jq：任务结果里的 JSON stdout，分两步更稳
welive task result --id 1 | jq -r '.stdout' > stdout.txt
jq -r '.[].message_content' stdout.txt
```

### 状态、服务、任务和 Web

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `help` | 打印内置帮助；无命令参数。 | 文本帮助，不是 JSON。示例：`welive [--config PATH] ... <command> [args]`。 | 人看即可；脚本通常只检查退出码。 |
| `init` | 初始化本地状态。`--env` 读取旧 env 文件；`--session-db` 指定 `session.db`；`--key` 指定或用 `@PATH` 读取数据库 key；`--my-wxid` 是当前账号；`--dir`/`--account-dir` 是账号目录；`--image-xor-key`/`--image-aes-key` 用于图片解析；`--addr` 保存默认服务地址。 | JSON 对象。首次模板：`{"status":"needs_config","config":"C:\\path\\welive.yaml","message":"created welive.yaml; ..."}`；完成后：`{"status":"ok","config":"C:\\path\\welive.yaml","session_db":"C:\\path\\session.db","my_wxid":"wxid_me_***","addr":"127.0.0.1:7676","key_saved":"true"}`。 | `jq -r '.status'` 判断是否还要填配置；外发前替换 `.config`、`.session_db`。 |
| `bindings` | 打印 native 固定别名绑定清单；仅 debug 或 `expose-bindings` 构建可用。 | JSON 清单或失败文本。示例：`{"exports":[{"alias":"wxa001","signature":"..."}]}`。 | `jq '.exports[]?.alias'`；release 构建可能返回 `bindings is disabled in this build`。 |
| `logs` | 读取 native 层日志；无命令参数。 | JSON 字符串数组。示例：`["2026-06-17 10:00:00 get_sessions done, rows=2"]`。 | `jq -r '.[]'`；日志可能包含本地路径，分享前脱敏。 |
| `monitor start` | 启动 native 监控管道；无命令参数。 | native 原样返回，常见为状态字符串、数字或 JSON。示例：`{"status":"ok"}` 或 `0`。 | 以退出码为准；需要管道名时再跑 `monitor name`。 |
| `monitor name` | 输出当前监控管道名；无命令参数。 | 字符串或 JSON。示例：`\\.\pipe\welive_monitor_1234`。 | PowerShell 直接保存：`$pipe = & $exe monitor name`。 |
| `monitor stop` | 停止 native 监控管道；无命令参数。 | native 原样返回。示例：`{"status":"stopped"}` 或 `0`。 | 脚本检查退出码。 |
| `monitor clear-callback` | 清理 native 监控回调；无命令参数。 | native 原样返回。示例：`{"status":"ok"}` 或 `0`。 | 用于重置监控状态；脚本检查退出码。 |
| `monitor sse` | 前台启动 SSE 服务。`--addr` 是监听地址；`--emit-db-change` 额外推送底层 DB change；`--include-self-sent` 不过滤自己发出的消息。 | stderr 输出监听地址；HTTP `GET /events` 返回 SSE。事件示例：`event: message`，`data: {"session_id":"wxid_peer_***","delta":1,"message":{"local_id":"123","message_content":"你好"}}`。 | 浏览器或 `curl -N` 连接；业务只处理 `event: message`，调试才看 `wcdb-change`。 |
| `service start` | 后台启动任务服务。`--addr` 指定服务地址。 | JSON 对象。示例：`{"status":"started","addr":"127.0.0.1:7676","pid":"12345","workers":"8"}`。 | `jq -r '.status'` 应为 `started`；保存 `.addr` 给后续 `task`。 |
| `service run` | 前台运行任务服务。`--addr` 指定服务地址；需要已保存 state。 | 不结束的前台服务；stderr 示例：`welive service running on 127.0.0.1:7676 with 8 workers`。 | 自动化更推荐 `service start`；健康检查用 `service status`。 |
| `serve` | `service run` 的别名，参数和返回完全相同。 | 同 `service run`。 | 同 `service run`。 |
| `service status` | 查询任务服务。`--addr` 指定服务地址。 | JSON 对象。示例：`{"status":"running"}`。 | `jq -r '.status'`。 |
| `service stop` | 请求任务服务停止。`--addr` 指定服务地址。 | JSON 对象。示例：`{"status":"stopping"}`。 | `jq -r '.status'`；随后可轮询 `service status`。 |
| `web` / `web run` | 前台运行 Web 控制台。`--addr` 指定 Web 地址，默认 `127.0.0.1:18080`。 | 前台服务，stderr 示例：`welive web listening on http://127.0.0.1:18080/`。 | 打开返回 URL；自动化状态查询用 `web status`。 |
| `web start` | 后台启动 Web 控制台。`--addr` 指定 Web 地址。 | JSON 对象。示例：`{"status":"started","addr":"127.0.0.1:18080","url":"http://127.0.0.1:18080/","pid":"12345","workers":"8"}`。 | `jq -r '.url'` 直接拿访问地址。 |
| `web status` | 查询 Web 控制台健康状态。`--addr` 指定 Web 地址。 | JSON 对象。示例：`{"status":"running","addr":"127.0.0.1:18080","url":"http://127.0.0.1:18080/","workers":8,"started_at":1717200000000,"platform":{"os":"windows","arch":"x86_64"}}`。 | `jq -r '.status,.url'`。 |
| `web stop` | 请求 Web 控制台停止。`--addr` 指定 Web 地址。 | HTTP JSON。示例：`{"status":"stopping"}`。 | `jq -r '.status'`。 |
| `task submit` | 提交后台任务。`--addr` 指服务地址；`--` 后面是允许后台执行的 CLI 命令和参数。 | 任务摘要 JSON。示例：`{"id":1,"agent":"ag000001","kind":"read","status":"queued","progress":0,"exit_code":null,"command":["messages","--session-id","wxid_peer_***","--limit","50"]}`。 | 取 `.id` 后轮询 `task status --id N`。 |
| `task status` | 查任务状态。`--addr` 指服务地址；`--id` 可选，不传时查全部。 | 单任务或任务数组 JSON。示例：`{"id":1,"agent":"ag000001","kind":"read","status":"done","progress":100,"exit_code":0,"stdout_bytes":2048,"stderr_bytes":0,"command":[...]}`。 | `jq -r '.status'`；全部任务看 `.tasks[]`。 |
| `task list` | 查询全部任务，是 `task status` 不带 `--id` 的别名。`--addr` 指服务地址。 | JSON 对象。示例：`{"status":"ok","tasks":[{"id":1,"status":"done","progress":100}]}`。 | `jq '.tasks[] \| {id,status,progress}'`。 |
| `task result` | 读取任务结果。`--addr` 指服务地址；`--id` 必填。 | JSON 对象，含命令 stdout/stderr。示例：`{"id":1,"status":"done","progress":100,"exit_code":0,"stdout_path":"C:\\path\\task_000001.stdout","stderr_path":"C:\\path\\task_000001.stderr","stdout":"[{\"local_id\":\"123\",\"message_content\":\"你好\"}]","stderr":"","truncated":false}`。 | 先看 `.exit_code`；大结果读 `.stdout_path`，小结果可二次解析 `.stdout`。 |
| `agent submit`、`agent status`、`agent list`、`agent result` | `task` 的等价别名，参数相同。 | 返回与对应 `task` 命令完全相同。 | 和 `task` 一样解析。 |

### 会话与消息

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `handle` | 输出当前 native 账号 handle；无命令参数。 | 数字。示例：`1`。 | 仅调试用；业务脚本通常不用。 |
| `sessions` | 列出会话；无命令参数。 | JSON 数组，每项是 session 表原始列。示例：`[{"username":"wxid_peer_***","nick_name":"朋友","sort_timestamp":"1717200000","unread_count":"0"}]`。 | `jq -r '.[].username'` 提取会话 id；先 `jq '.[0] \| keys'` 看当前字段。 |
| `messages` | 分页读取会话消息。`--session-id` 指会话；`--username` 是别名；`--limit` 条数；`--offset` 偏移。 | JSON 数组。示例：`[{"local_id":"123","create_time":"1717200000","sender_username":"wxid_peer_***","local_type":"1","message_content":"你好"}]`。 | `jq -r '.[].message_content'`；分页用固定 `--limit` 递增 `--offset`。 |
| `message-count` | 读取单会话消息总数。`--session-id`/`--username` 指会话。 | 数字。示例：`42`。 | 直接转整数；PowerShell `[int](& $exe message-count --session-id wxid_peer_***)`。 |
| `message-dates` | 读取单会话有消息的日期。`--session-id`/`--username` 指会话。 | JSON 字符串数组。示例：`["2024-06-01","2024-06-02"]`。 | `jq -r '.[]'`。 |
| `message-by-id` | 按本地消息 ID 读取单条。`--session-id`/`--username` 指会话；`--local-id` 是消息本地 ID。 | JSON 对象或数组，取决于 native 返回；常见对象示例：`{"local_id":"123","create_time":"1717200000","message_content":"你好"}`。 | 对象用 `jq -r '.message_content'`；如返回数组则用 `jq -r '.[0].message_content'`。 |
| `search` | 搜索消息。`--keyword` 必填；`--session-id` 可限定会话；`--limit`/`--offset` 分页；`--begin`/`--end` 是 Unix 秒时间范围，0 表示不限制。 | JSON 数组，CLI 会尽量补完整消息字段。示例：`[{"_session_id":"wxid_peer_***","local_id":"123","create_time":"1717200000","search_content":"合同","message_content":"合同已收到"}]`。 | `jq -r '.[] \| ._session_id + " " + .message_content'`。 |
| `session-message-counts` | 批量读取消息数。`--session-ids-json` 是 JSON 数组或 `@PATH`；`--session-id` 可传单个。 | JSON 对象，key 是 session id，value 是数量。示例：`{"wxid_peer_***":42,"12345@chatroom":108}`。 | `jq 'to_entries[] \| {session:.key,count:.value}'`。 |
| `messages-by-type` | 按消息类型读取。`--session-id`/`--username` 指会话；`--type` 是本地消息类型；`--asc` 升序；`--limit`/`--offset` 分页。 | JSON 数组，字段类似 `messages`，并可能含 `db_path`、`table_name`。示例：`[{"local_type":"3","local_id":"456","message_content":"[图片]","db_path":"C:\\path\\message.db"}]`。 | 图片消息常用 `--type 3`；语音常用 `--type 34`；先 `jq '.[0]'` 看字段。 |
| `message-meta` | 按消息库路径和表名读取元信息。`--db-path` 是消息库；`--table` 是消息表；`--limit`/`--offset` 分页。 | JSON 数组，常见含 `local_id`、`create_time`、`sort_seq`、类型和库表信息。示例：`[{"local_id":"123","create_time":"1717200000","sort_seq":"1717200000000"}]`。 | `jq '.[].local_id'`；适合先定位消息再用 `message-by-id`。 |
| `session-pack` | 单会话组合包。`--session-id`/`--username` 指会话；`--limit`/`--offset` 控制内嵌消息片段。 | 包装 JSON。示例：`{"session_id":"wxid_peer_***","message_count":42,"message_dates":["2024-06-01"],"message_tables":["Msg_abc"],"messages":[...],"group_member_count":0,"status":0}`。 | 固定外壳字段可直接取：`jq '.message_count,.messages[0]'`。 |

### 导出

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `export-session` | 导出单会话。`--session-id`/`--username` 指会话；`--out` 写文件；`--batch-size` 每批数量；`--asc` 升序；`--lite` 少列；`--jsonl` 一行一条；`--readable`/`--markdown`/`--md` 输出 Markdown；`--parse-content`/`--parse` 解析内容；`--begin`/`--end` 时间范围；`--keyword` 导出搜索结果；`--media-dir` 写图片/语音；`--account-dir`、`--image-xor-key`、`--image-aes-key` 用于媒体解密；`--key-valid` 与 `--key-sort-seq`/`--key-create-time`/`--key-local-id` 是 keyset 续传起点。 | 写文件时成功通常无 stdout；不传 `--out` 时输出 JSON 数组或 JSONL。JSONL 行示例：`{"local_id":"123","create_time":"1717200000","sender_username":"wxid_peer_***","message_content":"你好"}`；Markdown 示例：`- \`12:00:00\` **朋友**: 你好`。 | 自动化优先 `--jsonl --parse-content --out file.jsonl`，用 `jq -r '.message_content' file.jsonl`；续传保存最后一行的 `sort_seq/create_time/local_id`。 |
| `export-all-sessions` | 批量导出会话。`--out-dir` 必填；`--exports-dir`、`--media-dir`、`--logs-dir`、`--summary`、`--progress`、`--counts` 覆盖默认路径；`--scope` 选择 `all`、`private`、`group`、`official`；`--raw`/`--no-parse-content` 关闭解析；`--batch-size` 批大小；`--account-dir`、`--image-xor-key`、`--image-aes-key` 用于媒体。 | stdout 总览 JSON。示例：`{"status":"ok","out_dir":"C:\\tmp\\welive_export","summary":"C:\\tmp\\welive_export\\final_summary.csv","progress":"C:\\tmp\\welive_export\\progress.json","scope":"all","sessions":"10","completed":"10","failed":"0","elapsed_ms":"12345"}`。目录里写 `DONE`；失败时写 `FAILED`。 | `jq -r '.summary'` 找汇总 CSV；读 `progress.json` 看阶段；读 `exports/*.jsonl` 做内容分析。 |

### 联系人与群

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `contact` | 查询单个联系人。`--username` 是 wxid、群 id 或公众号 id。 | JSON 对象。示例：`{"username":"wxid_peer_***","alias":"alias_***","remark":"朋友","nickName":"昵称"}`；未找到为 `{}`。 | `jq -r '.remark // .nickName // .username'`。 |
| `contacts` | 查询联系人列表或指定联系人集合。`--usernames-json` 是 JSON 数组或 `@PATH`；不传时返回 native 默认范围。 | JSON 数组，常见字段有 `username`、`remark`、`nick_name`、`alias`、`local_type`、`quan_pin`、标签/描述相关可选字段。示例：`[{"username":"wxid_peer_***","remark":"朋友","nick_name":"昵称","local_type":"1"}]`。 | 先 `jq '.[0] \| keys'`；好友可看 `local_type`。 |
| `display-names` | 批量取展示名。`--username` 单个；`--usernames-json` 批量或 `@PATH`。 | JSON 对象。示例：`{"wxid_peer_***":"朋友","12345@chatroom":"项目群"}`。 | `jq -r '."wxid_peer_***"'`；批量用 `to_entries[]`。 |
| `avatars` | 批量取头像 URL。`--username` 单个；`--usernames-json` 批量或 `@PATH`。 | JSON 对象，value 是头像 URL。示例：`{"wxid_peer_***":"https://example.invalid/avatar/..."}`。 | URL 可能含 token，分享前脱敏；`jq -r 'to_entries[] \| .key'` 只取命中用户。 |
| `contact-status` | 批量取联系人状态。`--username` 单个；`--usernames-json` 批量或 `@PATH`。 | JSON 对象。示例：`{"wxid_peer_***":{"isFolded":false,"isMuted":true}}`。 | `jq '."wxid_peer_***".isMuted'` 判断免打扰。 |
| `contact-alias-map` | 批量取微信号/别名。`--username` 单个；`--usernames-json` 批量或 `@PATH`。 | JSON 对象。示例：`{"wxid_peer_***":"alias_***"}`；无别名则可能缺 key。 | `jq -r 'to_entries[] \| [.key,.value] \| @tsv'`。 |
| `contact-friend-flags` | 批量判断好友标记。`--username` 单个；`--usernames-json` 批量或 `@PATH`。 | JSON 对象，value 为布尔值。示例：`{"wxid_peer_***":true,"gh_***":false}`。 | `jq 'to_entries[] \| select(.value == true)'`。 |
| `contact-pack` | 单联系人组合包。`--username` 指联系人。 | 包装 JSON。示例：`{"username":"wxid_peer_***","contact":{"username":"wxid_peer_***"},"display_names":{"wxid_peer_***":"朋友"},"avatar_urls":{},"status_info":{"wxid_peer_***":{"isMuted":false}},"alias_map":{},"friend_flags":{"wxid_peer_***":true},"status":0}`。 | 固定外壳字段直接取：`jq '.display_names,.friend_flags'`。 |
| `group-count` | 取单群人数。`--chatroom-id` 是群 id。 | 数字。示例：`128`。 | 直接转整数。 |
| `group-counts` | 批量取群人数。`--chatroom-id` 单个；`--chatroom-ids-json` 批量或 `@PATH`。 | JSON 对象。示例：`{"12345@chatroom":128,"67890@chatroom":36}`。 | `jq 'to_entries[] \| {room:.key,count:.value}'`。 |
| `group-members` | 取群成员列表。`--chatroom-id` 是群 id。 | JSON 数组或对象数组，native 版本可能不同。示例：`["wxid_a_***","wxid_b_***"]`。 | 如果是数组：`jq -r '.[]'`；如果是对象数组先 `jq '.[0]'`。 |
| `group-nicknames` | 取群成员群昵称。`--chatroom-id` 是群 id。 | JSON 对象。示例：`{"wxid_a_***":"张三","wxid_b_***":"李四"}`。 | `jq -r 'to_entries[] \| [.key,.value] \| @tsv'`。 |
| `chat-room-ext` | 取群扩展 buffer。`--chatroom-id` 是群 id。 | JSON 对象。示例：`{"username":"12345@chatroom","ext_buffer":"0a0b0c..."}`；未找到为 `{}`。 | `ext_buffer` 是 hex，通常给上层解析器继续处理。 |

### 数据库、表结构与快照

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `message-dbs` | 列出消息数据库；无命令参数。 | JSON 字符串数组。示例：`["C:\\path\\message_0.db","C:\\path\\message_1.db"]`。 | `jq -r '.[]'`；路径分享前脱敏。 |
| `media-dbs` | 列出媒体数据库；无命令参数。 | JSON 字符串数组。示例：`["C:\\path\\media_0.db"]`。 | `jq -r '.[]'`。 |
| `message-tables` | 列出会话对应消息表。`--session-id`/`--username` 指会话。 | JSON 字符串数组。示例：`["Msg_abc123"]`。 | `jq -r '.[0]'` 后配合 `schema`/`message-meta`。 |
| `exec` | 执行 SQL 查询。`--kind` 指数据库类型；`--path` 对 message/media/sns/hardlink/biz/bizchat 等外部库通常必填；`--sql` 是字面 SQL，不展开 `@PATH`。 | JSON 数组，每行是列名到字符串值。示例：`[{"n":"42"}]`。 | 计数取 `jq -r '.[0].n'`；只建议查询 SQL，写操作优先用专门命令。 |
| `list-tables` | 列出数据库表。`--kind` 指数据库类型；`--path` 指外部库路径。 | JSON 字符串数组。示例：`["Msg_abc123","Name2Id"]`。 | `jq -r '.[]'`。 |
| `schema` | 读取建表 SQL。`--kind` 指数据库类型；`--table` 表名；`--path` 指外部库路径。 | JSON 对象。示例：`{"success":true,"schema":"CREATE TABLE Msg_abc123 (...)"}`。 | `jq -r '.schema'`；失败看 `.error`。 |
| `columns` | 读取表列名。`--db-path` 数据库路径；`--table` 表名。 | JSON 字符串数组。示例：`["local_id","create_time","message_content"]`。 | `jq -r '.[]'`。 |
| `time-range` | 读取表时间范围。`--db-path` 数据库路径；`--table` 表名。 | JSON 对象。示例：`{"column":"create_time","first_ts":1717200000,"last_ts":1717286400}`。 | `jq '.first_ts,.last_ts'`。 |
| `snapshot-export` | 导出表快照。`--kind`、`--table`、`--out` 必填；`--path` 指外部库路径。 | JSON 对象，并写 `.wfsnap` 文件。示例：`{"success":true,"rows":100,"columns":12,"path":"C:\\tmp\\Msg_abc.wfsnap"}`。 | `jq '.success,.rows'`；快照首行是 magic，第二行是列名 JSON。 |
| `snapshot-import` | 导入表快照。`--kind`、`--table`、`--input` 必填；`--path` 指目标库；`--create-sql` 可直接给 SQL 或 `@PATH`。 | JSON 对象。示例：`{"success":true,"rows":100,"inserted":95,"ignored":5,"malformed":0,"columns":12}`。 | `jq '.inserted,.ignored,.malformed'`。 |
| `schema-pack` | 表结构组合包。`--kind`、`--table` 必填；`--path` 是数据库路径；`--message-db-path` 默认等于 `--path`，用于 `columns`/`time_range`。 | 包装 JSON。示例：`{"kind":"message","path":"C:\\path\\message.db","table":"Msg_abc","schema":{"success":true,"schema":"CREATE TABLE ..."},"tables":["Msg_abc"],"columns":["local_id"],"time_range":{"first_ts":1717200000},"status":0}`。 | 固定外壳取 `jq '.schema,.columns,.time_range'`。 |

### 媒体、语音与头像

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `media-stream` | 扫描图片/视频消息流。`--session-id` 单个；`--session-ids-json` 批量或 `@PATH`；`--media-type` 为 `0` 全部、`1` 图片、`2` 视频；`--begin`/`--end` 时间范围；`--limit`/`--offset` 分页。 | 包装 JSON。示例：`{"items":[{"session_id":"wxid_peer_***","local_id":"456","create_time":"1717200000","media_type":"1","message_content":"[图片]"}],"has_more":false,"status":0}`。 | `jq '.items[]'`；翻页直到 `.has_more` 为 `false`。 |
| `voice-data` | 读取单条语音原始数据。`--session-id`/`--username` 指会话；`--create-time`、`--local-id` 定位消息；`--svr-id` 可加强匹配；`--candidates-json` 是候选用户名数组或 `@PATH`。 | 成功时 stdout 是语音数据 hex 字符串，找不到可能为空字符串。示例：`022153494c4b5f5633...`。 | 保存到文件后按 hex 解码；普通导出语音更推荐 `export-session --parse-content --media-dir`。 |
| `voice-batch` | 批量读取语音。`--requests-json` 是请求数组或 `@PATH`，每项常见含 `session_id`、`create_time`、`local_id`、`svr_id`、`candidates`。 | JSON 数组。示例：`[{"index":"0","session_id":"wxid_peer_***","success":"true","hex":"022153494c4b..."}]`。 | `jq '.[] \| select(.success == "true")'`；字段值可能是字符串形式。 |
| `media-schema` | 摘要媒体库语音表结构。`--db-path` 是 media db 路径。 | JSON 对象。示例：`{"voice_table":"VoiceInfo1","data_col":"voice_data","chat_name_id_col":"chat_name_id","time_col":"create_time","local_id_col":"local_id","svr_id_col":"svr_id","name2id_table":"Name2Id"}`。 | 用于调试语音定位；`jq -r '.voice_table'`。 |
| `head-images` | 读取头像 buffer。`--username` 单个；`--usernames-json` 批量或 `@PATH`。 | JSON 对象，value 通常是 hex。示例：`{"wxid_peer_***":"89504e470d0a..."}`。 | hex 需要再转图片；URL 头像优先用 `avatars`。 |
| `hardlink-image` | 按 MD5 解析图片 hardlink。`--md5` 是图片 MD5；`--account-dir` 是账号目录。 | JSON 对象或 `{}`。示例：`{"hardlink_db_path":"C:\\path\\hardlink.db","dir1":"ab","dir2":"cd","file_name":"012345...dat","full_path":"C:\\path\\Img\\012345...dat"}`。 | `jq -r '.full_path'`；路径存在性需调用方自行检查。 |
| `hardlink-image-batch` | 批量解析图片 hardlink。`--requests-json` 是请求数组或 `@PATH`，每项常见含 `md5`、`account_dir`。 | JSON 数组。示例：`[{"index":0,"md5":"012345...","success":true,"data":{"full_path":"C:\\path\\Img\\012345.dat"}}]`。 | `jq '.[] \| select(.success).data.full_path'`。 |
| `hardlink-video` | 按 MD5 解析视频 hardlink。`--md5` 是视频 MD5；`--db-path` 是 hardlink db。 | JSON 对象或 `{}`。示例：`{"db_path":"C:\\path\\hardlink.db","file_name":"012345.mp4","resolved_md5":"012345"}`。 | `jq -r '.file_name'`。 |
| `hardlink-video-batch` | 批量解析视频 hardlink。`--requests-json` 是请求数组或 `@PATH`，每项常见含 `md5`、`db_path`。 | JSON 数组。示例：`[{"index":0,"md5":"012345...","success":true,"data":{"file_name":"012345.mp4","resolved_md5":"012345"}}]`。 | `jq '.[] \| select(.success).data'`。 |

### 朋友圈、表情和写操作

| 命令 | 命令和参数做什么 | 返回与脱敏示例 | 快速解析 |
| --- | --- | --- | --- |
| `sns-timeline` | 读取朋友圈。`--limit`/`--offset` 分页；`--usernames-json` 限定用户数组或 `@PATH`；`--keyword` 过滤正文；`--start`/`--end` 是 Unix 秒。 | JSON 数组。示例：`[{"tid":"123456","id":"sns_post_***","username":"wxid_peer_***","nickname":"朋友","createTime":1717200000,"contentDesc":"旅行","type":1,"media":[{"url":"https://example.invalid/...","md5":"012345..."}],"likes":["朋友A"],"comments":[{"id":"c1","nickname":"朋友B","content":"好看"}]}]`。 | `jq -r '.[].contentDesc'`；媒体 URL/token 分享前必须脱敏。 |
| `sns-timeline-import` | 从另一份 `sns.db` 增量回写 `SnsTimeLine`。`--source-db` 是源库；`--source-key` 是源库 64 位 hex key 或 `@PATH`；`--source-key-json` 可从 key.json 中提取 key。 | JSON 对象。示例：`{"success":true,"source_rows":100,"inserted":20,"ignored":80,"malformed":0,"columns":12}`。 | 写操作；默认源路径是 `sns\sns.db`，默认尝试读取 `sns\key.json`。 |
| `sns-users` | 读取朋友圈出现过的用户名；无命令参数。 | JSON 字符串数组。示例：`["wxid_peer_***","wxid_friend_***"]`。 | `jq -r '.[]'`。 |
| `sns-guard install` | 安装朋友圈防删除触发器；无命令参数。 | native 原样返回；已安装也按成功处理。示例：`Success` 或 `already_installed`。 | 脚本检查退出码；状态用 `sns-guard check`。 |
| `sns-guard uninstall` | 卸载朋友圈防删除触发器；无命令参数。 | native 原样返回。示例：`Success`。 | 脚本检查退出码。 |
| `sns-guard check` | 检查朋友圈防删除触发器；无命令参数。 | 数字或 native 文本。示例：`1` 表示存在，`0` 表示不存在。 | 转整数判断。 |
| `sns-guard delete-post` | 删除指定朋友圈记录。`--post-id` 是朋友圈 id。 | native 原样返回。示例：`Success`。 | 写操作，先确认 `--post-id`；脚本检查退出码。 |
| `emoticon cdn` | 按 MD5 查表情 CDN。`--db-path` 是 emoticon db；`--md5` 是表情 MD5。 | 字符串 URL 或空。示例：`https://example.invalid/emoticon.gif`。 | URL 可能含 token，分享前脱敏。 |
| `emoticon caption` | 按 MD5 查表情描述。`--db-path` 是 emoticon db；`--md5` 是表情 MD5。 | 字符串。示例：`微笑`。 | 直接作为文本使用。 |
| `emoticon caption-strict` | 严格按 MD5 查表情描述。`--md5` 是表情 MD5，数据库路径由账号状态推导。 | 字符串或空。示例：`谢谢`。 | 直接作为文本使用。 |
| `emoticon add` | 新增自定义表情记录。`--md5` 是表情 MD5；`--cdn-url` 是 CDN URL。 | native 原样返回。示例：`Success`。 | 写操作，脚本检查退出码；URL 分享前脱敏。 |
| `emoticon update` | 更新自定义表情 CDN。`--md5` 是表情 MD5；`--cdn-url` 是新 URL。 | native 原样返回。示例：`Success`。 | 写操作，脚本检查退出码。 |
| `emoticon delete` | 删除自定义表情记录。`--md5` 是表情 MD5。 | native 原样返回。示例：`Success`。 | 写操作，脚本检查退出码。 |
| `anti-revoke install` | 给会话安装反撤回触发器。`--session-id`/`--username` 指会话。 | native 原样返回；`already_installed` 也按成功处理。示例：`Success` 或 `already_installed`。 | 脚本检查退出码；再跑 `anti-revoke check`。 |
| `anti-revoke uninstall` | 卸载会话反撤回触发器。`--session-id`/`--username` 指会话。 | native 原样返回。示例：`Success`。 | 脚本检查退出码。 |
| `anti-revoke check` | 检查会话反撤回触发器。`--session-id`/`--username` 指会话。 | 数字。示例：`1` 表示已安装，`0` 表示未安装。 | 转整数判断。 |
| `update-message` | 更新指定消息正文。`--session-id`/`--username` 指会话；`--local-id` 和 `--create-time` 定位消息；`--content` 是新内容。 | native 文本。示例：`Success`；失败示例：`Message not found across all databases`。 | 写操作，先用 `message-by-id` 复核目标；脚本检查退出码。 |
| `delete-message` | 删除指定消息。`--session-id`/`--username` 指会话；`--local-id` 和 `--create-time` 定位消息；`--db-path-hint` 可把某个消息库排在前面。 | native 文本。示例：`Success`；失败示例：`Message not found across all databases`。 | 写操作，先备份；脚本检查退出码。 |
| `mark-read` | 标记所有会话已读；无命令参数。 | native 文本。示例：`Success`。 | 写操作，脚本检查退出码。 |

## 消息与搜索

```text
sessions
messages --session-id ID [--limit N --offset N]
message-count --session-id ID
message-dates --session-id ID
message-by-id --session-id ID --local-id N
search [--session-id ID] --keyword TEXT [--limit N --offset N --begin TS --end TS]
session-message-counts (--session-ids-json JSON_OR_FILE | --session-id ID)
messages-by-type --session-id ID --type N [--asc --limit N --offset N]
message-meta --db-path PATH --table TABLE [--limit N --offset N]
```

默认值：

| 参数 | 默认值 |
| --- | --- |
| `messages --limit` | `50` |
| `messages --offset` | `0` |
| `search --limit` | `50` |
| `search --offset` | `0` |
| `search --begin`、`--end` | `0`，表示不限制。 |
| `messages-by-type --limit` | `50` |
| `messages-by-type --offset` | `0` |
| `message-meta --limit` | `100` |
| `message-meta --offset` | `0` |

示例：

```powershell
& $exe sessions
& $exe messages --session-id "wxid_xxx" --limit 100 --offset 0
& $exe message-by-id --session-id "wxid_xxx" --local-id 123
& $exe search --keyword "发票" --limit 50
& $exe session-message-counts --session-ids-json '["wxid_a","wxid_b"]'
& $exe messages-by-type --session-id "wxid_xxx" --type 3 --asc --limit 100
```

## 单会话导出

```text
export-session --session-id ID
  [--out PATH]
  [--batch-size N]
  [--asc]
  [--lite]
  [--jsonl]
  [--parse-content | --parse]
  [--begin TS --end TS]
  [--keyword TEXT]
  [--media-dir DIR]
  [--account-dir DIR]
  [--image-xor-key KEY]
  [--image-aes-key KEY]
  [--key-valid --key-sort-seq N --key-create-time TS --key-local-id N]
```

默认值：

| 参数 | 默认值 |
| --- | --- |
| `--batch-size` | `500`；直接 JSONL 文件导出和解析导出时内部至少按 `20000` 使用。 |
| `--begin`、`--end` | `0`，表示不限制。 |
| 输出格式 | 未加 `--jsonl` 时输出 JSON 数组；加 `--jsonl` 时一行一条 JSON。 |

导出原始 JSONL：

```powershell
& $exe export-session --session-id "wxid_xxx" --out "C:\tmp\session_raw.jsonl" --jsonl --asc --batch-size 20000
```

导出并解析内容：

```powershell
& $exe export-session --session-id "wxid_xxx" `
  --out "C:\tmp\session_parsed.jsonl" `
  --jsonl --asc --parse-content `
  --media-dir "C:\tmp\session_media"
```

可选 Markdown 预览导出，适合人工阅读，不建议作为机器解析主格式：

```powershell
& $exe export-session --session-id "wxid_xxx" `
  --out "C:\tmp\session.md" `
  --readable --parse-content `
  --media-dir "C:\tmp\session_media"
```

按关键词导出搜索结果：

```powershell
& $exe export-session --session-id "wxid_xxx" `
  --keyword "合同" `
  --out "C:\tmp\search.jsonl" `
  --jsonl
```

续传或深分页 keyset：

```powershell
& $exe export-session --session-id "wxid_xxx" `
  --out "C:\tmp\part.jsonl" --jsonl `
  --key-valid --key-sort-seq 1710000000000 --key-create-time 1710000000 --key-local-id 123
```

机器解析建议使用 `--jsonl`，一行一条 JSON。`--readable` 只生成按日期分组的 Markdown 预览。`--parse-content`/`--readable` 需要 `--out PATH`。如果要同时解密图片或语音，提供 `--media-dir DIR`；账号目录、图片 XOR、图片 AES 会优先从 `welive.yaml` 自动读取。Web 单会话导出默认使用 `--jsonl --parse-content`，媒体目录自动推导。

## 全量导出

```text
export-all-sessions --out-dir DIR
  [--exports-dir DIR]
  [--media-dir DIR]
  [--logs-dir DIR]
  [--summary PATH]
  [--progress PATH]
  [--counts PATH]
  [--scope all|private|group|official]
  [--raw | --no-parse-content]
  [--batch-size N]
  [--account-dir DIR]
  [--image-xor-key KEY]
  [--image-aes-key KEY]
```

默认输出：

| 路径 | 默认值 |
| --- | --- |
| `--exports-dir` | `<out-dir>/exports` |
| `--media-dir` | `<out-dir>/media` |
| `--logs-dir` | `<out-dir>/logs` |
| `--summary` | `<out-dir>/final_summary.csv` |
| `--progress` | `<out-dir>/progress.json` |
| `--counts` | `<out-dir>/session_counts.csv` |

默认行为：

| 项 | 默认值 |
| --- | --- |
| `--scope` | `all` |
| 解析内容 | 默认解析；`--raw` 或 `--no-parse-content` 关闭解析和媒体处理。 |
| `--batch-size` | `20000` |
| 会话分层 | `huge` 为 `>50000`，`large` 为 `10001..50000`，`medium` 为 `1001..10000`，`small` 为 `1..1000`，`zero` 为 0。 |
| 并发分配 | CLI 会根据 CPU 并行度、导出模式、会话规模和媒体任务自动分配。 |
| 子进程/媒体 worker | CLI 自动按任务分层和机器性能分配，用户无需配置。 |

scope 别名：

| 目标 | 可用值 |
| --- | --- |
| 全部 | `all` |
| 私聊 | `private`、`weflow-private`、`weflow_private` |
| 群聊 | `group`、`groups`、`chatroom`、`chatrooms` |
| 公众号 | `official`、`official-account`、`official_account`、`gh` |

示例：

```powershell
& $exe export-all-sessions --out-dir "C:\tmp\welive_export"
& $exe export-all-sessions --out-dir "C:\tmp\welive_private" --scope private
& $exe export-all-sessions --out-dir "C:\tmp\welive_raw" --raw
```

完成后会写入 `DONE`。如果有失败会写入 `FAILED`，命令最终返回失败，并在 `final_summary.csv` 里记录失败会话、stdout/stderr 路径、行数和耗时。

## 联系人与群

```text
contact --username ID
contacts [--usernames-json JSON_OR_FILE]
display-names (--usernames-json JSON_OR_FILE | --username ID)
avatars (--usernames-json JSON_OR_FILE | --username ID)
contact-status (--usernames-json JSON_OR_FILE | --username ID)
contact-alias-map (--usernames-json JSON_OR_FILE | --username ID)
contact-friend-flags (--usernames-json JSON_OR_FILE | --username ID)
contact-pack --username ID
group-count --chatroom-id ID
group-counts (--chatroom-ids-json JSON_OR_FILE | --chatroom-id ID)
group-members --chatroom-id ID
group-nicknames --chatroom-id ID
chat-room-ext --chatroom-id ID
```

示例：

```powershell
& $exe contact --username "wxid_xxx"
& $exe contacts
& $exe display-names --usernames-json '["wxid_a","wxid_b"]'
& $exe group-members --chatroom-id "12345@chatroom"
& $exe contact-pack --username "wxid_xxx"
```

## 数据库与表

```text
message-dbs
media-dbs
message-tables --session-id ID
exec --kind KIND [--path DB_PATH] --sql SQL
list-tables --kind KIND [--path DB_PATH]
schema --kind KIND --table TABLE [--path DB_PATH]
columns --db-path PATH --table TABLE
time-range --db-path PATH --table TABLE
snapshot-export --kind KIND --table TABLE --out PATH [--path DB_PATH]
snapshot-import --kind KIND --table TABLE --input PATH [--path DB_PATH --create-sql SQL_OR_FILE]
schema-pack --kind KIND --table TABLE [--path DB_PATH --message-db-path DB_PATH]
```

`--kind` 支持：

| kind | 用法 |
| --- | --- |
| `session` | 使用当前账号的 `session.db`，不需要 `--path`。 |
| `contact` | 自动定位 `contact.db`，不需要 `--path`。 |
| `emoticon` | 自动定位表情库，不需要 `--path`。 |
| `message`、`media`、`sns`、`hardlink`、`biz`、`bizchat` | 需要 `--path DB_PATH`。 |

示例：

```powershell
& $exe message-dbs
& $exe media-dbs
& $exe message-tables --session-id "wxid_xxx"
& $exe list-tables --kind message --path "C:\path\message_0.db"
& $exe schema --kind message --path "C:\path\message_0.db" --table "Msg_xxx"
& $exe exec --kind message --path "C:\path\message_0.db" --sql "SELECT COUNT(*) AS n FROM Msg_xxx"
& $exe snapshot-export --kind message --path "C:\path\message_0.db" --table "Msg_xxx" --out "C:\tmp\Msg_xxx.json"
& $exe snapshot-import --kind message --path "C:\path\message_0.db" --table "Msg_copy" --input "C:\tmp\Msg_xxx.json" --create-sql "@C:\tmp\create.sql"
```

## 媒体、语音和头像

```text
media-stream (--session-ids-json JSON_OR_FILE | --session-id ID) [--media-type 0|1|2 --begin TS --end TS --limit N --offset N]
voice-data --session-id ID --create-time TS --local-id N [--svr-id N --candidates-json JSON_OR_FILE]
voice-batch --requests-json JSON_OR_FILE
media-schema --db-path PATH
head-images (--usernames-json JSON_OR_FILE | --username ID)
hardlink-image --md5 MD5 --account-dir DIR
hardlink-image-batch --requests-json JSON_OR_FILE
hardlink-video --md5 MD5 --db-path PATH
hardlink-video-batch --requests-json JSON_OR_FILE
```

默认值：

| 参数 | 默认值 |
| --- | --- |
| `media-stream --media-type` | `0`，同时扫描图片和视频。`1` 只图片，`2` 只视频。 |
| `media-stream --begin`、`--end` | `0`，表示不限制。 |
| `media-stream --limit` | `50` |
| `media-stream --offset` | `0` |
| `voice-data --svr-id` | `0` |
| `voice-data --candidates-json` | `[]` |

示例：

```powershell
& $exe media-stream --session-id "wxid_xxx" --media-type 1 --limit 100
& $exe voice-data --session-id "wxid_xxx" --create-time 1710000000 --local-id 123
& $exe voice-batch --requests-json "@C:\tmp\voice_requests.json"
& $exe head-images --username "wxid_xxx"
& $exe hardlink-image --md5 "0123456789abcdef0123456789abcdef" --account-dir "C:\path\account"
```

解析导出媒体时可用环境变量：

| 环境变量 | 用法 |
| --- | --- |
| `WELIVE_VOICE_BATCH_SIZE` | 覆盖语音批量读取大小，范围会夹在 `128..10000`，默认 `2048`。 |
| `WELIVE_FFMPEG` | 指定 ffmpeg 路径，用于需要 ffmpeg 转换的图片。 |
| `WELIVE_EXPORT_TRACE=1` | 输出导出解析耗时和媒体处理 trace 到 stderr。 |

## 朋友圈

```text
sns-timeline [--limit N --offset N --usernames-json JSON_OR_FILE --keyword TEXT --start TS --end TS]
sns-timeline-import [--source-db PATH --source-key HEX_OR_@PATH --source-key-json PATH]
sns-users
sns-guard install
sns-guard uninstall
sns-guard check
sns-guard delete-post --post-id ID
```

默认值：

| 参数 | 默认值 |
| --- | --- |
| `sns-timeline --limit` | `50` |
| `sns-timeline --offset` | `0` |
| `sns-timeline --usernames-json` | `[]` |
| `sns-timeline --keyword` | 空字符串 |
| `sns-timeline --start`、`--end` | `0`，表示不限制。 |

示例：

```powershell
& $exe sns-users
& $exe sns-timeline --limit 100 --keyword "旅行"
& $exe sns-timeline-import --source-db ".\sns\sns.db" --source-key-json ".\sns\key.json"
& $exe sns-guard install
& $exe sns-guard check
& $exe sns-guard delete-post --post-id "POST_ID"
```

## 表情

```text
emoticon cdn --db-path PATH --md5 MD5
emoticon caption --db-path PATH --md5 MD5
emoticon caption-strict --md5 MD5
emoticon add --md5 MD5 --cdn-url URL
emoticon update --md5 MD5 --cdn-url URL
emoticon delete --md5 MD5
```

示例：

```powershell
& $exe emoticon cdn --db-path "C:\path\emoticon.db" --md5 "0123456789abcdef0123456789abcdef"
& $exe emoticon add --md5 "0123456789abcdef0123456789abcdef" --cdn-url "https://example.com/e.gif"
```

## 写操作

```text
anti-revoke install --session-id ID
anti-revoke uninstall --session-id ID
anti-revoke check --session-id ID
update-message --session-id ID --local-id N --create-time TS --content TEXT
delete-message --session-id ID --local-id N --create-time TS [--db-path-hint PATH]
mark-read
```

示例：

```powershell
& $exe anti-revoke install --session-id "wxid_xxx"
& $exe anti-revoke check --session-id "wxid_xxx"
& $exe update-message --session-id "wxid_xxx" --local-id 123 --create-time 1710000000 --content "new text"
& $exe delete-message --session-id "wxid_xxx" --local-id 123 --create-time 1710000000
& $exe mark-read
```

## 监控与 SSE

```text
monitor start
monitor name
monitor stop
monitor clear-callback
monitor sse [--addr HOST:PORT --emit-db-change --include-self-sent]
```

`monitor sse` 需要已 `init`，或显式提供 `--session-db` 和 `--key`。它监听：

```text
http://HOST:PORT/events
```

示例：

```powershell
& $exe monitor start
& $exe monitor name
& $exe monitor sse --addr "127.0.0.1:8788"
curl.exe -N -H "Accept: text/event-stream" http://127.0.0.1:8788/events
```

SSE 事件：

| 事件 | 含义 |
| --- | --- |
| `ready` | 客户端已连接。 |
| `message` | 监听到变化后补拉出的新消息。 |
| `wcdb-change` | 加 `--emit-db-change` 后输出原始数据库变化事件。 |
| `error` | 补拉消息失败。 |

默认过滤自己发出的消息；加 `--include-self-sent` 后包含自己发出的消息。

## 服务与后台任务

```text
service start [--addr HOST:PORT]
service run [--addr HOST:PORT]
serve [--addr HOST:PORT]
service status [--addr HOST:PORT]
service stop [--addr HOST:PORT]
web [run] [--addr HOST:PORT]
web start [--addr HOST:PORT]
web status [--addr HOST:PORT]
web stop [--addr HOST:PORT]
task submit [--addr HOST:PORT] -- <允许的命令> [参数]
task status [--addr HOST:PORT --id N]
task list [--addr HOST:PORT]
task result [--addr HOST:PORT] --id N
agent submit|status|list|result ...
```

说明：

| 项 | 用法 |
| --- | --- |
| `service start` | 后台启动服务。 |
| `service run` | 前台运行服务。 |
| `serve` | `service run` 的别名。 |
| `web` | 前台运行内置 Web 控制台，默认 `127.0.0.1:18080`。 |
| `web start` | 后台启动 Web 控制台。 |
| 子代理并发 | CLI 根据用户电脑 CPU 并行度自动分配。 |
| `task` 与 `agent` | 两者等价。 |
| 禁止作为任务提交的命令 | `init`、`serve`、`service`、`task`、`agent`、`web`、`help`、`bindings`。 |

示例：

```powershell
& $exe service start --addr "127.0.0.1:7676"
& $exe service status --addr "127.0.0.1:7676"
& $exe task submit --addr "127.0.0.1:7676" -- messages --session-id "wxid_xxx" --limit 50
& $exe task list --addr "127.0.0.1:7676"
& $exe task status --addr "127.0.0.1:7676" --id 1
& $exe task result --addr "127.0.0.1:7676" --id 1
& $exe service stop --addr "127.0.0.1:7676"
```

服务任务依赖已保存的 state；先运行 `init` 再启动服务。

Web 控制台：

```powershell
& $exe web --addr "127.0.0.1:18080"
& $exe web start --addr "127.0.0.1:18080"
& $exe web status --addr "127.0.0.1:18080"
& $exe web stop --addr "127.0.0.1:18080"
```

打开 `http://127.0.0.1:18080/` 后，可以在浏览器内编辑 `welive.yaml`、
运行 CLI 命令、提交长导出任务、查看任务 stdout/stderr 和导出结果路径。
Web 控制台随 Rust 二进制内置发布，不依赖 Node.js；Windows、Linux、macOS
均使用同一套本地 HTTP 映射。

## 信息包命令

```text
session-pack --session-id ID [--limit N --offset N]
contact-pack --username ID
schema-pack --kind KIND --table TABLE [--path DB_PATH --message-db-path DB_PATH]
```

默认值：

| 参数 | 默认值 |
| --- | --- |
| `session-pack --limit` | `50` |
| `session-pack --offset` | `0` |
| `schema-pack --message-db-path` | 默认等于 `--path`。 |

示例：

```powershell
& $exe session-pack --session-id "wxid_xxx" --limit 20
& $exe contact-pack --username "wxid_xxx"
& $exe schema-pack --kind message --path "C:\path\message_0.db" --table "Msg_xxx"
```
