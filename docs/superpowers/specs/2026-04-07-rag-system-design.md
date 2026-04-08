# RAG 系统设计文档

**日期：** 2026-04-07  
**目标：** 构建一个面向特定领域知识库的 RAG 系统，支持混合格式文档摄入、高精度检索和可插拔 LLM，用于面试准备和实际生产原型。  
**技术栈：** Python 3.11+、FastAPI、Qdrant、pymupdf、beautifulsoup4、tiktoken

---

## 1. 整体架构

系统分为两条独立流水线：**摄入流水线**和**查询流水线**，通过 Qdrant 向量数据库衔接。

### 摄入流水线

```
原始文档（PDF / Markdown / HTML / 网页 URL）
    → Document Loader（按类型分发）
    → Dedup & Version Manager（内容哈希去重，版本检测）
    → Hierarchical Chunker（父子两级分块）
    → Embedder（可插拔：OpenAI / 本地模型）
    → Qdrant（向量 + BM25 索引 + 元数据）
    ↑
AsyncJobQueue（异步执行，返回 job_id 供轮询）
```

### 查询流水线

```
用户问题（HTTP POST）
    → ConversationManager（多轮历史管理 + 问题改写消歧）
    → HyDE（可选：生成假设答案辅助检索）
    → 混合检索（Vector Search + BM25，RRF 融合）
    → Reranker（Cross-Encoder 二次精排）
    → 父块召回（用 child chunk 的 parent_id 取完整上下文）
    → Prompt Builder
    → LLM Client（可插拔：OpenAI / Anthropic / Ollama）
    → 答案 + 来源引用 + 链路追踪信息
```

---

## 2. 模块职责

| 模块 | 职责 |
|------|------|
| `loaders/` | PDF（pymupdf）、Markdown、HTML（beautifulsoup4）各一个 Loader，统一输出 `Document` 对象 |
| `chunker/` | 父子两级分块：parent ~512 token（无 overlap），child ~128 token（overlap 20 token） |
| `dedup/` | 内容哈希（SHA-256）去重；文档更新时标记新版本，清理旧 chunk |
| `embedder/` | `BaseEmbedder` 抽象接口 + OpenAI text-embedding-3-small / 本地 sentence-transformers 实现 |
| `vectorstore/` | 封装 Qdrant Python SDK：向量 upsert/search + BM25 稀疏索引 |
| `retriever/` | 混合检索：Vector Top-20 + BM25 Top-20，RRF 算法融合排名，输出 Top-10 |
| `reranker/` | `BaseReranker` 抽象接口 + Cross-Encoder（`cross-encoder/ms-marco-MiniLM-L-6-v2`）实现，精排至 Top-3~5 |
| `hyde/` | 调用 LLM 生成假设答案，与原始问题 embedding 取平均后用于检索 |
| `conversation/` | 维护对话历史（内存 / Redis 可选）；调用 LLM 将指代词改写为完整独立问题 |
| `llm/` | `BaseLLM` 抽象接口 + OpenAI / Anthropic Claude / Ollama 三种实现 |
| `prompt/` | RAG prompt 模板：system 角色定义 + 上下文注入 + 问题 |
| `eval/` | 实现 Faithfulness（答案是否忠于上下文）和 Answer Relevance（答案是否回答了问题）评估指标 |
| `tracing/` | 结构化日志；每步记录耗时、检索分数、chunk 来源，随查询结果返回 |
| `jobs/` | 基于 `asyncio.Task` 的异步摄入队列；支持 job 状态查询 |
| `api/` | FastAPI 路由：ingestion / query / conversation / eval / jobs / documents 六组端点 |

---

## 3. 数据模型

```python
class Document:
    id: str                        # SHA-256 内容哈希，用于去重
    source: str                    # 文件路径或 URL
    content: str                   # 原始文本
    version: int                   # 版本号，更新时递增
    metadata: dict                 # 文件类型、页码、标题、摄入时间等

class Chunk:
    id: str
    document_id: str
    content: str
    parent_id: str | None          # 父块 ID（仅 child chunk 有值）
    level: Literal["parent", "child"]
    metadata: dict
    embedding: list[float] | None

class Message:
    role: Literal["user", "assistant"]
    content: str

class Conversation:
    id: str
    messages: list[Message]
    created_at: datetime

class TraceInfo:
    query_rewrite: str | None      # 改写后的问题
    hyde_doc: str | None           # HyDE 生成的假设文档
    retrieval_scores: list[float]  # RRF 分数
    rerank_scores: list[float]     # Cross-Encoder 分数
    timings: dict[str, float]      # 各步耗时（ms）

class QueryResult:
    answer: str
    sources: list[Chunk]
    trace: TraceInfo
```

---

## 4. REST API 端点

### 摄入
```
POST   /ingest                body: {path_or_url: str, doc_type: "pdf"|"markdown"|"html"|"url"}  → {job_id: str}
GET    /jobs/{job_id}         → {status, progress, error}
```

### 查询
```
POST   /query                 body: {question: str, conversation_id?: str, use_hyde?: bool}
                              → QueryResult
```

