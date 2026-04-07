import asyncio
import uuid
from dataclasses import dataclass


@dataclass
class JobStatus:
    job_id: str
    status: str = "pending"
    progress: int = 0
    error: str | None = None


class AsyncJobQueue:
    def __init__(self):
        self._jobs: dict[str, JobStatus] = {}

    async def submit(self, coro) -> str:
        job_id = str(uuid.uuid4())
        self._jobs[job_id] = JobStatus(job_id=job_id, status="pending")
        asyncio.ensure_future(self._run(job_id, coro))
        return job_id

    async def _run(self, job_id: str, coro) -> None:
        self._jobs[job_id].status = "running"
        try:
            await coro
            self._jobs[job_id].status = "completed"
            self._jobs[job_id].progress = 100
        except Exception as exc:
            self._jobs[job_id].status = "failed"
            self._jobs[job_id].error = str(exc)

    def get_status(self, job_id: str) -> JobStatus | None:
        return self._jobs.get(job_id)