### 对话
```
POST   /conversations         → {conversation_id: str}
GET    /conversations/{id}    → Conversation
DELETE /conversations/{id}    → 204
```

### 评估
```
POST   /eval                  body: {question: str, answer: str, contexts: list[str]}
                              → {faithfulness: float, answer_relevance: float}
```

### 文档管理
```
GET    /documents             → list[{id, source, version, chunk_count}]
DELETE /documents/{id}        → 删除文档及其所有 chunk，返回 204
```

---

## 5. 可插拔接口（抽象基类）

```python
class BaseEmbedder(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...

class BaseLLM(ABC):
    @abstractmethod
    def generate(self, messages: list[Message]) -> str: ...

class BaseReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, chunks: list[Chunk]) -> list[Chunk]: ...
```

通过依赖注入（构造函数传入实例），切换实现无需修改业务逻辑。

---

## 6. 数据流详情

### 摄入流

1. API 接收文件路径或 URL，创建 Job 记录，立即返回 `job_id`
2. 异步任务启动：
   - Loader 按 `doc_type` 分发解析，输出 `Document`
   - Dedup：计算内容 SHA-256。若哈希已存在（完全相同内容）则跳过。若 source 路径相同但哈希不同（文件已更新），则递增版本号、清理旧 chunk、继续摄入新内容
   - Hierarchical Chunker：先切 parent chunk，再在每个 parent 内切 child chunk
   - Embedder 批量向量化所有 child chunk（batch size=32）
   - Qdrant upsert：child chunk 存向量 + BM25 稀疏向量；parent chunk 仅存文本和元数据
3. Job 状态更新为 `completed` 或 `failed`（附错误信息）

### 查询流

1. 收到问题，若有 `conversation_id` 则加载历史，LLM 改写为独立完整问题
2. 若 `use_hyde=true`：LLM 生成假设答案，与改写后问题的 embedding 取平均
3. 并行执行 Vector Search 和 BM25 Search，各取 Top-20
4. RRF 融合：`score = Σ 1/(k + rank_i)`，k=60，合并排名取 Top-10
5. Cross-Encoder 对 Top-10 逐一打分，按分数降序取 Top-5
6. 用 Top-5 child chunk 的 `parent_id` 从 Qdrant 取完整 parent chunk 作为上下文
7. Prompt Builder 拼装：system 角色 + 编号上下文 + 原始问题
8. LLM 生成答案，TraceInfo 记录全链路数据
9. 返回答案、source chunk 列表、trace 信息

---

## 7. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 文档解析失败（格式损坏等） | Job 标记 `failed`，记录具体原因，不影响其他 Job |
| Embedding 服务超时 | 指数退避重试 3 次（1s / 2s / 4s），仍失败则 Job `failed` |
| Qdrant 不可用 | 查询返回 HTTP 503；摄入任务暂停并等待重连 |
| LLM 返回异常或空响应 | 降级响应："无法生成答案，以下是检索到的相关片段：[sources]" |
| 检索相似度全低于阈值（默认 0.5） | 拒绝回答："在知识库中未找到与该问题相关的内容。" |
| conversation_id 不存在 | 返回 HTTP 404，不自动创建新会话 |

---

## 8. 测试策略

- **单元测试**：每个模块独立测试（Chunker 分块大小和 overlap、RRF 排名逻辑、Prompt 模板渲染、哈希去重逻辑）
- **集成测试**：用 `testcontainers-python` 启动真实 Qdrant 容器，跑完整摄入 → 查询链路
- **评估基准**：准备 20 个领域问答对，摄入对应文档后跑 `/eval`，记录 Faithfulness 和 Answer Relevance 分数作为回归基准；目标 Faithfulness ≥ 0.8

---

## 9. 实现阶段划分

### Phase 1：核心可运行
`loaders` → `chunker` → `embedder` → `vectorstore` → `api` (query + ingest)

### Phase 2：检索增强
`retriever`（混合检索 + RRF）→ `reranker` → `hyde` → `dedup`

### Phase 3：对话与可观测性
`conversation` → `tracing` → `jobs`（异步队列）→ `eval`

---

## 10. 目录结构

```
rag-system/
├── app/
│   ├── api/            # FastAPI 路由
│   ├── loaders/        # PDF / MD / HTML Loader
│   ├── chunker/        # 层级分块
│   ├── dedup/          # 去重和版本管理
│   ├── embedder/       # 向量化（可插拔）
│   ├── vectorstore/    # Qdrant 封装
│   ├── retriever/      # 混合检索 + RRF
│   ├── reranker/       # Cross-Encoder 精排
│   ├── hyde/           # 假设文档生成
│   ├── conversation/   # 多轮对话管理
│   ├── llm/            # LLM 客户端（可插拔）
│   ├── prompt/         # Prompt 模板
│   ├── eval/           # 评估指标
│   ├── tracing/        # 链路追踪
│   ├── jobs/           # 异步任务队列
│   └── models.py       # 全局数据模型
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   └── superpowers/specs/
├── docker-compose.yml  # Qdrant 本地部署
├── pyproject.toml
└── README.md
```
